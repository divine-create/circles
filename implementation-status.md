# Circles — Honest Implementation & Staging Readiness Status Report

**Last Updated**: 2026-10-26  
**Overall Readiness**: `LOCAL STAGING READY`

This document provides a strict, honest accounting of what is implemented and verified locally, what is implemented as a Beta Space-backed workflow, what is Planned, and what remains pending live hosted Supabase staging credentials.

---

## 1. Core Platform Subsystems

| Subsystem | Status | Implementation & Verification Details |
| :--- | :--- | :--- |
| **Database Executor (`remote_pg` & `embedded_pglite`)** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/lib/db/postgres.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/postgres.ts) implements both `pg.Pool` (`remote_pg` when `DATABASE_URL` / `SUPABASE_DB_URL` is configured) and `@electric-sql/pglite` (`embedded_pglite` in local dev/test). Both `withRlsTransaction` and `withServiceRoleTransaction` route through the active backend with full `BEGIN` / `COMMIT` / `ROLLBACK`, `SET LOCAL ROLE`, `request.jwt.claim.sub`, parameterized queries, and `client.release()`. |
| **Migration Runner & Version Tracking** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/lib/db/migrator.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/db/migrator.ts) and [`scripts/migrate.mjs`](file:///C:/Users/HomePC/Desktop/circles/scripts/migrate.mjs) (`npm run db:migrate`) apply `0001`–`0004` in order, record SHA-256 checksums in `public.schema_migrations`, and do not auto-run DDL on every remote PostgreSQL instance boot. |
| **Authentication & Stateful Sessions** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/auth/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/auth/service.ts) and [`src/lib/auth/session.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/auth/session.ts) enforce `scrypt` password hashing, HMAC-SHA256 tokens backed by `public.user_sessions` (isolated from Supabase GoTrue's `auth.sessions`), session fixation rotation on login, immediate logout revocation, and 1-hour single-use password recovery tokens. |
| **User Profiles & Privacy Controls** | **Verified Locally (`LOCAL STAGING READY`)** | [`0003_staging_rls_and_role_hardening.sql`](file:///C:/Users/HomePC/Desktop/circles/supabase/migrations/0003_staging_rls_and_role_hardening.sql) enforces `public`, `members_only` (via `shares_active_circle_with`), and `private` visibility in PostgreSQL RLS, plus email immutability via `trg_protect_profile_identity`. |
| **Circle Lifecycle & Visibility Isolation** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/circles/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/circles/service.ts) supports `public`, `discoverable_approval`, and `private` Circles with template provisioning, slug validation, and ownership protection triggers (`trg_protect_circle_ownership`). |
| **Memberships, Join Requests & Invitations** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/memberships/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/memberships/service.ts) and PostgreSQL triggers (`trg_enforce_membership_insert`, `trg_enforce_membership_transitions`) enforce strict `owner > admin > moderator > member` role hierarchy and last-owner protection. |
| **Moderation, Reporting & Audit Logs** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/moderation/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/moderation/service.ts) and [`src/app/api/moderation/route.ts`](file:///C:/Users/HomePC/Desktop/circles/src/app/api/moderation/route.ts) support content reports, hiding/removing posts/comments, member suspension/restoration, and immutable `audit_logs` / `moderation_actions`. |
| **Notifications & Transactional Email** | **Verified Locally (`LOCAL STAGING READY`)** | [`src/features/notifications/service.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/notifications/service.ts) and [`src/lib/email/index.ts`](file:///C:/Users/HomePC/Desktop/circles/src/lib/email/index.ts) persist in-app notifications, idempotent `notification_deliveries`, and optional Resend transactional emails. |

---

## 2. Capability Registry Honesty Matrix (`CAPABILITY_REGISTRY`)

As defined in [`src/features/capabilities/registry.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/capabilities/registry.ts):

### 2.1 `stable` Capabilities (Dedicated Database Tables, Services, APIs, UI & RLS)
| Capability Key | Name | Implementation Status |
| :--- | :--- | :--- |
| `discussions` | Discussions & Posts | **Complete (`stable`)**: Dedicated `posts`, `comments`, `reactions`, `saved_items` tables, full CRUD service, chronological pagination, pin protection, and RLS enforcement of `allowMemberPosts` & `allowReactions`. |
| `spaces` | Spaces & Subgroups | **Complete (`stable`)**: Dedicated `circle_spaces` table, space creation, reordering, archival, posting policies (`members`, `moderators`, `admins`), and RLS enforcement. |
| `member_directory` | Member Directory | **Complete (`stable`)**: Dedicated `/circles/[slug]/members` directory backed by `circle_memberships` and `profiles`, gated by `member_directory` capability check. |

### 2.2 `beta` Capabilities (Integrated with Capability Registry, Dependencies & Space-Filtered Feeds)
These capabilities can be enabled/disabled in Circle Studio with full dependency validation and route to specialized capability-tagged Spaces or filtered discussion feeds, but do **not** yet have separate domain-specific database tables (such as calendar recurrence or job application tracking tables):
- `shared_resources` (`spaces?capability=shared_resources`)
- `polls_decisions` (`discussions?filter=polls`)
- `help_desk` (`spaces?capability=help_desk`)
- `events` (`spaces?capability=events`)
- `rsvps` (`spaces?capability=events`, depends on `events`)
- `jobs_opportunities` (`spaces?capability=jobs_opportunities`)
- `learning_resources` (`spaces?capability=learning_resources`)
- `projects_collaboration` (`spaces?capability=projects_collaboration`)

### 2.3 `planned` Capabilities (Roadmap Metadata Only — Cannot Be Enabled as Fake Buttons)
These capabilities are explicitly marked `release_stage: 'planned'` in [`src/features/capabilities/registry.ts`](file:///C:/Users/HomePC/Desktop/circles/src/features/capabilities/registry.ts) and are displayed as **Planned** in Circle Studio so owners are never misled:
- `governance_committees`, `challenges_rewards`, `attendance`, `activities_meetups`, `marketplace`, `listings_discovery`, `services_bookings`, `rentals_sharing`, `housing_property`, `media_publishing`, `fundraising_causes`, `payments_finances`.

---

## 3. Pending External Verification Items

- **Hosted Supabase Staging Verification**: Executing `npm run db:migrate` and the staging checklist against a live hosted Supabase PostgreSQL instance (`DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) is pending external Supabase project credentials.
- **Live Resend Email Delivery**: Verified locally via structured outbox fallback; live SMTP/HTTP delivery requires a production `RESEND_API_KEY` and verified sender domain.
