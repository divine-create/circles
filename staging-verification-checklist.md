# Circles Platform — Supabase Staging Verification Checklist

> **Status**: `PENDING` (No external Supabase staging credentials were present in the local audit environment. Execute this checklist step by step when provisioning the staging environment.)

---

## 1. Environment Configuration Verification

Configure the following environment variables in the staging deployment environment (never commit real values to Git):

```ini
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://staging-circles.example.com
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-secret-key>
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
CIRCLES_SESSION_SECRET=<64-hex-char-random-secret-generated-via-openssl-rand-hex-32>
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=Circles Staging <no-reply@staging-circles.example.com>
```

### Fail-Closed Startup Checks
1. **Missing `CIRCLES_SESSION_SECRET`**: Temporarily omit `CIRCLES_SESSION_SECRET` and call `GET /api/health` -> Verify response is HTTP `503` (`{"status":"unhealthy","code":"SERVICE_UNAVAILABLE"}`) and no internal stack trace or secret is leaked.
2. **Weak `CIRCLES_SESSION_SECRET`**: Set `CIRCLES_SESSION_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` -> Verify `GET /api/health` returns HTTP `503`.
3. **Missing `DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`** (with `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION` unset) -> Verify `GET /api/health` returns HTTP `503` and does **not** fall back to local `.pgdata`.

---

## 2. Database Migration Execution & Verification

Apply migrations in strict chronological order against the fresh staging PostgreSQL database (using session-mode connection port `5432`, not transaction-mode port `6543`, so prepared statements, triggers, and `SET LOCAL ROLE` work deterministically):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_initial_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_security_hardening.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_staging_rls_and_role_hardening.sql
```

### Verify Schema, RLS & Role Grants in `psql`
1. Confirm RLS and `FORCE ROW LEVEL SECURITY` are enabled on all 22 `public` tables and `auth.sessions`:
   ```sql
   SELECT schemaname, tablename, rowsecurity, forcerowsecurity
   FROM pg_tables
   WHERE schemaname IN ('public', 'auth')
     AND tablename IN ('profiles', 'circles', 'circle_memberships', 'posts', 'comments', 'sessions');
   ```
   *Expected*: `rowsecurity = t` and `forcerowsecurity = t` on all protected tables.
2. Confirm `anon` and `authenticated` cannot access `auth.users` or `auth.sessions`:
   ```sql
   BEGIN;
   SET LOCAL ROLE authenticated;
   SELECT COUNT(*) FROM auth.sessions; -- Expected: ERROR: permission denied for table sessions
   ROLLBACK;
   ```
3. Confirm `service_role` can insert and query `auth.sessions`:
   ```sql
   BEGIN;
   SET LOCAL ROLE service_role;
   SELECT COUNT(*) FROM auth.sessions; -- Expected: succeeds (0 or current session count)
   ROLLBACK;
   ```

---

## 3. Authentication, Session Revocation & Recovery Checks

1. **Registration & Cookie Security**:
   - Register two distinct staging accounts (`user_a@staging.example.com` and `user_b@staging.example.com`) via `/register`.
   - Inspect response `Set-Cookie` header for `circles_session_token`: verify `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
2. **Logout Session Revocation**:
   - Copy `user_a`'s `circles_session_token` value.
   - Trigger `POST /api/auth/logout`.
   - Replay the copied token via `Authorization: Bearer <token>` against `GET /api/profile`.
   - *Expected*: HTTP `401 Unauthorized` (revoked in `auth.sessions`).
3. **Password Recovery & Full Session Invalidation**:
   - Log in as `user_a` on two separate browser sessions.
   - Request password recovery via `POST /api/auth/recover` (`{"email":"user_a@staging.example.com"}`).
   - Verify the HTTP response JSON does **not** include `previewToken` in staging (`NODE_ENV=production`).
   - Retrieve the recovery link/token from the Resend email inbox and submit `POST /api/auth/recover` (`{"action":"reset","token":"<token>","newPassword":"NewStagingPassword123!"}`).
   - Verify both prior browser sessions are immediately invalidated (`401` on `GET /api/profile`), and re-submitting the same recovery token a second time returns HTTP `400`.

---

## 4. Multi-User Authorization, Privacy & Capability Checks

1. **Private Circle Isolation**:
   - As `user_a`, create a `private` Circle (`slug: staging-private`).
   - As anonymous and as `user_b`, request `GET /api/circles/staging-private` and `GET /api/circles?search=staging-private`.
   - *Expected*: `404 Not Found` on direct lookup and absent from discovery results.
2. **Role Hierarchy & Ownership Protection**:
   - As `user_a` (Owner), invite `user_b` as `admin` to a Circle.
   - As `user_b` (Admin), attempt `PATCH /api/circles/<id>/membership` with `{"action":"transfer_ownership","newOwnerUserId":"<user_b_id>"}` -> *Expected*: HTTP `403 Forbidden`.
   - As `user_b` (Admin), attempt to invite a third user with `role: "admin"` -> *Expected*: HTTP `403 Forbidden`.
3. **Profile Visibility (`public`, `members_only`, `private`)**:
   - Set `user_a`'s profile visibility to `private` via `/settings`.
   - As anonymous, load `user_a`'s public Circle discussion feed -> *Expected*: Posts remain visible with fallback author name `"Circle Member"`, while `user_a`'s private profile fields (`bio`, `email`, `location`) are not exposed.
4. **Capability Enforcement (`discussions`, `spaces`, `allowMemberPosts`, `allowReactions`)**:
   - In Circle Studio (`/circles/<slug>/studio`), uncheck `Allow member posts` and `Allow reactions` under `Discussions & Posts`.
   - As a regular `'member'`, attempt `POST /api/circles/<id>/posts` and `POST /api/circles/<id>/posts/<postId>` (`{"action":"react"}`) -> *Expected*: HTTP `403 Forbidden`.
   - Disable `Discussions & Posts` capability in Circle Studio -> Verify `GET /api/circles/<id>/posts` returns `403`, re-enable it, and verify all prior posts and comments are intact.

---

## 5. Health Check, Rollback & Monitoring

1. **Readiness Probe**: Configure load balancer health check to poll `GET /api/health` every 30s (expect HTTP `200` with `{"status":"healthy","database":"connected"}`).
2. **Rollback Plan**:
   - Migrations `0002_security_hardening.sql` and `0003_staging_rls_and_role_hardening.sql` are non-destructive (they add `auth.sessions`, triggers, and updated RLS policies without dropping application columns or user data).
   - Take a logical snapshot (`pg_dump --format=custom "$DATABASE_URL" > pre_deploy_backup.dump`) prior to running migrations in any shared environment.
