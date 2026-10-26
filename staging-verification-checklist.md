# Circles — Staging Verification Checklist & Environment Reference

**Last Updated**: 2026-10-26  
**Current Readiness Status**: `LOCAL STAGING READY` (All 20 automated unit, integration, RLS, `pg.Pool` remote executor, migration tracking, and HTTP API security tests pass locally; live hosted Supabase staging verification is pending external credentials).

---

## 1. Authoritative Environment Variable Reference

Every environment variable below is verified against [`src/lib/config/env.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts), [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts), [`src/lib/db/supabase.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/supabase.ts), and [`src/lib/email/index.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/email/index.ts):

| Exact Variable Name | Exposure Scope | Required in Staging/Prod | Where to Obtain & How to Configure |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` (or `SUPABASE_DB_URL`) | **Server-Only** | **Yes** | **Supabase Dashboard → Connect → URI (Session Pooler port `5432` or Direct Connection port `5432`)**. Must begin with `postgresql://` or `postgres://`. Activates the `pg.Pool` remote PostgreSQL executor in [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts). |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → Project URL** (`https://<project-ref>.supabase.co`). Must begin with `http://` or `https://`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`**. Safe for browser bundle; subject to PostgreSQL RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** | **Yes** | **Supabase Dashboard → Project Settings → API → Project API keys → `service_role` `secret`**. Never expose to client components or `NEXT_PUBLIC_*`. |
| `CIRCLES_SESSION_SECRET` | **Server-Only** | **Yes** | Generate locally via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Validated by [`getVerifiedSessionSecret()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts#L23-L39): must be $\ge 32$ characters with $\ge 10$ distinct characters. |
| `NEXT_PUBLIC_APP_URL` | Client & Server | **Yes** | Public HTTPS origin of the staging/production deployment (e.g., `https://staging.circles.example.com`). Set to `http://localhost:3000` in local development. |
| `RESEND_API_KEY` | **Server-Only** | Optional (Recommended) | **Resend Dashboard → API Keys → Create API Key**. Used by [`sendTransactionalEmail()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/email/index.ts) for password recovery and notification emails. |
| `RESEND_FROM_EMAIL` | **Server-Only** | Optional (Recommended) | Verified sender address in Resend (e.g., `Circles <notifications@circles.example.com>`). |
| `PG_POOL_MAX` | **Server-Only** | Optional | Max connections per Node.js process in `pg.Pool` (default: `10`; set to `3`–`5` on serverless platforms). |
| `PG_IDLE_TIMEOUT_MS` | **Server-Only** | Optional | Idle connection timeout in milliseconds (default: `30000`). |
| `PG_CONNECTION_TIMEOUT_MS` | **Server-Only** | Optional | Connection acquisition timeout in milliseconds (default: `10000`). |
| `PG_SSL` / `PG_SSL_REJECT_UNAUTHORIZED` | **Server-Only** | Optional | SSL configuration for `pg.Pool` when connecting to managed cloud PostgreSQL instances. |
| `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION` | **Server-Only** | Optional (`false`) | Must remain unset or `false` in staging/production so missing `DATABASE_URL` fails closed. |

### Credential Rotation Procedure
- **`CIRCLES_SESSION_SECRET`**: Generate a new 32-byte hex secret, update the hosting environment variable, redeploy, and optionally run `UPDATE public.user_sessions SET revoked_at = NOW() WHERE revoked_at IS NULL;` to invalidate all active session records.
- **`DATABASE_URL`**: Rotate the database password in **Supabase Dashboard → Project Settings → Database**, update `DATABASE_URL` in the hosting environment, and redeploy.
- **`SUPABASE_SERVICE_ROLE_KEY` / `RESEND_API_KEY`**: Roll the secret key in the provider dashboard, update the server-only environment variable in the hosting platform, and redeploy.

---

## 2. Automated Local Pre-Staging Verification (`[x] Verified Locally`)

- [x] **Linting (`npm run lint`)**: Passed with zero ESLint warnings or errors.
- [x] **Type Checking (`npm run typecheck`)**: Passed `tsc --noEmit` in strict mode with zero errors.
- [x] **Automated Test Suite (`npm test`)**: Passed all 5 test files (**20/20 tests**):
  - [`tests/unit/capabilities-and-permissions.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/unit/capabilities-and-permissions.test.ts) (6 tests)
  - [`tests/integration/vertical-slice-and-rls.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/vertical-slice-and-rls.test.ts) (4 tests)
  - [`tests/integration/api-security.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/api-security.test.ts) (1 comprehensive HTTP API test)
  - [`tests/integration/security-audit-regression.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/security-audit-regression.test.ts) (6 security regression tests)
  - [`tests/integration/postgres-executor-and-migrations.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/postgres-executor-and-migrations.test.ts) (3 `pg.Pool` remote executor, migration tracking, and backend selection tests)
- [x] **Migration Runner CLI (`npm run db:migrate`)**: Applied migrations `0001`, `0002`, `0003`, and `0004` in order, recorded SHA-256 checksums in `public.schema_migrations`, and verified idempotency on second run (`Applied: 0, Skipped: 4`).
- [x] **Production Build (`npm run build`)**: Passed `next build` cleanly across all 21 routes.

---

## 3. Hosted Supabase Staging End-to-End Verification Checklist (`[ ] Pending Hosted Staging Verification`)

Execute and check off each item below once connected to a live hosted Supabase PostgreSQL project:

### 3.1 Database Migrations & Schema Verification
- [ ] Run `DATABASE_URL="postgresql://..." npm run db:migrate` against the fresh Supabase staging database.
- [ ] Verify `SELECT version, filename, checksum, applied_at FROM public.schema_migrations ORDER BY version;` returns `0001`, `0002`, `0003`, and `0004`.
- [ ] Re-run `npm run db:migrate` and confirm it reports `Applied: 0, Skipped: 4` with zero errors.
- [ ] Confirm `GET /api/health` returns HTTP `200` with `{"status":"healthy","database":"connected","backend":"remote_pg","mode":"supabase_configured"}`.

### 3.2 Authentication & Session Lifecycle
- [ ] Register a new user via `POST /api/auth/register` (or `/register` UI) and verify rows are created in `auth.users`, `public.profiles`, and `public.user_sessions`.
- [ ] Sign in with valid credentials (`POST /api/auth/login`) and verify invalid passwords return HTTP `401`.
- [ ] Verify signing in when already holding a session cookie revokes the previous session in `public.user_sessions`.
- [ ] Sign out (`POST /api/auth/logout`) and verify replaying the old session token is immediately rejected (`401`).
- [ ] Request password recovery (`POST /api/auth/recover`), confirm `previewToken` is **not** returned in `NODE_ENV=production`, receive the recovery email via Resend, reset the password, and confirm all prior sessions for that user have `revoked_at IS NOT NULL` in `public.user_sessions`.

### 3.3 Circle Lifecycle, Discovery & Visibility Isolation
- [ ] Create a `public` Circle, a `discoverable_approval` Circle, and a `private` Circle.
- [ ] Verify anonymous visitors can view the `public` Circle, see only the summary card for `discoverable_approval` (with internal spaces/posts/members hidden), and cannot discover or access the `private` Circle.

### 3.4 Memberships, Role Hierarchy & Ownership Protection
- [ ] Join a `public` Circle as an ordinary member.
- [ ] Submit a join request to a `discoverable_approval` Circle, approve it as Circle admin/owner, and verify non-admin moderators cannot read `circle_join_requests`.
- [ ] Issue an invitation (`circle_invitations`), verify a Circle admin cannot invite with `role = 'admin'`, and accept the invitation as the invited email owner.
- [ ] Verify the sole Circle owner cannot leave, be removed, or be demoted without first transferring ownership (`transferCircleOwnership`).

### 3.5 Capability Lifecycle & Settings Enforcement
- [ ] Enable and disable capabilities in Circle Studio; verify dependency validation blocks invalid transitions.
- [ ] Disable `discussions` and `spaces`, confirm underlying `posts` and `circle_spaces` rows remain intact in PostgreSQL, confirm read/write operations are blocked while disabled, and re-enable to restore access.
- [ ] Set `allowMemberPosts: false` and `allowReactions: false` on `discussions` and confirm ordinary members are blocked from posting or reacting at both the service layer and PostgreSQL RLS layer.

### 3.6 Moderation & Audit Logging
- [ ] Submit a content report (`POST /api/moderation`), hide/remove a post, and suspend/restore an ordinary member via Circle Studio (`PATCH /api/moderation`).
- [ ] Verify suspended members cannot post, comment, react, or self-restore their membership status.
- [ ] Verify `public.moderation_actions` and `public.audit_logs` record every administrative action.
