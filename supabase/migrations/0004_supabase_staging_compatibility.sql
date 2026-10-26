-- ============================================================================
-- CIRCLES PLATFORM — SUPABASE HOSTED STAGING COMPATIBILITY & MIGRATION TRACKING
-- Migration: 0004_supabase_staging_compatibility.sql
-- ============================================================================

-- 1. Schema Migrations Tracking Table
-- Tracks applied SQL migrations in order with SHA-256 checksums for deterministic staging/production rollouts.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE public.schema_migrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.schema_migrations TO postgres, service_role;

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schema_migrations_service_only ON public.schema_migrations;
CREATE POLICY schema_migrations_service_only ON public.schema_migrations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Dedicated Application Session Registry (public.user_sessions)
-- Placed in public schema with strict service_role-only RLS so it never collides with
-- Supabase GoTrue's internal auth.sessions table on hosted Supabase PostgreSQL.
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(token_hash);

REVOKE ALL ON TABLE public.user_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_sessions TO postgres, service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sessions_service_only ON public.user_sessions;
CREATE POLICY user_sessions_service_only ON public.user_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Migrate any existing local sessions from auth.sessions if the legacy column structure exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'sessions'
      AND column_name = 'token_hash'
  ) THEN
    INSERT INTO public.user_sessions (id, user_id, token_hash, expires_at, revoked_at, created_at)
    SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
    FROM auth.sessions
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END
$$;

-- 3. Ensure auth.users has required columns & service_role permissions when running on self-hosted or hosted Postgres
DO $$
BEGIN
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password TEXT DEFAULT '';
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_token TEXT;
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMPTZ;
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;

DO $$
BEGIN
  GRANT USAGE ON SCHEMA auth TO postgres, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth.users TO postgres, service_role;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;

-- 4. Authoritative Capability Definitions, Dependencies & Circle Templates Reference Catalog
-- Required in all staging/production environments so foreign keys on circle_capabilities and circle_spaces succeed.
INSERT INTO public.capability_definitions (key, name, description, version, category, default_enabled, release_stage, default_settings, required_permissions, navigation_config)
VALUES
  ('discussions', 'Discussions & Posts', 'Persistent community discussions, comments, reactions, and saved posts.', '1.0.0', 'community', true, 'stable', '{"allowMemberPosts": true, "allowReactions": true, "moderationMode": "post_publish"}'::jsonb, '["discussions.read", "discussions.post"]'::jsonb, '{"label": "Discussions", "path": "discussions", "icon": "message-square"}'::jsonb),
  ('spaces', 'Spaces & Subgroups', 'Organize community participation into dedicated topical channels and spaces.', '1.0.0', 'community', true, 'stable', '{"maxSpaces": 25, "allowMemberDirectoryPerSpace": true}'::jsonb, '["spaces.read", "spaces.manage"]'::jsonb, '{"label": "Spaces", "path": "spaces", "icon": "layout-grid"}'::jsonb),
  ('member_directory', 'Member Directory', 'Searchable directory of active Circle members, roles, and profiles.', '1.0.0', 'community', true, 'stable', '{"showRoleBadges": true, "showBio": true}'::jsonb, '["members.read"]'::jsonb, '{"label": "Members", "path": "members", "icon": "users"}'::jsonb),
  ('shared_resources', 'Shared Resources', 'Curated knowledge links, guides, and reference materials for members.', '1.0.0', 'community', false, 'beta', '{"allowMemberSubmissions": false}'::jsonb, '["resources.read"]'::jsonb, '{"label": "Resources", "path": "spaces?capability=shared_resources", "icon": "book-open"}'::jsonb),
  ('polls_decisions', 'Polls & Decisions', 'Structured community polls and proposal voting inside discussions.', '1.0.0', 'community', false, 'beta', '{"allowAnonymousVotes": false}'::jsonb, '["discussions.post"]'::jsonb, '{"label": "Polls", "path": "discussions?filter=polls", "icon": "bar-chart-2"}'::jsonb),
  ('governance_committees', 'Governance & Committees', 'Working groups, bylaws, and committee leadership workflows.', '0.1.0', 'community', false, 'planned', '{}'::jsonb, '["governance.read"]'::jsonb, '{"label": "Governance", "path": "governance", "icon": "shield"}'::jsonb),
  ('challenges_rewards', 'Challenges & Rewards', 'Community milestones, streaks, and recognition badges.', '0.1.0', 'community', false, 'planned', '{}'::jsonb, '["challenges.read"]'::jsonb, '{"label": "Challenges", "path": "challenges", "icon": "award"}'::jsonb),
  ('help_desk', 'Help Desk & Requests', 'Community support requests, Q&A triage, and mutual aid.', '1.0.0', 'community', false, 'beta', '{"requireResolutionStatus": true}'::jsonb, '["discussions.post"]'::jsonb, '{"label": "Help Desk", "path": "spaces?capability=help_desk", "icon": "life-buoy"}'::jsonb),
  ('events', 'Events', 'Community calendars, in-person gatherings, and virtual sessions.', '1.0.0', 'events_activities', false, 'beta', '{"allowMemberEvents": false}'::jsonb, '["events.read"]'::jsonb, '{"label": "Events", "path": "spaces?capability=events", "icon": "calendar"}'::jsonb),
  ('rsvps', 'RSVPs', 'Event registration, capacity limits, and guest lists.', '1.0.0', 'events_activities', false, 'beta', '{"enableWaitlist": true}'::jsonb, '["events.rsvp"]'::jsonb, '{"label": "RSVPs", "path": "spaces?capability=events", "icon": "check-circle"}'::jsonb),
  ('attendance', 'Attendance', 'Check-in tracking and participation verification for events.', '0.1.0', 'events_activities', false, 'planned', '{}'::jsonb, '["events.manage"]'::jsonb, '{"label": "Attendance", "path": "attendance", "icon": "user-check"}'::jsonb),
  ('activities_meetups', 'Activities & Meetups', 'Recurring casual meetups, study groups, and hobby sessions.', '0.1.0', 'events_activities', false, 'planned', '{}'::jsonb, '["events.read"]'::jsonb, '{"label": "Meetups", "path": "meetups", "icon": "compass"}'::jsonb),
  ('marketplace', 'Marketplace', 'Peer-to-peer buying, selling, and community exchange spaces.', '0.1.0', 'commerce_discovery', false, 'planned', '{}'::jsonb, '["marketplace.read"]'::jsonb, '{"label": "Marketplace", "path": "spaces?capability=marketplace", "icon": "shopping-bag"}'::jsonb),
  ('listings_discovery', 'Listings & Discovery', 'Local directory of vetted community listings and recommendations.', '0.1.0', 'commerce_discovery', false, 'planned', '{}'::jsonb, '["listings.read"]'::jsonb, '{"label": "Listings", "path": "spaces?capability=listings_discovery", "icon": "map-pin"}'::jsonb),
  ('services_bookings', 'Services & Bookings', 'Local service providers, tutoring, and appointment requests.', '0.1.0', 'commerce_discovery', false, 'planned', '{}'::jsonb, '["services.read"]'::jsonb, '{"label": "Services", "path": "services", "icon": "briefcase"}'::jsonb),
  ('rentals_sharing', 'Rentals & Sharing', 'Tool libraries, equipment lending, and community resource sharing.', '0.1.0', 'commerce_discovery', false, 'planned', '{}'::jsonb, '["rentals.read"]'::jsonb, '{"label": "Rentals", "path": "rentals", "icon": "repeat"}'::jsonb),
  ('jobs_opportunities', 'Jobs & Opportunities', 'Career boards, internships, volunteer roles, and collaborations.', '1.0.0', 'commerce_discovery', false, 'beta', '{"allowMemberJobPosts": true}'::jsonb, '["jobs.read"]'::jsonb, '{"label": "Opportunities", "path": "spaces?capability=jobs_opportunities", "icon": "briefcase"}'::jsonb),
  ('housing_property', 'Housing & Property', 'Roommate matching, sublets, and campus/neighbourhood housing.', '0.1.0', 'commerce_discovery', false, 'planned', '{}'::jsonb, '["housing.read"]'::jsonb, '{"label": "Housing", "path": "spaces?capability=housing_property", "icon": "home"}'::jsonb),
  ('learning_resources', 'Learning & Resources', 'Structured cohorts, study modules, and curriculum discussions.', '1.0.0', 'knowledge_collaboration', false, 'beta', '{"enableCohortSpaces": true}'::jsonb, '["learning.read"]'::jsonb, '{"label": "Learning", "path": "spaces?capability=learning_resources", "icon": "graduation-cap"}'::jsonb),
  ('projects_collaboration', 'Projects & Collaboration', 'Team project updates, build logs, and milestone coordination.', '1.0.0', 'knowledge_collaboration', false, 'beta', '{"enableBuildLogs": true}'::jsonb, '["projects.read"]'::jsonb, '{"label": "Projects", "path": "spaces?capability=projects_collaboration", "icon": "folder-kanban"}'::jsonb),
  ('media_publishing', 'Media & Publishing', 'Long-form newsletters, podcasts, and community publications.', '0.1.0', 'knowledge_collaboration', false, 'planned', '{}'::jsonb, '["media.read"]'::jsonb, '{"label": "Publishing", "path": "media", "icon": "newspaper"}'::jsonb),
  ('fundraising_causes', 'Fundraising & Causes', 'Community drives, non-profit pledges, and impact tracking.', '0.1.0', 'organization_finance', false, 'planned', '{}'::jsonb, '["fundraising.read"]'::jsonb, '{"label": "Causes", "path": "causes", "icon": "heart"}'::jsonb),
  ('payments_finances', 'Payments & Finances', 'Membership dues and treasury reporting (deferred until payment review).', '0.1.0', 'organization_finance', false, 'planned', '{}'::jsonb, '["finance.manage"]'::jsonb, '{"label": "Finances", "path": "finances", "icon": "credit-card"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.capability_dependencies (capability_key, depends_on_key)
VALUES
  ('shared_resources', 'spaces'),
  ('polls_decisions', 'discussions'),
  ('governance_committees', 'member_directory'),
  ('challenges_rewards', 'member_directory'),
  ('help_desk', 'discussions'),
  ('events', 'spaces'),
  ('rsvps', 'events'),
  ('attendance', 'rsvps'),
  ('activities_meetups', 'events'),
  ('marketplace', 'spaces'),
  ('listings_discovery', 'spaces'),
  ('services_bookings', 'listings_discovery'),
  ('rentals_sharing', 'listings_discovery'),
  ('jobs_opportunities', 'spaces'),
  ('housing_property', 'listings_discovery'),
  ('learning_resources', 'spaces'),
  ('projects_collaboration', 'spaces'),
  ('media_publishing', 'discussions'),
  ('fundraising_causes', 'member_directory'),
  ('payments_finances', 'member_directory')
ON CONFLICT (capability_key, depends_on_key) DO NOTHING;

INSERT INTO public.circle_templates (key, name, category, summary, current_version)
VALUES
  ('university', 'University & Campus Hub', 'university', 'Designed for universities, faculties, and student unions with study spaces, campus announcements, events, and opportunities.', 1),
  ('neighbourhood', 'Neighbourhood Association', 'neighbourhood', 'Connect residents with local announcements, mutual aid requests, neighbourhood events, and shared resources.', 1),
  ('professional', 'Professional Network', 'professional', 'Curated industry network with topical discussions, member directory, job opportunities, and peer mentorship.', 1),
  ('creator', 'Creator Community', 'creator', 'Gather supporters and collaborators around discussions, behind-the-scenes updates, and creative feedback spaces.', 1),
  ('learning', 'Learning & Cohort Community', 'learning', 'Run structured study groups, curriculum spaces, Q&A help desks, and shared resource libraries.', 1),
  ('sports', 'Sports & Athletics Club', 'sports', 'Coordinate training sessions, match schedules, RSVPs, and club announcements.', 1),
  ('project', 'Startup & Project Team', 'project', 'Organize builders around project tracks, release discussions, help desks, and shared specs.', 1),
  ('local_business', 'Local Business Collective', 'local_business', 'Unite local merchants, chambers of commerce, and community partners for events and collaborative initiatives.', 1)
ON CONFLICT (key) DO NOTHING;
