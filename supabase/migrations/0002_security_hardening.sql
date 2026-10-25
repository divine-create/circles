-- ============================================================================
-- CIRCLES PLATFORM — SECURITY HARDENING & SESSION REVOCATION MIGRATION
-- Migration: 0002_security_hardening.sql
-- ============================================================================

-- 1. Stateful Session Registry (Enables immediate logout revocation & password-reset session invalidation)
CREATE TABLE IF NOT EXISTS auth.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth.sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth.sessions(token_hash);

-- 2. Profile Identity & Email Immutability Trigger (Prevents email spoofing for invitation hijacking)
CREATE OR REPLACE FUNCTION public.protect_profile_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  canonical_email TEXT;
BEGIN
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Profile ID is immutable.';
  END IF;

  IF lower(NEW.email) <> lower(OLD.email) THEN
    SELECT email INTO canonical_email FROM auth.users WHERE id = NEW.id;
    IF canonical_email IS NULL OR lower(NEW.email) <> lower(canonical_email) THEN
      RAISE EXCEPTION 'Profile email cannot be modified independently of verified authentication email.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_identity ON public.profiles;
CREATE TRIGGER trg_protect_profile_identity
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_identity();

-- 3. Circle Ownership Protection Trigger (Prevents Circle admins from overwriting owner_id via direct SQL)
CREATE OR REPLACE FUNCTION public.protect_circle_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor UUID;
  new_owner_has_role BOOLEAN;
BEGIN
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Circle ID is immutable.';
  END IF;

  IF NEW.owner_id <> OLD.owner_id THEN
    actor := auth.uid();
    IF auth.role() <> 'service_role' AND (actor IS NULL OR actor <> OLD.owner_id) THEN
      RAISE EXCEPTION 'Only the current Circle owner can transfer Circle ownership.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.circle_memberships
      WHERE circle_id = NEW.id
        AND user_id = NEW.owner_id
        AND role = 'owner'
        AND status = 'active'
    ) INTO new_owner_has_role;

    IF NOT new_owner_has_role THEN
      RAISE EXCEPTION 'New Circle owner must hold an active owner membership before transferring Circle owner_id.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_circle_ownership ON public.circles;
CREATE TRIGGER trg_protect_circle_ownership
BEFORE UPDATE ON public.circles
FOR EACH ROW EXECUTE FUNCTION public.protect_circle_ownership();

-- 4. Strict Membership Role & Status Transition Trigger (Prevents lateral/upward privilege escalation in RLS)
CREATE OR REPLACE FUNCTION public.enforce_membership_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor UUID;
  actor_role TEXT;
  is_plat_admin BOOLEAN;
BEGIN
  IF NEW.circle_id <> OLD.circle_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Membership circle_id and user_id are immutable.';
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  actor := auth.uid();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to modify memberships.';
  END IF;

  is_plat_admin := public.is_platform_admin(actor);

  -- Self-update by a non-owner member
  IF actor = OLD.user_id THEN
    IF OLD.status = 'suspended' AND NOT is_plat_admin THEN
      RAISE EXCEPTION 'Suspended members cannot modify their own membership status.';
    END IF;

    -- Self-rejoin is only allowed when status was 'left', role is 'member', and Circle is public + open
    IF OLD.status = 'left' AND NEW.status = 'active' THEN
      IF NEW.role <> 'member' THEN
        RAISE EXCEPTION 'Rejoining members cannot assign themselves elevated roles.';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.circles c
        WHERE c.id = NEW.circle_id
          AND c.visibility = 'public'
          AND c.membership_policy = 'open'
          AND c.status = 'active'
      ) THEN
        RAISE EXCEPTION 'Cannot self-rejoin a non-open Circle.';
      END IF;
      RETURN NEW;
    END IF;

    -- Self-leave: must keep existing role and transition to 'left'
    IF NEW.status = 'left' AND NEW.role = OLD.role THEN
      RETURN NEW;
    END IF;

    -- Owner demoting self to admin during ownership transfer
    IF OLD.role = 'owner' AND NEW.role = 'admin' AND NEW.status = 'active' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Members cannot self-elevate roles or alter membership status arbitrarily.';
  END IF;

  -- Staff / Platform Admin updating another member
  actor_role := public.get_circle_role(OLD.circle_id, actor);

  IF actor_role = 'owner' THEN
    RETURN NEW;
  END IF;

  IF actor_role = 'admin' THEN
    IF OLD.role IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Circle administrators cannot modify owners or fellow administrators.';
    END IF;
    IF NEW.role NOT IN ('moderator', 'member') THEN
      RAISE EXCEPTION 'Only Circle owners can promote members to administrator or owner.';
    END IF;
    RETURN NEW;
  END IF;

  IF actor_role = 'moderator' OR is_plat_admin THEN
    IF OLD.role <> 'member' OR NEW.role <> 'member' THEN
      RAISE EXCEPTION 'Moderators can only suspend or restore ordinary members without changing roles.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Insufficient permissions to modify this membership.';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_membership_transitions ON public.circle_memberships;
CREATE TRIGGER trg_enforce_membership_transitions
BEFORE UPDATE ON public.circle_memberships
FOR EACH ROW EXECUTE FUNCTION public.enforce_membership_transitions();

-- 5. Tighten Notification & Delivery Policies (Prevent direct client spoofing of notifications)
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND recipient_id = auth.uid());

DROP POLICY IF EXISTS notification_deliveries_insert ON public.notification_deliveries;
CREATE POLICY notification_deliveries_insert ON public.notification_deliveries
  FOR INSERT TO service_role
  WITH CHECK (true);
