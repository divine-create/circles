# Circles — Modular Community Platform

> **One shared platform. Many types of communities. Each community configures its own experience.**

Circles is a production-oriented, multi-tenant community platform built with **Next.js App Router**, **TypeScript (strict mode)**, **Tailwind CSS**, and **PostgreSQL with Row-Level Security (RLS)**.

---

## Quick Start (Local Development)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables (optional for local embedded PostgreSQL)**:
   ```bash
   cp .env.example .env.local
   ```
   *Note: When `NEXT_PUBLIC_SUPABASE_URL` is left blank, Circles automatically initializes an embedded PostgreSQL database (`@electric-sql/pglite`) in `.pgdata/`, applies `supabase/migrations/0001_initial_schema.sql` and `supabase/seed.sql`, and enforces PostgreSQL Row-Level Security on every request.*

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

### Seeded Local Verification Accounts
On first boot in local development, three accounts are seeded (password: `CirclesDemo123!`):
- `amara@circles.dev` — Owner of *Highbury Green Residents Collective* & *Civic Product Builders Guild*, Platform Admin
- `liam@circles.dev` — Owner of *Edinburgh Computing & AI Society*
- `sofia@circles.dev` — Active Community Member

---

## Verification & Testing

- **Database Migrations (`npm run db:migrate`)**:
  ```bash
  npm run db:migrate
  ```
  Applies migrations `0001` through `0005` in order to the configured PostgreSQL database (`DATABASE_URL`), tracking SHA-256 checksums in `public.schema_migrations`.
- **TypeScript Strict Check**:
  ```bash
  npm run typecheck
  ```
- **Lint Check**:
  ```bash
  npm run lint
  ```
- **Unit & PostgreSQL RLS Integration Tests**:
  ```bash
  npm test
  ```
  Runs 7 test suites (28 tests) covering capability registries, PostgreSQL RLS policies, CSRF protection, distributed rate limiting, and live hosted Supabase PostgreSQL 17.11 integration.
- **Production Build**:
  ```bash
  npm run build
  ```
  Compiles all 22 static and dynamic App Router routes.

---

## Deployment & Staging (Vercel + Hosted Supabase)

1. Provision a Supabase project and obtain the **Session Pooler URI (port 5432)**.
2. Run database migrations:
   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" npm run db:migrate
   ```
3. Configure environment variables in your deployment environment (Vercel / Railway / Docker):
   - `DATABASE_URL` — Supabase Session Pooler URI (IPv4 compatible)
   - `NEXT_PUBLIC_APP_URL` — Canonical origin (e.g. `https://circles.example.com`)
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (`https://<ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role secret key
   - `CIRCLES_SESSION_SECRET` — 64-character random hex string (`crypto.randomBytes(32).toString('hex')`)
   - `RESEND_API_KEY` & `RESEND_FROM_EMAIL` (optional, for transactional email delivery)
4. Deploy and verify readiness at `GET /api/health`. See [`staging-deployment-guide.md`](file:///C:/Users/HomePC/Desktop/circles/staging-deployment-guide.md) for full procedures and credential rotation runbooks.
