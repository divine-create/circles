-- ============================================================================
-- Migration 0010: Assessments, Quizzes & Reusable Question Banks
-- Provides central question banks, configurable timed quizzes, auto-grading,
-- and manual evaluation queues.
-- ============================================================================

-- 1. Question Banks
CREATE TABLE IF NOT EXISTS public.course_question_banks (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_banks_circle ON public.course_question_banks(circle_id);

-- 2. Bank Questions
CREATE TABLE IF NOT EXISTS public.course_questions (
  id UUID PRIMARY KEY,
  bank_id UUID REFERENCES public.course_question_banks(id) ON DELETE SET NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'multiple_choice',
      'multiple_select',
      'true_false',
      'short_answer',
      'essay',
      'code_challenge',
      'file_submission'
    )
  ),
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  difficulty TEXT NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  rubrics TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_questions_bank ON public.course_questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_course_questions_circle ON public.course_questions(circle_id);

-- 3. Course Quizzes
CREATE TABLE IF NOT EXISTS public.course_quizzes (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
  time_limit_minutes INTEGER DEFAULT NULL CHECK (time_limit_minutes IS NULL OR time_limit_minutes > 0),
  max_attempts INTEGER DEFAULT 3 CHECK (max_attempts IS NULL OR max_attempts > 0),
  randomize_questions BOOLEAN NOT NULL DEFAULT false,
  feedback_mode TEXT NOT NULL DEFAULT 'immediate' CHECK (feedback_mode IN ('immediate', 'after_submission', 'after_deadline')),
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_quizzes_course ON public.course_quizzes(circle_id, course_id);
CREATE INDEX IF NOT EXISTS idx_course_quizzes_lesson ON public.course_quizzes(lesson_id);

-- 4. Quiz Questions Association
CREATE TABLE IF NOT EXISTS public.course_quiz_questions (
  id UUID PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.course_questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  UNIQUE (quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON public.course_quiz_questions(quiz_id, sort_order ASC);

-- 5. Student Quiz Attempts
CREATE TABLE IF NOT EXISTS public.course_quiz_attempts (
  id UUID PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ DEFAULT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  score_percent INTEGER DEFAULT NULL CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_possible INTEGER NOT NULL DEFAULT 0,
  is_passed BOOLEAN DEFAULT NULL,
  instructor_feedback TEXT DEFAULT NULL,
  grader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.course_quiz_attempts(circle_id, quiz_id, user_id);

-- 6. Quiz Answers & Evaluation
CREATE TABLE IF NOT EXISTS public.course_quiz_answers (
  id UUID PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.course_quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.course_questions(id) ON DELETE CASCADE,
  answer_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_correct BOOLEAN DEFAULT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  instructor_feedback TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON public.course_quiz_answers(attempt_id);

-- ============================================================================
-- Enable RLS and Configure Multi-Tenant Security
-- ============================================================================

ALTER TABLE public.course_question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_question_banks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quizzes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_attempts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.course_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_answers FORCE ROW LEVEL SECURITY;

-- Question Bank Policies (Circle Staff only)
CREATE POLICY question_banks_select ON public.course_question_banks
  FOR SELECT TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'));

CREATE POLICY question_banks_write ON public.course_question_banks
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Question Policies (Circle Staff can manage, students cannot read raw bank questions with answer keys directly)
CREATE POLICY course_questions_staff ON public.course_questions
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'));

-- Quizzes Policies (Visible to anyone who can read circle content, writeable by staff)
CREATE POLICY course_quizzes_select ON public.course_quizzes
  FOR SELECT TO anon, authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

CREATE POLICY course_quizzes_write ON public.course_quizzes
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'));

CREATE POLICY course_quiz_questions_select ON public.course_quiz_questions
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY course_quiz_questions_write ON public.course_quiz_questions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.course_quizzes q
    WHERE q.id = quiz_id AND public.has_circle_staff_role(q.circle_id, auth.uid(), 'moderator')
  ));

-- Quiz Attempts Policies (Learner can see their own, staff can see all)
CREATE POLICY quiz_attempts_select ON public.course_quiz_attempts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

CREATE POLICY quiz_attempts_insert ON public.course_quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY quiz_attempts_update ON public.course_quiz_attempts
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

-- Quiz Answers Policies (Learner can manage their attempt answers, staff can review)
CREATE POLICY quiz_answers_select ON public.course_quiz_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_quiz_attempts a
      WHERE a.id = attempt_id AND (
        a.user_id = auth.uid() OR
        public.has_circle_staff_role(a.circle_id, auth.uid(), 'moderator')
      )
    )
  );

CREATE POLICY quiz_answers_write ON public.course_quiz_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_quiz_attempts a
      WHERE a.id = attempt_id AND (
        a.user_id = auth.uid() OR
        public.has_circle_staff_role(a.circle_id, auth.uid(), 'moderator')
      )
    )
  );

