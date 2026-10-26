-- ============================================================================
-- CIRCLES PLATFORM — REMAINING CAPABILITIES, WORKFLOWS & SECURITY HARDENING
-- Migration: 0005_remaining_capabilities_and_security.sql
-- ============================================================================

-- 1. Rate Limit Buckets & Session Policy Hardening (Postgres + Service Role)
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset_at ON public.rate_limit_buckets(reset_at);

REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO postgres, service_role;

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limit_buckets_service_only ON public.rate_limit_buckets;
CREATE POLICY rate_limit_buckets_service_only ON public.rate_limit_buckets
  FOR ALL TO postgres, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS user_sessions_service_only ON public.user_sessions;
CREATE POLICY user_sessions_service_only ON public.user_sessions
  FOR ALL TO postgres, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS schema_migrations_service_only ON public.schema_migrations;
CREATE POLICY schema_migrations_service_only ON public.schema_migrations
  FOR ALL TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- 2. Expand Notifications event_type & Content Reports target_type Constraints
DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'notifications'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
  END LOOP;
END
$$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_type_check CHECK (
    event_type IN (
      'invitation_received',
      'join_request_received',
      'join_request_approved',
      'join_request_rejected',
      'new_comment',
      'role_changed',
      'circle_announcement',
      'moderation_notice',
      'event_rsvp',
      'event_updated',
      'listing_inquiry',
      'booking_status',
      'job_application',
      'support_ticket',
      'challenge_reward',
      'governance_update',
      'system'
    )
  );

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS target_listing_id UUID;

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'content_reports'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.content_reports DROP CONSTRAINT %I', con_name);
  END LOOP;
END
$$;

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_target_type_check CHECK (
    target_type IN ('post', 'comment', 'member', 'listing')
  );

-- ============================================================================
-- 3. EVENTS, RSVPS & ATTENDANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.circle_events (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  space_id UUID,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 8000),
  event_type TEXT NOT NULL DEFAULT 'event' CHECK (event_type IN ('event', 'meetup', 'workshop', 'online')),
  location_type TEXT NOT NULL DEFAULT 'in_person' CHECK (location_type IN ('in_person', 'online', 'hybrid')),
  venue_text TEXT NOT NULL DEFAULT '' CHECK (char_length(venue_text) <= 300),
  meeting_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 1),
  registration_closes_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  CONSTRAINT circle_events_time_order_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_circle_events_circle_starts ON public.circle_events(circle_id, status, starts_at ASC);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'waitlisted', 'cancelled')),
  attended BOOLEAN NOT NULL DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id),
  FOREIGN KEY (event_id, circle_id) REFERENCES public.circle_events(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_status ON public.event_rsvps(event_id, status, created_at ASC);

-- ============================================================================
-- 4. POLLS & COMMUNITY DECISIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.circle_polls (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  space_id UUID,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 3 AND 240),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  results_visibility TEXT NOT NULL DEFAULT 'always' CHECK (results_visibility IN ('always', 'after_vote', 'after_close')),
  closes_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  decision_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_polls_circle ON public.circle_polls(circle_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY,
  poll_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (id, poll_id),
  FOREIGN KEY (poll_id, circle_id) REFERENCES public.circle_polls(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON public.poll_options(poll_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY,
  poll_id UUID NOT NULL,
  option_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, option_id, voter_id),
  FOREIGN KEY (poll_id, circle_id) REFERENCES public.circle_polls(id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (option_id, poll_id) REFERENCES public.poll_options(id, poll_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_voter ON public.poll_votes(poll_id, voter_id);

CREATE OR REPLACE FUNCTION public.enforce_poll_vote_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poll_rec RECORD;
  existing_vote_count INTEGER;
BEGIN
  SELECT status, closes_at, allow_multiple
  INTO poll_rec
  FROM public.circle_polls
  WHERE id = NEW.poll_id AND circle_id = NEW.circle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll not found in this Circle.';
  END IF;

  IF poll_rec.status <> 'open' THEN
    RAISE EXCEPTION 'Cannot vote on a closed or archived poll.';
  END IF;

  IF poll_rec.closes_at IS NOT NULL AND poll_rec.closes_at <= NOW() THEN
    RAISE EXCEPTION 'Voting period for this poll has ended.';
  END IF;

  IF NOT poll_rec.allow_multiple THEN
    SELECT COUNT(*)::int INTO existing_vote_count
    FROM public.poll_votes
    WHERE poll_id = NEW.poll_id AND voter_id = NEW.voter_id;

    IF existing_vote_count > 0 THEN
      RAISE EXCEPTION 'Single-choice polls allow only one vote per member.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_poll_vote_integrity ON public.poll_votes;
CREATE TRIGGER trg_enforce_poll_vote_integrity
BEFORE INSERT ON public.poll_votes
FOR EACH ROW EXECUTE FUNCTION public.enforce_poll_vote_integrity();

-- ============================================================================
-- 5. MARKETPLACE, LISTINGS, INQUIRIES, SERVICES, BOOKINGS & RENTALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_type TEXT NOT NULL DEFAULT 'product' CHECK (listing_type IN ('product', 'service', 'rental', 'housing', 'directory')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (char_length(category) BETWEEN 1 AND 60),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 8000),
  price_amount NUMERIC(12, 2) CHECK (price_amount IS NULL OR price_amount >= 0),
  price_currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(price_currency) = 3),
  pricing_unit TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_unit IN ('fixed', 'hourly', 'daily', 'monthly', 'free', 'negotiable')),
  condition TEXT CHECK (condition IS NULL OR condition IN ('new', 'like_new', 'good', 'fair', 'not_applicable')),
  location TEXT,
  contact_preference TEXT NOT NULL DEFAULT 'in_app_inquiry' CHECK (contact_preference IN ('in_app_inquiry', 'email', 'both')),
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_duration_minutes INTEGER CHECK (service_duration_minutes IS NULL OR service_duration_minutes >= 15),
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'reserved', 'sold', 'archived', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_circle ON public.marketplace_listings(circle_id, listing_type, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_saved_listings (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, user_id),
  FOREIGN KEY (listing_id, circle_id) REFERENCES public.marketplace_listings(id, circle_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.listing_inquiries (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  seller_response TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'responded', 'accepted', 'declined', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (listing_id, circle_id) REFERENCES public.marketplace_listings(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listing_inquiries_listing ON public.listing_inquiries(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_inquiries_parties ON public.listing_inquiries(circle_id, buyer_id, seller_id);

CREATE TABLE IF NOT EXISTS public.service_bookings (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_type TEXT NOT NULL DEFAULT 'service' CHECK (booking_type IN ('service', 'rental')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed', 'returned')),
  provider_note TEXT,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_bookings_time_order_check CHECK (ends_at > starts_at),
  FOREIGN KEY (listing_id, circle_id) REFERENCES public.marketplace_listings(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_bookings_listing_time ON public.service_bookings(listing_id, status, starts_at, ends_at);

CREATE OR REPLACE FUNCTION public.prevent_booking_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_exists BOOLEAN;
BEGIN
  IF NEW.status = 'approved' THEN
    -- Lock the parent listing row to serialize concurrent booking approvals
    PERFORM 1 FROM public.marketplace_listings
    WHERE id = NEW.listing_id AND circle_id = NEW.circle_id
    FOR UPDATE;

    SELECT EXISTS (
      SELECT 1 FROM public.service_bookings b
      WHERE b.listing_id = NEW.listing_id
        AND b.circle_id = NEW.circle_id
        AND b.id <> NEW.id
        AND b.status = 'approved'
        AND NEW.starts_at < b.ends_at
        AND NEW.ends_at > b.starts_at
    ) INTO conflict_exists;

    IF conflict_exists THEN
      RAISE EXCEPTION 'Booking conflict: another approved booking or rental already overlaps this time window.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_booking_conflicts ON public.service_bookings;
CREATE TRIGGER trg_prevent_booking_conflicts
BEFORE INSERT OR UPDATE ON public.service_bookings
FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_conflicts();

-- ============================================================================
-- 6. JOBS & OPPORTUNITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_opportunities (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  poster_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  organization_name TEXT NOT NULL DEFAULT '' CHECK (char_length(organization_name) <= 140),
  opportunity_type TEXT NOT NULL DEFAULT 'full_time' CHECK (opportunity_type IN ('full_time', 'part_time', 'internship', 'freelance', 'volunteer', 'collaboration')),
  work_mode TEXT NOT NULL DEFAULT 'remote' CHECK (work_mode IN ('remote', 'on_site', 'hybrid')),
  location TEXT,
  compensation_text TEXT,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 10000),
  requirements TEXT NOT NULL DEFAULT '' CHECK (char_length(requirements) <= 6000),
  application_deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_job_opportunities_circle ON public.job_opportunities(circle_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL,
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_note TEXT NOT NULL CHECK (char_length(cover_note) BETWEEN 5 AND 5000),
  resume_url TEXT,
  portfolio_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn')),
  reviewer_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, applicant_id),
  FOREIGN KEY (opportunity_id, circle_id) REFERENCES public.job_opportunities(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_applications_opportunity ON public.job_applications(opportunity_id, created_at DESC);

-- ============================================================================
-- 7. LEARNING RESOURCES, BOOKMARKS & COLLABORATIVE PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.learning_resources_items (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL DEFAULT 'learning_resources' CHECK (capability_key IN ('learning_resources', 'shared_resources', 'media_publishing')),
  category TEXT NOT NULL DEFAULT 'guide' CHECK (char_length(category) BETWEEN 1 AND 60),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  summary TEXT NOT NULL DEFAULT '' CHECK (char_length(summary) <= 600),
  content_body TEXT NOT NULL DEFAULT '' CHECK (char_length(content_body) <= 25000),
  external_url TEXT,
  attachment_url TEXT,
  difficulty_level TEXT CHECK (difficulty_level IS NULL OR difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_resources_circle ON public.learning_resources_items(circle_id, capability_key, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.resource_bookmarks (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resource_id, user_id),
  FOREIGN KEY (resource_id, circle_id) REFERENCES public.learning_resources_items(id, circle_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.circle_projects (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  space_id UUID,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 140),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  target_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_projects_circle ON public.circle_projects(circle_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('lead', 'contributor', 'reviewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id),
  FOREIGN KEY (project_id, circle_id) REFERENCES public.circle_projects(id, circle_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 180),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 3000),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (project_id, circle_id) REFERENCES public.circle_projects(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks(project_id, status, priority);

-- ============================================================================
-- 8. GOVERNANCE, FUNDRAISING, CHALLENGES & HELP DESK
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.governance_proposals (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  committee_name TEXT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 5 AND 10000),
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('draft', 'under_review', 'approved', 'rejected', 'implemented', 'archived')),
  decision_rationale TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_circle ON public.governance_proposals(circle_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fundraising_campaigns (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 6000),
  goal_amount NUMERIC(12, 2) NOT NULL CHECK (goal_amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE TABLE IF NOT EXISTS public.fundraising_pledges (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  pledger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pledge_amount NUMERIC(12, 2) NOT NULL CHECK (pledge_amount > 0),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  status TEXT NOT NULL DEFAULT 'pledged' CHECK (status IN ('pledged', 'fulfilled_verified', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (campaign_id, circle_id) REFERENCES public.fundraising_campaigns(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fundraising_pledges_campaign ON public.fundraising_pledges(campaign_id, status);

CREATE TABLE IF NOT EXISTS public.community_challenges (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 4000),
  rules TEXT NOT NULL DEFAULT '' CHECK (char_length(rules) <= 2000),
  reward_badge_name TEXT NOT NULL DEFAULT 'Challenger',
  reward_points INTEGER NOT NULL DEFAULT 50 CHECK (reward_points >= 0 AND reward_points <= 10000),
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id UUID PRIMARY KEY,
  challenge_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_text TEXT NOT NULL CHECK (char_length(submission_text) BETWEEN 2 AND 4000),
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  awarded_points INTEGER NOT NULL DEFAULT 0 CHECK (awarded_points >= 0 AND awarded_points <= 10000),
  awarded_badge TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, participant_id),
  FOREIGN KEY (challenge_id, circle_id) REFERENCES public.community_challenges(id, circle_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.protect_challenge_rewards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'submitted' OR NEW.awarded_points <> 0 OR NEW.awarded_badge IS NOT NULL THEN
      IF NOT public.has_circle_staff_role(NEW.circle_id, auth.uid(), 'moderator') THEN
        RAISE EXCEPTION 'Participants cannot self-award challenge points or badges on submission.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.awarded_points IS DISTINCT FROM OLD.awarded_points
       OR NEW.awarded_badge IS DISTINCT FROM OLD.awarded_badge THEN
      IF NOT public.has_circle_staff_role(OLD.circle_id, auth.uid(), 'moderator')
         AND NOT public.is_platform_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only Circle moderators, administrators, or owners can approve challenge submissions or award points.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_challenge_rewards ON public.challenge_submissions;
CREATE TRIGGER trg_protect_challenge_rewards
BEFORE INSERT OR UPDATE ON public.challenge_submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_challenge_rewards();

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'technical', 'membership', 'mutual_aid', 'facilities')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_private BOOLEAN NOT NULL DEFAULT true,
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 180),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 5 AND 6000),
  resolution_notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_circle ON public.support_tickets(circle_id, status, priority, created_at DESC);

-- ============================================================================
-- 9. SECURE MEDIA & FILE UPLOADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.media_uploads (
  id UUID PRIMARY KEY,
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket_name TEXT NOT NULL DEFAULT 'circles-media',
  object_path TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  safe_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  sha256_checksum TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'circle_members' CHECK (visibility IN ('public', 'circle_members', 'private')),
  storage_backend TEXT NOT NULL DEFAULT 'database_signed',
  content_base64 TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'orphaned', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_uploads_circle ON public.media_uploads(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_media_uploads_uploader ON public.media_uploads(uploader_id, status);

-- ============================================================================
-- 10. HELPER FUNCTIONS, GRANTS & ROW-LEVEL SECURITY POLICIES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_any_commerce_capability_enabled(target_circle_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_capabilities
    WHERE circle_id = target_circle_id
      AND capability_key IN (
        'marketplace',
        'listings_discovery',
        'services_bookings',
        'rentals_sharing',
        'housing_property'
      )
      AND enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_any_event_capability_enabled(target_circle_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_capabilities
    WHERE circle_id = target_circle_id
      AND capability_key IN ('events', 'rsvps', 'attendance', 'activities_meetups')
      AND enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_any_resource_capability_enabled(target_circle_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_capabilities
    WHERE circle_id = target_circle_id
      AND capability_key IN ('learning_resources', 'shared_resources', 'media_publishing')
      AND enabled = true
  );
$$;

GRANT EXECUTE ON FUNCTION
  public.is_any_commerce_capability_enabled(uuid),
  public.is_any_event_capability_enabled(uuid),
  public.is_any_resource_capability_enabled(uuid)
TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.circle_events,
  public.event_rsvps,
  public.circle_polls,
  public.poll_options,
  public.poll_votes,
  public.marketplace_listings,
  public.marketplace_saved_listings,
  public.listing_inquiries,
  public.service_bookings,
  public.job_opportunities,
  public.job_applications,
  public.learning_resources_items,
  public.resource_bookmarks,
  public.circle_projects,
  public.project_members,
  public.project_tasks,
  public.governance_proposals,
  public.fundraising_campaigns,
  public.fundraising_pledges,
  public.community_challenges,
  public.challenge_submissions,
  public.support_tickets,
  public.media_uploads
TO anon, authenticated, service_role;

ALTER TABLE public.circle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraising_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraising_pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;

-- 10.1 Events & RSVPs Policies
DROP POLICY IF EXISTS circle_events_select ON public.circle_events;
CREATE POLICY circle_events_select ON public.circle_events
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_event_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS circle_events_insert ON public.circle_events;
CREATE POLICY circle_events_insert ON public.circle_events
  FOR INSERT TO authenticated
  WITH CHECK (
    organizer_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_any_event_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS circle_events_update ON public.circle_events;
CREATE POLICY circle_events_update ON public.circle_events
  FOR UPDATE TO authenticated
  USING (
    public.is_any_event_capability_enabled(circle_id)
    AND (
      organizer_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_any_event_capability_enabled(circle_id)
    AND (
      organizer_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS circle_events_delete ON public.circle_events;
CREATE POLICY circle_events_delete ON public.circle_events
  FOR DELETE TO authenticated
  USING (
    organizer_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS event_rsvps_select ON public.event_rsvps;
CREATE POLICY event_rsvps_select ON public.event_rsvps
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_event_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS event_rsvps_insert ON public.event_rsvps;
CREATE POLICY event_rsvps_insert ON public.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_any_event_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS event_rsvps_update ON public.event_rsvps;
CREATE POLICY event_rsvps_update ON public.event_rsvps
  FOR UPDATE TO authenticated
  USING (
    public.is_any_event_capability_enabled(circle_id)
    AND (
      user_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.circle_events e
        WHERE e.id = event_rsvps.event_id
          AND e.circle_id = event_rsvps.circle_id
          AND e.organizer_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_any_event_capability_enabled(circle_id)
    AND (
      user_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.circle_events e
        WHERE e.id = event_rsvps.event_id
          AND e.circle_id = event_rsvps.circle_id
          AND e.organizer_id = auth.uid()
      )
    )
  );

-- 10.2 Polls Policies
DROP POLICY IF EXISTS circle_polls_select ON public.circle_polls;
CREATE POLICY circle_polls_select ON public.circle_polls
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'polls_decisions')
  );

DROP POLICY IF EXISTS circle_polls_insert ON public.circle_polls;
CREATE POLICY circle_polls_insert ON public.circle_polls
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'polls_decisions')
  );

DROP POLICY IF EXISTS circle_polls_update ON public.circle_polls;
CREATE POLICY circle_polls_update ON public.circle_polls
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'polls_decisions')
    AND (
      creator_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'polls_decisions')
    AND (
      creator_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS poll_options_select ON public.poll_options;
CREATE POLICY poll_options_select ON public.poll_options
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'polls_decisions')
  );

DROP POLICY IF EXISTS poll_options_insert ON public.poll_options;
CREATE POLICY poll_options_insert ON public.poll_options
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'polls_decisions')
    AND EXISTS (
      SELECT 1 FROM public.circle_polls p
      WHERE p.id = poll_options.poll_id
        AND p.circle_id = poll_options.circle_id
        AND (p.creator_id = auth.uid() OR public.has_circle_staff_role(poll_options.circle_id, auth.uid(), 'moderator'))
    )
  );

DROP POLICY IF EXISTS poll_votes_select ON public.poll_votes;
CREATE POLICY poll_votes_select ON public.poll_votes
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'polls_decisions')
  );

DROP POLICY IF EXISTS poll_votes_insert ON public.poll_votes;
CREATE POLICY poll_votes_insert ON public.poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'polls_decisions')
  );

-- 10.3 Marketplace, Inquiries, Saved Listings & Bookings Policies
DROP POLICY IF EXISTS marketplace_listings_select ON public.marketplace_listings;
CREATE POLICY marketplace_listings_select ON public.marketplace_listings
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_commerce_capability_enabled(circle_id)
    AND (
      status IN ('published', 'reserved', 'sold')
      OR seller_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS marketplace_listings_insert ON public.marketplace_listings;
CREATE POLICY marketplace_listings_insert ON public.marketplace_listings
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_any_commerce_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS marketplace_listings_update ON public.marketplace_listings;
CREATE POLICY marketplace_listings_update ON public.marketplace_listings
  FOR UPDATE TO authenticated
  USING (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      (seller_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      (seller_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS marketplace_listings_delete ON public.marketplace_listings;
CREATE POLICY marketplace_listings_delete ON public.marketplace_listings
  FOR DELETE TO authenticated
  USING (
    (seller_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS marketplace_saved_listings_all ON public.marketplace_saved_listings;
CREATE POLICY marketplace_saved_listings_all ON public.marketplace_saved_listings
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_commerce_capability_enabled(circle_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_commerce_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS listing_inquiries_select ON public.listing_inquiries;
CREATE POLICY listing_inquiries_select ON public.listing_inquiries
  FOR SELECT TO authenticated
  USING (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      buyer_id = auth.uid()
      OR seller_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS listing_inquiries_insert ON public.listing_inquiries;
CREATE POLICY listing_inquiries_insert ON public.listing_inquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND buyer_id <> seller_id
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_any_commerce_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS listing_inquiries_update ON public.listing_inquiries;
CREATE POLICY listing_inquiries_update ON public.listing_inquiries
  FOR UPDATE TO authenticated
  USING (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      buyer_id = auth.uid()
      OR seller_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      buyer_id = auth.uid()
      OR seller_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS service_bookings_select ON public.service_bookings;
CREATE POLICY service_bookings_select ON public.service_bookings
  FOR SELECT TO authenticated
  USING (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      requester_id = auth.uid()
      OR provider_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS service_bookings_insert ON public.service_bookings;
CREATE POLICY service_bookings_insert ON public.service_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND requester_id <> provider_id
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_any_commerce_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS service_bookings_update ON public.service_bookings;
CREATE POLICY service_bookings_update ON public.service_bookings
  FOR UPDATE TO authenticated
  USING (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      requester_id = auth.uid()
      OR provider_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_any_commerce_capability_enabled(circle_id)
    AND (
      requester_id = auth.uid()
      OR provider_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

-- 10.4 Jobs & Applications Policies (Strict Applicant Privacy)
DROP POLICY IF EXISTS job_opportunities_select ON public.job_opportunities;
CREATE POLICY job_opportunities_select ON public.job_opportunities
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'jobs_opportunities')
    AND (
      status IN ('open', 'closed')
      OR poster_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS job_opportunities_insert ON public.job_opportunities;
CREATE POLICY job_opportunities_insert ON public.job_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    poster_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'jobs_opportunities')
  );

DROP POLICY IF EXISTS job_opportunities_update ON public.job_opportunities;
CREATE POLICY job_opportunities_update ON public.job_opportunities
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'jobs_opportunities')
    AND (
      poster_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'jobs_opportunities')
    AND (
      poster_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS job_applications_select ON public.job_applications;
CREATE POLICY job_applications_select ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'jobs_opportunities')
    AND (
      applicant_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.job_opportunities j
        WHERE j.id = job_applications.opportunity_id
          AND j.circle_id = job_applications.circle_id
          AND j.poster_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS job_applications_insert ON public.job_applications;
CREATE POLICY job_applications_insert ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'jobs_opportunities')
  );

DROP POLICY IF EXISTS job_applications_update ON public.job_applications;
CREATE POLICY job_applications_update ON public.job_applications
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'jobs_opportunities')
    AND (
      applicant_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.job_opportunities j
        WHERE j.id = job_applications.opportunity_id
          AND j.circle_id = job_applications.circle_id
          AND j.poster_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'jobs_opportunities')
    AND (
      applicant_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.job_opportunities j
        WHERE j.id = job_applications.opportunity_id
          AND j.circle_id = job_applications.circle_id
          AND j.poster_id = auth.uid()
      )
    )
  );

-- 10.5 Learning Resources, Bookmarks & Projects Policies
DROP POLICY IF EXISTS learning_resources_select ON public.learning_resources_items;
CREATE POLICY learning_resources_select ON public.learning_resources_items
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_resource_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS learning_resources_insert ON public.learning_resources_items;
CREATE POLICY learning_resources_insert ON public.learning_resources_items
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_any_resource_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS learning_resources_update ON public.learning_resources_items;
CREATE POLICY learning_resources_update ON public.learning_resources_items
  FOR UPDATE TO authenticated
  USING (
    public.is_any_resource_capability_enabled(circle_id)
    AND (
      author_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_any_resource_capability_enabled(circle_id)
    AND (
      author_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS resource_bookmarks_all ON public.resource_bookmarks;
CREATE POLICY resource_bookmarks_all ON public.resource_bookmarks
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_resource_capability_enabled(circle_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_any_resource_capability_enabled(circle_id)
  );

DROP POLICY IF EXISTS circle_projects_select ON public.circle_projects;
CREATE POLICY circle_projects_select ON public.circle_projects
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
  );

DROP POLICY IF EXISTS circle_projects_insert ON public.circle_projects;
CREATE POLICY circle_projects_insert ON public.circle_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
  );

DROP POLICY IF EXISTS circle_projects_update ON public.circle_projects;
CREATE POLICY circle_projects_update ON public.circle_projects
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'projects_collaboration')
    AND (
      owner_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'projects_collaboration')
    AND (
      owner_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS project_members_select ON public.project_members;
CREATE POLICY project_members_select ON public.project_members
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
  );

DROP POLICY IF EXISTS project_members_insert ON public.project_members;
CREATE POLICY project_members_insert ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
    AND (
      user_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.circle_projects p
        WHERE p.id = project_members.project_id
          AND p.circle_id = project_members.circle_id
          AND p.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS project_tasks_select ON public.project_tasks;
CREATE POLICY project_tasks_select ON public.project_tasks
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
  );

DROP POLICY IF EXISTS project_tasks_insert ON public.project_tasks;
CREATE POLICY project_tasks_insert ON public.project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
  );

DROP POLICY IF EXISTS project_tasks_update ON public.project_tasks;
CREATE POLICY project_tasks_update ON public.project_tasks
  FOR UPDATE TO authenticated
  USING (
    public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
  )
  WITH CHECK (
    public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'projects_collaboration')
  );

-- 10.6 Governance, Fundraising, Challenges & Support Tickets Policies
DROP POLICY IF EXISTS governance_proposals_select ON public.governance_proposals;
CREATE POLICY governance_proposals_select ON public.governance_proposals
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'governance_committees')
  );

DROP POLICY IF EXISTS governance_proposals_insert ON public.governance_proposals;
CREATE POLICY governance_proposals_insert ON public.governance_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    proposer_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'governance_committees')
  );

DROP POLICY IF EXISTS governance_proposals_update ON public.governance_proposals;
CREATE POLICY governance_proposals_update ON public.governance_proposals
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'governance_committees')
    AND (
      proposer_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'governance_committees')
    AND (
      proposer_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS fundraising_campaigns_select ON public.fundraising_campaigns;
CREATE POLICY fundraising_campaigns_select ON public.fundraising_campaigns
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
  );

DROP POLICY IF EXISTS fundraising_campaigns_insert ON public.fundraising_campaigns;
CREATE POLICY fundraising_campaigns_insert ON public.fundraising_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
  );

DROP POLICY IF EXISTS fundraising_campaigns_update ON public.fundraising_campaigns;
CREATE POLICY fundraising_campaigns_update ON public.fundraising_campaigns
  FOR UPDATE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
  )
  WITH CHECK (
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
  );

DROP POLICY IF EXISTS fundraising_pledges_select ON public.fundraising_pledges;
CREATE POLICY fundraising_pledges_select ON public.fundraising_pledges
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
  );

DROP POLICY IF EXISTS fundraising_pledges_insert ON public.fundraising_pledges;
CREATE POLICY fundraising_pledges_insert ON public.fundraising_pledges
  FOR INSERT TO authenticated
  WITH CHECK (
    pledger_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
  );

DROP POLICY IF EXISTS fundraising_pledges_update ON public.fundraising_pledges;
CREATE POLICY fundraising_pledges_update ON public.fundraising_pledges
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'fundraising_causes')
    AND (
      pledger_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'fundraising_causes')
    AND (
      pledger_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS community_challenges_select ON public.community_challenges;
CREATE POLICY community_challenges_select ON public.community_challenges
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'challenges_rewards')
  );

DROP POLICY IF EXISTS community_challenges_insert ON public.community_challenges;
CREATE POLICY community_challenges_insert ON public.community_challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    AND public.is_capability_enabled(circle_id, 'challenges_rewards')
  );

DROP POLICY IF EXISTS challenge_submissions_select ON public.challenge_submissions;
CREATE POLICY challenge_submissions_select ON public.challenge_submissions
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'challenges_rewards')
  );

DROP POLICY IF EXISTS challenge_submissions_insert ON public.challenge_submissions;
CREATE POLICY challenge_submissions_insert ON public.challenge_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    participant_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'challenges_rewards')
  );

DROP POLICY IF EXISTS challenge_submissions_update ON public.challenge_submissions;
CREATE POLICY challenge_submissions_update ON public.challenge_submissions
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'challenges_rewards')
    AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'challenges_rewards')
    AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

-- Support Tickets: Private tickets readable ONLY by requester, assignee, or Circle moderator+
DROP POLICY IF EXISTS support_tickets_select ON public.support_tickets;
CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'help_desk')
    AND (
      requester_id = auth.uid()
      OR assigned_to = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR (is_private = false AND public.is_active_circle_member(circle_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'help_desk')
  );

DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'help_desk')
    AND (
      requester_id = auth.uid()
      OR assigned_to = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'help_desk')
    AND (
      requester_id = auth.uid()
      OR assigned_to = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

-- 10.7 Media Uploads Policies
DROP POLICY IF EXISTS media_uploads_select ON public.media_uploads;
CREATE POLICY media_uploads_select ON public.media_uploads
  FOR SELECT TO anon, authenticated
  USING (
    uploader_id = auth.uid()
    OR (
      circle_id IS NOT NULL
      AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
    OR (
      status = 'active'
      AND (
        visibility = 'public'
        OR (
          visibility = 'circle_members'
          AND circle_id IS NOT NULL
          AND public.can_read_circle_content(circle_id, auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS media_uploads_insert ON public.media_uploads;
CREATE POLICY media_uploads_insert ON public.media_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND (
      circle_id IS NULL
      OR public.is_active_circle_member(circle_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS media_uploads_update ON public.media_uploads;
CREATE POLICY media_uploads_update ON public.media_uploads
  FOR UPDATE TO authenticated
  USING (
    uploader_id = auth.uid()
    OR (circle_id IS NOT NULL AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
  )
  WITH CHECK (
    uploader_id = auth.uid()
    OR (circle_id IS NOT NULL AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
  );

-- 11. Promote Implemented Capabilities in capability_definitions Reference Catalog
UPDATE public.capability_definitions
SET release_stage = 'stable',
    version = '1.0.0'
WHERE key IN (
  'discussions',
  'spaces',
  'member_directory',
  'events',
  'rsvps',
  'attendance',
  'activities_meetups',
  'polls_decisions',
  'marketplace',
  'listings_discovery',
  'services_bookings',
  'rentals_sharing',
  'jobs_opportunities',
  'housing_property',
  'learning_resources',
  'shared_resources',
  'projects_collaboration',
  'media_publishing',
  'governance_committees',
  'fundraising_causes',
  'challenges_rewards',
  'help_desk'
);
