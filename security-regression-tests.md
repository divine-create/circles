# Circles Platform — Security Regression Test Catalog

This document maps each security scenario audited in Phase 1 and Phase 2 to its expected outcome and the automated test that verifies it.

## 1. Automated Test Suites

Run all suites with:

```bash
npm test
```

| Test File | Scope | Test Count |
| :--- | :--- | :--- |
| [`tests/unit/capabilities-and-permissions.test.ts`](tests/unit/capabilities-and-permissions.test.ts) | Capability dependency graph & centralized role/visibility permission matrix | 6 |
| [`tests/integration/vertical-slice-and-rls.test.ts`](tests/integration/vertical-slice-and-rls.test.ts) | Full multi-user P0 vertical slice, approval/private Circle RLS isolation, non-destructive capability disabling, last-owner protection, space posting policies | 4 |
| [`tests/integration/api-security.test.ts`](tests/integration/api-security.test.ts) | HTTP Route Handler authentication, role escalation blocking, and capability gates | 1 |
| [`tests/integration/security-audit-regression.test.ts`](tests/integration/security-audit-regression.test.ts) | Dedicated Phase 1 & Phase 2 security audit regression suite (sessions, tokens, direct SQL triggers/RLS, privacy, capability settings, fail-closed env, health endpoint, concurrency) | 6 |

---

## 2. Security Scenario Matrix

| Scenario | Threat / Vulnerability Tested | Expected Outcome | Covering Test |
| :--- | :--- | :--- | :--- |
| **Forged Session Token Signature** | Attacker modifies base64 payload or signature of `circles_session_token` | `verifySignedSessionToken` and `verifyAndResolveSessionUser` return `null` (timing-safe HMAC check) | `security-audit-regression.test.ts` — Test #1 |
| **Expired Session Token** | Replay of a session token past its `exp` timestamp | Rejected (`null`) before and during DB lookup | `security-audit-regression.test.ts` — Test #1 |
| **Logged-Out Session Replay** | Attacker replays a captured `Bearer` or cookie token after user logs out | `signOutUser` sets `revoked_at = NOW()` in `auth.sessions`; subsequent `verifyAndResolveSessionUser` returns `null` | `security-audit-regression.test.ts` — Test #1 |
| **Session Fixation on Re-Login** | User logs in via `POST /api/auth/login` while holding a pre-existing session token | Pre-existing session token is revoked in `auth.sessions` and a fresh `jti` session is issued | `security-audit-regression.test.ts` — Test #1 |
| **Active Session Invalidation on Password Reset** | Compromised account resets password while attacker holds active sessions | `resetPasswordWithToken` revokes all active rows in `auth.sessions` for that `user_id` | `security-audit-regression.test.ts` — Test #1 |
| **Password Recovery Token Reuse & Expiration** | Attacker reuses a consumed reset token or uses a token $> 1$ hour old | Rejected with `ValidationError: Invalid or expired password recovery token` | `security-audit-regression.test.ts` — Test #1 & #2 |
| **Production Recovery Token Leakage** | Calling `requestPasswordRecovery` in `NODE_ENV=production` when Resend is unconfigured | `previewToken` is `undefined` in production | `security-audit-regression.test.ts` — Test #2 |
| **Profile Email Spoofing (Invitation Hijacking)** | Authenticated user runs direct SQL `UPDATE public.profiles SET email = 'vip@...'` to claim another user's pending Circle invitation | Blocked by PostgreSQL trigger `trg_protect_profile_identity` (`Profile email cannot be modified independently of verified authentication email`) | `security-audit-regression.test.ts` — Test #3a |
| **Unauthorized Circle Ownership Takeover by Admin** | Circle `admin` executes direct SQL `UPDATE public.circles SET owner_id = ...` | Blocked by PostgreSQL trigger `trg_protect_circle_ownership` (`Only the current Circle owner can transfer Circle ownership`) | `security-audit-regression.test.ts` — Test #3b |
| **Moderator Modifying Admin/Owner Membership** | Circle `moderator` executes direct SQL `UPDATE public.circle_memberships` on an `admin` or `owner` row | Blocked by PostgreSQL trigger `trg_enforce_membership_transitions` (`Moderators can only suspend or restore ordinary members`) | `security-audit-regression.test.ts` — Test #3c |
| **Admin Promoting Member to Admin/Owner (`UPDATE` & `INSERT`)** | Circle `admin` executes direct SQL `UPDATE` or `INSERT` on `public.circle_memberships` with `role IN ('admin', 'owner')`, or invites with `role = 'admin'` | Blocked by `trg_enforce_membership_transitions`, `trg_enforce_membership_insert`, `memberships_insert` RLS, and `inviteToCircle` | `security-audit-regression.test.ts` — Test #3d, #3e, #3f |
| **Unauthorized Post Pinning by Regular Member** | Post author (`role = 'member'`) attempts to set `is_pinned = true` via `updatePost` or direct SQL `UPDATE public.posts` | Blocked by both `updatePost` service guard and PostgreSQL trigger `trg_protect_post_mutations` | `security-audit-regression.test.ts` — Test #3g |
| **Circle Studio Member Suspension & Self-Restore Prevention** | Staff suspends member via `PATCH /api/moderation`; suspended member attempts direct SQL `UPDATE public.circle_memberships SET status = 'active'` | `PATCH /api/moderation` suspends member (`status = 'suspended'`); self-restore is blocked by `trg_enforce_membership_transitions` | `security-audit-regression.test.ts` — Test #3h |
| **Client Notification Spoofing** | Authenticated user attempts direct SQL `INSERT INTO public.notifications` with another user as `recipient_id` or `actor_id` | Blocked by `notifications_insert` RLS policy | `security-audit-regression.test.ts` — Test #3i |
| **`private` & `members_only` Profile Isolation + Public Post Visibility** | Author sets `profile_visibility` to `'members_only'` or `'private'` after posting in a public Circle | Co-members can read `'members_only'` profile while outsiders cannot; nobody except owner/platform-admin can read `'private'` profile; public Circle post remains visible to `anon` with fallback display name `'Circle Member'` | `security-audit-regression.test.ts` — Test #4 |
| **Server & RLS Enforcement of Capability Settings (`allowMemberPosts`, `allowReactions`, `spaces`, `discussions`)** | Owner disables `allowMemberPosts`, `allowReactions`, `discussions`, or `spaces`; member attempts mutations or direct SQL bypass | Blocked by both service layer and PostgreSQL RLS policies (`posts_insert`, `reactions_insert`, `spaces_select`) | `security-audit-regression.test.ts` — Test #5 |
| **Fail-Closed Production Secret & Database Config** | `NODE_ENV=production` with missing/weak `CIRCLES_SESSION_SECRET` (`'a'.repeat(32)`) or partial Supabase config missing `DATABASE_URL` | `getVerifiedSessionSecret()` and `assertProductionDatabaseConfigured()` throw `ConfigurationError` | `security-audit-regression.test.ts` — Test #5 |
| **Health Endpoint Error Redaction on Outage** | Database is unreachable during `GET /api/health` | Returns HTTP `503` with `{"status":"unhealthy","code":"SERVICE_UNAVAILABLE"}` and never leaks internal error messages | `security-audit-regression.test.ts` — Test #5 |
| **Transaction Rollback & Concurrent User Isolation** | Mid-transaction exception and concurrent `Promise.all` transactions for `userA`, `userB`, and `anon` | Failed transaction rolls back cleanly; concurrent transactions maintain strict `auth.uid()` and role isolation | `security-audit-regression.test.ts` — Test #6 |
