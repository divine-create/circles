-- ============================================================================
-- Migration 0011: Learning Paths, Course Prerequisites & Program Progression
-- Enables multi-course structured tracks, prerequisite completion graphs,
-- and programme milestone credentials.
-- ============================================================================

-- 1. Learning Paths (Programmes/Curriculum Tracks)
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT DEFAULT NULL,
  difficulty_level TEXT DEFAULT 'all_levels' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
  estimated_hours NUMERIC(6, 1) NOT NULL DEFAULT 0 CHECK (estimated_hours >= 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_circle ON public.learning_paths(circle_id, sort_order ASC);

-- 2. Learning Path Courses Sequence
CREATE TABLE IF NOT EXISTS public.learning_path_courses (
  id UUID PRIMARY KEY,
  path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (path_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_path_courses_sort ON public.learning_path_courses(path_id, sort_order ASC);

-- 3. Course Prerequisites (Require Course A before Course B can be enrolled)
CREATE TABLE IF NOT EXISTS public.course_prerequisites (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  prerequisite_course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  min_score_percent INTEGER DEFAULT 70 CHECK (min_score_percent IS NULL OR (min_score_percent >= 0 AND min_score_percent <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, prerequisite_course_id),
  CHECK (course_id <> prerequisite_course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_prereqs_course ON public.course_prerequisites(circle_id, course_id);

-- 4. Learning Path Enrollments & Program Progression
CREATE TABLE IF NOT EXISTS public.learning_path_enrollments (
  id UUID PRIMARY KEY,
  path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (path_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_path_enrollments_user ON public.learning_path_enrollments(circle_id, user_id, status);

-- ============================================================================
-- Enable RLS and Configure Multi-Tenant Security
-- ============================================================================

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths FORCE ROW LEVEL SECURITY;

ALTER TABLE public.learning_path_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_path_courses FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_prerequisites FORCE ROW LEVEL SECURITY;

ALTER TABLE public.learning_path_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_path_enrollments FORCE ROW LEVEL SECURITY;

-- Learning Paths Policies (Readable by circle viewers, editable by staff)
CREATE POLICY learning_paths_select ON public.learning_paths
  FOR SELECT TO anon, authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY learning_paths_write ON public.learning_paths
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Learning Path Courses Policies
CREATE POLICY learning_path_courses_select ON public.learning_path_courses
  FOR SELECT TO anon, authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY learning_path_courses_write ON public.learning_path_courses
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Course Prerequisites Policies
CREATE POLICY course_prereqs_select ON public.course_prerequisites
  FOR SELECT TO anon, authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY course_prereqs_write ON public.course_prerequisites
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Path Enrollments Policies (Learners see their own, staff see all)
CREATE POLICY path_enrollments_select ON public.learning_path_enrollments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

CREATE POLICY path_enrollments_insert ON public.learning_path_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY path_enrollments_update ON public.learning_path_enrollments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

