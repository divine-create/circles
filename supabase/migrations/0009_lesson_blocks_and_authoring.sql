-- ============================================================================
-- Migration 0009: Lesson Content Blocks, Drafts & Curriculum Authoring
-- Enables rich multi-block lessons (video, rich text, code, files, quizzes),
-- draft working states, learning objectives, and private instructor notes.
-- ============================================================================

-- 1. Extend public.course_lessons with block architecture, drafts, and metadata
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS draft_content_blocks JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS instructor_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prerequisite_lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Extend public.courses with learning objectives, publishing metadata, and validation
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS validation_issues JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Populate default content_blocks from legacy columns where content_blocks is empty
UPDATE public.course_lessons
SET content_blocks = jsonb_build_array(
  jsonb_build_object(
    'id', 'block-initial-video',
    'type', 'video',
    'url', video_url,
    'provider', 'custom'
  ),
  jsonb_build_object(
    'id', 'block-initial-text',
    'type', 'rich_text',
    'markdown', COALESCE(content_body, '')
  )
)
WHERE jsonb_array_length(content_blocks) = 0 AND (video_url IS NOT NULL OR content_body <> '');

-- 4. Indexes for lesson prerequisites and search
CREATE INDEX IF NOT EXISTS idx_course_lessons_prereq ON public.course_lessons(prerequisite_lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_status ON public.course_lessons(circle_id, course_id, status);
