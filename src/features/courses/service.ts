import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  CourseItem,
  CourseModuleItem,
  CourseLessonItem,
  StudentCourseProgress,
  LessonCommentItem,
  CourseAssignmentItem,
  AssignmentSubmissionItem,
  CircleRole,
  MembershipStatus,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';

export const createCourseSchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and dashes.'),
  description: z.string().trim().max(5000).default(''),
  thumbnailUrl: z.string().trim().max(1000).nullable().optional(),
  difficultyLevel: z
    .enum(['beginner', 'intermediate', 'advanced', 'all_levels'])
    .nullable()
    .optional(),
  estimatedDurationHours: z.number().min(0).max(1000).default(0),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
});

export const updateCourseSchema = z.object({
  title: z.string().trim().min(3).max(180).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and dashes.')
    .optional(),
  description: z.string().trim().max(5000).optional(),
  thumbnailUrl: z.string().trim().max(1000).nullable().optional(),
  difficultyLevel: z
    .enum(['beginner', 'intermediate', 'advanced', 'all_levels'])
    .nullable()
    .optional(),
  estimatedDurationHours: z.number().min(0).max(1000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const createModuleSchema = z.object({
  circleId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).default(''),
  sortOrder: z.number().int().min(0).default(0),
});

export const createLessonSchema = z.object({
  circleId: z.string().uuid(),
  courseId: z.string().uuid(),
  moduleId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and dashes.'),
  description: z.string().trim().max(2000).default(''),
  contentBody: z.string().trim().max(50000).default(''),
  videoUrl: z.string().trim().max(1000).nullable().optional(),
  durationMinutes: z.number().int().min(0).max(1440).default(0),
  attachmentUrl: z.string().trim().max(1000).nullable().optional(),
  attachmentName: z.string().trim().max(200).nullable().optional(),
  isFreePreview: z.boolean().default(false),
  liveEventId: z.string().uuid().nullable().optional(),
  isLiveSession: z.boolean().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and dashes.')
    .optional(),
  description: z.string().trim().max(2000).optional(),
  contentBody: z.string().trim().max(50000).optional(),
  videoUrl: z.string().trim().max(1000).nullable().optional(),
  durationMinutes: z.number().int().min(0).max(1440).optional(),
  attachmentUrl: z.string().trim().max(1000).nullable().optional(),
  attachmentName: z.string().trim().max(200).nullable().optional(),
  isFreePreview: z.boolean().optional(),
  liveEventId: z.string().uuid().nullable().optional(),
  isLiveSession: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createLessonCommentSchema = z.object({
  circleId: z.string().uuid(),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export const createCourseAssignmentSchema = z.object({
  circleId: z.string().uuid(),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  promptBody: z.string().trim().min(5).max(10000),
  dueDate: z.string().datetime().nullable().optional(),
});

export const submitAssignmentSchema = z.object({
  circleId: z.string().uuid(),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  submissionBody: z.string().trim().min(3).max(10000),
  attachmentUrl: z.string().trim().max(1000).nullable().optional(),
  attachmentName: z.string().trim().max(200).nullable().optional(),
  status: z.enum(['draft', 'submitted']).default('submitted'),
});

export const reviewAssignmentSubmissionSchema = z.object({
  circleId: z.string().uuid(),
  courseId: z.string().uuid(),
  submissionId: z.string().uuid(),
  status: z.enum(['in_review', 'needs_revision', 'approved']),
  gradeScore: z.number().int().min(0).max(100).nullable().optional(),
  instructorFeedback: z.string().trim().max(5000).default(''),
});

/**
 * Lists published courses for a Circle with progress summary for authenticated users.
 */
export async function listCourses(
  actorUserId: string | null,
  circleId: string
): Promise<CourseItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ visibility: string }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    if (!circleRes.rows[0]) {
      throw new NotFoundError('Circle not found.');
    }

    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'learning_resources'
       LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('learning_resources');
    }

    const coursesRes = await tx.query<
      CourseItem & {
        instructor_username: string;
        instructor_display_name: string;
        instructor_avatar_url: string | null;
        total_lessons_count: string;
      }
    >(
      `SELECT 
         c.*,
         p.username AS instructor_username,
         p.display_name AS instructor_display_name,
         p.avatar_url AS instructor_avatar_url,
         (
           SELECT COUNT(*)::text 
           FROM public.course_lessons l 
           WHERE l.course_id = c.id AND l.circle_id = c.circle_id AND l.status = 'published'
         ) AS total_lessons_count
       FROM public.courses c
       JOIN public.profiles p ON p.id = c.instructor_id
       WHERE c.circle_id = $1
       ORDER BY c.sort_order ASC, c.created_at DESC;`,
      [circleId]
    );

    const completionMap: Record<string, number> = {};
    if (actorUserId) {
      const compRes = await tx.query<{ course_id: string; completed_count: string }>(
        `SELECT course_id, COUNT(*)::text AS completed_count
         FROM public.course_lesson_completions
         WHERE circle_id = $1 AND user_id = $2
         GROUP BY course_id;`,
        [circleId, actorUserId]
      );
      for (const row of compRes.rows) {
        completionMap[row.course_id] = parseInt(row.completed_count, 10);
      }
    }

    return coursesRes.rows.map((row) => {
      const totalLessons = parseInt(row.total_lessons_count || '0', 10);
      const completedLessons = actorUserId ? completionMap[row.id] || 0 : 0;
      const progressPercentage =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      return {
        id: row.id,
        circle_id: row.circle_id,
        instructor_id: row.instructor_id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        thumbnail_url: row.thumbnail_url,
        difficulty_level: row.difficulty_level,
        estimated_duration_hours: Number(row.estimated_duration_hours),
        status: row.status,
        sort_order: row.sort_order,
        created_at: row.created_at,
        updated_at: row.updated_at,
        instructor: {
          id: row.instructor_id,
          username: row.instructor_username,
          display_name: row.instructor_display_name,
          avatar_url: row.instructor_avatar_url,
        },
        total_lessons_count: totalLessons,
        completed_lessons_count: completedLessons,
        progress_percentage: progressPercentage,
        is_enrolled: completedLessons > 0,
      };
    });
  });
}

/**
 * Retrieves a course with its complete curriculum (modules + lessons) and viewer completion status.
 */
export async function getCourseWithCurriculum(
  actorUserId: string | null,
  circleId: string,
  courseIdOrSlug: string
): Promise<CourseItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      courseIdOrSlug
    );

    const courseRes = await tx.query<
      CourseItem & {
        instructor_username: string;
        instructor_display_name: string;
        instructor_avatar_url: string | null;
      }
    >(
      `SELECT 
         c.*,
         p.username AS instructor_username,
         p.display_name AS instructor_display_name,
         p.avatar_url AS instructor_avatar_url
       FROM public.courses c
       JOIN public.profiles p ON p.id = c.instructor_id
       WHERE c.circle_id = $1 AND ${isUuid ? 'c.id = $2' : 'c.slug = $2'}
       LIMIT 1;`,
      [circleId, courseIdOrSlug]
    );

    const course = courseRes.rows[0];
    if (!course) {
      throw new NotFoundError('Course not found.');
    }

    // Modules
    const modulesRes = await tx.query<CourseModuleItem>(
      `SELECT * FROM public.course_modules
       WHERE circle_id = $1 AND course_id = $2
       ORDER BY sort_order ASC, created_at ASC;`,
      [circleId, course.id]
    );

    // Lessons ordered by module sort_order then lesson sort_order
    const lessonsRes = await tx.query<CourseLessonItem>(
      `SELECT l.* FROM public.course_lessons l
       JOIN public.course_modules m ON m.id = l.module_id
       WHERE l.circle_id = $1 AND l.course_id = $2
       ORDER BY m.sort_order ASC, l.sort_order ASC, l.created_at ASC;`,
      [circleId, course.id]
    );

    // Completions for actor
    let completedLessonIds = new Set<string>();
    if (actorUserId) {
      const compRes = await tx.query<{ lesson_id: string }>(
        `SELECT lesson_id FROM public.course_lesson_completions
         WHERE circle_id = $1 AND course_id = $2 AND user_id = $3;`,
        [circleId, course.id, actorUserId]
      );
      completedLessonIds = new Set(compRes.rows.map((r) => r.lesson_id));
    }

    // Assignments
    const assignmentsRes = await tx.query<CourseAssignmentItem>(
      `SELECT * FROM public.course_assignments
       WHERE circle_id = $1 AND course_id = $2;`,
      [circleId, course.id]
    );

    // If student actor, load submissions
    const submissionsByAssignment: Record<string, AssignmentSubmissionItem> = {};
    if (actorUserId) {
      const subRes = await tx.query<AssignmentSubmissionItem>(
        `SELECT * FROM public.course_assignment_submissions
         WHERE circle_id = $1 AND course_id = $2 AND student_id = $3;`,
        [circleId, course.id, actorUserId]
      );
      for (const sub of subRes.rows) {
        submissionsByAssignment[sub.assignment_id] = sub;
      }
    }

    const assignmentsByLesson: Record<string, CourseAssignmentItem> = {};
    for (const a of assignmentsRes.rows) {
      assignmentsByLesson[a.lesson_id] = {
        ...a,
        user_submission: submissionsByAssignment[a.id] || null,
      };
    }

    const lessonsByModule: Record<string, CourseLessonItem[]> = {};
    for (const lesson of lessonsRes.rows) {
      if (!lessonsByModule[lesson.module_id]) {
        lessonsByModule[lesson.module_id] = [];
      }
      lessonsByModule[lesson.module_id].push({
        ...lesson,
        is_completed: completedLessonIds.has(lesson.id),
        assignment: assignmentsByLesson[lesson.id] || null,
      });
    }

    const modules: CourseModuleItem[] = modulesRes.rows.map((mod) => ({
      ...mod,
      lessons: lessonsByModule[mod.id] || [],
    }));

    const totalLessons = lessonsRes.rows.length;
    const completedLessons = completedLessonIds.size;
    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      ...course,
      estimated_duration_hours: Number(course.estimated_duration_hours),
      instructor: {
        id: course.instructor_id,
        username: course.instructor_username,
        display_name: course.instructor_display_name,
        avatar_url: course.instructor_avatar_url,
      },
      modules,
      total_lessons_count: totalLessons,
      completed_lessons_count: completedLessons,
      progress_percentage: progressPercentage,
      is_enrolled: completedLessons > 0,
    };
  });
}

/**
 * Creates a new course in a Circle. Requires active membership and learning_resources capability.
 */
export async function createCourse(
  actorUserId: string,
  input: z.input<typeof createCourseSchema>
): Promise<CourseItem> {
  const parsed = createCourseSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'learning_resources'
       LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('learning_resources');
    }

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can create courses.');
    }

    const courseId = crypto.randomUUID();
    const res = await tx.query<CourseItem>(
      `INSERT INTO public.courses (
         id, circle_id, instructor_id, title, slug, description,
         thumbnail_url, difficulty_level, estimated_duration_hours, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *;`,
      [
        courseId,
        parsed.circleId,
        actorUserId,
        parsed.title,
        parsed.slug,
        parsed.description,
        parsed.thumbnailUrl || null,
        parsed.difficultyLevel || null,
        parsed.estimatedDurationHours,
        parsed.status,
      ]
    );

    const course = res.rows[0];
    if (!course) {
      throw new ValidationError('Failed to create course.');
    }

    return course;
  });
}

/**
 * Updates course metadata.
 */
export async function updateCourse(
  actorUserId: string,
  circleId: string,
  courseId: string,
  input: z.input<typeof updateCourseSchema>
): Promise<CourseItem> {
  const parsed = updateCourseSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const courseRes = await tx.query<{ instructor_id: string }>(
      `SELECT instructor_id FROM public.courses WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [courseId, circleId]
    );
    const course = courseRes.rows[0];
    if (!course) {
      throw new NotFoundError('Course not found.');
    }

    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    const isStaff = role === 'owner' || role === 'admin' || role === 'moderator';

    if (!isStaff && course.instructor_id !== actorUserId) {
      throw new ForbiddenError('Only the course instructor or Circle staff can update this course.');
    }

    const res = await tx.query<CourseItem>(
      `UPDATE public.courses
       SET 
         title = COALESCE($3, title),
         slug = COALESCE($4, slug),
         description = COALESCE($5, description),
         thumbnail_url = CASE WHEN $6::boolean THEN $7 ELSE thumbnail_url END,
         difficulty_level = CASE WHEN $8::boolean THEN $9 ELSE difficulty_level END,
         estimated_duration_hours = COALESCE($10, estimated_duration_hours),
         status = COALESCE($11, status),
         updated_at = NOW()
       WHERE id = $1 AND circle_id = $2
       RETURNING *;`,
      [
        courseId,
        circleId,
        parsed.title ?? null,
        parsed.slug ?? null,
        parsed.description ?? null,
        parsed.thumbnailUrl !== undefined,
        parsed.thumbnailUrl ?? null,
        parsed.difficultyLevel !== undefined,
        parsed.difficultyLevel ?? null,
        parsed.estimatedDurationHours ?? null,
        parsed.status ?? null,
      ]
    );

    return res.rows[0];
  });
}

/**
 * Adds a module (section) to a course.
 */
export async function createModule(
  actorUserId: string,
  input: z.input<typeof createModuleSchema>
): Promise<CourseModuleItem> {
  const parsed = createModuleSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const courseRes = await tx.query<{ instructor_id: string }>(
      `SELECT instructor_id FROM public.courses WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [parsed.courseId, parsed.circleId]
    );
    if (!courseRes.rows[0]) {
      throw new NotFoundError('Course not found.');
    }

    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    const isStaff = role === 'owner' || role === 'admin' || role === 'moderator';

    if (!isStaff && courseRes.rows[0].instructor_id !== actorUserId) {
      throw new ForbiddenError('Only the instructor or staff can add modules.');
    }

    const moduleId = crypto.randomUUID();
    const res = await tx.query<CourseModuleItem>(
      `INSERT INTO public.course_modules (id, course_id, circle_id, title, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
      [
        moduleId,
        parsed.courseId,
        parsed.circleId,
        parsed.title,
        parsed.description,
        parsed.sortOrder,
      ]
    );

    return {
      ...res.rows[0],
      lessons: [],
    };
  });
}

/**
 * Adds a lesson to a course module.
 */
export async function createLesson(
  actorUserId: string,
  input: z.input<typeof createLessonSchema>
): Promise<CourseLessonItem> {
  const parsed = createLessonSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const moduleRes = await tx.query<{ course_id: string }>(
      `SELECT course_id FROM public.course_modules 
       WHERE id = $1 AND course_id = $2 AND circle_id = $3 LIMIT 1;`,
      [parsed.moduleId, parsed.courseId, parsed.circleId]
    );
    if (!moduleRes.rows[0]) {
      throw new NotFoundError('Course module not found in this circle.');
    }

    const courseRes = await tx.query<{ instructor_id: string }>(
      `SELECT instructor_id FROM public.courses WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [parsed.courseId, parsed.circleId]
    );
    if (!courseRes.rows[0]) {
      throw new NotFoundError('Course not found.');
    }

    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    const isStaff = role === 'owner' || role === 'admin' || role === 'moderator';

    if (!isStaff && courseRes.rows[0].instructor_id !== actorUserId) {
      throw new ForbiddenError('Only the instructor or staff can add lessons.');
    }

    const lessonId = crypto.randomUUID();
    const res = await tx.query<CourseLessonItem>(
      `INSERT INTO public.course_lessons (
         id, module_id, course_id, circle_id, title, slug, description,
         content_body, video_url, duration_minutes, attachment_url,
         attachment_name, is_free_preview, live_event_id, is_live_session, status, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *;`,
      [
        lessonId,
        parsed.moduleId,
        parsed.courseId,
        parsed.circleId,
        parsed.title,
        parsed.slug,
        parsed.description,
        parsed.contentBody,
        parsed.videoUrl || null,
        parsed.durationMinutes,
        parsed.attachmentUrl || null,
        parsed.attachmentName || null,
        parsed.isFreePreview,
        parsed.liveEventId || null,
        parsed.isLiveSession || false,
        parsed.status,
        parsed.sortOrder,
      ]
    );

    return {
      ...res.rows[0],
      is_completed: false,
    };
  });
}

/**
 * Toggles student completion for a lesson and returns updated progress.
 */
export async function toggleLessonCompletion(
  actorUserId: string,
  circleId: string,
  courseId: string,
  lessonId: string,
  completed: boolean
): Promise<StudentCourseProgress> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const lessonRes = await tx.query<{ id: string }>(
      `SELECT id FROM public.course_lessons
       WHERE id = $1 AND course_id = $2 AND circle_id = $3 LIMIT 1;`,
      [lessonId, courseId, circleId]
    );
    if (!lessonRes.rows[0]) {
      throw new NotFoundError('Lesson not found in this course.');
    }

    const memRes = await tx.query<{ status: MembershipStatus }>(
      `SELECT status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    if (memRes.rows[0]?.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can record learning progress.');
    }

    if (completed) {
      await tx.query(
        `INSERT INTO public.course_lesson_completions (id, lesson_id, course_id, circle_id, user_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lesson_id, user_id) DO NOTHING;`,
        [crypto.randomUUID(), lessonId, courseId, circleId, actorUserId]
      );
    } else {
      await tx.query(
        `DELETE FROM public.course_lesson_completions
         WHERE lesson_id = $1 AND user_id = $2 AND circle_id = $3;`,
        [lessonId, actorUserId, circleId]
      );
    }

    // Fetch all lessons in course ordered by module syllabus order
    const allLessons = await tx.query<{ id: string }>(
      `SELECT l.id FROM public.course_lessons l
       JOIN public.course_modules m ON m.id = l.module_id
       WHERE l.course_id = $1 AND l.circle_id = $2 AND l.status = 'published'
       ORDER BY m.sort_order ASC, l.sort_order ASC, l.created_at ASC;`,
      [courseId, circleId]
    );

    // Fetch completed lessons for student
    const completedRes = await tx.query<{ lesson_id: string }>(
      `SELECT lesson_id FROM public.course_lesson_completions
       WHERE course_id = $1 AND circle_id = $2 AND user_id = $3;`,
      [courseId, circleId, actorUserId]
    );
    const completedSet = new Set(completedRes.rows.map((r) => r.lesson_id));

    let nextLessonId: string | null = null;
    for (const l of allLessons.rows) {
      if (!completedSet.has(l.id)) {
        nextLessonId = l.id;
        break;
      }
    }

    const total = allLessons.rows.length;
    const completedCount = completedSet.size;
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      course_id: courseId,
      total_lessons: total,
      completed_lessons: completedCount,
      progress_percentage: progress,
      completed_lesson_ids: Array.from(completedSet),
      next_lesson_id: nextLessonId,
    };
  });
}

/**
 * Creates a comment in a course lesson discussion thread.
 */
export async function createLessonComment(
  actorUserId: string,
  input: z.input<typeof createLessonCommentSchema>
): Promise<LessonCommentItem> {
  const parsed = createLessonCommentSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ status: MembershipStatus }>(
      `SELECT status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    if (memRes.rows[0]?.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can post lesson comments.');
    }

    const commentId = crypto.randomUUID();
    const res = await tx.query<LessonCommentItem>(
      `INSERT INTO public.course_lesson_comments (id, lesson_id, course_id, circle_id, author_id, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
      [commentId, parsed.lessonId, parsed.courseId, parsed.circleId, actorUserId, parsed.body]
    );

    const profileRes = await tx.query<{
      username: string;
      display_name: string;
      avatar_url: string | null;
    }>(
      `SELECT username, display_name, avatar_url FROM public.profiles WHERE id = $1 LIMIT 1;`,
      [actorUserId]
    );

    return {
      ...res.rows[0],
      author: {
        id: actorUserId,
        username: profileRes.rows[0]?.username ?? 'member',
        display_name: profileRes.rows[0]?.display_name ?? 'Member',
        avatar_url: profileRes.rows[0]?.avatar_url ?? null,
      },
    };
  });
}

/**
 * Lists published comments for a course lesson ordered chronologically.
 */
export async function listLessonComments(
  actorUserId: string | null,
  circleId: string,
  courseId: string,
  lessonId: string
): Promise<LessonCommentItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      LessonCommentItem & {
        author_username: string;
        author_display_name: string;
        author_avatar_url: string | null;
      }
    >(
      `SELECT 
         c.*,
         p.username AS author_username,
         p.display_name AS author_display_name,
         p.avatar_url AS author_avatar_url
       FROM public.course_lesson_comments c
       JOIN public.profiles p ON p.id = c.author_id
       WHERE c.circle_id = $1 AND c.course_id = $2 AND c.lesson_id = $3 AND c.status = 'published'
       ORDER BY c.created_at ASC;`,
      [circleId, courseId, lessonId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      lesson_id: r.lesson_id,
      course_id: r.course_id,
      circle_id: r.circle_id,
      author_id: r.author_id,
      body: r.body,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: {
        id: r.author_id,
        username: r.author_username,
        display_name: r.author_display_name,
        avatar_url: r.author_avatar_url,
      },
    }));
  });
}

/**
 * Creates or updates an assignment prompt for a lesson.
 */
export async function createCourseAssignment(
  actorUserId: string,
  input: z.input<typeof createCourseAssignmentSchema>
): Promise<CourseAssignmentItem> {
  const parsed = createCourseAssignmentSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const courseRes = await tx.query<{ instructor_id: string }>(
      `SELECT instructor_id FROM public.courses WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [parsed.courseId, parsed.circleId]
    );
    if (!courseRes.rows[0]) throw new NotFoundError('Course not found.');

    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    const isStaff = role === 'owner' || role === 'admin' || role === 'moderator';

    if (!isStaff && courseRes.rows[0].instructor_id !== actorUserId) {
      throw new ForbiddenError('Only the instructor or staff can create assignments.');
    }

    const assignmentId = crypto.randomUUID();
    const res = await tx.query<CourseAssignmentItem>(
      `INSERT INTO public.course_assignments (id, lesson_id, course_id, circle_id, title, prompt_body, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (lesson_id, circle_id) DO UPDATE SET
         title = EXCLUDED.title,
         prompt_body = EXCLUDED.prompt_body,
         due_date = EXCLUDED.due_date,
         updated_at = NOW()
       RETURNING *;`,
      [
        assignmentId,
        parsed.lessonId,
        parsed.courseId,
        parsed.circleId,
        parsed.title,
        parsed.promptBody,
        parsed.dueDate || null,
      ]
    );

    return res.rows[0];
  });
}

/**
 * Submits homework/project for a lesson assignment.
 */
export async function submitAssignment(
  actorUserId: string,
  input: z.input<typeof submitAssignmentSchema>
): Promise<AssignmentSubmissionItem> {
  const parsed = submitAssignmentSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ status: MembershipStatus }>(
      `SELECT status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    if (memRes.rows[0]?.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can submit assignments.');
    }

    const subId = crypto.randomUUID();
    const res = await tx.query<AssignmentSubmissionItem>(
      `INSERT INTO public.course_assignment_submissions (
         id, assignment_id, lesson_id, course_id, circle_id, student_id,
         submission_body, attachment_url, attachment_name, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET
         submission_body = EXCLUDED.submission_body,
         attachment_url = EXCLUDED.attachment_url,
         attachment_name = EXCLUDED.attachment_name,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *;`,
      [
        subId,
        parsed.assignmentId,
        parsed.lessonId,
        parsed.courseId,
        parsed.circleId,
        actorUserId,
        parsed.submissionBody,
        parsed.attachmentUrl || null,
        parsed.attachmentName || null,
        parsed.status,
      ]
    );

    return res.rows[0];
  });
}

/**
 * Reviews a student assignment submission with grade and feedback.
 */
export async function reviewAssignmentSubmission(
  actorUserId: string,
  input: z.input<typeof reviewAssignmentSubmissionSchema>
): Promise<AssignmentSubmissionItem> {
  const parsed = reviewAssignmentSubmissionSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const subRes = await tx.query<{ course_id: string }>(
      `SELECT course_id FROM public.course_assignment_submissions WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [parsed.submissionId, parsed.circleId]
    );
    if (!subRes.rows[0]) throw new NotFoundError('Submission not found.');

    const courseRes = await tx.query<{ instructor_id: string }>(
      `SELECT instructor_id FROM public.courses WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [parsed.courseId, parsed.circleId]
    );
    if (!courseRes.rows[0]) throw new NotFoundError('Course not found.');

    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    const isStaff = role === 'owner' || role === 'admin' || role === 'moderator';

    if (!isStaff && courseRes.rows[0].instructor_id !== actorUserId) {
      throw new ForbiddenError('Only the course instructor or staff can review submissions.');
    }

    const res = await tx.query<AssignmentSubmissionItem>(
      `UPDATE public.course_assignment_submissions
       SET 
         status = $3,
         grade_score = $4,
         instructor_feedback = $5,
         reviewed_by = $6,
         reviewed_at = NOW(),
         updated_at = NOW()
       WHERE id = $1 AND circle_id = $2
       RETURNING *;`,
      [
        parsed.submissionId,
        parsed.circleId,
        parsed.status,
        parsed.gradeScore !== undefined ? parsed.gradeScore : null,
        parsed.instructorFeedback,
        actorUserId,
      ]
    );

    return res.rows[0];
  });
}

