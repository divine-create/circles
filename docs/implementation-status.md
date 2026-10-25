# Circles Platform — Implementation Status Report

## 1. Feature Status Matrix

### Implemented, Audited, and Verified (P0 Core Release)
- **Authentication & Stateful Sessions**: Registration, sign-in, sign-out with server-side session revocation (`auth.sessions`), 1-hour expiring single-use password recovery tokens, full session invalidation on password reset, HMAC-SHA256 signed HTTP-only cookies, fail-closed production secret enforcement (`src/lib/config/env.ts`), and profile visibility (`public`, `members_only`, `private`) enforced by PostgreSQL RLS and `trg_protect_profile_identity`.
- **Circle Lifecycle & Templates**: Creation from 8 versioned templates (`university`, `neighbourhood`, `professional`, `creator`, `learning`, `sports`, `project`, `local_business`), server-side slug normalization and collision handling, settings updates, visibility/policy reconciliation, and `trg_protect_circle_ownership` protection.
- **Visibility & Membership Workflows**: Public open joining, discoverable-with-approval join requests, administrator approval/rejection workflows, hashed email invitations, invitation acceptance, member role management (`owner`, `admin`, `moderator`, `member`) enforced by both service guards and `trg_enforce_membership_transitions`, ownership transfer, and PostgreSQL trigger-backed last-owner protection (`trg_prevent_last_owner_loss`).
- **Capability Registry & Lifecycle**: Authoritative registry (`src/features/capabilities/registry.ts`), dependency graph validation, Circle Studio enable/disable controls and capability setting toggles (`allowMemberPosts`, `allowReactions`), dynamic navigation generation, non-destructive disabling (preserving all PostgreSQL data), and backend + RLS enforcement when a capability is disabled.
- **Spaces & Discussions**: Space creation, capability association, posting policy enforcement (`members`, `moderators`, `admins`), space reordering (`↑`/`↓`) and archival, persistent chronological posts, comments, reactions (`like`), saved items with a "Saved Only" feed filter, `LEFT JOIN` private-profile resilience, and composite foreign key anti-IDOR guarantees.
- **Circle Studio**: Complete owner/admin control center with unsaved-changes tracking, server-confirmed save states, capability manager with settings toggles, space manager with reordering and archival, join-request review queue, invitation generator, role manager with ownership transfer and member suspension/restoration, and audit log viewer.
- **Notifications, Moderation & Health Probe**: Database-backed in-app notifications with anti-spoofing RLS and idempotent delivery records, content reporting (`post`, `comment`, `member`), moderator & platform-admin review queue, post removal/restoration, member suspension, audit history, and `GET /api/health` readiness endpoint.

### Requires External Configuration for Cloud Deployment
- **Supabase Cloud (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`)**: In development and automated tests, the platform runs against an embedded PostgreSQL 16 instance (`@electric-sql/pglite`) with full SQL migrations and Row-Level Security enforcement. In `NODE_ENV=production`, `assertProductionDatabaseConfigured()` fails closed if cloud credentials are omitted unless `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true` is explicitly set.
- **Session Signing Secret (`CIRCLES_SESSION_SECRET`)**: Required in `NODE_ENV=production` ($\ge 32$ characters); fails closed if unset or left at the development default.
- **Resend Transactional Email (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)**: When unconfigured, email deliveries are recorded in `public.notification_deliveries` with status `skipped_unconfigured` and in-app notifications continue to function normally.

### Partially Implemented (Space-Backed Beta Modules)
- **Events, RSVPs, Shared Resources, Polls, Help Desk, Jobs, Learning, Projects**: Enabled via the capability registry and backed by dedicated topical Spaces and discussion threads in P0; dedicated standalone calendar/ticketing/kanban schemas are scheduled for P1.

### Deferred to P1 (Not Implemented in First Release)
- **Commerce, Marketplace, Listings, Services, Rentals, Housing**: Marked honestly as `P1 Planned` in the Capability Registry and Circle Studio.
- **Governance Committees & Challenges/Rewards**: Marked as `P1 Planned`.
- **Fundraising & Payments/Finances**: Explicitly deferred per P0 scope rules until a dedicated payment security review is conducted.

---

## 2. Outstanding P1 Recommendations

1. **Binary Avatar & Media Uploads**: P0 supports validated avatar/cover URLs and generated initial badges; connecting Supabase Storage buckets with signed upload URLs and MIME-type scanning is recommended when cloud storage credentials are provisioned.
2. **Distributed Rate Limiting**: API route rate limiting uses an in-memory sliding window (`src/lib/auth/api-helpers.ts`); for multi-instance serverless deployment, back the rate limiter with Upstash Redis or a PostgreSQL token-bucket table.
