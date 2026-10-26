-- ============================================================================
-- CIRCLES PLATFORM — COURSE DRIP PACING, GAMIFICATION & ACCESS GATING (PHASE 3 LMS)
-- Migration: 0008_course_drip_gamification_and_gating.sql
-- ============================================================================

-- 1. Extend Courses with Access Rules and Min Level Gating
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS access_rule TEXT NOT NULL DEFAULT 'open'
    CHECK (access_rule IN ('open', 'members_only', 'min_level', 'staff_only')),
  ADD COLUMN IF NOT EXISTS min_level_required INTEGER NOT NULL DEFAULT 1
    CHECK (min_level_required >= 1);

-- 2. Extend Course Modules with Drip Pacing Configuration
ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS drip_type TEXT NOT NULL DEFAULT 'instant'
    CHECK (drip_type IN ('instant', 'relative_days', 'calendar_date')),
  ADD COLUMN IF NOT EXISTS drip_days_after_enrollment INTEGER NOT NULL DEFAULT 0
    CHECK (drip_days_after_enrollment >= 0),
  ADD COLUMN IF NOT EXISTS drip_unlock_date TIMESTAMPTZ;

-- 3. Course Enrollments Table
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, student_id),
  FOREIGN KEY (course_id, circle_id) REFERENCES public.courses(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_student 
  ON public.course_enrollments(student_id, course_id, enrolled_at DESC);

-- 4. Member XP Points (Gamification & Activity Tracking)
CREATE TABLE IF NOT EXISTS public.member_xp_points (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('lesson_completed', 'assignment_submitted', 'assignment_approved', 'lesson_comment', 'discussion_post')),
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, user_id, activity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_member_xp_circle_user 
  ON public.member_xp_points(circle_id, user_id, points);

-- 5. Permissions & Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.course_enrollments,
  public.member_xp_points
TO anon, authenticated, service_role;

-- 6. Enable and Force Row Level Security (RLS)
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.member_xp_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_xp_points FORCE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies

-- 7.1 Course Enrollments Policies
DROP POLICY IF EXISTS course_enrollments_select ON public.course_enrollments;
CREATE POLICY course_enrollments_select ON public.course_enrollments
  FOR SELECT TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      student_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS course_enrollments_insert ON public.course_enrollments;
CREATE POLICY course_enrollments_insert ON public.course_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
  );

DROP POLICY IF EXISTS course_enrollments_delete ON public.course_enrollments;
CREATE POLICY course_enrollments_delete ON public.course_enrollments
  FOR DELETE TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

-- 7.2 Member XP Points Policies
-- Anyone who can read Circle content can see XP / leaderboards
DROP POLICY IF EXISTS member_xp_points_select ON public.member_xp_points;
CREATE POLICY member_xp_points_select ON public.member_xp_points
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
  );

-- Direct client INSERT/UPDATE on XP points is blocked by RLS (only service_role or staff can award XP)
DROP POLICY IF EXISTS member_xp_points_insert ON public.member_xp_points;
CREATE POLICY member_xp_points_insert ON public.member_xp_points
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );
