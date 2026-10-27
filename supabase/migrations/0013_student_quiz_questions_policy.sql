-- ============================================================================
-- Migration 0013: Allow Students to Read Questions Attached to Circle Quizzes
-- Preserves academic integrity: correct_answers are filtered in the service layer,
-- while allowing the database to join course_quiz_questions to course_questions.
-- ============================================================================

DROP POLICY IF EXISTS course_questions_staff ON public.course_questions;

CREATE POLICY course_questions_select ON public.course_questions
  FOR SELECT TO anon, authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR EXISTS (
      SELECT 1 FROM public.course_quiz_questions qq
      JOIN public.course_quizzes qz ON qz.id = qq.quiz_id
      WHERE qq.question_id = course_questions.id AND public.can_discover_circle(qz.circle_id, auth.uid())
    )
  );

CREATE POLICY course_questions_staff_write ON public.course_questions
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'moderator'));
