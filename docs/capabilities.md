# Circles Platform — Capability Registry & Lifecycle

## 1. Authoritative Registry

The capability catalog is defined in `src/features/capabilities/registry.ts` and seeded into `public.capability_definitions` and `public.capability_dependencies` via `supabase/seed.sql`.

### Capability Catalog & Release Stages

| Key | Name | Category | Default | Dependencies | Stage |
| --- | --- | --- | :---: | --- | :---: |
| `discussions` | Discussions & Posts | Community | Enabled | — | **Stable (P0)** |
| `spaces` | Spaces & Subgroups | Community | Enabled | — | **Stable (P0)** |
| `member_directory` | Member Directory | Community | Enabled | — | **Stable (P0)** |
| `shared_resources` | Shared Resources | Community | Disabled | `spaces` | Beta (P0 Space-backed) |
| `polls_decisions` | Polls & Decisions | Community | Disabled | `discussions` | Beta (P0 Space-backed) |
| `help_desk` | Help Desk & Requests | Community | Disabled | `discussions` | Beta (P0 Space-backed) |
| `events` | Events | Events & Activities | Disabled | `spaces` | Beta (P0 Space-backed) |
| `rsvps` | RSVPs | Events & Activities | Disabled | `events` | Beta (P0 Space-backed) |
| `jobs_opportunities` | Jobs & Opportunities | Commerce & Discovery | Disabled | `spaces` | Beta (P0 Space-backed) |
| `learning_resources` | Learning & Resources | Knowledge & Collaboration | Disabled | `spaces` | Beta (P0 Space-backed) |
| `projects_collaboration` | Projects & Collaboration | Knowledge & Collaboration | Disabled | `spaces` | Beta (P0 Space-backed) |
| `governance_committees` | Governance & Committees | Community | Disabled | `member_directory` | Planned (P1) |
| `challenges_rewards` | Challenges & Rewards | Community | Disabled | `member_directory` | Planned (P1) |
| `attendance` | Attendance | Events & Activities | Disabled | `rsvps` | Planned (P1) |
| `activities_meetups` | Activities & Meetups | Events & Activities | Disabled | `events` | Planned (P1) |
| `marketplace` | Marketplace | Commerce & Discovery | Disabled | `spaces` | Planned (P1) |
| `listings_discovery` | Listings & Discovery | Commerce & Discovery | Disabled | `spaces` | Planned (P1) |
| `services_bookings` | Services & Bookings | Commerce & Discovery | Disabled | `listings_discovery` | Planned (P1) |
| `rentals_sharing` | Rentals & Sharing | Commerce & Discovery | Disabled | `listings_discovery` | Planned (P1) |
| `housing_property` | Housing & Property | Commerce & Discovery | Disabled | `listings_discovery` | Planned (P1) |
| `media_publishing` | Media & Publishing | Knowledge & Collaboration | Disabled | `discussions` | Planned (P1) |
| `fundraising_causes` | Fundraising & Causes | Organization & Finance | Disabled | `member_directory` | Planned (P1) |
| `payments_finances` | Payments & Finances | Organization & Finance | Disabled | `member_directory` | Planned (P1) |

---

## 2. Enabling & Disabling Rules

1. **Permission Verification**: Only an active Circle `owner` or `admin` can enable or disable capabilities (`circle.manage_capabilities`).
2. **Dependency Validation (`validateCapabilityTransition`)**:
   - A capability cannot be enabled unless all capabilities in its `dependencies` array are currently enabled for that Circle.
   - A capability cannot be disabled if another currently enabled capability depends on it (for example, `spaces` cannot be disabled while `events` is enabled).
3. **Non-Destructive Disabling**:
   - Disabling a capability updates `public.circle_capabilities.enabled = false` and sets `disabled_at = NOW()`.
   - Existing spaces, posts, comments, and reactions remain untouched in PostgreSQL.
   - Both the backend service (`requireEnabledCapability`) and PostgreSQL RLS policies (`public.is_capability_enabled(circle_id, 'discussions')`) block read/write access to disabled capabilities via direct URLs or APIs.
   - Re-enabling the capability immediately restores access to all preserved data.
4. **Audit Logging**: Every capability state change writes an immutable record to `public.audit_logs`.
