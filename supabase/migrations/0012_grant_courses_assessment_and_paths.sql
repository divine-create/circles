-- ============================================================================
-- Migration 0012: Grant Permissions on Question Banks, Quizzes & Learning Paths
-- Ensures anon, authenticated, and service_role have table-level access,
-- guarded by Row-Level Security (RLS) policies.
-- ============================================================================

GRANT ALL ON TABLE public.course_question_banks TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.course_questions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.course_quizzes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.course_quiz_questions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.course_quiz_attempts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.course_quiz_answers TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.learning_paths TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.learning_path_courses TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.course_prerequisites TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.learning_path_enrollments TO anon, authenticated, service_role;
