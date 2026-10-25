-- ============================================================================
-- CIRCLES PLATFORM — CORE DATABASE SCHEMA & ROW-LEVEL SECURITY MIGRATION
-- Migration: 0001_initial_schema.sql
-- ============================================================================

-- 1. Auth Schema & Roles Bootstrap (Compatible with Supabase & Local PGlite)
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role SUPERUSER BYPASSRLS NOLOGIN;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  recovery_token TEXT,
  recovery_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql VOLATILE
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql VOLATILE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    current_user
  );
$$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- 2.1 User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 500),
  avatar_url TEXT,
  location TEXT,
  profile_visibility TEXT NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public', 'members_only', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Platform Roles (Platform-level administration separated from Circle roles)
CREATE TABLE IF NOT EXISTS public.platform_roles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'trust_safety')),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Circles
CREATE TABLE IF NOT EXISTS public.circles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 64),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  category TEXT NOT NULL DEFAULT 'general' CHECK (
    category IN (
      'university',
      'neighbourhood',
      'professional',
      'creator',
      'learning',
      'sports',
      'project',
      'local_business',
      'faith',
      'housing',
      'marketplace',
      'nonprofit',
      'general'
    )
  ),
  location TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'discoverable_approval', 'private')),
  membership_policy TEXT NOT NULL DEFAULT 'open' CHECK (membership_policy IN ('open', 'approval', 'invite_only')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'suspended')),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  template_key TEXT,
  template_version INTEGER,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT circles_visibility_policy_check CHECK (
    (visibility = 'private' AND membership_policy = 'invite_only')
    OR (visibility = 'discoverable_approval' AND membership_policy IN ('approval', 'invite_only'))
    OR (visibility = 'public' AND membership_policy IN ('open', 'approval'))
  )
);

CREATE INDEX IF NOT EXISTS idx_circles_visibility_status ON public.circles(visibility, status);
CREATE INDEX IF NOT EXISTS idx_circles_category ON public.circles(category);
CREATE INDEX IF NOT EXISTS idx_circles_owner ON public.circles(owner_id);

-- 2.4 Circle Memberships
CREATE TABLE IF NOT EXISTS public.circle_memberships (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_memberships_user_status ON public.circle_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_memberships_circle_role ON public.circle_memberships(circle_id, role, status);

-- 2.5 Circle Join Requests
CREATE TABLE IF NOT EXISTS public.circle_join_requests (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate pending join requests per user per circle
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_join_request
  ON public.circle_join_requests (circle_id, user_id)
  WHERE status = 'pending';

-- 2.6 Circle Invitations
CREATE TABLE IF NOT EXISTS public.circle_invitations (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  token_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_invitations_circle ON public.circle_invitations(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_invitations_email ON public.circle_invitations(lower(invited_email), status);

-- 2.7 Circle Role Permissions (Customizable role overrides per Circle)
CREATE TABLE IF NOT EXISTS public.circle_role_permissions (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  permission_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, role, permission_key)
);

-- 2.8 Capability Registry Definitions & Dependencies
CREATE TABLE IF NOT EXISTS public.capability_definitions (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  category TEXT NOT NULL CHECK (
    category IN (
      'community',
      'events_activities',
      'commerce_discovery',
      'knowledge_collaboration',
      'organization_finance'
    )
  ),
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  release_stage TEXT NOT NULL DEFAULT 'stable' CHECK (release_stage IN ('stable', 'beta', 'planned')),
  default_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  navigation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.capability_dependencies (
  capability_key TEXT NOT NULL REFERENCES public.capability_definitions(key) ON DELETE CASCADE,
  depends_on_key TEXT NOT NULL REFERENCES public.capability_definitions(key) ON DELETE CASCADE,
  PRIMARY KEY (capability_key, depends_on_key),
  CHECK (capability_key <> depends_on_key)
);

-- 2.9 Per-Circle Capabilities
CREATE TABLE IF NOT EXISTS public.circle_capabilities (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL REFERENCES public.capability_definitions(key) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, capability_key)
);

CREATE INDEX IF NOT EXISTS idx_circle_capabilities_lookup ON public.circle_capabilities(circle_id, capability_key, enabled);

-- 2.10 Circle Templates & Template Versions
CREATE TABLE IF NOT EXISTS public.circle_templates (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.circle_template_versions (
  id UUID PRIMARY KEY,
  template_key TEXT NOT NULL REFERENCES public.circle_templates(key) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  default_visibility TEXT NOT NULL DEFAULT 'public',
  default_membership_policy TEXT NOT NULL DEFAULT 'open',
  enabled_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_spaces JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_key, version)
);

-- 2.11 Circle Spaces
CREATE TABLE IF NOT EXISTS public.circle_spaces (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 400),
  icon TEXT NOT NULL DEFAULT 'message-square',
  capability_key TEXT REFERENCES public.capability_definitions(key) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'members' CHECK (visibility IN ('public', 'members', 'staff_only')),
  posting_policy TEXT NOT NULL DEFAULT 'members' CHECK (posting_policy IN ('members', 'moderators', 'admins')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, slug),
  UNIQUE (id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_spaces_circle_order ON public.circle_spaces(circle_id, is_archived, sort_order);

-- 2.12 Circle Navigation Items
CREATE TABLE IF NOT EXISTS public.circle_navigation_items (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  capability_key TEXT REFERENCES public.capability_definitions(key) ON DELETE SET NULL,
  space_id UUID,
  visibility TEXT NOT NULL DEFAULT 'members' CHECK (visibility IN ('public', 'members', 'staff_only')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (space_id, circle_id) REFERENCES public.circle_spaces(id, circle_id) ON DELETE CASCADE
);

-- 2.13 Posts (Composite FK enforces space belongs to exact same Circle)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  space_id UUID,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 10000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived', 'removed')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  comment_count INTEGER NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  FOREIGN KEY (space_id, circle_id) REFERENCES public.circle_spaces(id, circle_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_circle_created ON public.posts(circle_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_space_created ON public.posts(space_id, status, created_at DESC);

-- 2.14 Comments (Composite FK enforces comment belongs to post in exact same Circle)
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (post_id, circle_id) REFERENCES public.posts(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments(post_id, status, created_at ASC);

-- 2.15 Reactions
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'helpful', 'celebrate', 'insightful')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, reaction_type),
  FOREIGN KEY (post_id, circle_id) REFERENCES public.posts(id, circle_id) ON DELETE CASCADE
);

-- 2.16 Saved Items
CREATE TABLE IF NOT EXISTS public.saved_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id),
  FOREIGN KEY (post_id, circle_id) REFERENCES public.posts(id, circle_id) ON DELETE CASCADE
);

-- 2.17 Circle Follows & User Blocks
CREATE TABLE IF NOT EXISTS public.circle_follows (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, circle_id)
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- 2.18 Content Reports & Moderation Actions
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'member')),
  target_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  target_comment_id UUID REFERENCES public.comments(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'misinformation', 'rule_violation', 'other')),
  details TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_circle_status ON public.content_reports(circle_id, status);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY,
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL CHECK (
    action_type IN (
      'remove_post',
      'restore_post',
      'remove_comment',
      'restore_comment',
      'suspend_member',
      'restore_member',
      'resolve_report',
      'dismiss_report',
      'platform_suspend_circle'
    )
  ),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  report_id UUID REFERENCES public.content_reports(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.19 Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY,
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_circle_created ON public.audit_logs(circle_id, created_at DESC);

-- 2.20 Notifications & Idempotent Delivery Records
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  circle_id UUID REFERENCES public.circles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'invitation_received',
      'join_request_received',
      'join_request_approved',
      'join_request_rejected',
      'new_comment',
      'role_changed',
      'circle_announcement',
      'moderation_notice'
    )
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_url TEXT NOT NULL DEFAULT '/circles',
  idempotency_key TEXT UNIQUE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'skipped_unconfigured', 'failed')),
  provider_reference TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, channel)
);

-- ============================================================================
-- 3. INTEGRITY TRIGGERS (Last-Owner Protection)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_last_owner_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  remaining_owners INTEGER;
  circle_exists BOOLEAN;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.status = 'active') OR
     (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND OLD.status = 'active' AND (NEW.role <> 'owner' OR NEW.status <> 'active')) THEN

    SELECT EXISTS (SELECT 1 FROM public.circles WHERE id = OLD.circle_id) INTO circle_exists;
    IF NOT circle_exists THEN
      RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COUNT(*) INTO remaining_owners
    FROM public.circle_memberships
    WHERE circle_id = OLD.circle_id
      AND id <> OLD.id
      AND role = 'owner'
      AND status = 'active';

    IF remaining_owners = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last active owner of a Circle. Transfer ownership first.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_loss ON public.circle_memberships;
CREATE TRIGGER trg_prevent_last_owner_loss
BEFORE UPDATE OR DELETE ON public.circle_memberships
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_loss();

CREATE OR REPLACE FUNCTION public.sync_post_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_post UUID;
BEGIN
  target_post := COALESCE(NEW.post_id, OLD.post_id);
  IF target_post IS NOT NULL THEN
    UPDATE public.posts
    SET comment_count = (
          SELECT COUNT(*) FROM public.comments
          WHERE post_id = target_post AND status = 'published'
        ),
        reaction_count = (
          SELECT COUNT(*) FROM public.reactions
          WHERE post_id = target_post
        )
    WHERE id = target_post;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comment_counts ON public.comments;
CREATE TRIGGER trg_sync_comment_counts
AFTER INSERT OR UPDATE OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.sync_post_counts();

DROP TRIGGER IF EXISTS trg_sync_reaction_counts ON public.reactions;
CREATE TRIGGER trg_sync_reaction_counts
AFTER INSERT OR DELETE ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_post_counts();

-- ============================================================================
-- 4. CENTRALIZED RLS AUTHORIZATION FUNCTIONS (SECURITY DEFINER with safe search_path)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = check_user_id
      AND role IN ('platform_admin', 'trust_safety')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_circle_role(target_circle_id uuid, check_user_id uuid)
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.circle_memberships
  WHERE circle_id = target_circle_id
    AND user_id = check_user_id
    AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_circle_member(target_circle_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_memberships
    WHERE circle_id = target_circle_id
      AND user_id = check_user_id
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.circles
    WHERE id = target_circle_id
      AND owner_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_circle_staff_role(target_circle_id uuid, check_user_id uuid, min_role text)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_memberships
    WHERE circle_id = target_circle_id
      AND user_id = check_user_id
      AND status = 'active'
      AND (
        (min_role = 'moderator' AND role IN ('owner', 'admin', 'moderator'))
        OR (min_role = 'admin' AND role IN ('owner', 'admin'))
        OR (min_role = 'owner' AND role = 'owner')
      )
  ) OR EXISTS (
    SELECT 1 FROM public.circles
    WHERE id = target_circle_id
      AND owner_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_pending_circle_invite(target_circle_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_invitations inv
    JOIN public.profiles p ON lower(p.email) = lower(inv.invited_email)
    WHERE inv.circle_id = target_circle_id
      AND p.id = check_user_id
      AND inv.status = 'pending'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_discover_circle(target_circle_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = target_circle_id
      AND (
        c.visibility IN ('public', 'discoverable_approval')
        OR (check_user_id IS NOT NULL AND c.owner_id = check_user_id)
        OR (check_user_id IS NOT NULL AND public.is_active_circle_member(c.id, check_user_id))
        OR (check_user_id IS NOT NULL AND public.is_platform_admin(check_user_id))
        OR (check_user_id IS NOT NULL AND public.has_pending_circle_invite(c.id, check_user_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_circle_content(target_circle_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = target_circle_id
      AND (
        c.visibility = 'public'
        OR (check_user_id IS NOT NULL AND c.owner_id = check_user_id)
        OR (check_user_id IS NOT NULL AND public.is_active_circle_member(c.id, check_user_id))
        OR (check_user_id IS NOT NULL AND public.is_platform_admin(check_user_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_capability_enabled(target_circle_id uuid, cap_key text)
RETURNS boolean
RETURNS NULL ON NULL INPUT
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_capabilities
    WHERE circle_id = target_circle_id
      AND capability_key = cap_key
      AND enabled = true
  );
$$;

-- ============================================================================
-- 5. ENABLE ROW-LEVEL SECURITY & POLICIES ON ALL TABLES
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO anon, authenticated, service_role;

-- Enable & Force RLS across every user-data table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_join_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_invitations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_role_permissions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.capability_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_definitions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.capability_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_dependencies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_capabilities FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_template_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_spaces FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_navigation_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_follows FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports FORCE ROW LEVEL SECURITY;

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries FORCE ROW LEVEL SECURITY;

-- 5.1 Profiles Policies
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (
    profile_visibility = 'public'
    OR (auth.uid() IS NOT NULL AND profile_visibility = 'members_only')
    OR id = auth.uid()
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5.2 Platform Roles Policies (Read own or platform admin; never self-grant via client)
CREATE POLICY platform_roles_select ON public.platform_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- 5.3 Circles Policies
CREATE POLICY circles_select ON public.circles
  FOR SELECT TO anon, authenticated
  USING (
    visibility IN ('public', 'discoverable_approval')
    OR owner_id = auth.uid()
    OR (auth.uid() IS NOT NULL AND public.is_active_circle_member(id, auth.uid()))
    OR (auth.uid() IS NOT NULL AND public.is_platform_admin(auth.uid()))
    OR (auth.uid() IS NOT NULL AND public.has_pending_circle_invite(id, auth.uid()))
  );

CREATE POLICY circles_insert ON public.circles
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY circles_update ON public.circles
  FOR UPDATE TO authenticated
  USING (
    public.has_circle_staff_role(id, auth.uid(), 'admin')
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_circle_staff_role(id, auth.uid(), 'admin')
    OR public.is_platform_admin(auth.uid())
  );

-- 5.4 Circle Memberships Policies
CREATE POLICY memberships_select ON public.circle_memberships
  FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.can_read_circle_content(circle_id, auth.uid())
  );

-- Users can join open public circles as 'member', or creator can insert 'owner' for their own circle, or admins can add members
CREATE POLICY memberships_insert ON public.circle_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.circles c
        WHERE c.id = circle_id AND c.owner_id = auth.uid()
      )
    )
    OR (
      user_id = auth.uid()
      AND role = 'member'
      AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.circles c
        WHERE c.id = circle_id
          AND c.visibility = 'public'
          AND c.membership_policy = 'open'
          AND c.status = 'active'
      )
    )
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

-- Members can leave (status='left', role unchanged), or admins/owners can update roles/status appropriately
CREATE POLICY memberships_update ON public.circle_memberships
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  )
  WITH CHECK (
    (
      -- Self-leave: cannot elevate own role
      user_id = auth.uid()
      AND status = 'left'
      AND role = public.get_circle_role(circle_id, auth.uid())
    )
    OR (
      -- Owner can manage any role
      public.has_circle_staff_role(circle_id, auth.uid(), 'owner')
    )
    OR (
      -- Admin can manage non-owner roles
      public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
      AND role IN ('admin', 'moderator', 'member')
    )
    OR (
      -- Moderator can suspend/restore ordinary members without changing role
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      AND role = 'member'
    )
  );

-- 5.5 Circle Join Requests Policies
CREATE POLICY join_requests_select ON public.circle_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

CREATE POLICY join_requests_insert ON public.circle_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = circle_id
        AND c.visibility IN ('public', 'discoverable_approval')
        AND c.membership_policy = 'approval'
        AND c.status = 'active'
    )
    AND NOT public.is_active_circle_member(circle_id, auth.uid())
  );

CREATE POLICY join_requests_update ON public.circle_join_requests
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'cancelled')
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

-- 5.6 Circle Invitations Policies
CREATE POLICY invitations_select ON public.circle_invitations
  FOR SELECT TO authenticated
  USING (
    inviter_id = auth.uid()
    OR invited_user_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND lower(p.email) = lower(invited_email)
    )
  );

CREATE POLICY invitations_insert ON public.circle_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

CREATE POLICY invitations_update ON public.circle_invitations
  FOR UPDATE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    OR invited_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND lower(p.email) = lower(invited_email)
    )
  );

-- 5.7 Static Registry & Template Read Policies
CREATE POLICY capability_defs_select ON public.capability_definitions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY capability_deps_select ON public.capability_dependencies
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY templates_select ON public.circle_templates
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY template_versions_select ON public.circle_template_versions
  FOR SELECT TO anon, authenticated USING (true);

-- 5.8 Circle Capabilities & Role Permissions Policies
CREATE POLICY circle_capabilities_select ON public.circle_capabilities
  FOR SELECT TO anon, authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY circle_capabilities_write ON public.circle_capabilities
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

CREATE POLICY circle_role_perms_select ON public.circle_role_permissions
  FOR SELECT TO authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY circle_role_perms_write ON public.circle_role_permissions
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'owner'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'owner'));

-- 5.9 Spaces & Navigation Policies
CREATE POLICY spaces_select ON public.circle_spaces
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND (
      visibility IN ('public', 'members')
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

CREATE POLICY spaces_write ON public.circle_spaces
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

CREATE POLICY nav_items_select ON public.circle_navigation_items
  FOR SELECT TO anon, authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY nav_items_write ON public.circle_navigation_items
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- 5.10 Posts Policies (Enforces Circle access, Discussions capability enabled, and active membership)
CREATE POLICY posts_select ON public.posts
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
    AND (
      status = 'published'
      OR author_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY posts_insert ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
    AND (
      space_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.circle_spaces s
        WHERE s.id = space_id
          AND s.circle_id = posts.circle_id
          AND s.is_archived = false
          AND (
            s.posting_policy = 'members'
            OR (s.posting_policy = 'moderators' AND public.has_circle_staff_role(posts.circle_id, auth.uid(), 'moderator'))
            OR (s.posting_policy = 'admins' AND public.has_circle_staff_role(posts.circle_id, auth.uid(), 'admin'))
          )
      )
    )
  );

CREATE POLICY posts_update ON public.posts
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'discussions')
    AND (
      (author_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR public.is_platform_admin(auth.uid())
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'discussions')
    AND (
      (author_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY posts_delete ON public.posts
  FOR DELETE TO authenticated
  USING (
    (author_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR public.is_platform_admin(auth.uid())
  );

-- 5.11 Comments Policies
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
    AND (
      status = 'published'
      OR author_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY comments_insert ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
  );

CREATE POLICY comments_update ON public.comments
  FOR UPDATE TO authenticated
  USING (
    (author_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    (author_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR public.is_platform_admin(auth.uid())
  );

-- 5.12 Reactions & Saved Items Policies
CREATE POLICY reactions_select ON public.reactions
  FOR SELECT TO anon, authenticated
  USING (public.can_read_circle_content(circle_id, auth.uid()));

CREATE POLICY reactions_insert ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
  );

CREATE POLICY reactions_delete ON public.reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY saved_items_all ON public.saved_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.can_read_circle_content(circle_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_read_circle_content(circle_id, auth.uid()));

CREATE POLICY circle_follows_all ON public.circle_follows
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY user_blocks_all ON public.user_blocks
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- 5.13 Content Reports, Moderation & Audit Policies
CREATE POLICY reports_select ON public.content_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY reports_insert ON public.content_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND public.can_read_circle_content(circle_id, auth.uid())
  );

CREATE POLICY reports_update ON public.content_reports
  FOR UPDATE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY moderation_actions_select ON public.moderation_actions
  FOR SELECT TO authenticated
  USING (
    (circle_id IS NOT NULL AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY moderation_actions_insert ON public.moderation_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      (circle_id IS NOT NULL AND public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (circle_id IS NOT NULL AND public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- 5.14 Notifications & Deliveries Policies
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY notification_deliveries_select ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.id = notification_id AND n.recipient_id = auth.uid()
    )
  );

CREATE POLICY notification_deliveries_insert ON public.notification_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (true);
