-- ============================================================================
-- CIRCLES PLATFORM — LESSON INTERACTIVITY, ASSIGNMENTS & LIVE SESSIONS (PHASE 2 LMS)
-- Migration: 0007_lesson_interactivity_and_assignments.sql
-- ============================================================================

-- 1. Extend Course Lessons with Live Workshop & Event Linking
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS live_event_id UUID,
  ADD COLUMN IF NOT EXISTS is_live_session BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_course_lessons_live_event'
  ) THEN
    ALTER TABLE public.course_lessons
      ADD CONSTRAINT fk_course_lessons_live_event
      FOREIGN KEY (live_event_id, circle_id)
      REFERENCES public.circle_events(id, circle_id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 2. Course Lesson Comments (Contextual In-Lesson Discussions)
CREATE TABLE IF NOT EXISTS public.course_lesson_comments (
  id UUID PRIMARY KEY,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  FOREIGN KEY (lesson_id, circle_id) REFERENCES public.course_lessons(id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, circle_id) REFERENCES public.courses(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_comments_timeline 
  ON public.course_lesson_comments(lesson_id, status, created_at ASC);

-- 3. Course Assignments (Homework / Projects attached to Lessons)
CREATE TABLE IF NOT EXISTS public.course_assignments (
  id UUID PRIMARY KEY,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  prompt_body TEXT NOT NULL CHECK (char_length(prompt_body) <= 10000),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  UNIQUE (lesson_id, circle_id),
  FOREIGN KEY (lesson_id, circle_id) REFERENCES public.course_lessons(id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, circle_id) REFERENCES public.courses(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_assignments_course 
  ON public.course_assignments(course_id, created_at DESC);

-- 4. Course Assignment Submissions (Student Homework Submissions & Private Feedback)
CREATE TABLE IF NOT EXISTS public.course_assignment_submissions (
  id UUID PRIMARY KEY,
  assignment_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_body TEXT NOT NULL CHECK (char_length(submission_body) <= 10000),
  attachment_url TEXT,
  attachment_name TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'in_review', 'needs_revision', 'approved')),
  grade_score INTEGER CHECK (grade_score IS NULL OR (grade_score >= 0 AND grade_score <= 100)),
  instructor_feedback TEXT NOT NULL DEFAULT '' CHECK (char_length(instructor_feedback) <= 5000),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, circle_id),
  UNIQUE (assignment_id, student_id),
  FOREIGN KEY (assignment_id, circle_id) REFERENCES public.course_assignments(id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id, circle_id) REFERENCES public.course_lessons(id, circle_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, circle_id) REFERENCES public.courses(id, circle_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_status 
  ON public.course_assignment_submissions(assignment_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_student 
  ON public.course_assignment_submissions(student_id, course_id);

-- 5. Updated At Triggers
DROP TRIGGER IF EXISTS trigger_set_updated_at_lesson_comments ON public.course_lesson_comments;
CREATE TRIGGER trigger_set_updated_at_lesson_comments
  BEFORE UPDATE ON public.course_lesson_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_course_assignments ON public.course_assignments;
CREATE TRIGGER trigger_set_updated_at_course_assignments
  BEFORE UPDATE ON public.course_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_assignment_submissions ON public.course_assignment_submissions;
CREATE TRIGGER trigger_set_updated_at_assignment_submissions
  BEFORE UPDATE ON public.course_assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Permissions & Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.course_lesson_comments,
  public.course_assignments,
  public.course_assignment_submissions
TO anon, authenticated, service_role;

-- 7. Enable and Force Row Level Security (RLS)
ALTER TABLE public.course_lesson_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_comments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignment_submissions FORCE ROW LEVEL SECURITY;

-- 8. Row Level Security Policies

-- 8.1 Lesson Comments
DROP POLICY IF EXISTS lesson_comments_select ON public.course_lesson_comments;
CREATE POLICY lesson_comments_select ON public.course_lesson_comments
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
    AND (status = 'published' OR author_id = auth.uid() OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
  );

DROP POLICY IF EXISTS lesson_comments_insert ON public.course_lesson_comments;
CREATE POLICY lesson_comments_insert ON public.course_lesson_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
  );

DROP POLICY IF EXISTS lesson_comments_update ON public.course_lesson_comments;
CREATE POLICY lesson_comments_update ON public.course_lesson_comments
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      author_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      author_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    )
  );

DROP POLICY IF EXISTS lesson_comments_delete ON public.course_lesson_comments;
CREATE POLICY lesson_comments_delete ON public.course_lesson_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

-- 8.2 Course Assignments (Prompts)
DROP POLICY IF EXISTS course_assignments_select ON public.course_assignments;
CREATE POLICY course_assignments_select ON public.course_assignments
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
  );

DROP POLICY IF EXISTS course_assignments_insert ON public.course_assignments;
CREATE POLICY course_assignments_insert ON public.course_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_assignments.course_id
          AND c.circle_id = course_assignments.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_assignments_update ON public.course_assignments;
CREATE POLICY course_assignments_update ON public.course_assignments
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_assignments.course_id
          AND c.circle_id = course_assignments.circle_id
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
        WHERE c.id = course_assignments.course_id
          AND c.circle_id = course_assignments.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_assignments_delete ON public.course_assignments;
CREATE POLICY course_assignments_delete ON public.course_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_assignments.course_id
        AND c.circle_id = course_assignments.circle_id
        AND c.instructor_id = auth.uid()
    )
  );

-- 8.3 Course Assignment Submissions (Student Privacy Guaranteed)
DROP POLICY IF EXISTS assignment_submissions_select ON public.course_assignment_submissions;
CREATE POLICY assignment_submissions_select ON public.course_assignment_submissions
  FOR SELECT TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      student_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_assignment_submissions.course_id
          AND c.circle_id = course_assignment_submissions.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS assignment_submissions_insert ON public.course_assignment_submissions;
CREATE POLICY assignment_submissions_insert ON public.course_assignment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'learning_resources')
  );

DROP POLICY IF EXISTS assignment_submissions_update ON public.course_assignment_submissions;
CREATE POLICY assignment_submissions_update ON public.course_assignment_submissions
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      student_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_assignment_submissions.course_id
          AND c.circle_id = course_assignment_submissions.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      student_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_assignment_submissions.course_id
          AND c.circle_id = course_assignment_submissions.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );
