# Circles Platform — Capability Registry & Lifecycle

## 1. Authoritative Registry

The capability catalog is defined in `src/features/capabilities/registry.ts` and seeded into `public.capability_definitions` and `public.capability_dependencies` via `supabase/seed.sql`.

### Capability Catalog & Release Stages

| Key | Name | Category | Default | Dependencies | Stage | Dedicated Domain & UI Route |
| --- | --- | --- | :---: | --- | :---: | :--- |
| `discussions` | Discussions & Posts | Community | Enabled | — | **Stable** | `/circles/[slug]` (Feed & Space discussions) |
| `spaces` | Spaces & Subgroups | Community | Enabled | — | **Stable** | `/circles/[slug]` (Space switcher & management) |
| `member_directory` | Member Directory | Community | Enabled | — | **Stable** | `/circles/[slug]/members` (Directory & search) |
| `events` | Events | Events & Activities | Disabled | `spaces` | **Stable** | `/circles/[slug]/events` ([`EventsBoard`](file:///C:/Users/HomePC/Desktop/circles/src/components/circles/events-board.tsx)) |
| `rsvps` | RSVPs | Events & Activities | Disabled | `events` | **Stable** | `/circles/[slug]/events` (Capacity & waitlist) |
| `attendance` | Attendance | Events & Activities | Disabled | `rsvps` | **Stable** | `/circles/[slug]/events` (Organizer check-in) |
| `activities_meetups`| Activities & Meetups | Events & Activities | Disabled | `events` | **Stable** | `/circles/[slug]/events` (Meetup coordination) |
| `polls_decisions` | Polls & Decisions | Community | Disabled | `discussions` | **Stable** | `/circles/[slug]/polls` ([`PollsBoard`](file:///C:/Users/HomePC/Desktop/circles/src/components/circles/polls-board.tsx)) |
| `marketplace` | Marketplace | Commerce & Discovery | Disabled | `spaces` | **Stable** | `/circles/[slug]/marketplace` ([`MarketplaceBoard`](file:///C:/Users/HomePC/Desktop/circles/src/components/circles/marketplace-board.tsx)) |
| `listings_discovery`| Listings & Discovery | Commerce & Discovery | Disabled | `spaces` | **Stable** | `/circles/[slug]/marketplace` (Listing filters) |
| `services_bookings` | Services & Bookings | Commerce & Discovery | Disabled | `listings_discovery`| **Stable** | `/circles/[slug]/marketplace` (Double-booking protection) |
| `rentals_sharing` | Rentals & Sharing | Commerce & Discovery | Disabled | `listings_discovery`| **Stable** | `/circles/[slug]/marketplace` (Return tracking) |
| `housing_property` | Housing & Property | Commerce & Discovery | Disabled | `listings_discovery`| **Stable** | `/circles/[slug]/marketplace` (Property listings) |
| `jobs_opportunities`| Jobs & Opportunities | Commerce & Discovery | Disabled | `spaces` | **Stable** | `/circles/[slug]/jobs` ([`JobsBoard`](file:///C:/Users/HomePC/Desktop/circles/src/components/circles/jobs-board.tsx), RLS privacy) |
| `learning_resources`| Learning & Resources | Knowledge & Collaboration | Disabled | `spaces` | **Stable** | `/circles/[slug]/resources` ([`ResourcesBoard`](file:///C:/Users/HomePC/Desktop/circles/src/components/circles/resources-board.tsx)) |
| `shared_resources` | Shared Resources | Community | Disabled | `spaces` | **Stable** | `/circles/[slug]/resources` (Resource bookmarks) |
| `media_publishing` | Media & Publishing | Knowledge & Collaboration | Disabled | `discussions` | **Stable** | `/circles/[slug]/resources` (Media uploads & signed URLs) |
| `projects_collaboration` | Projects & Collaboration | Knowledge & Collaboration | Disabled | `spaces` | **Stable** | `/circles/[slug]/projects` ([`ProjectsBoard`](file:///C:/Users/HomePC/Desktop/circles/src/components/circles/projects-board.tsx)) |
| `governance_committees` | Governance & Committees | Community | Disabled | `member_directory` | **Stable** | `/circles/[slug]/community` ([`CommunityHubBoard`](file:///C:/Users/HomePC/Desktop/circles/src/components/circles/community-hub-board.tsx)) |
| `fundraising_causes` | Fundraising & Causes | Organization & Finance | Disabled | `member_directory` | **Stable** | `/circles/[slug]/community` (Pledges, non-custodial) |
| `challenges_rewards` | Challenges & Rewards | Community | Disabled | `member_directory` | **Stable** | `/circles/[slug]/community` (Anti-self-award trigger) |
| `help_desk` | Help Desk & Requests | Community | Disabled | `discussions` | **Stable** | `/circles/[slug]/community` (Strict RLS ticket privacy) |
| `payments_finances` | Payments & Finances | Organization & Finance | Disabled | `member_directory` | **Pledge/Intent Only** | Out of scope for raw card handling (Pledges supported) |

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
