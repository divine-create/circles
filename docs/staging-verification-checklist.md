# Circles — Staging Verification Checklist & Environment Reference

**Last Updated**: 2026-10-26  
**Current Readiness Status**: `HOSTED STAGING VERIFIED` (Verified end-to-end against live hosted Supabase PostgreSQL 17.11 in `eu-west-1` as well as all local unit, RLS, and HTTP API regression suites).

---

## 1. Authoritative Environment Variable Reference

| Exact Variable Name | Exposure Scope | Required in Staging/Prod | Where to Obtain & How to Configure |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` (or `SUPABASE_DB_URL`) | **Server-Only** | **Yes** | **Supabase Dashboard → Connect → Session Pooler URI (`postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`)**. Use the Session Pooler URI rather than `db.<project-ref>.supabase.co` on IPv4 networks. |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → Project URL** (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → `anon` / `publishable`**. |
| `CIRCLES_SESSION_SECRET` | **Server-Only** | **Yes** | Generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Must be $\ge 32$ characters with $\ge 10$ distinct characters. |
| `NEXT_PUBLIC_APP_URL` | Client & Server | **Yes** | Public HTTPS origin of the staging/production deployment. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | **Server-Only** | Optional (Recommended) | **Resend Dashboard → API Keys**. |

---

## 2. Hosted Supabase Staging End-to-End Verification (`[x] Verified on Live Hosted Supabase PostgreSQL 17.11`)

- [x] Executed `npm run db:migrate` against hosted Supabase PostgreSQL 17.11 (`Applied: 4, Skipped: 0`) and verified idempotency (`Applied: 0, Skipped: 4`).
- [x] Confirmed `GET /api/health` returns HTTP `200` with `{"status":"healthy","database":"connected","backend":"remote_pg","mode":"supabase_configured"}`.
- [x] Verified registration, sign-in, session fixation rotation, logout revocation, and single-use password recovery against `public.user_sessions` and `auth.users`.
- [x] Verified `public`, `discoverable_approval`, and `private` Circle creation, discovery, join requests, invitations, role hierarchy, and last-owner protection.
- [x] Verified capability enable/disable non-destructive persistence, capability settings enforcement, spaces, discussions, moderation actions, and audit logs.
