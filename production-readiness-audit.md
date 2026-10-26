# Circles — Independent Security, Architecture & Staging-Readiness Audit Report (Phase 3)

**Audit Date**: 2026-10-26  
**Repository**: `C:\Users\HomePC\Desktop\circles`  
**Audit Status**: `LOCAL STAGING READY` — All 8 security audit findings (`AUD-01` through `AUD-08`) plus Phase 3 Remote PostgreSQL (`pg.Pool`) Execution, Migration Tracking (`public.schema_migrations`), and Hosted Supabase Schema Compatibility (`0004_supabase_staging_compatibility.sql`) are implemented and verified across 20 automated tests (5 test suites). Hosted Supabase verification remains pending external staging credentials.

---

## 1. Baseline & Final Verification Commands Executed

All verification commands were executed directly against the live workspace:

| Command | Result | Details |
| :--- | :--- | :--- |
| `npm run lint` | **PASSED** (`exit 0`) | `✔ No ESLint warnings or errors` |
| `npm run typecheck` | **PASSED** (`exit 0`) | `tsc --noEmit` completed with 0 TypeScript errors |
| `npm test` | **PASSED** (`exit 0`) | **5 test files passed, 20 tests passed** (`capabilities-and-permissions.test.ts` [6], `vertical-slice-and-rls.test.ts` [4], `api-security.test.ts` [1], `security-audit-regression.test.ts` [6], `postgres-executor-and-migrations.test.ts` [3]) |
| `npm run db:migrate` | **PASSED** (`exit 0`) | Applied `0001`, `0002`, `0003`, `0004` in order; second run verified idempotency (`Applied: 0, Skipped: 4`) |
| `npm run build` | **PASSED** (`exit 0`) | Next.js 14.2.35 optimized production build succeeded across all 21 routes |

---

## 2. Phase 3 Architectural Upgrades & Findings Resolved

### AUD-09 (Phase 3) — Real Remote PostgreSQL Pool Executor (`pg.Pool`)
- **Previous Gap**: In Phase 2, [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) only instantiated embedded `@electric-sql/pglite`. Setting `DATABASE_URL` passed environment checks but did not open a remote PostgreSQL connection.
- **Remediation Implemented**:
  - Installed `pg` and `@types/pg` and implemented a dual-backend PostgreSQL executor in [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) controlled by [`getDatabaseBackendMode()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts#L98-L115).
  - When `DATABASE_URL` or `SUPABASE_DB_URL` is configured (`remote_pg`), both [`withRlsTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L341-L350) and [`withServiceRoleTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L357-L364) acquire a client from the singleton `pg.Pool`, execute `BEGIN`, set `SET LOCAL ROLE authenticated | anon | service_role`, apply `set_config('request.jwt.claim.role', ...)` and `set_config('request.jwt.claim.sub', ...)`, execute parameterized queries, `COMMIT` (or `ROLLBACK` on error), and release the client in `finally`.
  - Configured pool limits (`PG_POOL_MAX`, `PG_IDLE_TIMEOUT_MS`, `PG_CONNECTION_TIMEOUT_MS`), SSL options, and [`closeDatabasePools()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L117-L124).

### AUD-10 (Phase 3) — Hosted Supabase `auth` Schema Compatibility & Session Table Isolation
- **Previous Gap**:
  1. Hosted Supabase PostgreSQL pre-installs `auth.uid()` and `auth.role()` under ownership of `supabase_auth_admin`. Unconditional `CREATE OR REPLACE FUNCTION auth.uid()` in `0001_initial_schema.sql` could fail with `must be owner of function uid` when run as `postgres`.
  2. Hosted Supabase GoTrue manages its own internal `auth.sessions` table without `token_hash` or `revoked_at` columns. Creating `auth.sessions` with `IF NOT EXISTS` in `0002_security_hardening.sql` would skip table creation on hosted Supabase and then fail when creating indexes on `token_hash`.
- **Remediation Implemented**:
  - Wrapped `auth.uid()` and `auth.role()` definitions in [`0001_initial_schema.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0001_initial_schema.sql#L34-L69) and legacy `auth.sessions` statements in [`0002_security_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0002_security_hardening.sql#L6-L31) and [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql#L6-L31) inside `DO $$ ... EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;` blocks.
  - Created [`0004_supabase_staging_compatibility.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0004_supabase_staging_compatibility.sql) introducing `public.user_sessions` (with `ENABLE` and `FORCE ROW LEVEL SECURITY`, `REVOKE ALL FROM PUBLIC, anon, authenticated`, and `service_role`-only policy) and updated [`src/lib/auth/session.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/auth/session.ts) to persist and verify all application sessions in `public.user_sessions`.

### AUD-11 (Phase 3) — Deterministic Migration Tracking (`public.schema_migrations`)
- **Previous Gap**: Migrations were re-executed on embedded database initialization without version tracking or checksums, and had no dedicated CLI runner for staging/production deployments.
- **Remediation Implemented**:
  - Created [`src/lib/db/migrator.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/migrator.ts) and [`scripts/migrate.mjs`](file:///C:/Users/HomePC/Desktop/circles/scripts/migrate.mjs) (`npm run db:migrate`).
  - Applied migrations are tracked in `public.schema_migrations` (`version`, `filename`, `checksum`, `applied_at`) with `service_role`-only RLS.
  - Remote PostgreSQL connections (`remote_pg`) do **not** run DDL migrations automatically on every application boot; instead, migrations are executed explicitly via `npm run db:migrate` during deployment.

---

## 3. Summary of Previously Verified Security Findings (`AUD-01` – `AUD-08`)

| ID | Finding Area | Status | Key Enforcement Files |
| :--- | :--- | :--- | :--- |
| **AUD-01** | Production Configuration Safety | **VERIFIED** | [`src/lib/config/env.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts), [`src/app/api/health/route.ts`](file:///C:/Users/HomePC/Desktop/circles/src/app/api/health/route.ts) |
| **AUD-02** | Stateful Session Revocation & Fixation Rotation | **VERIFIED** | [`src/lib/auth/session.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/auth/session.ts), [`src/app/api/auth/login/route.ts`](file:///C:/Users/HomePC/Desktop/circles/src/app/api/auth/login/route.ts) |
| **AUD-03** | PostgreSQL RLS & Trigger Role Hierarchy | **VERIFIED** | [`0002_security_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0002_security_hardening.sql), [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql) |
| **AUD-04** | Profile Privacy (`public`, `members_only`, `private`) | **VERIFIED** | [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql#L50-L95) |
| **AUD-05** | Password Recovery Single-Use & 1h Expiry | **VERIFIED** | [`src/features/auth/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/auth/service.ts#L121-L195) |
| **AUD-06** | Capability Enforcement & Settings in Services & RLS | **VERIFIED** | [`src/features/discussions/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/discussions/service.ts), [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql#L264-L315) |
| **AUD-07** | Database Concurrency, Pooling & Rollback Safety | **VERIFIED** | [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) |
| **AUD-08** | API Error Sanitization & Health Check Honesty | **VERIFIED** | [`src/app/api/health/route.ts`](file:///C:/Users/HomePC/Desktop/circles/src/app/api/health/route.ts), [`src/lib/errors/index.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/errors/index.ts) |
