import { PGlite, Transaction } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface QueryExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __circlesPgInstance: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __circlesPgInitPromise: Promise<PGlite> | undefined;
}

function hashPasswordSync(password: string, salt = 'circles-static-demo-salt'): string {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export async function initializeSchemaOnDb(pg: PGlite, includeDemoSeed = false): Promise<void> {
  const check = await pg.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'circles'
    ) AS exists;`
  );

  if (!check.rows[0]?.exists) {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '0001_initial_schema.sql');
    const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql');

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await pg.exec(migrationSql);

    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await pg.exec(seedSql);
    }
  }

  if (includeDemoSeed) {
    const countRes = await pg.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM public.circles;`);
    const count = parseInt(countRes.rows[0]?.count ?? '0', 10);
    if (count === 0) {
      await seedInitialDevelopmentCommunities(pg);
    }
  }
}

async function seedInitialDevelopmentCommunities(pg: PGlite): Promise<void> {
  const founderId = '11111111-1111-4111-8111-111111111111';
  const moderatorId = '22222222-2222-4222-8222-222222222222';
  const memberId = '33333333-3333-4333-8333-333333333333';

  const demoPasswordHash = hashPasswordSync('CirclesDemo123!');

  await pg.query(
    `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
     VALUES
       ($1, 'amara@circles.dev', $4, '{"display_name":"Amara Okafor","username":"amara_okafor"}'::jsonb),
       ($2, 'liam@circles.dev', $4, '{"display_name":"Liam Chen","username":"liam_chen"}'::jsonb),
       ($3, 'sofia@circles.dev', $4, '{"display_name":"Sofia Rossi","username":"sofia_rossi"}'::jsonb)
     ON CONFLICT (id) DO NOTHING;`,
    [founderId, moderatorId, memberId, demoPasswordHash]
  );

  await pg.query(
    `INSERT INTO public.profiles (id, email, username, display_name, bio, location, profile_visibility)
     VALUES
       ($1, 'amara@circles.dev', 'amara_okafor', 'Amara Okafor', 'Community systems architect and urban gardening organizer.', 'London, UK', 'public'),
       ($2, 'liam@circles.dev', 'liam_chen', 'Liam Chen', 'Computer science lecturer and open-source study group lead.', 'Edinburgh, UK', 'public'),
       ($3, 'sofia@circles.dev', 'sofia_rossi', 'Sofia Rossi', 'Independent industrial designer & community builder.', 'Milan, IT', 'public')
     ON CONFLICT (id) DO NOTHING;`,
    [founderId, moderatorId, memberId]
  );

  await pg.query(
    `INSERT INTO public.platform_roles (user_id, role)
     VALUES ($1, 'platform_admin')
     ON CONFLICT (user_id) DO NOTHING;`,
    [founderId]
  );

  // Circle 1: Public University Circle
  const uniCircleId = 'aaaa1111-1111-4111-8111-111111111111';
  // Circle 2: Discoverable with Approval Neighbourhood Circle
  const hoodCircleId = 'bbbb2222-2222-4222-8222-222222222222';
  // Circle 3: Public Professional Network Circle
  const proCircleId = 'cccc3333-3333-4333-8333-333333333333';

  await pg.query(
    `INSERT INTO public.circles (id, name, slug, description, category, location, visibility, membership_policy, owner_id, template_key, template_version)
     VALUES
       ($1, 'Edinburgh Computing & AI Society', 'edinburgh-computing-society', 'A collaborative university community for students, researchers, and alumni exploring systems engineering, AI safety, hackathons, and study groups.', 'university', 'Edinburgh, Scotland', 'public', 'open', $2, 'university', 1),
       ($3, 'Highbury Green Residents Collective', 'highbury-green-residents', 'Our neighbourhood association for local announcements, tool sharing, seasonal street gatherings, and mutual aid requests.', 'neighbourhood', 'North London', 'discoverable_approval', 'approval', $4, 'neighbourhood', 1),
       ($5, 'Civic Product Builders Guild', 'civic-product-builders', 'Practitioners designing resilient civic technology, community platforms, and local-first software.', 'professional', 'Global / Remote', 'public', 'open', $4, 'professional', 1)
     ON CONFLICT (id) DO NOTHING;`,
    [uniCircleId, moderatorId, hoodCircleId, founderId, proCircleId]
  );

  // Memberships
  await pg.query(
    `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
     VALUES
       ('d0000001-0000-4000-8000-000000000001', $1, $2, 'owner', 'active'),
       ('d0000002-0000-4000-8000-000000000002', $1, $3, 'moderator', 'active'),
       ('d0000003-0000-4000-8000-000000000003', $1, $4, 'member', 'active'),
       ('d0000004-0000-4000-8000-000000000004', $5, $3, 'owner', 'active'),
       ('d0000005-0000-4000-8000-000000000005', $5, $2, 'admin', 'active'),
       ('d0000006-0000-4000-8000-000000000006', $6, $3, 'owner', 'active'),
       ('d0000007-0000-4000-8000-000000000007', $6, $4, 'member', 'active')
     ON CONFLICT (circle_id, user_id) DO NOTHING;`,
    [uniCircleId, moderatorId, founderId, memberId, hoodCircleId, proCircleId]
  );

  // Capabilities
  const capsToEnable: Array<[string, string]> = [
    [uniCircleId, 'discussions'],
    [uniCircleId, 'spaces'],
    [uniCircleId, 'member_directory'],
    [uniCircleId, 'events'],
    [uniCircleId, 'rsvps'],
    [uniCircleId, 'learning_resources'],
    [uniCircleId, 'jobs_opportunities'],
    [hoodCircleId, 'discussions'],
    [hoodCircleId, 'spaces'],
    [hoodCircleId, 'member_directory'],
    [hoodCircleId, 'events'],
    [hoodCircleId, 'help_desk'],
    [hoodCircleId, 'shared_resources'],
    [proCircleId, 'discussions'],
    [proCircleId, 'spaces'],
    [proCircleId, 'member_directory'],
    [proCircleId, 'jobs_opportunities'],
    [proCircleId, 'shared_resources'],
  ];

  for (const [cId, capKey] of capsToEnable) {
    await pg.query(
      `INSERT INTO public.circle_capabilities (id, circle_id, capability_key, enabled)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (circle_id, capability_key) DO NOTHING;`,
      [crypto.randomUUID(), cId, capKey]
    );
  }

  // Spaces
  const uniGenSpace = 'e0000001-0000-4000-8000-000000000001';
  const uniStudySpace = 'e0000002-0000-4000-8000-000000000002';
  const hoodGenSpace = 'e0000003-0000-4000-8000-000000000003';
  const proGenSpace = 'e0000004-0000-4000-8000-000000000004';

  await pg.query(
    `INSERT INTO public.circle_spaces (id, circle_id, name, slug, description, icon, capability_key, visibility, posting_policy, sort_order)
     VALUES
       ($1, $5, 'Campus Commons', 'general', 'Open discussions, introductions, and society updates.', 'message-square', 'discussions', 'public', 'members', 1),
       ($2, $5, 'Distributed Systems Study Cohort', 'study-cohort', 'Weekly paper readings, lab notes, and exam prep.', 'graduation-cap', 'learning_resources', 'public', 'members', 2),
       ($3, $6, 'Neighbours Forum', 'general', 'Block updates, garden coordination, and neighbourly requests.', 'message-square', 'discussions', 'members', 'members', 1),
       ($4, $7, 'Architecture & Design Patterns', 'general', 'Deep dives into modular community platforms and authorization design.', 'message-square', 'discussions', 'public', 'members', 1)
     ON CONFLICT (circle_id, slug) DO NOTHING;`,
    [uniGenSpace, uniStudySpace, hoodGenSpace, proGenSpace, uniCircleId, hoodCircleId, proCircleId]
  );

  // Sample Posts
  const post1Id = 'f0000001-0000-4000-8000-000000000001';
  const post2Id = 'f0000002-0000-4000-8000-000000000002';
  const post3Id = 'f0000003-0000-4000-8000-000000000003';

  await pg.query(
    `INSERT INTO public.posts (id, circle_id, space_id, author_id, title, body, is_pinned, comment_count, reaction_count)
     VALUES
       ($1, $4, $6, $8, 'Welcome to the Autumn Semester Systems & AI Cohort', 'Welcome everyone! This semester we are running weekly reading groups on distributed consensus, PostgreSQL internals, and applied machine learning. Introduce yourself below and share what project you are building this term.', true, 1, 2),
       ($2, $4, $7, $9, 'Week 1 Reading Notes: Row-Level Security & Multi-Tenant Isolation', 'Here are our consolidated notes on designing defense-in-depth authorization where application services and PostgreSQL RLS policies work together to prevent cross-tenant leaks.', false, 0, 1),
       ($3, $5, $10, $9, 'Designing Configurable Community Capabilities Without Bloat', 'One of the hardest problems in community software is supporting diverse groups—from universities to neighbourhood associations—without turning every group into a cluttered dashboard. How do you decide which capabilities belong in the core registry?', true, 0, 1)
     ON CONFLICT (id) DO NOTHING;`,
    [
      post1Id,
      post2Id,
      post3Id,
      uniCircleId,
      proCircleId,
      uniGenSpace,
      uniStudySpace,
      moderatorId,
      founderId,
      proGenSpace,
    ]
  );

  await pg.query(
    `INSERT INTO public.comments (id, post_id, circle_id, author_id, body)
     VALUES
       ('c0000001-0000-4000-8000-000000000001', $1, $2, $3, 'Excited to join! Looking forward to the PostgreSQL internals workshop next Thursday.')
     ON CONFLICT (id) DO NOTHING;`,
    [post1Id, uniCircleId, memberId]
  );
}

export async function getPgDatabase(): Promise<PGlite> {
  if (global.__circlesPgInstance) {
    return global.__circlesPgInstance;
  }
  if (global.__circlesPgInitPromise) {
    return global.__circlesPgInitPromise;
  }

  global.__circlesPgInitPromise = (async () => {
    const isTest = process.env.NODE_ENV === 'test' || process.env.PGLITE_IN_MEMORY === 'true';
    const dataDir = isTest
      ? undefined
      : path.join(process.cwd(), process.env.PGLITE_DATA_DIR || '.pgdata');

    const pg = new PGlite(dataDir);
    await initializeSchemaOnDb(pg, !isTest);
    global.__circlesPgInstance = pg;
    return pg;
  })();

  return global.__circlesPgInitPromise;
}

/**
 * Resets the database instance (used by isolated integration test suites).
 */
export async function resetTestDatabase(): Promise<PGlite> {
  if (global.__circlesPgInstance) {
    try {
      await global.__circlesPgInstance.close();
    } catch {
      // ignore close errors
    }
  }
  global.__circlesPgInstance = undefined;
  global.__circlesPgInitPromise = undefined;
  return getPgDatabase();
}

/**
 * Executes a callback inside a PostgreSQL transaction where `ROLE` and `request.jwt.claim.sub`
 * are set to the active user (or `anon` if unauthenticated), enforcing all PostgreSQL RLS policies.
 */
export async function withRlsTransaction<T>(
  actorUserId: string | null,
  callback: (tx: QueryExecutor) => Promise<T>
): Promise<T> {
  const pg = await getPgDatabase();
  return pg.transaction(async (tx: Transaction) => {
    if (actorUserId) {
      await tx.exec(`SET LOCAL ROLE authenticated;`);
      await tx.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true);`);
      await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [actorUserId]);
    } else {
      await tx.exec(`SET LOCAL ROLE anon;`);
      await tx.query(`SELECT set_config('request.jwt.claim.role', 'anon', true);`);
      await tx.query(`SELECT set_config('request.jwt.claim.sub', '', true);`);
    }

    const executor: QueryExecutor = {
      query: <R = Record<string, unknown>>(sql: string, params?: unknown[]) =>
        tx.query<R>(sql, params),
      exec: async (sql: string) => {
        await tx.exec(sql);
      },
    };

    return callback(executor);
  });
}

/**
 * Executes a privileged operation under `service_role` (strictly server-only, for auth bootstrap,
 * token lookup, or system notifications across users).
 */
export async function withServiceRoleTransaction<T>(
  callback: (tx: QueryExecutor) => Promise<T>
): Promise<T> {
  const pg = await getPgDatabase();
  return pg.transaction(async (tx: Transaction) => {
    await tx.exec(`SET LOCAL ROLE service_role;`);
    await tx.query(`SELECT set_config('request.jwt.claim.role', 'service_role', true);`);

    const executor: QueryExecutor = {
      query: <R = Record<string, unknown>>(sql: string, params?: unknown[]) =>
        tx.query<R>(sql, params),
      exec: async (sql: string) => {
        await tx.exec(sql);
      },
    };

    return callback(executor);
  });
}
