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

---

## 2. Automated Local Pre-Staging Verification (`[x] Verified Locally`)

- [x] **Linting (`npm run lint`)**: Passed with zero ESLint warnings or errors.
- [x] **Type Checking (`npm run typecheck`)**: Passed `tsc --noEmit` in strict mode with zero errors.
- [x] **Automated Test Suite (`npm test`)**: Passed all 5 test files (**20/20 tests**).
- [x] **Migration Runner CLI (`npm run db:migrate`)**: Applied migrations `0001`, `0002`, `0003`, and `0004` in order, recorded SHA-256 checksums in `public.schema_migrations`, and verified idempotency on second run (`Applied: 0, Skipped: 4`).
- [x] **Production Build (`npm run build`)**: Passed `next build` cleanly across all 21 routes.

---

## 3. Hosted Supabase Staging End-to-End Verification Checklist (`[ ] Pending Hosted Staging Verification`)

- [ ] Run `DATABASE_URL="postgresql://..." npm run db:migrate` against the fresh Supabase staging database and verify `public.schema_migrations` records `0001`–`0004`.
- [ ] Confirm `GET /api/health` returns HTTP `200` with `{"status":"healthy","database":"connected","backend":"remote_pg","mode":"supabase_configured"}`.
- [ ] Verify user registration, sign-in, session fixation rotation, logout revocation, and password recovery via Resend against `public.user_sessions` and `auth.users`.
- [ ] Verify Circle creation (`public`, `discoverable_approval`, `private`), join requests, invitations, role transitions, and last-owner protection.
- [ ] Verify capability enable/disable non-destructive persistence, capability settings enforcement, moderation actions, and audit logs.
