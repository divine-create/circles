import { describe, expect, it } from 'vitest';
import {
  getActiveDatabaseBackend,
  getPgDatabase,
  listAppliedDatabaseMigrations,
  RemotePgClientLike,
  RemotePgPoolLike,
  runDatabaseMigrations,
  setCustomRemotePoolForTesting,
  withRlsTransaction,
  withServiceRoleTransaction,
} from '@/lib/db/postgres';
import {
  ConfigurationError,
  getDatabaseBackendMode,
  getRemoteDatabaseUrl,
} from '@/lib/config/env';
import { registerUser } from '@/features/auth/service';
import { GET as healthGetRoute } from '@/app/api/health/route';

describe('Phase 3: Remote PostgreSQL Pool Executor, Migration Tracking & Supabase Compatibility', () => {
  it('1. Tracks all five migrations in public.schema_migrations in order, enforces idempotency, and blocks non-service_role access to public.user_sessions & public.schema_migrations', async () => {
    const applied = await listAppliedDatabaseMigrations();
    expect(applied.map((m) => m.version)).toEqual([
      '0001',
      '0002',
      '0003',
      '0004',
      '0005',
      '0006',
      '0007',
      '0008',
      '0009',
      '0010',
      '0011',
      '0012',
      '0013',
      '0014',
      '0015',
    ]);
    expect(applied.map((m) => m.filename)).toEqual([
      '0001_initial_schema.sql',
      '0002_security_hardening.sql',
      '0003_staging_rls_and_role_hardening.sql',
      '0004_supabase_staging_compatibility.sql',
      '0005_remaining_capabilities_and_security.sql',
      '0006_courses_and_learning_progress.sql',
      '0007_lesson_interactivity_and_assignments.sql',
      '0008_course_drip_gamification_and_gating.sql',
      '0009_lesson_blocks_and_authoring.sql',
      '0010_question_banks_and_quizzes.sql',
      '0011_learning_paths_and_prerequisites.sql',
      '0012_grant_courses_assessment_and_paths.sql',
      '0013_student_quiz_questions_policy.sql',
      '0014_hyper_configurable_pricing_engine.sql',
      '0015_financial_webhooks_and_integrations.sql',
    ]);
    for (const record of applied) {
      expect(record.checksum).toMatch(/^[a-f0-9]{64}$/);
    }

    // Re-running migrations is a safe no-op
    const rerunResult = await runDatabaseMigrations();
    expect(rerunResult.applied).toEqual([]);
    expect(rerunResult.skipped).toEqual([
      '0001_initial_schema.sql',
      '0002_security_hardening.sql',
      '0003_staging_rls_and_role_hardening.sql',
      '0004_supabase_staging_compatibility.sql',
      '0005_remaining_capabilities_and_security.sql',
      '0006_courses_and_learning_progress.sql',
      '0007_lesson_interactivity_and_assignments.sql',
      '0008_course_drip_gamification_and_gating.sql',
      '0009_lesson_blocks_and_authoring.sql',
      '0010_question_banks_and_quizzes.sql',
      '0011_learning_paths_and_prerequisites.sql',
      '0012_grant_courses_assessment_and_paths.sql',
      '0013_student_quiz_questions_policy.sql',
      '0014_hyper_configurable_pricing_engine.sql',
      '0015_financial_webhooks_and_integrations.sql',
    ]);

    const suffix = Date.now();
    const reg = await registerUser({
      email: `mig-test-${suffix}@example.com`,
      username: `mig_test_${suffix}`,
      displayName: 'Migration Security Tester',
      password: 'Password123!',
    });

    // Ordinary authenticated user and anon cannot read or mutate public.user_sessions or public.schema_migrations
    await expect(
      withRlsTransaction(reg.user.id, async (tx) => {
        await tx.query(`SELECT * FROM public.user_sessions;`);
      })
    ).rejects.toThrow(/permission denied/i);

    await expect(
      withRlsTransaction(null, async (tx) => {
        await tx.query(`SELECT * FROM public.user_sessions;`);
      })
    ).rejects.toThrow(/permission denied/i);

    await expect(
      withRlsTransaction(reg.user.id, async (tx) => {
        await tx.query(`SELECT * FROM public.schema_migrations;`);
      })
    ).rejects.toThrow(/permission denied/i);
  });

  it('2. Routes withRlsTransaction and withServiceRoleTransaction through the remote_pg pool executor with proper role/claim scoping, commit/rollback, and client release', async () => {
    const suffix = Date.now() + 10;
    const reg = await registerUser({
      email: `remote-pool-${suffix}@example.com`,
      username: `remote_pool_${suffix}`,
      displayName: 'Remote Pool Tester',
      password: 'Password123!',
    });

    const pglite = await getPgDatabase();
    const recordedStatements: Array<{ sql: string; values?: unknown[] }> = [];
    let connectCount = 0;
    let releaseCount = 0;

    const mockPool: RemotePgPoolLike = {
      connect: async (): Promise<RemotePgClientLike> => {
        connectCount += 1;
        return {
          query: async (sql: string, values?: unknown[]) => {
            recordedStatements.push({ sql, values });
            const res = await pglite.query(sql, values ?? []);
            return { rows: res.rows as unknown[] };
          },
          release: () => {
            releaseCount += 1;
          },
        };
      },
      end: async () => {},
    };

    setCustomRemotePoolForTesting(mockPool);
    try {
      expect(getActiveDatabaseBackend()).toBe('remote_pg');

      // 2a. Authenticated RLS transaction via remote_pg pool
      recordedStatements.length = 0;
      const profileRow = await withRlsTransaction(reg.user.id, async (tx) => {
        const res = await tx.query<{ id: string; uid: string; role: string }>(
          `SELECT id, auth.uid()::text AS uid, auth.role() AS role FROM public.profiles WHERE id = $1;`,
          [reg.user.id]
        );
        return res.rows[0];
      });

      expect(profileRow?.id).toBe(reg.user.id);
      expect(profileRow?.uid).toBe(reg.user.id);
      expect(profileRow?.role).toBe('authenticated');
      expect(connectCount).toBe(1);
      expect(releaseCount).toBe(1);
      expect(recordedStatements[0]?.sql).toBe('BEGIN');
      expect(recordedStatements[1]?.sql).toBe('SET LOCAL ROLE authenticated');
      expect(recordedStatements[2]?.sql).toContain(`set_config('request.jwt.claim.role', 'authenticated'`);
      expect(recordedStatements[3]?.sql).toContain(`set_config('request.jwt.claim.sub', $1`);
      expect(recordedStatements[3]?.values).toEqual([reg.user.id]);
      expect(recordedStatements[recordedStatements.length - 1]?.sql).toBe('COMMIT');

      // 2b. Anonymous RLS transaction via remote_pg pool
      recordedStatements.length = 0;
      const anonCheck = await withRlsTransaction(null, async (tx) => {
        const res = await tx.query<{ role: string; uid: string | null }>(
          `SELECT auth.role() AS role, auth.uid()::text AS uid;`
        );
        return res.rows[0];
      });
      expect(anonCheck?.role).toBe('anon');
      expect(anonCheck?.uid).toBeNull();
      expect(recordedStatements[0]?.sql).toBe('BEGIN');
      expect(recordedStatements[1]?.sql).toBe('SET LOCAL ROLE anon');
      expect(recordedStatements[recordedStatements.length - 1]?.sql).toBe('COMMIT');
      expect(releaseCount).toBe(2);

      // 2c. Service-role transaction via remote_pg pool
      recordedStatements.length = 0;
      const serviceCheck = await withServiceRoleTransaction(async (tx) => {
        const res = await tx.query<{ role: string }>(`SELECT auth.role() AS role;`);
        return res.rows[0];
      });
      expect(serviceCheck?.role).toBe('service_role');
      expect(recordedStatements[0]?.sql).toBe('BEGIN');
      expect(recordedStatements[1]?.sql).toBe('SET LOCAL ROLE service_role');
      expect(recordedStatements[recordedStatements.length - 1]?.sql).toBe('COMMIT');
      expect(releaseCount).toBe(3);

      // 2d. Error rollback and guaranteed client.release() on failure
      recordedStatements.length = 0;
      await expect(
        withRlsTransaction(reg.user.id, async (tx) => {
          await tx.query(`UPDATE public.profiles SET bio = 'Remote Rollback Bio' WHERE id = $1;`, [
            reg.user.id,
          ]);
          throw new Error('Intentional remote transaction failure');
        })
      ).rejects.toThrow('Intentional remote transaction failure');

      expect(recordedStatements[0]?.sql).toBe('BEGIN');
      expect(recordedStatements[recordedStatements.length - 1]?.sql).toBe('ROLLBACK');
      expect(releaseCount).toBe(4);

      const bioVerify = await withRlsTransaction(reg.user.id, async (tx) => {
        const res = await tx.query<{ bio: string }>(
          `SELECT bio FROM public.profiles WHERE id = $1;`,
          [reg.user.id]
        );
        return res.rows[0]?.bio;
      });
      expect(bioVerify).not.toBe('Remote Rollback Bio');

      // 2e. Health endpoint reports backend: 'remote_pg' when remote pool is active
      const healthRes = await healthGetRoute();
      expect(healthRes.status).toBe(200);
      const healthJson = await healthRes.json();
      expect(healthJson.backend).toBe('remote_pg');
    } finally {
      setCustomRemotePoolForTesting(null);
    }
  });

  it('3. Validates DATABASE_URL format and selects remote_pg vs embedded_pglite safely without silent fallback in production', () => {
    const prevDbUrl = process.env.DATABASE_URL;
    const prevForceRemote = process.env.CIRCLES_FORCE_REMOTE_PG;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevAllowEmbedded = process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
    const prevSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      // Invalid DATABASE_URL protocol throws ConfigurationError
      process.env.DATABASE_URL = 'http://not-a-postgres-url:5432/db';
      expect(() => getRemoteDatabaseUrl()).toThrow(ConfigurationError);

      // Valid DATABASE_URL with CIRCLES_FORCE_REMOTE_PG selects remote_pg
      process.env.DATABASE_URL = 'postgresql://postgres:password@db.example.supabase.co:5432/postgres';
      process.env.CIRCLES_FORCE_REMOTE_PG = 'true';
      expect(getDatabaseBackendMode()).toBe('remote_pg');

      // Production without DATABASE_URL fails closed
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.DATABASE_URL;
      delete process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
      expect(() => getDatabaseBackendMode()).toThrow(ConfigurationError);

      // Production with full Supabase + DATABASE_URL selects remote_pg
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-value';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-value';
      process.env.DATABASE_URL = 'postgresql://postgres:password@db.example.supabase.co:5432/postgres';
      expect(getDatabaseBackendMode()).toBe('remote_pg');
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      if (prevDbUrl !== undefined) process.env.DATABASE_URL = prevDbUrl;
      else delete process.env.DATABASE_URL;
      if (prevForceRemote !== undefined) process.env.CIRCLES_FORCE_REMOTE_PG = prevForceRemote;
      else delete process.env.CIRCLES_FORCE_REMOTE_PG;
      if (prevAllowEmbedded !== undefined) {
        process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION = prevAllowEmbedded;
      } else {
        delete process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
      }
      if (prevSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupabaseUrl;
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (prevAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnonKey;
      else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (prevServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });
});
