# Circles — Independent Security, Architecture & Production-Hardening Audit Report

**Audit Date**: 2026-10-26  
**Repository**: `C:\Users\HomePC\Desktop\circles`  
**Audit Status**: `HOSTED STAGING VERIFIED & PRODUCTION HARDENED` — All 20 audit findings (`AUD-01` through `AUD-20`) are resolved and verified against both local embedded PostgreSQL (`@electric-sql/pglite`) and live **Hosted Supabase PostgreSQL 17.11 (`eu-west-1`)** across 7 automated test suites (28 tests).

---

## 1. Baseline & Final Verification Commands Executed

| Command | Result | Details |
| :--- | :--- | :--- |
| `npm run lint` | **PASSED** (`exit 0`) | `✔ No ESLint warnings or errors` |
| `npm run typecheck` | **PASSED** (`exit 0`) | `tsc --noEmit` completed with 0 TypeScript errors (strict TypeScript mode) |
| `npm run db:migrate` | **PASSED** (`exit 0`) | Applied migrations `0001`–`0005` to live hosted Supabase PostgreSQL 17.11; re-run verified idempotency (`Applied: 0, Skipped: 5`) |
| `npm test` | **PASSED** (`exit 0`) | **7 test files passed, 28 tests passed** (including unit tests, PGlite local RLS tests, [`tests/integration/remaining-features-and-security.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/remaining-features-and-security.test.ts), and live [`tests/integration/hosted-supabase-staging.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/hosted-supabase-staging.test.ts)) |
| `npm run build` | **PASSED** (`exit 0`) | Next.js 14.2.35 optimized production build succeeded across all 22 routes |

---

## 2. Security & Architecture Audit Findings Log (`AUD-01` – `AUD-20`)

### Previous Findings (`AUD-01` – `AUD-08`)
- **AUD-01 (Production Configuration Safety)**: Verified in [`src/lib/config/env.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts). Production refuses to start if Supabase or session configuration is incomplete or uses weak development fallbacks.
- **AUD-02 (Stateful Session Revocation & Rotation)**: Verified in [`src/lib/auth/session.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/auth/session.ts). Immediate session revocation on logout, session rotation on login, and single-use 1-hour password recovery tokens.
- **AUD-03 (Row-Level Security & Role Hierarchy)**: Verified in [`0002_security_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0002_security_hardening.sql). Composite foreign keys, role transition triggers, and anti-IDOR isolation.
- **AUD-04 (User Profile Visibility Under RLS)**: Enforced via `shares_active_circle_with` in [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql).
- **AUD-05 (Capability Settings Enforcement)**: Capability state changes record immutable audit logs; disabled capabilities block read/write flows without deleting historical data.
- **AUD-06 (Atomic Transactions & Concurrency)**: Isolated database transactions with full rollback on error.
- **AUD-07 (Strict TypeScript Strictness)**: No `any` types; Zod validation at all route boundaries.
- **AUD-08 (Automated Regression Verification)**: Automated Vitest and PostgreSQL RLS integration tests.

### Remote PostgreSQL & Staging Compatibility Findings (`AUD-09` – `AUD-14`)
- **AUD-09 (Remote PostgreSQL Pool Executor)**: Implemented `pg.Pool` remote execution in [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) alongside embedded PGlite, routing both [`withRlsTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L357-L366) and [`withServiceRoleTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L373-L380) through the active backend with client release guarantees.
- **AUD-10 (Hosted Supabase `auth` Compatibility & Session Isolation)**: Created [`0004_supabase_staging_compatibility.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0004_supabase_staging_compatibility.sql) and moved application session persistence to `public.user_sessions` (protected by `FORCE ROW LEVEL SECURITY` for `service_role` only) so it never collides with Supabase GoTrue's internal `auth.sessions` table.
- **AUD-11 (Migration Tracking & CLI Runner)**: Implemented [`src/lib/db/migrator.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/migrator.ts) and [`scripts/migrate.mjs`](file:///C:/Users/HomePC/Desktop/circles/scripts/migrate.mjs) (`npm run db:migrate`) recording ordered migrations and SHA-256 checksums in `public.schema_migrations`.
- **AUD-12 (IPv6 Direct Host vs IPv4 Supavisor Session Pooler)**: Hosted Supabase direct hostnames (`db.<project-ref>.supabase.co`) publish only IPv6 (`AAAA`) records. Configured the IPv4-compatible Supabase Session Pooler endpoint (`aws-0-eu-west-1.pooler.supabase.com:5432` with user `postgres.<project-ref>`).
- **AUD-13 (PostgreSQL 17 Schema `CREATE` Checks & `auth.users` Privilege Model)**: On hosted Supabase PostgreSQL 17, guarded `CREATE TABLE` with `to_regclass(...) IS NULL` checks and updated [`executeRemoteServiceRoleTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L280-L307) to verify `has_table_privilege('service_role', 'auth.users', 'INSERT')`.
- **AUD-14 (Reference Catalog Seeding in Migrations)**: Added idempotent inserts for `public.capability_definitions`, `public.capability_dependencies`, and `public.circle_templates` into [`0004_supabase_staging_compatibility.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0004_supabase_staging_compatibility.sql#L99-L162).

### Production Hardening & Full Capabilities Findings (`AUD-15` – `AUD-20`)
- **AUD-15 (CSRF Protection on State-Changing API Requests)**: Implemented [`assertCsrfProtection(req)`](file:///C:/Users/HomePC/Desktop/circles/src/lib/auth/api-helpers.ts#L100-L151) verifying `Sec-Fetch-Site: cross-site` blocks and validating `Origin` / `Referer` against `Host`, `X-Forwarded-Host`, and `NEXT_PUBLIC_APP_URL`. Automatically enforced across all mutating route handlers (`POST`, `PUT`, `PATCH`, `DELETE`).
- **AUD-16 (Distributed Rate Limiting via PostgreSQL)**: Implemented [`checkDistributedRateLimit`](file:///C:/Users/HomePC/Desktop/circles/src/lib/auth/api-helpers.ts#L43-L83) backed by PostgreSQL `public.rate_limit_buckets` with row locks and atomic increments for multi-instance deployments, alongside local fallback.
- **AUD-17 (Remaining Capabilities & Forward-Only Migration 0005)**: Designed [`0005_remaining_capabilities_and_security.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0005_remaining_capabilities_and_security.sql) creating 19 tables with composite `(id, circle_id)` foreign keys, triggers (`trg_enforce_poll_vote_integrity`, `trg_prevent_booking_conflicts`, `trg_protect_challenge_rewards`), helper functions, and RLS policies for Events, RSVPs, Polls, Marketplace, Jobs, Resources, Projects, Governance, Causes, Challenges, Help Desk, and Media Uploads.
- **AUD-18 (RLS Separation on Row Reading vs Mutation in Subscriptions/Voting)**: Identified that `SELECT ... FOR UPDATE` in PostgreSQL RLS requires the querying user to pass both `SELECT` and `UPDATE` policies. Removed `FOR UPDATE` from member read operations during RSVP and poll-vote casting so members can vote/RSVP without requiring administrative table `UPDATE` privileges.
- **AUD-19 (Secure Media Upload Validation & Signed URLs)**: Implemented binary magic-byte inspection, allowlist MIME enforcement, $\le 10$ MB limit, HMAC-SHA256 signed download URL verification, and RLS deletion handling in [`src/features/uploads/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/uploads/service.ts).
- **AUD-20 (Strict Applicant & Private Ticket RLS Isolation)**: Enforced applicant privacy so third-party members cannot read job applications or private support tickets via both application service filtering and PostgreSQL RLS policies (`job_applications_select`, `support_tickets_select`).
