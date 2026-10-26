# Circles — Supabase Staging & Production Deployment Guide

**Last Updated**: 2026-10-26  
**Target Architecture**: Next.js 14 App Router + Remote PostgreSQL (`pg.Pool`) / Supabase Cloud with Row-Level Security (RLS)

---

## 1. Database Execution Architecture

Circles uses a unified transactional RLS query executor in [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) that supports two explicit backends selected by [`getDatabaseBackendMode()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts#L98-L115):

1. **`remote_pg` (`pg.Pool`) — Staging & Production Default**:
   - Activated whenever `DATABASE_URL` (or `SUPABASE_DB_URL`) is configured with a valid `postgresql://` or `postgres://` connection string.
   - Both [`withRlsTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L341-L350) and [`withServiceRoleTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L357-L364) check out a dedicated `PoolClient` from the singleton `pg.Pool`, execute `BEGIN`, set the transaction-local role (`SET LOCAL ROLE authenticated | anon | service_role`) and JWT claims (`SELECT set_config('request.jwt.claim.sub', $1, true)`), run parameterized SQL statements, `COMMIT` (or `ROLLBACK` on any error), and deterministically call `client.release()` in `finally`.
   - Does **not** run DDL migrations automatically on every application boot, preventing race conditions and lock contention in multi-instance or serverless deployments.
2. **`embedded_pglite` (`@electric-sql/pglite`) — Local Development & Deterministic CI Tests**:
   - Activated only in non-production environments when `DATABASE_URL` is omitted (or in `NODE_ENV=production` only if `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true` is explicitly set for single-node self-hosted evaluation).
   - If `NODE_ENV=production` and `DATABASE_URL` / Supabase credentials are missing without `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true`, the server **fails closed** with a `ConfigurationError`.

---

## 2. Required Environment Variables

Configure the following environment variables in your staging/production hosting platform (Vercel, Railway, Render, Fly.io, AWS ECS, or Docker) and in `.env.local` for local staging verification:

| Variable Name | Scope | Required in Staging/Prod | Where to Obtain & Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Server-Only** | **Yes** | **Supabase Dashboard → Connect → URI (Session Pooler port `5432` or Direct Connection port `5432`)**. Used by `pg.Pool` in [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) and [`scripts/migrate.mjs`](file:///C:/Users/HomePC/Desktop/circles/scripts/migrate.mjs). |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → Project URL** (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`**. Safe for browser exposure; constrained by PostgreSQL RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** | **Yes** | **Supabase Dashboard → Project Settings → API → Project API keys → `service_role` `secret`**. Never expose to client code or `NEXT_PUBLIC_*`. |
| `CIRCLES_SESSION_SECRET` | **Server-Only** | **Yes** | Generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Must be $\ge 32$ characters with $\ge 10$ unique characters. Signs HMAC-SHA256 session tokens verified against `public.user_sessions`. |
| `NEXT_PUBLIC_APP_URL` | Client & Server | **Yes** | Canonical public HTTPS origin of the staging/production deployment (e.g., `https://staging.circles.example.com`). |
| `RESEND_API_KEY` | **Server-Only** | Recommended | **Resend Dashboard → API Keys**. Delivers password recovery and notification emails. |
| `RESEND_FROM_EMAIL` | **Server-Only** | Recommended | Verified sender identity in Resend (e.g., `Circles <no-reply@circles.example.com>`). |
| `PG_POOL_MAX` | **Server-Only** | Optional | Maximum concurrent PostgreSQL connections per Node.js instance (default: `10`). For serverless platforms (e.g., Vercel), set to `3`–`5`. |
| `PG_IDLE_TIMEOUT_MS` | **Server-Only** | Optional | Idle client timeout in milliseconds (default: `30000`). |
| `PG_CONNECTION_TIMEOUT_MS` | **Server-Only** | Optional | Connection acquisition timeout in milliseconds (default: `10000`). |

---

## 3. Step-by-Step Staging Deployment Procedure

### Step 1: Provision Supabase Project
1. Create a new project in [Supabase Dashboard](https://supabase.com/dashboard).
2. Wait for the PostgreSQL database to finish provisioning.
3. Copy the **Database Connection String** (`DATABASE_URL`), **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`), **Anon Key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), and **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`).

### Step 2: Run Database Migrations (`npm run db:migrate`)
Run the ordered SQL migrations against your staging database before starting or deploying the application:

```bash
export DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
npm run db:migrate
```

What `npm run db:migrate` ([`scripts/migrate.mjs`](file:///C:/Users/HomePC/Desktop/circles/scripts/migrate.mjs)) does:
1. Connects to `DATABASE_URL` and begins a transaction.
2. Creates `public.schema_migrations` if it does not exist.
3. Checks already-applied versions in `public.schema_migrations` and applies unapplied migrations in strict lexicographical order:
   - [`0001_initial_schema.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0001_initial_schema.sql)
   - [`0002_security_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0002_security_hardening.sql)
   - [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql)
   - [`0004_supabase_staging_compatibility.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0004_supabase_staging_compatibility.sql)
4. Records each migration's `version`, `filename`, and SHA-256 `checksum` in `public.schema_migrations`.
5. Exits with code `0` on success, or rolls back and exits with code `1` on any SQL error.

### Step 3: Build and Start the Application
```bash
npm run build
npm run start
```

### Step 4: Verify Health & Readiness
Query `GET /api/health`:
```bash
curl -i https://<your-staging-domain>/api/health
```
Expected response (`200 OK`):
```json
{
  "status": "healthy",
  "database": "connected",
  "backend": "remote_pg",
  "mode": "supabase_configured",
  "timestamp": "2026-10-26T09:15:00.000Z"
}
```
