# Circles — Security & Staging Regression Test Suite Reference

**Last Updated**: 2026-10-26  
**Command**: `npm test` (`vitest run`)  
**Total Suites**: 5 passed (5)  
**Total Tests**: 20 passed (20)

---

## 1. Suite Breakdown

- **[`tests/integration/postgres-executor-and-migrations.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/postgres-executor-and-migrations.test.ts) (3 Tests)**: Verifies `0001`–`0004` migration tracking in `public.schema_migrations`, idempotency of `runDatabaseMigrations()`, `service_role`-only RLS on `public.user_sessions` and `public.schema_migrations`, `remote_pg` pool transaction lifecycle (`BEGIN`, `SET LOCAL ROLE`, `request.jwt.claim.sub`, `COMMIT`, `ROLLBACK`, `client.release()`), and `DATABASE_URL` validation.
- **[`tests/integration/security-audit-regression.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/security-audit-regression.test.ts) (6 Tests)**: Verifies `AUD-01` through `AUD-08` (stateful session revocation, session fixation rotation, 1-hour single-use recovery tokens, PostgreSQL role hierarchy triggers, profile privacy levels, capability settings in RLS, health check sanitization, and transaction rollback/concurrency isolation).
- **[`tests/integration/vertical-slice-and-rls.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/vertical-slice-and-rls.test.ts) (4 Tests)**: Verifies end-to-end Circle creation, templates, discovery, join requests, invitations, anti-IDOR, non-destructive capability disabling, last-owner protection, and moderation.
- **[`tests/integration/api-security.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/integration/api-security.test.ts) (1 Test)**: Verifies HTTP Route Handlers reject unauthenticated requests, block privilege escalation, and enforce capability gates.
- **[`tests/unit/capabilities-and-permissions.test.ts`](file:///C:/Users/HomePC/Desktop/circles/tests/unit/capabilities-and-permissions.test.ts) (6 Tests)**: Verifies capability dependency validation and role permission matrix rules.
