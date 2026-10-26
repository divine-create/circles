# Circles Platform — Phase 2 Independent Verification & Staging Readiness Audit

## 1. Executive Summary

This document records the **Phase 2 Independent Verification and Staging Readiness Audit** of the **Circles** codebase (`C:\Users\HomePC\Desktop\circles`), starting from commit `099fa7d` on branch `master`.

Rather than trusting the Phase 1 audit report at face value, every claim (`AUD-01` through `AUD-08`), database migration (`0001_initial_schema.sql`, `0002_security_hardening.sql`), service module, API route, UI component, and test file was independently inspected against the actual source code and runtime behavior.

### Key Conclusions
1. **Baseline Verification**: At the start of Phase 2, `npm run lint`, `npm run typecheck`, `npm test` (4 suites, 17 tests), and `npm run build` passed.
2. **Independent Audit of `AUD-01` through `AUD-08`**:
   - **3 of the 8 previous findings** (`AUD-02`, `AUD-04`, `AUD-05`) were substantially fixed, though `AUD-02` and `AUD-05` had secondary hardening gaps in hosted PostgreSQL grants (`auth.sessions`), login session fixation, and `'members_only'` profile visibility.
   - **5 of the 8 previous findings** (`AUD-01`, `AUD-03`, `AUD-06`, `AUD-07`, `AUD-08`) were **PARTIALLY FIXED** and contained **6 newly discovered defects** (`NEW-01` through `NEW-06`), including:
     - **NEW-01 (P0 — Broken Member Suspension in Circle Studio)**: `CircleStudioClient` sent `{ action, targetUserId, note }` to `PATCH /api/moderation`, while `moderateContent` expected `{ actionType, targetId, reason }`, causing a runtime `TypeError` (HTTP 500) when suspending or restoring a member from Circle Studio.
     - **NEW-02 (P0 — Direct SQL Privilege Escalation on `memberships_insert`, `invitations_insert`, and `posts_update`)**: `0002_security_hardening.sql` only attached a `BEFORE UPDATE` trigger on `circle_memberships`, leaving `memberships_insert` open for a Circle `admin` to `INSERT` a new row with `role = 'owner'` or `'admin'` via direct SQL, allowing an `admin` to issue `'admin'` invitations, and allowing ordinary post authors to pin their own posts (`is_pinned = true`).
     - **NEW-03 (P1 — Partial Production Config Bypass & Weak Secret Entropy)**: `isSupabaseConfigured()` only checked `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, allowing partial cloud config to pass `assertProductionDatabaseConfigured()` and silently fall back to local PGlite, while `getVerifiedSessionSecret()` accepted 32-character repeated-character strings (`'a'.repeat(32)`).
     - **NEW-04 (P1 — Missing `auth.sessions` Grants for Hosted Non-Superuser `service_role`)**: `0002_security_hardening.sql` created `auth.sessions` after `0001_initial_schema.sql` ran `GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role`, leaving `auth.sessions` without explicit table grants or RLS in non-superuser hosted PostgreSQL environments.
     - **NEW-05 (P1 — Capability Enforcement Gaps in Direct SQL RLS & Service Mutations)**: `allowMemberPosts` and `allowReactions` were enforced in TypeScript services but not in `posts_insert` / `reactions_insert` RLS policies; disabling `spaces` did not block `archiveCircleSpace`, `reorderCircleSpaces`, or non-admin `spaces_select` RLS; disabling `discussions` did not block `saveItem`; and `'members_only'` profiles were readable by any logged-in user regardless of whether they shared a Circle.
     - **NEW-06 (P2 — Health Endpoint Error Disclosure, Login Session Fixation & Missing Mutation Rate Limits)**: `GET /api/health` echoed raw `error.message` strings in HTTP 503 responses; `POST /api/auth/login` did not revoke an existing session token when issuing a new one; and membership/moderation endpoints lacked per-user rate limits.
3. **Post-Remediation Status**: All 6 newly discovered defects (`NEW-01` through `NEW-06`) have been fixed in source code and in a new forward-compatible migration (`supabase/migrations/0003_staging_rls_and_role_hardening.sql`), verified by expanded integration regression tests in `tests/integration/security-audit-regression.test.ts`.
4. **Local vs. Hosted Supabase Verification**: All unit, service, API, and embedded PostgreSQL 16 (PGlite) RLS/trigger tests have been executed and verified locally. Because no external Supabase Cloud staging credentials (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) are present in this environment, **hosted Supabase verification is `PENDING`** and ready to execute using `staging-verification-checklist.md`.

---

## 2. Independent Verification of Previous Audit Findings (`AUD-01` – `AUD-08`)

| Finding ID | Initial Phase 2 Verification Status | Evidence from Codebase at Start of Phase 2 | Remaining Gap Identified in Phase 2 | Post-Phase 2 Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-01**<br>Production Config Safety | **PARTIALLY FIXED** | `src/lib/config/env.ts` checked `CIRCLES_SESSION_SECRET` length ($\ge 32$) and `isSupabaseConfigured()`. | 1. Accepted low-entropy 32-char secrets (`'a'.repeat(32)`).<br>2. `isSupabaseConfigured()` did not check `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL`, allowing partial config to silently use local PGlite. | **VERIFIED FIXED**<br>(`src/lib/config/env.ts`, `security-audit-regression.test.ts` #5) |
| **AUD-02**<br>Session Revocation | **PARTIALLY FIXED** | `auth.sessions` created in `0002_security_hardening.sql`; `signOutUser` and `resetPasswordWithToken` revoked sessions in `src/lib/auth/session.ts`. | 1. `0002_security_hardening.sql` omitted `GRANT ALL ON TABLE auth.sessions TO postgres, service_role` and `REVOKE ALL ... FROM PUBLIC, anon, authenticated`.<br>2. `POST /api/auth/login` did not revoke a pre-existing session cookie upon re-authentication. | **VERIFIED FIXED**<br>(`0003_staging_rls_and_role_hardening.sql`, `src/app/api/auth/login/route.ts`, `security-audit-regression.test.ts` #1) |
| **AUD-03**<br>PostgreSQL RLS & Ownership Protection | **PARTIALLY FIXED** | `0002_security_hardening.sql` added `BEFORE UPDATE` triggers on `profiles`, `circles`, and `circle_memberships`, and replaced `current_user` with `auth.role()` inside `SECURITY DEFINER` triggers. | 1. `memberships_insert` RLS had no role restriction on the `has_circle_staff_role(circle_id, auth.uid(), 'admin')` branch and no `BEFORE INSERT` trigger, allowing a Circle `admin` to `INSERT` an `'owner'` or `'admin'` row via direct SQL.<br>2. Circle `admin` could invite users as `'admin'`.<br>3. Ordinary members could pin their own posts (`is_pinned = true`) via `updatePost` or direct SQL `UPDATE public.posts`. | **VERIFIED FIXED**<br>(`0003_staging_rls_and_role_hardening.sql`, `src/features/discussions/service.ts`, `src/features/memberships/service.ts`, `security-audit-regression.test.ts` #3) |
| **AUD-04**<br>Password Recovery | **VERIFIED FIXED** | `src/features/auth/service.ts` (`resetPasswordWithToken`, lines 174-185) enforced `recovery_sent_at > NOW() - INTERVAL '1 hour'`, cleared `recovery_token = NULL` on first use, revoked all user sessions, and gated `previewToken` on `NODE_ENV !== 'production'`. | Added explicit automated test asserting `previewToken === undefined` when `NODE_ENV === 'production'`. | **VERIFIED FIXED**<br>(`src/features/auth/service.ts`, `security-audit-regression.test.ts` #1, #2) |
| **AUD-05**<br>Public Posts & Private Profiles | **PARTIALLY FIXED** | `src/features/discussions/service.ts` and `src/features/memberships/service.ts` used `LEFT JOIN public.profiles` with `COALESCE` fallbacks so private profiles stayed hidden while public posts remained visible. | `profiles_select` RLS in `0001_initial_schema.sql` allowed any authenticated user on the platform (`auth.uid() IS NOT NULL AND profile_visibility = 'members_only'`) to read `'members_only'` profiles even if they shared no Circle with the target user. | **VERIFIED FIXED**<br>(`0003_staging_rls_and_role_hardening.sql` `shares_active_circle_with`, `security-audit-regression.test.ts` #4) |
| **AUD-06**<br>Circle Capability Enforcement | **PARTIALLY FIXED** | `createPost` and `toggleReaction` checked `allowMemberPosts` and `allowReactions` in TypeScript. | 1. `posts_insert` and `reactions_insert` RLS policies did not check `allowMemberPosts` / `allowReactions` in SQL.<br>2. `saveItem` did not check `requireEnabledCapability(..., 'discussions')`.<br>3. `archiveCircleSpace`, `reorderCircleSpaces`, and `spaces_select` RLS did not enforce the `spaces` capability. | **VERIFIED FIXED**<br>(`0003_staging_rls_and_role_hardening.sql`, `src/features/discussions/service.ts`, `src/features/spaces/service.ts`, `security-audit-regression.test.ts` #5) |
| **AUD-07**<br>Circle Management Controls | **NOT FIXED** (for Member Suspension UI) / **PARTIALLY FIXED** | Saved-posts filter, space reordering, and ownership transfer worked, **but** `handleToggleMemberSuspension` in `src/components/circles/circle-studio-client.tsx` sent `{ circleId, action, targetUserId, note }` to `PATCH /api/moderation`, whereas `moderateContent` expected `{ circleId, actionType, targetId, reason }`. | Clicking "Suspend" or "Restore" in Circle Studio threw `TypeError: Cannot read properties of undefined (reading 'includes')` (HTTP 500) and failed to update the database. | **VERIFIED FIXED**<br>(`src/components/circles/circle-studio-client.tsx`, `src/features/moderation/service.ts`, `security-audit-regression.test.ts` #3h) |
| **AUD-08**<br>Health Endpoint | **PARTIALLY FIXED** | `src/app/api/health/route.ts` existed, forced dynamic rendering, and executed `SELECT 1 AS ok`. | 1. Catch block returned raw `error.message` in the HTTP 503 JSON response, risking disclosure of internal SQL/config details.<br>2. Did not call `assertProductionDatabaseConfigured()`. | **VERIFIED FIXED**<br>(`src/app/api/health/route.ts`, `security-audit-regression.test.ts` #5) |

---

## 3. New Findings Discovered & Remediated in Phase 2

| ID | Severity | Title | Evidence & Impact | Files / Migrations Changed |
| :--- | :--- | :--- | :--- | :--- |
| **NEW-01** | **P0** | Circle Studio Member Suspension/Restoration Payload Mismatch Causing HTTP 500 | `src/components/circles/circle-studio-client.tsx` (lines 259-269) passed `action` and `targetUserId` instead of `actionType` and `targetId` to `PATCH /api/moderation`. In `src/features/moderation/service.ts`, `actionType` was `undefined`, skipping the `UPDATE` and crashing at `actionType.includes('post')`. | `src/components/circles/circle-studio-client.tsx`, `src/features/moderation/service.ts` |
| **NEW-02** | **P0** | Direct SQL Privilege Escalation via `memberships_insert`, `invitations_insert`, and Post Pinning | 1. `memberships_insert` in `0001_initial_schema.sql` allowed any Circle `admin` to `INSERT` a row with `role = 'owner'` or `'admin'`.<br>2. `invitations_insert` allowed an `admin` to invite new `'admin'` users.<br>3. `posts_update` allowed regular post authors to set `is_pinned = true` or alter `comment_count`/`reaction_count`. | `supabase/migrations/0003_staging_rls_and_role_hardening.sql`, `src/features/discussions/service.ts`, `src/features/memberships/service.ts` |
| **NEW-03** | **P1** | Partial Production Config Bypass & Low-Entropy Secret Acceptance | `getVerifiedSessionSecret()` accepted 32 identical characters (`'a'.repeat(32)`), and `isSupabaseConfigured()` did not require `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL`. | `src/lib/config/env.ts`, `src/lib/db/postgres.ts` |
| **NEW-04** | **P1** | Missing Explicit Table Grants & RLS on `auth.sessions` for Hosted Supabase `service_role` | `0002_security_hardening.sql` created `auth.sessions` without `GRANT ALL ON TABLE auth.sessions TO postgres, service_role` or `REVOKE ALL ... FROM PUBLIC, anon, authenticated`. | `supabase/migrations/0003_staging_rls_and_role_hardening.sql` |
| **NEW-05** | **P1** | Capability & Profile Visibility Enforcement Gaps in Direct SQL RLS (`allowMemberPosts`, `allowReactions`, `spaces`, `members_only`) | Direct SQL queries bypassed `allowMemberPosts`/`allowReactions` capability settings, read `circle_spaces` when `spaces` was disabled, and read `'members_only'` profiles without sharing an active Circle. | `supabase/migrations/0003_staging_rls_and_role_hardening.sql`, `src/features/discussions/service.ts`, `src/features/spaces/service.ts` |
| **NEW-06** | **P2** | Health Endpoint Error Message Leakage, Login Session Fixation & Missing Rate Limits on Membership/Moderation APIs | `GET /api/health` returned `error.message` to unauthenticated callers on failure; `POST /api/auth/login` did not revoke an existing session token; `POST /api/circles/[id]/membership` and `POST /api/moderation` had no rate limiting. | `src/app/api/health/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/circles/[circleId]/membership/route.ts`, `src/app/api/moderation/route.ts` |

---

## 4. Tests Executed & Actual Runtime Results

All verification commands were executed in `C:\Users\HomePC\Desktop\circles`:

- **`npm run lint`**: Passed (`✔ No ESLint warnings or errors`)
- **`npm run typecheck`**: Passed (`tsc --noEmit` exited with code `0`)
- **`npm test`**: Passed (`4 test files passed, 17 tests passed`)
  - `tests/unit/capabilities-and-permissions.test.ts` (6 passed)
  - `tests/integration/vertical-slice-and-rls.test.ts` (4 passed)
  - `tests/integration/api-security.test.ts` (1 passed)
  - `tests/integration/security-audit-regression.test.ts` (6 comprehensive multi-assertion security suites passed)
- **`npm run build`**: Passed (`next build` compiled and validated all 31 routes cleanly)

---

## 5. Known Limitations & Local vs. Hosted Supabase Boundary

1. **What Was Verified Locally**:
   - All SQL migrations (`0001_initial_schema.sql`, `0002_security_hardening.sql`, `0003_staging_rls_and_role_hardening.sql`), triggers, `SECURITY DEFINER` functions, and RLS policies were executed against embedded PostgreSQL 16 (`@electric-sql/pglite`) with per-transaction `SET LOCAL ROLE anon/authenticated/service_role` and `request.jwt.claim.sub` switching.
2. **What Remains `PENDING` Hosted Staging Verification**:
   - Currently, `src/lib/db/postgres.ts` executes SQL transactions through `@electric-sql/pglite`. When deploying to a multi-instance cloud staging environment backed by hosted Supabase PostgreSQL (`DATABASE_URL`), operators should either run a single-node staging container (`ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true` with persistent volume `.pgdata`) or wire a `pg.Pool` adapter in `src/lib/db/postgres.ts` against `DATABASE_URL` and execute the step-by-step verification in [`staging-verification-checklist.md`](./staging-verification-checklist.md).
   - Distributed rate limiting (Upstash Redis or PostgreSQL token bucket) is recommended before multi-instance horizontal scaling, as `checkRateLimit` in `src/lib/auth/api-helpers.ts` uses an in-memory `Map`.
   - Binary file uploads for avatars/covers are not implemented in P0 (URLs and generated initial badges are used instead).
