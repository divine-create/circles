import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  assertProductionDatabaseConfigured,
  DatabaseBackendMode,
  getDatabaseBackendMode,
  getRemoteDatabaseUrl,
} from '@/lib/config/env';
import {
  getAppliedMigrations,
  MigrationRunResult,
  runPendingMigrations,
} from '@/lib/db/migrator';
import { logger } from '@/lib/logging';

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface DbTransaction {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
  exec: (sql: string) => Promise<void>;
}

export interface RemotePgClientLike {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  release: (err?: Error | boolean) => void;
}

export interface RemotePgPoolLike {
  connect: () => Promise<RemotePgClientLike>;
  end: () => Promise<void>;
}

interface GlobalDbState {
  __circlesPgInstance?: PGlite;
  __circlesPgInitPromise?: Promise<PGlite>;
  __circlesPgMutex?: Promise<void>;
  __circlesRemotePool?: RemotePgPoolLike;
  __circlesRemotePoolUrl?: string;
  __circlesServiceRoleCanMutateAuthUsers?: boolean;
  __circlesCustomTestPool?: RemotePgPoolLike | null;
}

const globalForPg = globalThis as unknown as GlobalDbState;

/**
 * Allows integration tests to inject a deterministic Pool implementation
 * to test the remote_pg executor path without requiring an external TCP database.
 */
export function setCustomRemotePoolForTesting(pool: RemotePgPoolLike | null): void {
  globalForPg.__circlesCustomTestPool = pool;
}

/**
 * Returns the active database backend mode ('remote_pg' or 'embedded_pglite'),
 * accounting for any test pool override.
 */
export function getActiveDatabaseBackend(): DatabaseBackendMode {
  if (globalForPg.__circlesCustomTestPool) {
    return 'remote_pg';
  }
  return getDatabaseBackendMode();
}

/**
 * Returns or initializes the singleton `pg.Pool` for remote PostgreSQL / Supabase connections.
 */
export function getRemotePgPool(): RemotePgPoolLike {
  if (globalForPg.__circlesCustomTestPool) {
    return globalForPg.__circlesCustomTestPool;
  }

  assertProductionDatabaseConfigured();
  const connectionString = getRemoteDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      'Remote PostgreSQL pool requested, but DATABASE_URL / SUPABASE_DB_URL is not configured.'
    );
  }

  if (globalForPg.__circlesRemotePool && globalForPg.__circlesRemotePoolUrl === connectionString) {
    return globalForPg.__circlesRemotePool;
  }

  const maxConnections = Math.max(1, Number(process.env.PG_POOL_MAX || 10));
  const idleTimeoutMillis = Math.max(1000, Number(process.env.PG_IDLE_TIMEOUT_MS || 30000));
  const connectionTimeoutMillis = Math.max(
    1000,
    Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000)
  );

  const isLocalhost =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('sslmode=disable');

  const sslConfig =
    process.env.PG_SSL === 'false' || isLocalhost
      ? undefined
      : process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true'
        ? true
        : { rejectUnauthorized: false };

  const pool = new Pool({
    connectionString,
    max: maxConnections,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ...(sslConfig ? { ssl: sslConfig } : {}),
  });

  pool.on('error', (err) => {
    logger.error('Unexpected idle client error in remote PostgreSQL pool', {
      error: err.message,
    });
  });

  globalForPg.__circlesRemotePool = pool as unknown as RemotePgPoolLike;
  globalForPg.__circlesRemotePoolUrl = connectionString;
  return globalForPg.__circlesRemotePool;
}

/**
 * Gracefully closes any active remote PostgreSQL connection pool.
 */
export async function closeDatabasePools(): Promise<void> {
  if (globalForPg.__circlesRemotePool) {
    const pool = globalForPg.__circlesRemotePool;
    globalForPg.__circlesRemotePool = undefined;
    globalForPg.__circlesRemotePoolUrl = undefined;
    await pool.end();
  }
}

/**
 * Resets the in-memory embedded PGlite database for deterministic integration tests.
 */
export async function resetTestDatabase(): Promise<void> {
  const db = new PGlite();
  await initializeEmbeddedSchemaAndSeed(db);
  globalForPg.__circlesPgInstance = db;
  globalForPg.__circlesPgInitPromise = Promise.resolve(db);
}

async function initializeEmbeddedSchemaAndSeed(db: PGlite): Promise<void> {
  const executor: DbTransaction = {
    query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
      const res = await db.query<T>(sql, params);
      return { rows: res.rows };
    },
    exec: async (sql: string) => {
      await db.exec(sql);
    },
  };

  await runPendingMigrations(executor);

  if (process.env.SKIP_DB_SEED !== 'true') {
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.circles;`
    );
    const circleCount = Number(countRes.rows[0]?.count ?? '0');
    if (circleCount === 0) {
      const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql');
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await db.exec(seedSql);
      }
    }
  }
}

/**
 * Returns the initialized embedded PGlite instance for local development and local RLS tests.
 * Fails closed in production unless `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true` is set.
 */
export async function getPgDatabase(): Promise<PGlite> {
  assertProductionDatabaseConfigured();

  if (globalForPg.__circlesPgInstance) {
    return globalForPg.__circlesPgInstance;
  }

  if (!globalForPg.__circlesPgInitPromise) {
    globalForPg.__circlesPgInitPromise = (async () => {
      const useInMemory =
        process.env.NODE_ENV === 'test' || process.env.PGLITE_IN_MEMORY === 'true';

      let db: PGlite;
      if (useInMemory) {
        db = new PGlite();
      } else {
        const dataDir =
          process.env.PGLITE_DATA_DIR || path.join(process.cwd(), '.pgdata', 'circles-db');
        fs.mkdirSync(path.dirname(dataDir), { recursive: true });
        try {
          db = new PGlite(dataDir);
          await db.query('SELECT 1;');
        } catch {
          db = new PGlite();
        }
      }

      await initializeEmbeddedSchemaAndSeed(db);
      globalForPg.__circlesPgInstance = db;
      return db;
    })();
  }

  return globalForPg.__circlesPgInitPromise;
}

/**
 * Serializes access to the single-connection embedded PGlite engine so concurrent
 * async calls do not interleave `BEGIN` / `SET LOCAL ROLE` / `COMMIT`.
 */
async function withEmbeddedDbMutex<T>(fn: () => Promise<T>): Promise<T> {
  const prev = globalForPg.__circlesPgMutex ?? Promise.resolve();
  let release!: () => void;
  globalForPg.__circlesPgMutex = new Promise<void>((resolve) => {
    release = resolve;
  });

  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function executeRemoteRlsTransaction<T>(
  userId: string | null,
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const pool = getRemotePgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (userId) {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    } else {
      await client.query('SET LOCAL ROLE anon');
      await client.query(`SELECT set_config('request.jwt.claim.role', 'anon', true)`);
      await client.query(`SELECT set_config('request.jwt.claim.sub', '', true)`);
    }

    const tx: DbTransaction = {
      query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
        const res = await client.query(sql, params);
        return { rows: (res.rows ?? []) as R[] };
      },
      exec: async (sql: string) => {
        await client.query(sql);
      },
    };

    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors if connection was already terminated
    }
    throw err;
  } finally {
    client.release();
  }
}

async function executeRemoteServiceRoleTransaction<T>(
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const pool = getRemotePgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (globalForPg.__circlesCustomTestPool) {
      await client.query('SET LOCAL ROLE service_role');
    } else {
      if (globalForPg.__circlesServiceRoleCanMutateAuthUsers === undefined) {
        const privRes = await client.query(
          `SELECT has_table_privilege('service_role', 'auth.users', 'INSERT') AS can_insert;`
        );
        const row = (privRes.rows?.[0] ?? {}) as { can_insert?: boolean };
        globalForPg.__circlesServiceRoleCanMutateAuthUsers = Boolean(row.can_insert);
      }

      if (globalForPg.__circlesServiceRoleCanMutateAuthUsers) {
        await client.query('SET LOCAL ROLE service_role');
      }
    }

    await client.query(`SELECT set_config('request.jwt.claim.role', 'service_role', true)`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', '', true)`);

    const tx: DbTransaction = {
      query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
        const res = await client.query(sql, params);
        return { rows: (res.rows ?? []) as R[] };
      },
      exec: async (sql: string) => {
        await client.query(sql);
      },
    };

    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors if connection was already terminated
    }
    throw err;
  } finally {
    client.release();
  }
}

async function executeEmbeddedRlsTransaction<T>(
  userId: string | null,
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const db = await getPgDatabase();

  return withEmbeddedDbMutex(async () => {
    await db.exec('BEGIN;');
    try {
      if (userId) {
        await db.exec(`SET LOCAL ROLE authenticated;`);
        await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true);`);
        await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [userId]);
      } else {
        await db.exec(`SET LOCAL ROLE anon;`);
        await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', true);`);
        await db.query(`SELECT set_config('request.jwt.claim.sub', '', true);`);
      }

      const tx: DbTransaction = {
        query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          const res = await db.query<R>(sql, params);
          return { rows: res.rows };
        },
        exec: async (sql: string) => {
          await db.exec(sql);
        },
      };

      const result = await callback(tx);
      await db.exec('COMMIT;');
      return result;
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  });
}

async function executeEmbeddedServiceRoleTransaction<T>(
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const db = await getPgDatabase();

  return withEmbeddedDbMutex(async () => {
    await db.exec('BEGIN;');
    try {
      await db.exec(`SET LOCAL ROLE service_role;`);
      await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', true);`);
      await db.query(`SELECT set_config('request.jwt.claim.sub', '', true);`);

      const tx: DbTransaction = {
        query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          const res = await db.query<R>(sql, params);
          return { rows: res.rows };
        },
        exec: async (sql: string) => {
          await db.exec(sql);
        },
      };

      const result = await callback(tx);
      await db.exec('COMMIT;');
      return result;
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  });
}

/**
 * Executes a callback inside an isolated PostgreSQL transaction with
 * Supabase-compatible Row-Level Security (RLS) session context (`auth.uid()`, `auth.role()`).
 * Automatically routes to the remote `pg.Pool` executor when `DATABASE_URL` / `SUPABASE_DB_URL`
 * is configured, or to embedded PGlite in local development/testing.
 */
export async function withRlsTransaction<T>(
  userId: string | null,
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const mode = getActiveDatabaseBackend();
  if (mode === 'remote_pg') {
    return executeRemoteRlsTransaction(userId, callback);
  }
  return executeEmbeddedRlsTransaction(userId, callback);
}

/**
 * Executes a privileged `service_role` transaction (for system-level operations
 * such as registration, session persistence, audit logging, and notification dispatch).
 * Automatically routes to the remote `pg.Pool` executor when `DATABASE_URL` / `SUPABASE_DB_URL`
 * is configured, or to embedded PGlite in local development/testing.
 */
export async function withServiceRoleTransaction<T>(
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const mode = getActiveDatabaseBackend();
  if (mode === 'remote_pg') {
    return executeRemoteServiceRoleTransaction(callback);
  }
  return executeEmbeddedServiceRoleTransaction(callback);
}

/**
 * Explicitly applies pending SQL migrations against the active database backend.
 * For remote PostgreSQL (`remote_pg`), runs migrations as the connection's administrative user
 * inside a transaction so partial failures roll back cleanly.
 */
export async function runDatabaseMigrations(
  migrationsDir?: string
): Promise<MigrationRunResult> {
  const mode = getActiveDatabaseBackend();
  if (mode === 'remote_pg') {
    const pool = getRemotePgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const executor: DbTransaction = {
        query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
          const res = await client.query(sql, params);
          return { rows: (res.rows ?? []) as R[] };
        },
        exec: async (sql: string) => {
          await client.query(sql);
        },
      };
      const result = await runPendingMigrations(executor, migrationsDir);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors
      }
      throw err;
    } finally {
      client.release();
    }
  }

  const db = await getPgDatabase();
  return withEmbeddedDbMutex(async () => {
    const executor: DbTransaction = {
      query: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
        const res = await db.query<R>(sql, params);
        return { rows: res.rows };
      },
      exec: async (sql: string) => {
        await db.exec(sql);
      },
    };
    return runPendingMigrations(executor, migrationsDir);
  });
}

/**
 * Returns the list of applied migrations from `public.schema_migrations` on the active backend.
 */
export async function listAppliedDatabaseMigrations() {
  return withServiceRoleTransaction(async (tx) => {
    return getAppliedMigrations(tx);
  });
}
