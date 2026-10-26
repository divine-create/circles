-- ============================================================================
-- CIRCLES PLATFORM — STAGING READINESS, RLS & ROLE HIERARCHY HARDENING
-- Migration: 0003_staging_rls_and_role_hardening.sql
-- ============================================================================

-- 1. Explicit Grants & RLS on local auth.sessions if created by Circles (superseded by public.user_sessions in 0004)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'sessions'
      AND column_name = 'token_hash'
  ) THEN
    REVOKE ALL ON TABLE auth.sessions FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE auth.sessions TO postgres, service_role;

    ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE auth.sessions FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS auth_sessions_service_only ON auth.sessions;
    CREATE POLICY auth_sessions_service_only ON auth.sessions
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;

-- 2. Capability Settings Helper for PostgreSQL RLS
CREATE OR REPLACE FUNCTION public.is_capability_setting_enabled(
  target_circle_id uuid,
  cap_key text,
  setting_key text,
  default_val boolean DEFAULT true
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN jsonb_typeof(cc.settings -> setting_key) = 'boolean'
          THEN (cc.settings ->> setting_key)::boolean
        ELSE default_val
      END
      FROM public.circle_capabilities cc
      WHERE cc.circle_id = target_circle_id
        AND cc.capability_key = cap_key
        AND cc.enabled = true
      LIMIT 1
    ),
    false
  );
$$;

-- 3. Co-Membership Helper for 'members_only' Profile Visibility
CREATE OR REPLACE FUNCTION public.shares_active_circle_with(
  target_user_id uuid,
  viewer_user_id uuid
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.circle_memberships m1
    JOIN public.circle_memberships m2 ON m1.circle_id = m2.circle_id
    WHERE m1.user_id = target_user_id
      AND m2.user_id = viewer_user_id
      AND m1.status = 'active'
      AND m2.status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM public.circle_join_requests jr
    WHERE jr.user_id = target_user_id
      AND public.has_circle_staff_role(jr.circle_id, viewer_user_id, 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION
  public.is_capability_setting_enabled(uuid, text, text, boolean),
  public.shares_active_circle_with(uuid, uuid)
TO anon, authenticated, service_role;

-- 4. Tighten profiles_select RLS Policy for 'members_only' Profiles
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (
    profile_visibility = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND profile_visibility = 'members_only'
      AND public.shares_active_circle_with(id, auth.uid())
    )
    OR id = auth.uid()
    OR public.is_platform_admin(auth.uid())
  );

-- 5. Enforce Role Hierarchy on Membership INSERT (Prevent Circle Admin from inserting Owner or Admin)
CREATE OR REPLACE FUNCTION public.enforce_membership_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor UUID;
  actor_role TEXT;
  circle_owner UUID;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  actor := auth.uid();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create memberships.';
  END IF;

  SELECT owner_id INTO circle_owner FROM public.circles WHERE id = NEW.circle_id;

  -- Circle owner creating their initial owner membership or adding any member
  IF circle_owner = actor THEN
    RETURN NEW;
  END IF;

  -- Self-joining an open public Circle as an ordinary active member
  IF NEW.user_id = actor THEN
    IF NEW.role <> 'member' OR NEW.status <> 'active' THEN
      RAISE EXCEPTION 'Self-joining users can only join with role member and status active.';
    END IF;
    RETURN NEW;
  END IF;

  actor_role := public.get_circle_role(NEW.circle_id, actor);
  IF actor_role = 'owner' THEN
    RETURN NEW;
  END IF;

  IF actor_role = 'admin' THEN
    IF NEW.role NOT IN ('moderator', 'member') THEN
      RAISE EXCEPTION 'Only Circle owners can assign administrator or owner roles.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Insufficient permissions to insert Circle membership.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_membership_insert ON public.circle_memberships;
CREATE TRIGGER trg_enforce_membership_insert
BEFORE INSERT ON public.circle_memberships
FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_insert();

DROP POLICY IF EXISTS memberships_insert ON public.circle_memberships;
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
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'owner')
    OR (
      public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
      AND role IN ('moderator', 'member')
    )
  );

-- 6. Restrict Admin Role Invitations to Circle Owners & Restrict Join Requests to Admins
DROP POLICY IF EXISTS invitations_insert ON public.circle_invitations;
CREATE POLICY invitations_insert ON public.circle_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = auth.uid()
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'owner')
      OR (
        public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
        AND role IN ('moderator', 'member')
      )
    )
  );

DROP POLICY IF EXISTS join_requests_select ON public.circle_join_requests;
CREATE POLICY join_requests_select ON public.circle_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

-- 7. Protect Post & Comment Identity Columns and Restrict Post Pinning to Staff
CREATE OR REPLACE FUNCTION public.protect_post_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.circle_id <> OLD.circle_id OR NEW.author_id <> OLD.author_id THEN
    RAISE EXCEPTION 'Post identity fields (id, circle_id, author_id) are immutable.';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned THEN
      IF NOT public.has_circle_staff_role(OLD.circle_id, auth.uid(), 'moderator')
         AND NOT public.is_platform_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only Circle moderators, administrators, or owners can pin or unpin posts.';
      END IF;
    END IF;

    IF pg_trigger_depth() <= 1 AND (
      NEW.comment_count IS DISTINCT FROM OLD.comment_count
      OR NEW.reaction_count IS DISTINCT FROM OLD.reaction_count
    ) THEN
      RAISE EXCEPTION 'Post counters cannot be modified directly.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_post_mutations ON public.posts;
CREATE TRIGGER trg_protect_post_mutations
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.protect_post_mutations();

CREATE OR REPLACE FUNCTION public.protect_comment_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.circle_id <> OLD.circle_id OR NEW.post_id <> OLD.post_id OR NEW.author_id <> OLD.author_id THEN
    RAISE EXCEPTION 'Comment identity fields (id, circle_id, post_id, author_id) are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_comment_mutations ON public.comments;
CREATE TRIGGER trg_protect_comment_mutations
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.protect_comment_mutations();

-- 8. Enforce Capability Settings (allowMemberPosts, allowReactions) and Spaces Capability in RLS
DROP POLICY IF EXISTS spaces_select ON public.circle_spaces;
CREATE POLICY spaces_select ON public.circle_spaces
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND (
      public.is_capability_enabled(circle_id, 'spaces')
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    )
    AND (
      visibility IN ('public', 'members')
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS posts_insert ON public.posts;
CREATE POLICY posts_insert ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
    AND (
      public.is_capability_setting_enabled(circle_id, 'discussions', 'allowMemberPosts', true)
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
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

DROP POLICY IF EXISTS reactions_insert ON public.reactions;
CREATE POLICY reactions_insert ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
    AND public.is_capability_setting_enabled(circle_id, 'discussions', 'allowReactions', true)
  );
