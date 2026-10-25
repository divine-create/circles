# Circles Platform — Independent Verification & Production-Readiness Audit

## 1. Executive Summary

An independent, line-by-line code, database, authorization, and runtime verification audit of the **Circles** repository (`C:\Users\HomePC\Desktop\circles`) was conducted against the seven-phase audit mandate.

### Verdict
- **Initial State**: The repository contained a genuine Next.js 14.2.35 App Router + TypeScript strict-mode + Tailwind CSS + PostgreSQL (`@electric-sql/pglite` & Supabase) implementation with working initial migrations (`0001_initial_schema.sql`), domain services, UI routes, and 11 passing tests. However, our deep-dive security and production-readiness audit uncovered **8 real security, authorization, configuration, and UX defects** (3 P0, 3 P1, 2 P2) that would have posed material risks in a hostile production environment.
- **Post-Remediation State**: Every P0, P1, and P2 finding identified during this audit has been remediated in code and PostgreSQL schema (`supabase/migrations/0002_security_hardening.sql`), backed by automated regression tests in `tests/integration/security-audit-regression.test.ts`, and verified via `npm run lint`, `npm run typecheck`, `npm test` (17 tests across 4 suites), and `npm run build`.

---

## 2. Prioritized Findings Table

| ID | Severity | Title | Root Cause | Exploit / Failure Scenario | Files Changed | Remediation & Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | **P0** | Silent Production Fallback to Default Session Secret & Local PGlite Storage | `src/lib/auth/session.ts` fell back to a hardcoded development secret when `CIRCLES_SESSION_SECRET` was unset, and `src/lib/db/postgres.ts` fell back to `.pgdata` when Supabase env vars were absent even if `NODE_ENV=production`. | An operator deploying to production while forgetting `CIRCLES_SESSION_SECRET` or `NEXT_PUBLIC_SUPABASE_URL` would expose the app to trivial HMAC session forgery and ephemeral container-local database state. | `src/lib/config/env.ts`, `src/lib/auth/session.ts`, `src/lib/db/postgres.ts` | Added `getVerifiedSessionSecret()` and `assertProductionDatabaseConfigured()` which throw `ConfigurationError` in `NODE_ENV=production` unless a strong secret ($\ge 32$ chars) and explicit DB config are present. Verified in `security-audit-regression.test.ts` (#5). |
| **AUD-02** | **P0** | Stateless Session Tokens Remained Valid After Logout or Password Reset | Session tokens were previously verified only by HMAC-SHA256 signature and `exp` timestamp without a server-side session store. | Logging out only cleared the browser cookie; a captured `circles_session_token` replayed via `Cookie` or `Authorization: Bearer` remained valid until its 7-day expiry, and resetting a compromised password did not revoke active sessions. | `supabase/migrations/0002_security_hardening.sql`, `src/lib/auth/session.ts`, `src/features/auth/service.ts`, `src/app/api/auth/logout/route.ts` | Created `auth.sessions` table (`id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`). `verifyAndResolveSessionUser` validates active unrevoked state in `auth.sessions`, `signOutUser` revokes the token hash immediately, and `resetPasswordWithToken` revokes all active sessions for the user. Verified in `security-audit-regression.test.ts` (#1). |
| **AUD-03** | **P0** | Direct PostgreSQL RLS Privilege Escalation & Invitation Hijacking Vectors | 1. `profiles_update` RLS allowed a user to update their own `profiles.email`, which `has_pending_circle_invite()` used to authorize private Circle access.<br>2. `circles_update` allowed `admin` role to update `circles.owner_id`.<br>3. `memberships_update` checked actor rank (`moderator+`) but did not restrict modifying higher-ranked members or suspended users self-restoring via direct SQL. | A user with direct PostgREST/SQL access could change `profiles.email` to match a victim's pending invitation email, an `admin` could overwrite `circles.owner_id`, or a `moderator` could demote/suspend an `admin`. | `supabase/migrations/0002_security_hardening.sql` | Added `BEFORE UPDATE` PostgreSQL triggers: `trg_protect_profile_identity`, `trg_protect_circle_ownership`, and `trg_enforce_membership_transitions`, plus tightened `notifications_insert` RLS. Verified in `security-audit-regression.test.ts` (#3). |
| **AUD-04** | **P1** | Password Recovery Token Lacked Server-Side Expiration Check & Leaked Preview Token Outside Dev | `resetPasswordWithToken` matched `recovery_token` without enforcing a maximum age on `recovery_sent_at`, and `requestPasswordRecovery` returned `previewToken` whenever `!isResendConfigured()`. | Unclaimed password reset tokens remained valid indefinitely, and an unconfigured Resend key in production could expose `previewToken` in the JSON response. | `src/features/auth/service.ts`, `src/app/api/auth/recover/route.ts` | Enforced `recovery_sent_at > NOW() - INTERVAL '1 hour'` in SQL `UPDATE`, cleared token on first use, and restricted `previewToken` strictly to `NODE_ENV !== 'production' && !isResendConfigured()`. Verified in `security-audit-regression.test.ts` (#1, #2). |
| **AUD-05** | **P1** | Inner Join on `public.profiles` Hid Public Posts/Members When Author Set `profile_visibility = 'private'` | `listCirclePosts`, `getPostWithComments`, `listCircleMembers`, and `listCircleJoinRequests` used `INNER JOIN public.profiles`. | Because `profiles_select` RLS hides rows where `profile_visibility = 'private'` from anonymous or non-co-member users, any public Circle post authored by a user with a private profile disappeared from the public feed. | `src/features/discussions/service.ts`, `src/features/memberships/service.ts` | Replaced `INNER JOIN public.profiles` with `LEFT JOIN public.profiles` and `COALESCE` display fallbacks (`'Circle Member'`), keeping private profile rows protected by RLS while preserving public Circle posts. Verified in `security-audit-regression.test.ts` (#4). |
| **AUD-06** | **P1** | Capability Settings (`allowMemberPosts`, `allowReactions`) Not Enforced on Mutations | `discussions` capability stored `allowMemberPosts` and `allowReactions` in `circle_capabilities.settings`, but `createPost` and `toggleReaction` only checked `enabled = true`. | Disabling member posts or reactions in capability settings did not block regular members from creating posts or reactions. | `src/features/discussions/service.ts`, `src/components/circles/circle-studio-client.tsx` | Added capability settings enforcement in `createPost` and `toggleReaction` and exposed interactive checkboxes in Circle Studio. Verified in `security-audit-regression.test.ts` (#5). |
| **AUD-07** | **P2** | Missing UI Controls for Saved Posts Filter, Space Reordering, Ownership Transfer & Member Suspension in Circle Studio | Backend service functions and API endpoints existed for `saveItem`, space reordering (`action: 'reorder'`), `transferCircleOwnership`, and member suspension, but the corresponding UI buttons were omitted. | Circle owners had to use API calls rather than Circle Studio buttons to reorder spaces or transfer ownership, and members could bookmark posts without a "Saved Only" feed filter. | `src/components/circles/discussions-client.tsx`, `src/components/circles/circle-studio-client.tsx` | Added "Saved Only" filter button in `DiscussionsClient` and space reordering (`↑`/`↓`), member "Suspend/Restore", and "Make Owner" buttons in `CircleStudioClient`. |
| **AUD-08** | **P2** | Missing `/api/health` Readiness Endpoint | `AGENTS.md` listed `/api/health` under `src/app/api/`, but no route handler file existed. | Load balancers and container orchestrators lacked a health/readiness probe to verify PostgreSQL connectivity and secret configuration. | `src/app/api/health/route.ts` | Implemented `GET /api/health` verifying session secret configuration and executing a live PostgreSQL transaction check. |

---

## 3. Architecture & Database Verification (Local PGlite vs. Hosted Supabase PostgreSQL)

###Verified Transaction & RLS Execution Model
1. **Per-Transaction Identity & Role Switching**:
   - Every domain query executes inside `withRlsTransaction(actorUserId, fn)` in `src/lib/db/postgres.ts`.
   - Inside `db.transaction(...)`, the executor runs:
     - When `actorUserId` is present: `SET LOCAL ROLE authenticated;` and `SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true);`
     - When `actorUserId` is `null`: `SET LOCAL ROLE anon;` and clears `request.jwt.claim.sub`.
   - Because `SET LOCAL` and `set_config(..., true)` are scoped strictly to the current PostgreSQL transaction (`BEGIN ... COMMIT/ROLLBACK`), identity claims never leak across transactions.
2. **Rollback & Concurrency Guarantees**:
   - Any uncaught error inside `withRlsTransaction` aborts the PostgreSQL transaction and rolls back all uncommitted statements (verified in `security-audit-regression.test.ts` #6).
   - PGlite serializes transactions over its single embedded Postgres backend mutex while `pg.Pool` in production allocates an isolated connection per transaction from the pool. Concurrent calls (`Promise.all`) for `userA`, `userB`, and `anon` were verified to preserve strict `auth.uid()` isolation.
3. **Differences Between Local PGlite and Hosted Supabase PostgreSQL**:
   - **Process Model**: PGlite runs an embedded WebAssembly PostgreSQL 16 engine in-process (persisted to `.pgdata/` in local dev or in-memory during `VITEST`), whereas production uses a `pg.Pool` (`DATABASE_URL` / `SUPABASE_DB_URL`) connecting to Supabase PostgreSQL.
   - **Authentication Bridge**: In Supabase Cloud mode, `supabase.auth.getUser()` validates the Supabase Auth JWT and `auth.uid()` reads `request.jwt.claim.sub`. Our `0001_initial_schema.sql` migration safely creates `auth.uid()` and `auth.role()` inside a `DO $$ BEGIN ... EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;` block so applying the migration to hosted Supabase never conflicts with Supabase's managed `auth` schema.
   - **Fail-Closed Production Guard**: `assertProductionDatabaseConfigured()` blocks accidental use of embedded PGlite when `NODE_ENV=production` unless `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true` is explicitly set for self-hosted single-node evaluation.

---

## 4. Security & RLS Verification Matrix

All checks below are enforced in PostgreSQL (`0001_initial_schema.sql` + `0002_security_hardening.sql`) and verified with real multi-user database transactions:

- **Anonymous users cannot read private Circle data**: Enforced by `circles_select`, `spaces_select`, `posts_select`, `comments_select`, and `memberships_select`. Verified in `vertical-slice-and-rls.test.ts` and `api-security.test.ts`.
- **Non-members cannot read protected Circle content**: Discoverable-approval Circles expose Circle metadata (`can_discover_circle`) so users can request to join, while `can_read_circle_content` blocks non-members from reading spaces, posts, comments, or member directories.
- **Members cannot escalate their own role or restore suspended status**: Enforced by `trg_enforce_membership_transitions` (`0002_security_hardening.sql`) and `updateMemberRole`. Verified in `security-audit-regression.test.ts` (#3).
- **Circle administrators cannot hijack ownership or administer another Circle**: Enforced by `trg_protect_circle_ownership`, Circle-scoped RLS (`is_circle_admin(circle_id)`), and composite foreign keys (`(id, circle_id)`).
- **Disabled capabilities block reads/writes without deleting data**: `is_capability_enabled(circle_id, 'discussions')` in `posts_select`, `posts_insert`, `comments_select`, and `comments_insert` blocks access while preserving all rows in `public.posts`, `public.comments`, and `public.circle_spaces`. Verified in `vertical-slice-and-rls.test.ts`.
- **Last-owner protection**: Enforced by `BEFORE UPDATE OR DELETE` trigger `trg_prevent_last_owner_loss` on `public.circle_memberships`. Verified in `vertical-slice-and-rls.test.ts`.

---

## 5. Production Deployment Checklist

### Required Environment Variables (`NODE_ENV=production`)
1. `CIRCLES_SESSION_SECRET` — Cryptographically random 32+ character secret (`openssl rand -hex 32`). **Required; server fails closed if missing or default.**
2. `NEXT_PUBLIC_SUPABASE_URL` — Hosted Supabase project URL.
3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous public API key.
4. `SUPABASE_SERVICE_ROLE_KEY` — Server-only service role key (never exposed to client bundles).
5. `DATABASE_URL` (or `SUPABASE_DB_URL`) — Direct/Supavisor session-mode PostgreSQL connection string for transactional RLS execution.
6. `RESEND_API_KEY` & `RESEND_FROM_EMAIL` — Optional; required for live transactional emails (invitations, join approvals, password recovery).

### Database Migration Order
1. Apply `supabase/migrations/0001_initial_schema.sql`
2. Apply `supabase/migrations/0002_security_hardening.sql`
3. *(Development/Staging only)* Apply `supabase/seed.sql`

### Health & Monitoring
- Configure load balancer readiness probe against `GET /api/health` (expects HTTP `200` with `{"status":"healthy","database":"connected"}`).
