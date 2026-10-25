# Circles Platform — Implementation Status Report

## 1. Feature Status Matrix

### Implemented and Tested (P0 Core Release)
- **Authentication & User Profiles**: Registration, sign-in, sign-out, password recovery & token reset, HMAC-SHA256 signed HTTP-only session cookies, profile editing, and profile visibility (`public`, `members_only`, `private`) enforced by PostgreSQL RLS.
- **Circle Lifecycle & Templates**: Creation from 8 versioned templates (`university`, `neighbourhood`, `professional`, `creator`, `learning`, `sports`, `project`, `local_business`), server-side slug normalization and collision handling, settings updates, and visibility/policy reconciliation.
- **Visibility & Membership Workflows**: Public open joining, discoverable-with-approval join requests, administrator approval/rejection workflows, hashed email invitations, invitation acceptance, member role management (`owner`, `admin`, `moderator`, `member`), ownership transfer, and PostgreSQL trigger-backed last-owner protection.
- **Capability Registry & Lifecycle**: Authoritative registry (`src/features/capabilities/registry.ts`), dependency graph validation, Circle Studio enable/disable controls, dynamic navigation generation, non-destructive disabling (preserving all PostgreSQL data), and backend + RLS enforcement when a capability is disabled.
- **Spaces & Discussions**: Space creation, capability association, posting policy enforcement (`members`, `moderators`, `admins`), space archival, persistent chronological posts, comments, reactions (`like`), saved items, and composite foreign key anti-IDOR guarantees.
- **Circle Studio**: Complete owner/admin control center with unsaved-changes tracking, server-confirmed save states, capability manager, space manager, join-request review queue, invitation generator, role manager, and audit log viewer.
- **Notifications & Moderation**: Database-backed in-app notifications with idempotent delivery records, content reporting (`post`, `comment`, `member`), moderator & platform-admin review queue, post removal/restoration, member suspension, and audit history.

### Requires External Configuration
- **Supabase Cloud (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)**: When unconfigured, the platform runs locally against an embedded PostgreSQL instance (`@electric-sql/pglite`) with full SQL migrations and Row-Level Security enforcement.
- **Resend Transactional Email (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)**: When unconfigured, email deliveries are recorded in `public.notification_deliveries` with status `skipped_unconfigured` and in-app notifications continue to function normally.

### Partially Implemented (Space-Backed Beta Modules)
- **Events, RSVPs, Shared Resources, Polls, Help Desk, Jobs, Learning, Projects**: Enabled via the capability registry and backed by dedicated topical Spaces and discussion threads in P0; dedicated standalone calendar/ticketing/kanban schemas are scheduled for P1.

### Deferred to P1 (Not Implemented in First Release)
- **Commerce, Marketplace, Listings, Services, Rentals, Housing**: Marked honestly as `P1 Planned` in the Capability Registry and Circle Studio.
- **Governance Committees & Challenges/Rewards**: Marked as `P1 Planned`.
- **Fundraising & Payments/Finances**: Explicitly deferred per P0 scope rules until a dedicated payment security review is conducted.

---

## 2. Outstanding Risks & Recommendations for P1

1. **File & Avatar Binary Uploads**: P0 supports avatar/cover URLs and generated initial badges; connecting Supabase Storage buckets with signed upload URLs and MIME-type scanning is recommended when cloud credentials are provisioned.
2. **Distributed Rate Limiting**: API route rate limiting currently uses an in-memory sliding window (`src/lib/auth/api-helpers.ts`); for multi-region serverless deployment on Vercel, back the rate limiter with Upstash Redis or PostgreSQL token buckets.
