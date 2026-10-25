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
- **Production Build**:
  ```bash
  npm run build
  ```

---

## Deployment (Vercel + Supabase)

1. Provision a Supabase project and apply `supabase/migrations/0001_initial_schema.sql` followed by `supabase/seed.sql`.
2. Configure the following environment variables in Vercel:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CIRCLES_SESSION_SECRET` (32+ byte random hex string)
   - `RESEND_API_KEY` & `RESEND_FROM_EMAIL` (optional, for transactional email delivery)
3. Deploy via Vercel (`vercel --prod`).
