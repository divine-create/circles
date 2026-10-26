# Circles — Staging Verification Checklist & Environment Reference

**Last Updated**: 2026-10-26  
**Current Readiness Status**: `HOSTED STAGING VERIFIED` (Verified end-to-end against live hosted Supabase PostgreSQL 17.11 in `eu-west-1` as well as all local unit, RLS, and HTTP API regression suites).

---

## 1. Authoritative Environment Variable Reference

Every environment variable below is verified against [`src/lib/config/env.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts), [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts), [`src/lib/db/supabase.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/supabase.ts), and [`src/lib/email/index.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/email/index.ts):

| Exact Variable Name | Exposure Scope | Required in Staging/Prod | Where to Obtain & How to Configure |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` (or `SUPABASE_DB_URL`) | **Server-Only** | **Yes** | **Supabase Dashboard → Connect → Session Pooler URI (`postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`)**. Use the Session Pooler URI rather than `db.<project-ref>.supabase.co` on IPv4 networks (direct hostnames are IPv6-only). |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → Project URL** (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Client & Server | **Yes** | **Supabase Dashboard → Project Settings → API → Project API keys → `anon` / `publishable`**. Safe for browser bundle; subject to PostgreSQL RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** | Optional when `DATABASE_URL` is set | **Supabase Dashboard → Project Settings → API → `service_role` `secret`**. Server-side privileged SQL operations execute over `DATABASE_URL` via `withServiceRoleTransaction`. |
| `CIRCLES_SESSION_SECRET` | **Server-Only** | **Yes** | Generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Validated by [`getVerifiedSessionSecret()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts#L23-L39): must be $\ge 32$ characters with $\ge 10$ distinct characters. |
| `NEXT_PUBLIC_APP_URL` | Client & Server | **Yes** | Public HTTPS origin of the staging/production deployment (e.g., `https://staging.circles.example.com`). |
| `RESEND_API_KEY` | **Server-Only** | Optional (Recommended) | **Resend Dashboard → API Keys**. Delivers password recovery and notification emails (falls back to structured outbox logging when omitted). |
| `RESEND_FROM_EMAIL` | **Server-Only** | Optional (Recommended) | Verified sender address in Resend (e.g., `Circles <notifications@circles.example.com>`). |
| `PG_POOL_MAX` | **Server-Only** | Optional | Max connections per Node.js process in `pg.Pool` (default: `10`; set to `3`–`5` on serverless platforms). |

---

## 2. Automated Local & Hosted Pre-Staging Verification (`[x] Verified`)

- [x] **Linting (`npm run lint`)**: Passed with zero ESLint warnings or errors.
- [x] **Type Checking (`npm run typecheck`)**: Passed `tsc --noEmit` in strict mode with zero errors.
- [x] **Automated Test Suite (`npm test`)**: Passed all **7 test files (28/28 tests)** including [`tests/integration/hosted-supabase-staging.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/hosted-supabase-staging.test.ts) and [`tests/integration/remaining-features-and-security.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/remaining-features-and-security.test.ts).
- [x] **Migration Runner CLI (`npm run db:migrate`)**: Applied migrations `0001`, `0002`, `0003`, `0004`, and `0005` in order to live hosted Supabase PostgreSQL 17.11 (`aws-0-eu-west-1.pooler.supabase.com:5432`) and verified idempotency on re-run (`Applied: 0, Skipped: 5`).
- [x] **Production Build (`npm run build`)**: Passed `next build` cleanly across all 22 static and dynamic routes.

---

## 3. Hosted Supabase Staging End-to-End Verification Checklist (`[x] Verified on Live Hosted Supabase PostgreSQL 17.11`)

Every item below was executed and verified against the live hosted Supabase project (`vfbqurszheoyyqbugdse`, PostgreSQL 17.11, `eu-west-1`) via [`tests/integration/hosted-supabase-staging.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/hosted-supabase-staging.test.ts) and [`tests/integration/remaining-features-and-security.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/remaining-features-and-security.test.ts):

### 3.1 Database Migrations & Schema Verification
- [x] Executed `npm run db:migrate` against the hosted Supabase database (`Applied: 5, Skipped: 0`).
- [x] Verified `public.schema_migrations` contains `0001`, `0002`, `0003`, `0004`, and `0005` with SHA-256 checksums.
- [x] Re-ran `npm run db:migrate` and confirmed idempotency (`Applied: 0, Skipped: 5`).
- [x] Confirmed `GET /api/health` returns HTTP `200` with `{"status":"healthy","database":"connected","backend":"remote_pg","mode":"supabase_configured"}`.

### 3.2 Authentication & Session Lifecycle
- [x] Registered users on hosted Supabase and verified rows in `auth.users`, `public.profiles`, and `public.user_sessions`.
- [x] Signed in with valid credentials and verified invalid passwords fail with `UnauthorizedError`.
- [x] Verified session fixation rotation on `POST /api/auth/login` revokes the prior session token in `public.user_sessions`.
- [x] Signed out and confirmed the revoked session token is immediately rejected.
- [x] Requested password recovery, reset password with single-use token, confirmed all prior sessions for the user were revoked in `public.user_sessions`, and confirmed token reuse is rejected.

### 3.3 Circle Lifecycle, Discovery & Visibility Isolation
- [x] Created `public` (`university` template), `discoverable_approval` (`professional` template), and `private` (`neighbourhood` template) Circles on hosted Supabase.
- [x] Verified anonymous discovery returns `public` and `discoverable_approval` Circles while hiding `private` Circles.
- [x] Verified non-members cannot read internal spaces or posts of `discoverable_approval` or `private` Circles under hosted Supabase RLS.

### 3.4 Memberships, Role Hierarchy & Ownership Protection
- [x] Joined a `public` Circle as an ordinary member and promoted a member to `admin`.
- [x] Submitted a join request to a `discoverable_approval` Circle and approved it via `approveJoinRequest`.
- [x] Issued an invitation to a `private` Circle, verified a different email account cannot hijack the token, and accepted the invitation as the invited email owner.
- [x] Verified `members_only` profile visibility (`shares_active_circle_with`) under hosted Supabase RLS.
- [x] Verified last-owner protection blocks the sole owner from leaving, and verified `transferCircleOwnership` works end-to-end.

### 3.5 Capability Lifecycle, Spaces & Discussions
- [x] Created custom spaces, reordered spaces, and archived spaces on hosted Supabase.
- [x] Created posts, comments, reactions, and saved items, and verified ordinary members cannot pin posts.
- [x] Enforced `allowMemberPosts: false` on `discussions` and verified non-destructive capability disabling (`updateCircleCapability`) preserves existing posts and restores them upon re-enabling.

### 3.6 Moderation & Audit Logging
- [x] Submitted content reports (`reportContent`), listed reports (`listModerationReports`), suspended and restored a member via `PATCH /api/moderation`, confirmed suspended members cannot post, and verified `public.audit_logs` on hosted Supabase.

### 3.7 Remaining Capabilities & Production Security Controls
- [x] **Events & RSVPs**: Created events, RSVPed with capacity limit, waitlist overflow, and waitlist auto-promotion on cancellation. Verified attendance check-in restricted to organizers.
- [x] **Polls & Decisions**: Cast single and multi-choice votes, verified single-vote enforcement by `trg_enforce_poll_vote_integrity`, tested `after_vote` and `after_close` visibility, and recorded final decision summaries.
- [x] **Marketplace, Bookings & Rentals**: Created listings, inquiries, service/rental bookings, double-booking prevention by `trg_prevent_booking_conflicts`, and return condition tracking.
- [x] **Jobs & Strict Applicant Privacy**: Posted job openings, submitted applications, verified applicant privacy under RLS preventing third-party members from reading candidate records.
- [x] **Resources & Collaborative Projects**: Created modules, bookmarks, projects, task assignments, and completion states.
- [x] **Governance, Causes & Challenges**: Submitted proposals, cast votes, recorded decisions, created fundraising causes with pledge intentions, created community challenges, and verified `trg_protect_challenge_rewards` prevents self-awarding.
- [x] **Help Desk Support Tickets**: Created private member tickets, verified non-author members cannot access tickets, and verified responses by support staff.
- [x] **Secure Media Uploads**: Validated file size ($\le 10$ MB), allowlisted MIME types, binary magic-byte inspection, HMAC-SHA256 signed download URL verification, and RLS delete cleanup.
- [x] **CSRF Protection**: Verified cross-site mutation blocking with `Sec-Fetch-Site` inspection and origin validation across state-changing endpoints.
- [x] **Distributed Rate Limiting**: Verified atomic counter increments in `public.rate_limit_buckets` enforcing rate limits under concurrent requests.
