-- ============================================================================
-- CIRCLES PLATFORM — COURSES, CURRICULUM & STUDENT PROGRESS (PHASE 1 LMS)
-- Migration: 0006_courses_and_learning_progress.sql
-- ============================================================================

-- 1. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  slug TEXT NOT NULL CHECK (char_length(slug) BETWEEN 2 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  thumbnail_url TEXT,
  difficulty_level TEXT CHECK (difficulty_level IS NULL OR difficulty_level IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
  estimated_duration_hours NUMERIC(5, 1) DEFAULT 0 CHECK (estimated_duration_hours >= 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  UNIQUE (circle_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_courses_circle_status ON public.courses(circle_id, status, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON public.courses(instructor_id);

-- 2. Course Modules (Sections) Table
CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 180),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  FOREIGN KEY (course_id, circle_id) REFERENCES public.courses(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course_sort ON public.course_modules(course_id, sort_order ASC, created_at ASC);

-- 3. Course Lessons Table
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL,
  course_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 180),
  slug TEXT NOT NULL CHECK (char_length(slug) BETWEEN 2 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  content_body TEXT NOT NULL DEFAULT '' CHECK (char_length(content_body) <= 50000),
  video_url TEXT,
  duration_minutes INTEGER DEFAULT 0 CHECK (duration_minutes >= 0),
  attachment_url TEXT,
  attachment_name TEXT,
  is_free_preview BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  FOREIGN KEY (module_id, circle_id) REFERENCES public.course_modules(id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, circle_id) REFERENCES public.courses(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_module_sort ON public.course_lessons(module_id, sort_order ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_course_lessons_course_sort ON public.course_lessons(course_id, sort_order ASC);

-- 4. Course Lesson Completions (Student Progress) Table
CREATE TABLE IF NOT EXISTS public.course_lesson_completions (
  id UUID PRIMARY KEY,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, user_id),
  FOREIGN KEY (lesson_id, circle_id) REFERENCES public.course_lessons(id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, circle_id) REFERENCES public.courses(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_completions_student ON public.course_lesson_completions(course_id, user_id, completed_at DESC);

-- 5. Updated At Trigger Function & Triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_updated_at_courses ON public.courses;
CREATE TRIGGER trigger_set_updated_at_courses
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_course_modules ON public.course_modules;
CREATE TRIGGER trigger_set_updated_at_course_modules
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_course_lessons ON public.course_lessons;
CREATE TRIGGER trigger_set_updated_at_course_lessons
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Permissions & Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.courses,
  public.course_modules,
  public.course_lessons,
  public.course_lesson_completions
TO anon, authenticated, service_role;

-- 7. Enable and Force Row Level Security (RLS)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_completions FORCE ROW LEVEL SECURITY;

-- 8. Row Level Security Policies

-- 8.1 Courses Policies
DROP POLICY IF EXISTS courses_select ON public.courses;
CREATE POLICY courses_select ON public.courses
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      status = 'published'
      OR instructor_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS courses_insert ON public.courses;
CREATE POLICY courses_insert ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR (instructor_id = auth.uid() AND public.is_active_circle_member(circle_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS courses_update ON public.courses;
CREATE POLICY courses_update ON public.courses
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      instructor_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      instructor_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS courses_delete ON public.courses;
CREATE POLICY courses_delete ON public.courses
  FOR DELETE TO authenticated
  USING (
    instructor_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

-- 8.2 Course Modules Policies
DROP POLICY IF EXISTS course_modules_select ON public.course_modules;
CREATE POLICY course_modules_select ON public.course_modules
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
  );

DROP POLICY IF EXISTS course_modules_insert ON public.course_modules;
CREATE POLICY course_modules_insert ON public.course_modules
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_modules.course_id
          AND c.circle_id = course_modules.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_modules_update ON public.course_modules;
CREATE POLICY course_modules_update ON public.course_modules
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_modules.course_id
          AND c.circle_id = course_modules.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_modules.course_id
          AND c.circle_id = course_modules.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_modules_delete ON public.course_modules;
CREATE POLICY course_modules_delete ON public.course_modules
  FOR DELETE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_modules.course_id
        AND c.circle_id = course_modules.circle_id
        AND c.instructor_id = auth.uid()
    )
  );

-- 8.3 Course Lessons Policies
DROP POLICY IF EXISTS course_lessons_select ON public.course_lessons;
CREATE POLICY course_lessons_select ON public.course_lessons
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      status = 'published'
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_lessons.course_id
          AND c.circle_id = course_lessons.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_lessons_insert ON public.course_lessons;
CREATE POLICY course_lessons_insert ON public.course_lessons
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_lessons.course_id
          AND c.circle_id = course_lessons.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_lessons_update ON public.course_lessons;
CREATE POLICY course_lessons_update ON public.course_lessons
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_lessons.course_id
          AND c.circle_id = course_lessons.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_lessons.course_id
          AND c.circle_id = course_lessons.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_lessons_delete ON public.course_lessons;
CREATE POLICY course_lessons_delete ON public.course_lessons
  FOR DELETE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_lessons.course_id
        AND c.circle_id = course_lessons.circle_id
        AND c.instructor_id = auth.uid()
    )
  );

-- 8.4 Course Lesson Completions (Progress) Policies
DROP POLICY IF EXISTS course_completions_select ON public.course_lesson_completions;
CREATE POLICY course_completions_select ON public.course_lesson_completions
  FOR SELECT TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      user_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS course_completions_insert ON public.course_lesson_completions;
CREATE POLICY course_completions_insert ON public.course_lesson_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
  );

DROP POLICY IF EXISTS course_completions_delete ON public.course_lesson_completions;
CREATE POLICY course_completions_delete ON public.course_lesson_completions
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_capability_enabled(circle_id, 'learning_resources')
  );
