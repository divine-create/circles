# Circles — Security & Staging Regression Test Suite Reference

**Last Updated**: 2026-10-26  
**Command**: `npm test` (`vitest run`)  
**Total Suites**: 6 passed (6)  
**Total Tests**: 21 passed (21)

---

## 1. Suite Breakdown

### 1.0 [`tests/integration/hosted-supabase-staging.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/hosted-supabase-staging.test.ts) (1 End-to-End Live Hosted Supabase Suite)
- Executes the full Phase 5 staging checklist against live hosted Supabase PostgreSQL 17.11 (`aws-0-eu-west-1.pooler.supabase.com:5432`): verifies `public.schema_migrations` (`0001`–`0004`), `GET /api/health` (`remote_pg`), user registration, session fixation rotation, logout revocation, password recovery & reset, `public` / `discoverable_approval` / `private` Circle creation & discovery, join requests, invitations, `members_only` profile RLS, last-owner protection, ownership transfer, capability settings & non-destructive disabling, spaces, discussions, moderation reports, member suspension/restoration, and audit logs.

### 1.1 [`tests/integration/postgres-executor-and-migrations.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/postgres-executor-and-migrations.test.ts) (3 Tests — Phase 3)
1. **Migration Tracking & Session/Migration Table Isolation**:
   - Verifies [`listAppliedDatabaseMigrations()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L406-L410) returns `0001_initial_schema.sql`, `0002_security_hardening.sql`, `0003_staging_rls_and_role_hardening.sql`, and `0004_supabase_staging_compatibility.sql` in order with valid 64-character SHA-256 checksums.
   - Verifies [`runDatabaseMigrations()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L369-L401) is idempotent on re-run (`applied: []`, `skipped: ['0001...', '0002...', '0003...', '0004...']`).
   - Verifies neither `authenticated` nor `anon` roles can query `public.user_sessions` or `public.schema_migrations` (`permission denied`).
2. **Remote PostgreSQL Pool Executor (`remote_pg`)**:
   - Verifies [`withRlsTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L341-L350) and [`withServiceRoleTransaction`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts#L357-L364) acquire a client from the `remote_pg` pool, execute `BEGIN`, `SET LOCAL ROLE authenticated | anon | service_role`, `set_config('request.jwt.claim.role', ...)`, and `set_config('request.jwt.claim.sub', ...)`, commit on success, execute `ROLLBACK` on error with zero partial writes, and always call `client.release()`.
   - Verifies `GET /api/health` reports `backend: "remote_pg"` when the remote pool is active.
3. **Database Backend Selection & Fail-Closed Production Guards**:
   - Verifies [`getRemoteDatabaseUrl()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts#L43-L55) rejects invalid protocols with `ConfigurationError`.
   - Verifies [`getDatabaseBackendMode()`](file:///C:/Users/HomePC/Desktop/circles/src/lib/config/env.ts#L98-L115) selects `remote_pg` when `DATABASE_URL` is configured and fails closed in `NODE_ENV=production` when `DATABASE_URL` is missing.

### 1.2 [`tests/integration/security-audit-regression.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/security-audit-regression.test.ts) (6 Tests — Phase 1 & 2)
1. **Stateful Session Lifecycle (`AUD-02`)**: Verifies session creation in `public.user_sessions`, forged/expired token rejection, session fixation rotation on `POST /api/auth/login`, immediate server-side revocation on logout, and revocation of all user sessions on password reset.
2. **Password Recovery Expiry & Production Token Redaction (`AUD-05`)**: Verifies recovery tokens older than 1 hour are rejected and `previewToken` is never included when `NODE_ENV=production`.
3. **Direct SQL RLS & Trigger Privilege Escalation Prevention (`AUD-03`)**: Verifies `trg_protect_profile_identity`, `trg_protect_circle_ownership`, `trg_enforce_membership_transitions`, `trg_enforce_membership_insert`, `trg_protect_post_mutations`, Circle Studio `PATCH /api/moderation` member suspension/restoration, and anti-spoofing on `notifications`.
4. **Profile Visibility Isolation (`AUD-04`)**: Verifies `public`, `members_only` (`shares_active_circle_with`), and `private` profile visibility under PostgreSQL RLS while preserving public Circle post readability.
5. **Capability Settings & Disabled Capability Enforcement (`AUD-06`, `AUD-01`, `AUD-08`)**: Verifies `allowMemberPosts: false`, `allowReactions: false`, disabled `discussions` / `spaces` enforcement in both services and PostgreSQL RLS, `CIRCLES_SESSION_SECRET` entropy checks, and sanitized `503` responses on `GET /api/health`.
6. **Transaction Rollback & Concurrency Isolation (`AUD-07`)**: Verifies multi-step failures roll back cleanly and concurrent `Promise.all` transactions across distinct users never bleed `auth.uid()`.

### 1.3 [`tests/integration/vertical-slice-and-rls.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/vertical-slice-and-rls.test.ts) (4 Tests)
- Complete P0 vertical slice (registration, Circle creation, template provisioning, public discovery, joining, posting, commenting, reacting, notifications, and audit logs).
- Approval-based joining, private Circle isolation, email-verified invitations, and cross-Circle anti-IDOR protection.
- Non-destructive capability disabling, last-owner protection, ownership transfer, and moderation workflows.
- Custom space creation and space posting policy enforcement (`members`, `moderators`, `admins`).

### 1.4 [`tests/integration/api-security.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/api-security.test.ts) (1 Comprehensive HTTP Suite)
- Verifies HTTP route handlers (`/api/circles`, `/api/circles/[circleId]`, `/api/circles/[circleId]/capabilities`, `/api/circles/[circleId]/spaces`, `/api/circles/[circleId]/posts`, `/api/circles/[circleId]/membership`, `/api/moderation`, `/api/profile`) enforce authentication, role checks, anti-IDOR, and capability gates.

### 1.5 [`tests/unit/capabilities-and-permissions.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/unit/capabilities-and-permissions.test.ts) (6 Tests)
- Verifies capability registry dependency graph validation and permission matrix role hierarchy.
