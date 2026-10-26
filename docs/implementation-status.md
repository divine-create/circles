# Circles — Honest Implementation & Staging Readiness Status Report

**Last Updated**: 2026-10-26  
**Overall Readiness**: `HOSTED STAGING VERIFIED` (Verified end-to-end against live hosted Supabase PostgreSQL 17.11 in `eu-west-1` as well as all local unit, RLS, and HTTP API regression suites).

---

## 1. Core Platform Subsystems

| Subsystem | Status | Implementation & Verification Details |
| :--- | :--- | :--- |
| **Database Executor (`remote_pg` & `embedded_pglite`)** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) implements both `pg.Pool` (`remote_pg` when `DATABASE_URL` / `SUPABASE_DB_URL` is configured) and `@electric-sql/pglite` (`embedded_pglite` in local dev/test). |
| **Migration Runner & Version Tracking** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/lib/db/migrator.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/migrator.ts) and [`scripts/migrate.mjs`](file:///C:/Users/HomePC/Desktop/circles/scripts/migrate.mjs) (`npm run db:migrate`) apply `0001`–`0004` in order and record SHA-256 checksums in `public.schema_migrations`. |
| **Authentication & Stateful Sessions** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/auth/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/auth/service.ts) and [`src/lib/auth/session.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/auth/session.ts) enforce `scrypt` password hashing, HMAC-SHA256 tokens backed by `public.user_sessions`, session fixation rotation on login, immediate logout revocation, and 1-hour single-use password recovery tokens. |
| **User Profiles & Privacy Controls** | **Verified Locally (`LOCAL STAGING READY`)** | [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql) enforces `public`, `members_only`, and `private` visibility in PostgreSQL RLS, plus email immutability via `trg_protect_profile_identity`. |
| **Circle Lifecycle & Visibility Isolation** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/circles/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/circles/service.ts) supports `public`, `discoverable_approval`, and `private` Circles with template provisioning, slug validation, and ownership protection triggers. |
| **Memberships, Join Requests & Invitations** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/memberships/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/memberships/service.ts) and PostgreSQL triggers enforce strict `owner > admin > moderator > member` role hierarchy and last-owner protection. |
| **Moderation, Reporting & Audit Logs** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/moderation/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/moderation/service.ts) and [`src/app/api/moderation/route.ts`](file:///C:/Users/HomePC/Desktop/circles/src/app/api/moderation/route.ts) support content reports, hiding/removing posts/comments, member suspension/restoration, and immutable `audit_logs` / `moderation_actions`. |

---

## 2. Capability Registry Honesty Matrix (`CAPABILITY_REGISTRY`)

- **`stable` (Full Dedicated Schema, Service, API, UI & RLS)**: `discussions`, `spaces`, `member_directory`.
- **`beta` (Integrated with Capability Registry, Dependencies & Space-Filtered Feeds)**: `shared_resources`, `polls_decisions`, `help_desk`, `events`, `rsvps`, `jobs_opportunities`, `learning_resources`, `projects_collaboration`.
- **`planned` (Roadmap Metadata Only)**: `governance_committees`, `challenges_rewards`, `attendance`, `activities_meetups`, `marketplace`, `listings_discovery`, `services_bookings`, `rentals_sharing`, `housing_property`, `media_publishing`, `fundraising_causes`, `payments_finances`.
