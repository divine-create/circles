import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction, withServiceRoleTransaction, DbTransaction } from '@/lib/db/postgres';
import {
  CourseItem,
  CourseModuleItem,
  CourseLessonItem,
  StudentCourseProgress,
  LessonCommentItem,
  CourseAssignmentItem,
  AssignmentSubmissionItem,
  CourseEnrollmentItem,
  MemberXpSummary,
  LeaderboardEntry,
  CircleRole,
  MembershipStatus,
  LessonContentBlock,
  QuestionBankItem,
  QuestionType,
  CourseQuestionItem,
  CourseQuizItem,
  CourseQuizAttemptItem,
  CourseQuizAnswerItem,
  LearningPathItem,
  LearningPathCourseItem,
  CoursePrerequisiteItem,
  LearningPathEnrollmentItem,
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
  accessRule: z.enum(['open', 'members_only', 'min_level', 'staff_only']).default('open'),
  minLevelRequired: z.number().int().min(1).default(1),
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
  accessRule: z.enum(['open', 'members_only', 'min_level', 'staff_only']).optional(),
  minLevelRequired: z.number().int().min(1).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const createModuleSchema = z.object({
  circleId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).default(''),
  sortOrder: z.number().int().min(0).default(0),
  dripType: z.enum(['instant', 'relative_days', 'calendar_date']).default('instant'),
  dripDaysAfterEnrollment: z.number().int().min(0).default(0),
  dripUnlockDate: z.string().datetime().nullable().optional(),
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
        access_rule: row.access_rule ?? 'open',
        min_level_required: Number(row.min_level_required ?? 1),
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

    // Member info & staff role
    const memRes = actorUserId
      ? await tx.query<{ role: CircleRole; status: MembershipStatus }>(
          `SELECT role, status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
          [circleId, actorUserId]
        )
      : { rows: [] };
    const role = memRes.rows[0]?.role;
    const isMember = memRes.rows[0]?.status === 'active';
    const isStaff =
      role === 'owner' ||
      role === 'admin' ||
      role === 'moderator' ||
      course.instructor_id === actorUserId;

    // Quizzes for lessons in this course
    const quizzesRes = await tx.query<CourseQuizItem>(
      `SELECT * FROM public.course_quizzes WHERE circle_id = $1 AND course_id = $2;`,
      [circleId, course.id]
    );
    const quizzesByLesson: Record<string, CourseQuizItem> = {};
    for (const q of quizzesRes.rows) {
      if (q.lesson_id) {
        quizzesByLesson[q.lesson_id] = q;
      }
    }

    const lessonsByModule: Record<string, CourseLessonItem[]> = {};
    for (const lesson of lessonsRes.rows) {
      if (!lessonsByModule[lesson.module_id]) {
        lessonsByModule[lesson.module_id] = [];
      }

      const isCompleted = completedLessonIds.has(lesson.id);
      const isPrereqLocked = Boolean(
        lesson.prerequisite_lesson_id && !completedLessonIds.has(lesson.prerequisite_lesson_id)
      );

      // Synthesize fallback blocks if legacy columns used
      let blocks = Array.isArray(lesson.content_blocks) ? lesson.content_blocks : [];
      if (blocks.length === 0) {
        const synth: LessonContentBlock[] = [];
        if (lesson.video_url) {
          synth.push({ id: 'block-v', type: 'video', url: lesson.video_url, provider: 'custom' });
        }
        if (lesson.content_body) {
          synth.push({ id: 'block-t', type: 'rich_text', markdown: lesson.content_body });
        }
        if (lesson.attachment_url) {
          synth.push({
            id: 'block-f',
            type: 'file_asset',
            title: lesson.attachment_name || 'Attachment',
            fileUrl: lesson.attachment_url,
          });
        }
        blocks = synth;
      }

      lessonsByModule[lesson.module_id].push({
        ...lesson,
        content_blocks: blocks,
        instructor_notes: isStaff ? lesson.instructor_notes : null,
        is_completed: isCompleted,
        is_locked: isPrereqLocked,
        lock_reason: isPrereqLocked ? 'Requires completion of prerequisite lesson.' : null,
        assignment: assignmentsByLesson[lesson.id] || null,
        quiz: quizzesByLesson[lesson.id] || null,
      });
    }

    // Enrollment & Member info
    const enrollRes = actorUserId
      ? await tx.query<{ enrolled_at: string }>(
          `SELECT enrolled_at FROM public.course_enrollments WHERE course_id = $1 AND student_id = $2 LIMIT 1;`,
          [course.id, actorUserId]
        )
      : { rows: [] };
    const enrolledAt = enrollRes.rows[0]?.enrolled_at
      ? new Date(enrollRes.rows[0].enrolled_at)
      : null;

    let viewerLevel = 1;
    if (actorUserId) {
      const xpRes = await tx.query<{ total: string }>(
        `SELECT COALESCE(SUM(points), 0)::text AS total FROM public.member_xp_points WHERE circle_id = $1 AND user_id = $2;`,
        [circleId, actorUserId]
      );
      viewerLevel = calculateLevelFromXp(parseInt(xpRes.rows[0]?.total || '0', 10)).currentLevel;
    }

    let viewerCanAccess = true;
    if (course.access_rule === 'staff_only') {
      viewerCanAccess = isStaff;
    } else if (course.access_rule === 'members_only') {
      viewerCanAccess = isMember || isStaff;
    } else if (course.access_rule === 'min_level') {
      viewerCanAccess = isStaff || (isMember && viewerLevel >= (course.min_level_required ?? 1));
    }

    const now = new Date();
    const modules: CourseModuleItem[] = modulesRes.rows.map((mod) => {
      let isLocked = false;
      let unlocksAt: string | null = null;

      if (!isStaff && mod.drip_type === 'calendar_date' && mod.drip_unlock_date) {
        const unlockDate = new Date(mod.drip_unlock_date);
        if (now < unlockDate) {
          isLocked = true;
          unlocksAt = mod.drip_unlock_date;
        }
      } else if (
        !isStaff &&
        mod.drip_type === 'relative_days' &&
        (mod.drip_days_after_enrollment ?? 0) > 0
      ) {
        if (!enrolledAt) {
          isLocked = true;
        } else {
          const unlockDate = new Date(
            enrolledAt.getTime() + (mod.drip_days_after_enrollment ?? 0) * 86400000
          );
          if (now < unlockDate) {
            isLocked = true;
            unlocksAt = unlockDate.toISOString();
          }
        }
      }

      return {
        ...mod,
        is_locked: isLocked,
        unlocks_at: unlocksAt,
        lessons: isLocked ? [] : lessonsByModule[mod.id] || [],
      };
    });

    const totalLessons = lessonsRes.rows.length;
    const completedLessons = completedLessonIds.size;
    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      ...course,
      estimated_duration_hours: Number(course.estimated_duration_hours),
      viewer_can_access: viewerCanAccess,
      viewer_level: viewerLevel,
      is_enrolled: Boolean(enrolledAt) || completedLessons > 0,
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
         thumbnail_url, difficulty_level, estimated_duration_hours,
         access_rule, min_level_required, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        parsed.accessRule,
        parsed.minLevelRequired,
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
         access_rule = COALESCE($12, access_rule),
         min_level_required = COALESCE($13, min_level_required),
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
        parsed.accessRule ?? null,
        parsed.minLevelRequired ?? null,
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
      `INSERT INTO public.course_modules (
         id, course_id, circle_id, title, description, sort_order,
         drip_type, drip_days_after_enrollment, drip_unlock_date
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        moduleId,
        parsed.courseId,
        parsed.circleId,
        parsed.title,
        parsed.description,
        parsed.sortOrder,
        parsed.dripType,
        parsed.dripDaysAfterEnrollment,
        parsed.dripUnlockDate ? new Date(parsed.dripUnlockDate).toISOString() : null,
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
  const result = await withRlsTransaction(actorUserId, async (tx) => {
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
      progress: {
        course_id: courseId,
        total_lessons: total,
        completed_lessons: completedCount,
        progress_percentage: progress,
        completed_lesson_ids: Array.from(completedSet),
        next_lesson_id: nextLessonId,
      },
      wasCompleted: completed,
    };
  });

  if (result.wasCompleted) {
    try {
      await awardMemberXp(actorUserId, circleId, 10, 'lesson_completed', lessonId);
    } catch {
      // XP reward is best-effort idempotent
    }
  }

  return result.progress;
}

/**
 * Creates a comment in a course lesson discussion thread.
 */
export async function createLessonComment(
  actorUserId: string,
  input: z.input<typeof createLessonCommentSchema>
): Promise<LessonCommentItem> {
  const parsed = createLessonCommentSchema.parse(input);

  const comment = await withRlsTransaction(actorUserId, async (tx) => {
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

  try {
    await awardMemberXp(actorUserId, parsed.circleId, 5, 'lesson_comment', comment.id);
  } catch {
    // XP reward is best-effort idempotent
  }

  return comment;
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

  const submission = await withRlsTransaction(actorUserId, async (tx) => {
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

  try {
    await awardMemberXp(
      actorUserId,
      parsed.circleId,
      25,
      'assignment_submitted',
      submission.id
    );
  } catch {
    // XP reward is best-effort idempotent
  }

  return submission;
}

/**
 * Reviews a student assignment submission with grade and feedback.
 */
export async function reviewAssignmentSubmission(
  actorUserId: string,
  input: z.input<typeof reviewAssignmentSubmissionSchema>
): Promise<AssignmentSubmissionItem> {
  const parsed = reviewAssignmentSubmissionSchema.parse(input);

  const result = await withRlsTransaction(actorUserId, async (tx) => {
    const subRes = await tx.query<{ course_id: string; student_id: string }>(
      `SELECT course_id, student_id FROM public.course_assignment_submissions WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
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

    return {
      submission: res.rows[0],
      studentId: subRes.rows[0].student_id,
    };
  });

  // Award +50 XP if approved
  if (parsed.status === 'approved' && result.studentId) {
    try {
      await awardMemberXp(
        result.studentId,
        parsed.circleId,
        50,
        'assignment_approved',
        result.submission.id
      );
    } catch {
      // XP reward is best-effort idempotent
    }
  }

  return result.submission;
}

/**
 * Calculates current level, target XP for next level, and progress percentage.
 */
export function calculateLevelFromXp(xp: number): {
  currentLevel: number;
  nextLevelXp: number;
  levelProgressPercentage: number;
} {
  const thresholds = [0, 50, 150, 300, 600, 1000];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]!) {
      level = i + 1;
      break;
    }
  }
  const currentBase = thresholds[level - 1] ?? 0;
  const nextTarget = thresholds[level] ?? currentBase + 500;
  const needed = Math.max(1, nextTarget - currentBase);
  const currentInLevel = Math.max(0, xp - currentBase);
  const progress = Math.min(100, Math.round((currentInLevel / needed) * 100));

  return {
    currentLevel: level,
    nextLevelXp: nextTarget,
    levelProgressPercentage: progress,
  };
}

/**
 * Awards XP points for community and learning activities (idempotent per activity entity).
 */
export async function awardMemberXp(
  actorUserId: string,
  circleId: string,
  points: number,
  activityType:
    | 'lesson_completed'
    | 'assignment_submitted'
    | 'assignment_approved'
    | 'lesson_comment'
    | 'discussion_post',
  entityId?: string | null
): Promise<void> {
  await withServiceRoleTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO public.member_xp_points (id, circle_id, user_id, points, activity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (circle_id, user_id, activity_type, entity_id) DO NOTHING;`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        points,
        activityType,
        entityId || crypto.randomUUID(),
      ]
    );
  });
}

/**
 * Retrieves the XP summary and calculated level for a member in a Circle.
 */
export async function getMemberXpSummary(
  actorUserId: string,
  circleId: string
): Promise<MemberXpSummary> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<{ total: string }>(
      `SELECT COALESCE(SUM(points), 0)::text AS total
       FROM public.member_xp_points
       WHERE circle_id = $1 AND user_id = $2;`,
      [circleId, actorUserId]
    );
    const totalXp = parseInt(res.rows[0]?.total || '0', 10);
    const lvl = calculateLevelFromXp(totalXp);
    return {
      user_id: actorUserId,
      total_xp: totalXp,
      current_level: lvl.currentLevel,
      next_level_xp: lvl.nextLevelXp,
      level_progress_percentage: lvl.levelProgressPercentage,
    };
  });
}

/**
 * Retrieves the top students in a Circle by total XP (Leaderboard).
 */
export async function getCircleLeaderboard(
  actorUserId: string | null,
  circleId: string,
  limit = 10
): Promise<LeaderboardEntry[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<{
      user_id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      total_xp: string;
    }>(
      `SELECT 
         xp.user_id,
         p.username,
         p.display_name,
         p.avatar_url,
         SUM(xp.points)::text AS total_xp
       FROM public.member_xp_points xp
       JOIN public.profiles p ON p.id = xp.user_id
       WHERE xp.circle_id = $1
       GROUP BY xp.user_id, p.username, p.display_name, p.avatar_url
       ORDER BY SUM(xp.points) DESC
       LIMIT $2;`,
      [circleId, limit]
    );

    return res.rows.map((r, idx) => {
      const xp = parseInt(r.total_xp, 10);
      const lvl = calculateLevelFromXp(xp);
      return {
        user_id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        total_xp: xp,
        current_level: lvl.currentLevel,
        rank: idx + 1,
      };
    });
  });
}

/**
 * Enrolls a student in a course, checking tier and community level requirements.
 */
export async function enrollInCourse(
  actorUserId: string,
  circleId: string,
  courseId: string
): Promise<CourseEnrollmentItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can enroll in courses.');
    }

    const courseRes = await tx.query<{ access_rule: string; min_level_required: number }>(
      `SELECT access_rule, min_level_required FROM public.courses WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [courseId, circleId]
    );
    const course = courseRes.rows[0];
    if (!course) throw new NotFoundError('Course not found.');

    const isStaff =
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.role === 'moderator';

    if (course.access_rule === 'staff_only' && !isStaff) {
      throw new ForbiddenError('This course is reserved for staff members only.');
    }

    if (course.access_rule === 'min_level') {
      const xpRes = await tx.query<{ total: string }>(
        `SELECT COALESCE(SUM(points), 0)::text AS total FROM public.member_xp_points WHERE circle_id = $1 AND user_id = $2;`,
        [circleId, actorUserId]
      );
      const totalXp = parseInt(xpRes.rows[0]?.total || '0', 10);
      const lvl = calculateLevelFromXp(totalXp);
      if (lvl.currentLevel < course.min_level_required && !isStaff) {
        throw new ForbiddenError(
          `This course requires Community Level ${course.min_level_required}. Your current level is ${lvl.currentLevel}. Earn more XP to unlock!`
        );
      }
    }

    const enrollId = crypto.randomUUID();
    const res = await tx.query<CourseEnrollmentItem>(
      `INSERT INTO public.course_enrollments (id, course_id, circle_id, student_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (course_id, student_id) DO UPDATE SET enrolled_at = public.course_enrollments.enrolled_at
       RETURNING *;`,
      [enrollId, courseId, circleId, actorUserId]
    );

    return res.rows[0];
  });
}



// ============================================================================
// PHASES 1 - 3: ADVANCED CURRICULUM, QUIZZES & LEARNING PATHS
// ============================================================================

/**
 * Updates rich content blocks, drafts, learning objectives, and private notes for a lesson.
 */
export async function updateLessonBlocks(
  actorUserId: string,
  circleId: string,
  input: {
    lessonId: string;
    contentBlocks: LessonContentBlock[];
    draftContentBlocks?: LessonContentBlock[] | null;
    learningObjectives?: string[];
    instructorNotes?: string | null;
    isOptional?: boolean;
    prerequisiteLessonId?: string | null;
    publishNow?: boolean;
  }
): Promise<CourseLessonItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    if (role !== 'owner' && role !== 'admin' && role !== 'moderator') {
      throw new ForbiddenError('Only Circle staff can edit lesson content blocks.');
    }

    const currentRes = await tx.query<CourseLessonItem>(
      `SELECT * FROM public.course_lessons WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [input.lessonId, circleId]
    );
    if (!currentRes.rows[0]) {
      throw new NotFoundError('Lesson not found.');
    }

    const finalBlocks = input.publishNow !== false ? input.contentBlocks : currentRes.rows[0].content_blocks;
    const finalDraft = input.publishNow !== false ? null : (input.draftContentBlocks ?? input.contentBlocks);

    const res = await tx.query<CourseLessonItem>(
      `UPDATE public.course_lessons
       SET
         content_blocks = COALESCE($3::jsonb, content_blocks),
         draft_content_blocks = $4::jsonb,
         learning_objectives = COALESCE($5::jsonb, learning_objectives),
         instructor_notes = CASE WHEN $6::boolean THEN $7 ELSE instructor_notes END,
         is_optional = COALESCE($8, is_optional),
         prerequisite_lesson_id = CASE WHEN $9::boolean THEN $10::uuid ELSE prerequisite_lesson_id END,
         last_edited_by = $11,
         updated_at = NOW()
       WHERE id = $1 AND circle_id = $2
       RETURNING *;`,
      [
        input.lessonId,
        circleId,
        JSON.stringify(finalBlocks || []),
        finalDraft ? JSON.stringify(finalDraft) : null,
        JSON.stringify(input.learningObjectives || []),
        input.instructorNotes !== undefined,
        input.instructorNotes || null,
        input.isOptional ?? false,
        input.prerequisiteLessonId !== undefined,
        input.prerequisiteLessonId || null,
        actorUserId,
      ]
    );

    return res.rows[0];
  });
}

/**
 * Reorders curriculum modules and lessons.
 */
export async function reorderCurriculum(
  actorUserId: string,
  circleId: string,
  courseId: string,
  input: {
    moduleOrder?: string[];
    lessonOrder?: { moduleId: string; lessonIds: string[] }[];
  }
): Promise<{ success: boolean }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    if (role !== 'owner' && role !== 'admin' && role !== 'moderator') {
      throw new ForbiddenError('Only Circle staff can reorder curriculum.');
    }

    if (input.moduleOrder && input.moduleOrder.length > 0) {
      for (let i = 0; i < input.moduleOrder.length; i++) {
        await tx.query(
          `UPDATE public.course_modules SET sort_order = $1 WHERE id = $2 AND circle_id = $3 AND course_id = $4;`,
          [i + 1, input.moduleOrder[i], circleId, courseId]
        );
      }
    }

    if (input.lessonOrder && input.lessonOrder.length > 0) {
      for (const group of input.lessonOrder) {
        for (let j = 0; j < group.lessonIds.length; j++) {
          await tx.query(
            `UPDATE public.course_lessons
             SET sort_order = $1, module_id = $2
             WHERE id = $3 AND circle_id = $4 AND course_id = $5;`,
            [j + 1, group.moduleId, group.lessonIds[j], circleId, courseId]
          );
        }
      }
    }

    return { success: true };
  });
}

/**
 * Duplicates an existing lesson into the same or target module.
 */
export async function duplicateLesson(
  actorUserId: string,
  circleId: string,
  lessonId: string,
  targetModuleId?: string
): Promise<CourseLessonItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    if (role !== 'owner' && role !== 'admin' && role !== 'moderator') {
      throw new ForbiddenError('Only Circle staff can duplicate lessons.');
    }

    const sourceRes = await tx.query<CourseLessonItem>(
      `SELECT * FROM public.course_lessons WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [lessonId, circleId]
    );
    const source = sourceRes.rows[0];
    if (!source) throw new NotFoundError('Source lesson not found.');

    const newId = crypto.randomUUID();
    const destModuleId = targetModuleId || source.module_id;
    const newTitle = `${source.title} (Copy)`;
    const newSlug = `${source.slug}-copy-${Date.now().toString().slice(-4)}`;

    const res = await tx.query<CourseLessonItem>(
      `INSERT INTO public.course_lessons (
         id, module_id, course_id, circle_id, title, slug, description,
         content_body, video_url, duration_minutes, attachment_url, attachment_name,
         is_free_preview, status, sort_order, content_blocks, learning_objectives,
         instructor_notes, is_optional, last_edited_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *;`,
      [
        newId,
        destModuleId,
        source.course_id,
        circleId,
        newTitle,
        newSlug,
        source.description,
        source.content_body,
        source.video_url,
        source.duration_minutes,
        source.attachment_url,
        source.attachment_name,
        source.is_free_preview,
        'draft',
        source.sort_order + 1,
        JSON.stringify(source.content_blocks || []),
        JSON.stringify(source.learning_objectives || []),
        source.instructor_notes,
        source.is_optional ?? false,
        actorUserId,
      ]
    );

    return res.rows[0];
  });
}

/**
 * Validates a course for publishing integrity (checks empty modules, broken lessons, durations).
 */
export async function validateCourseForPublishing(
  actorUserId: string,
  circleId: string,
  courseId: string
): Promise<{ isValid: boolean; issues: string[] }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const issues: string[] = [];

    const modulesRes = await tx.query<{ id: string; title: string }>(
      `SELECT id, title FROM public.course_modules WHERE circle_id = $1 AND course_id = $2;`,
      [circleId, courseId]
    );

    if (modulesRes.rows.length === 0) {
      issues.push('Course must have at least one curriculum module before publishing.');
    }

    const lessonsRes = await tx.query<{ id: string; title: string; content_blocks: LessonContentBlock[] | null; duration_minutes: number }>(
      `SELECT id, title, content_blocks, duration_minutes
       FROM public.course_lessons
       WHERE circle_id = $1 AND course_id = $2 AND status <> 'archived';`,
      [circleId, courseId]
    );

    if (lessonsRes.rows.length === 0) {
      issues.push('Course must have at least one active lesson before publishing.');
    }

    for (const l of lessonsRes.rows) {
      const blocks = Array.isArray(l.content_blocks) ? l.content_blocks : [];
      if (blocks.length === 0) {
        issues.push(`Lesson "${l.title}" has no content blocks.`);
      }
    }

    await tx.query(
      `UPDATE public.courses SET validation_issues = $1::jsonb WHERE id = $2 AND circle_id = $3;`,
      [JSON.stringify(issues), courseId, circleId]
    );

    return {
      isValid: issues.length === 0,
      issues,
    };
  });
}

/**
 * Publishes a course draft version to active students.
 */
export async function publishCourseVersion(
  actorUserId: string,
  circleId: string,
  courseId: string
): Promise<CourseItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole }>(
      `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const role = memRes.rows[0]?.role;
    if (role !== 'owner' && role !== 'admin') {
      throw new ForbiddenError('Only Circle owners or admins can publish courses.');
    }

    // Publish all draft lesson content blocks
    await tx.query(
      `UPDATE public.course_lessons
       SET content_blocks = COALESCE(draft_content_blocks, content_blocks),
           draft_content_blocks = NULL,
           status = 'published',
           published_at = NOW(),
           updated_at = NOW()
       WHERE course_id = $1 AND circle_id = $2 AND status <> 'archived';`,
      [courseId, circleId]
    );

    const res = await tx.query<CourseItem>(
      `UPDATE public.courses
       SET status = 'published',
           published_version = published_version + 1,
           updated_at = NOW()
       WHERE id = $1 AND circle_id = $2
       RETURNING *;`,
      [courseId, circleId]
    );

    return res.rows[0];
  });
}

// ----------------------------------------------------------------------------
// PHASE 2: QUESTION BANKS & QUIZZES
// ----------------------------------------------------------------------------

export async function listQuestionBanks(
  actorUserId: string,
  circleId: string
): Promise<QuestionBankItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<QuestionBankItem>(
      `SELECT qb.*,
              (SELECT COUNT(*)::int FROM public.course_questions q WHERE q.bank_id = qb.id) AS questions_count
       FROM public.course_question_banks qb
       WHERE qb.circle_id = $1
       ORDER BY qb.created_at DESC;`,
      [circleId]
    );
    return res.rows;
  });
}

export async function createQuestionBank(
  actorUserId: string,
  circleId: string,
  input: { title: string; description?: string; category?: string; tags?: string[] }
): Promise<QuestionBankItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const id = crypto.randomUUID();
    const res = await tx.query<QuestionBankItem>(
      `INSERT INTO public.course_question_banks (
         id, circle_id, instructor_id, title, description, category, tags
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *;`,
      [
        id,
        circleId,
        actorUserId,
        input.title.trim(),
        input.description?.trim() || '',
        input.category || 'general',
        JSON.stringify(input.tags || []),
      ]
    );
    return res.rows[0];
  });
}

export async function listBankQuestions(
  actorUserId: string,
  circleId: string,
  bankId?: string
): Promise<CourseQuestionItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const whereBank = bankId ? 'AND q.bank_id = $2' : '';
    const params = bankId ? [circleId, bankId] : [circleId];

    const res = await tx.query<CourseQuestionItem>(
      `SELECT q.* FROM public.course_questions q
       WHERE q.circle_id = $1 ${whereBank}
       ORDER BY q.created_at DESC;`,
      params
    );
    return res.rows;
  });
}

export async function createBankQuestion(
  actorUserId: string,
  circleId: string,
  input: {
    bankId?: string | null;
    type: QuestionType;
    questionText: string;
    explanation?: string;
    points?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    options?: { id: string; text: string }[];
    correctAnswers?: string[];
    rubrics?: string | null;
  }
): Promise<CourseQuestionItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const id = crypto.randomUUID();
    const res = await tx.query<CourseQuestionItem>(
      `INSERT INTO public.course_questions (
         id, bank_id, circle_id, type, question_text, explanation, points,
         difficulty, options, correct_answers, rubrics
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
       RETURNING *;`,
      [
        id,
        input.bankId || null,
        circleId,
        input.type,
        input.questionText.trim(),
        input.explanation?.trim() || '',
        input.points || 1,
        input.difficulty || 'intermediate',
        JSON.stringify(input.options || []),
        JSON.stringify(input.correctAnswers || []),
        input.rubrics || null,
      ]
    );
    return res.rows[0];
  });
}

export async function createCourseQuiz(
  actorUserId: string,
  circleId: string,
  input: {
    courseId: string;
    lessonId?: string | null;
    title: string;
    description?: string;
    passingScore?: number;
    timeLimitMinutes?: number | null;
    maxAttempts?: number | null;
    randomizeQuestions?: boolean;
    feedbackMode?: 'immediate' | 'after_submission' | 'after_deadline';
    isRequired?: boolean;
    questionIds: string[];
  }
): Promise<CourseQuizItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const quizId = crypto.randomUUID();
    const res = await tx.query<CourseQuizItem>(
      `INSERT INTO public.course_quizzes (
         id, circle_id, course_id, lesson_id, title, description,
         passing_score, time_limit_minutes, max_attempts, randomize_questions,
         feedback_mode, is_required
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *;`,
      [
        quizId,
        circleId,
        input.courseId,
        input.lessonId || null,
        input.title.trim(),
        input.description?.trim() || '',
        input.passingScore ?? 70,
        input.timeLimitMinutes || null,
        input.maxAttempts ?? 3,
        input.randomizeQuestions ?? false,
        input.feedbackMode ?? 'immediate',
        input.isRequired !== false,
      ]
    );

    for (let i = 0; i < input.questionIds.length; i++) {
      await tx.query(
        `INSERT INTO public.course_quiz_questions (id, quiz_id, question_id, sort_order, points)
         VALUES ($1, $2, $3, $4, (SELECT points FROM public.course_questions WHERE id = $3 LIMIT 1))
         ON CONFLICT (quiz_id, question_id) DO NOTHING;`,
        [crypto.randomUUID(), quizId, input.questionIds[i], i + 1]
      );
    }

    return res.rows[0];
  });
}

export async function getQuizWithQuestions(
  actorUserId: string | null,
  circleId: string,
  quizId: string
): Promise<CourseQuizItem & { questions: CourseQuestionItem[] }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const quizRes = await tx.query<CourseQuizItem>(
      `SELECT * FROM public.course_quizzes WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [quizId, circleId]
    );
    const quiz = quizRes.rows[0];
    if (!quiz) throw new NotFoundError('Quiz not found.');

    const memRes = actorUserId
      ? await tx.query<{ role: CircleRole }>(
          `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
          [circleId, actorUserId]
        )
      : { rows: [] };
    const isStaff = memRes.rows[0]?.role === 'owner' || memRes.rows[0]?.role === 'admin' || memRes.rows[0]?.role === 'moderator';

    // Fetch quiz questions
    const qRes = await tx.query<CourseQuestionItem & { sort_order: number }>(
      `SELECT q.*, qq.sort_order, qq.points
       FROM public.course_quiz_questions qq
       JOIN public.course_questions q ON q.id = qq.question_id
       WHERE qq.quiz_id = $1
       ORDER BY qq.sort_order ASC;`,
      [quizId]
    );

    // Redact answer keys for student actors
    const sanitizedQuestions = qRes.rows.map((row) => ({
      ...row,
      correct_answers: isStaff ? row.correct_answers : undefined,
    }));

    // Find best attempt for user
    let bestAttempt: CourseQuizAttemptItem | null = null;
    if (actorUserId) {
      const attRes = await tx.query<CourseQuizAttemptItem>(
        `SELECT * FROM public.course_quiz_attempts
         WHERE quiz_id = $1 AND user_id = $2 AND status IN ('submitted', 'graded')
         ORDER BY score_percent DESC NULLS LAST LIMIT 1;`,
        [quizId, actorUserId]
      );
      bestAttempt = attRes.rows[0] || null;
    }

    return {
      ...quiz,
      questions: sanitizedQuestions,
      user_best_attempt: bestAttempt,
    };
  });
}

export async function startQuizAttempt(
  actorUserId: string,
  circleId: string,
  quizId: string
): Promise<CourseQuizAttemptItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const quizRes = await tx.query<CourseQuizItem>(
      `SELECT * FROM public.course_quizzes WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [quizId, circleId]
    );
    const quiz = quizRes.rows[0];
    if (!quiz) throw new NotFoundError('Quiz not found.');

    // Check existing attempts
    const countRes = await tx.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.course_quiz_attempts WHERE quiz_id = $1 AND user_id = $2;`,
      [quizId, actorUserId]
    );
    const attemptCount = parseInt(countRes.rows[0]?.count || '0', 10);
    if (quiz.max_attempts && attemptCount >= quiz.max_attempts) {
      throw new ForbiddenError(`Maximum attempt limit (${quiz.max_attempts}) reached for this quiz.`);
    }

    const attemptId = crypto.randomUUID();
    const res = await tx.query<CourseQuizAttemptItem>(
      `INSERT INTO public.course_quiz_attempts (
         id, quiz_id, circle_id, user_id, status, started_at
       ) VALUES ($1, $2, $3, $4, 'in_progress', NOW())
       RETURNING *;`,
      [attemptId, quizId, circleId, actorUserId]
    );

    return res.rows[0];
  });
}

export async function submitQuizAnswer(
  actorUserId: string,
  circleId: string,
  input: {
    attemptId: string;
    questionId: string;
    answerData: Record<string, unknown>;
  }
): Promise<CourseQuizAnswerItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const attemptRes = await tx.query<CourseQuizAttemptItem>(
      `SELECT * FROM public.course_quiz_attempts WHERE id = $1 AND user_id = $2 LIMIT 1;`,
      [input.attemptId, actorUserId]
    );
    if (!attemptRes.rows[0] || attemptRes.rows[0].status !== 'in_progress') {
      throw new ForbiddenError('Attempt is no longer in progress.');
    }

    const answerId = crypto.randomUUID();
    const res = await tx.query<CourseQuizAnswerItem>(
      `INSERT INTO public.course_quiz_answers (id, attempt_id, question_id, answer_data, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET answer_data = EXCLUDED.answer_data, updated_at = NOW()
       RETURNING *;`,
      [answerId, input.attemptId, input.questionId, JSON.stringify(input.answerData)]
    );

    return res.rows[0];
  });
}

export async function finalizeQuizAttempt(
  actorUserId: string,
  circleId: string,
  attemptId: string
): Promise<CourseQuizAttemptItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const attemptRes = await tx.query<CourseQuizAttemptItem & { quiz_id: string }>(
      `SELECT * FROM public.course_quiz_attempts WHERE id = $1 AND user_id = $2 LIMIT 1;`,
      [attemptId, actorUserId]
    );
    const attempt = attemptRes.rows[0];
    if (!attempt) throw new NotFoundError('Attempt not found.');

    const quizRes = await tx.query<CourseQuizItem>(
      `SELECT * FROM public.course_quizzes WHERE id = $1 LIMIT 1;`,
      [attempt.quiz_id]
    );
    const quiz = quizRes.rows[0];

    // Evaluate answers
    const questionsRes = await tx.query<CourseQuestionItem & { points: number }>(
      `SELECT q.*, qq.points FROM public.course_quiz_questions qq
       JOIN public.course_questions q ON q.id = qq.question_id
       WHERE qq.quiz_id = $1;`,
      [attempt.quiz_id]
    );

    const answersRes = await tx.query<CourseQuizAnswerItem>(
      `SELECT * FROM public.course_quiz_answers WHERE attempt_id = $1;`,
      [attemptId]
    );
    const answerMap = new Map(answersRes.rows.map((a) => [a.question_id, a]));

    let pointsEarned = 0;
    let pointsPossible = 0;
    let hasManualGrading = false;

    for (const q of questionsRes.rows) {
      pointsPossible += q.points;
      const ans = answerMap.get(q.id);

      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        const chosen = ans?.answer_data?.selectedOptionId;
        const correct = Array.isArray(q.correct_answers) ? q.correct_answers[0] : null;
        const isCorrect = Boolean(chosen && correct && chosen === correct);
        const pts = isCorrect ? q.points : 0;
        pointsEarned += pts;

        if (ans) {
          await tx.query(
            `UPDATE public.course_quiz_answers SET is_correct = $1, points_awarded = $2 WHERE id = $3;`,
            [isCorrect, pts, ans.id]
          );
        }
      } else if (q.type === 'multiple_select') {
        const chosen = Array.isArray(ans?.answer_data?.selectedOptionIds) ? ans?.answer_data?.selectedOptionIds : [];
        const correct = Array.isArray(q.correct_answers) ? q.correct_answers : [];
        const isMatch = chosen.length === correct.length && chosen.every((c: string) => correct.includes(c));
        const pts = isMatch ? q.points : 0;
        pointsEarned += pts;

        if (ans) {
          await tx.query(
            `UPDATE public.course_quiz_answers SET is_correct = $1, points_awarded = $2 WHERE id = $3;`,
            [isMatch, pts, ans.id]
          );
        }
      } else {
        hasManualGrading = true;
      }
    }

    const scorePercent = pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 100;
    const isPassed = scorePercent >= quiz.passing_score;
    const nextStatus = hasManualGrading ? 'submitted' : 'graded';

    const res = await tx.query<CourseQuizAttemptItem>(
      `UPDATE public.course_quiz_attempts
       SET status = $1,
           submitted_at = NOW(),
           score_percent = $2,
           points_earned = $3,
           points_possible = $4,
           is_passed = $5
       WHERE id = $6
       RETURNING *;`,
      [nextStatus, scorePercent, pointsEarned, pointsPossible, isPassed, attemptId]
    );

    return res.rows[0];
  });
}

// ----------------------------------------------------------------------------
// PHASE 3: LEARNING PATHS & PREREQUISITES
// ----------------------------------------------------------------------------

export async function listLearningPaths(
  actorUserId: string | null,
  circleId: string
): Promise<LearningPathItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<LearningPathItem>(
      `SELECT lp.*,
              (SELECT COUNT(*)::int FROM public.learning_path_courses lpc WHERE lpc.path_id = lp.id) AS courses_count
       FROM public.learning_paths lp
       WHERE lp.circle_id = $1 AND lp.status = 'published'
       ORDER BY lp.sort_order ASC, lp.created_at DESC;`,
      [circleId]
    );
    return res.rows;
  });
}

export async function getLearningPathWithCourses(
  actorUserId: string | null,
  circleId: string,
  pathIdOrSlug: string
): Promise<LearningPathItem & { courses: LearningPathCourseItem[] }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathIdOrSlug);
    const pathRes = await tx.query<LearningPathItem>(
      `SELECT * FROM public.learning_paths
       WHERE circle_id = $1 AND ${isUuid ? 'id = $2' : 'slug = $2'}
       LIMIT 1;`,
      [circleId, pathIdOrSlug]
    );
    const path = pathRes.rows[0];
    if (!path) throw new NotFoundError('Learning path not found.');

    // Fetch courses in path
    const coursesRes = await tx.query<LearningPathCourseItem & { course_title: string; course_slug: string }>(
      `SELECT lpc.*, c.title AS course_title, c.slug AS course_slug
       FROM public.learning_path_courses lpc
       JOIN public.courses c ON c.id = lpc.course_id
       WHERE lpc.path_id = $1
       ORDER BY lpc.sort_order ASC;`,
      [path.id]
    );

    // Check user enrollment
    let enrollment: LearningPathEnrollmentItem | null = null;
    if (actorUserId) {
      const enrRes = await tx.query<LearningPathEnrollmentItem>(
        `SELECT * FROM public.learning_path_enrollments WHERE path_id = $1 AND user_id = $2 LIMIT 1;`,
        [path.id, actorUserId]
      );
      enrollment = enrRes.rows[0] || null;
    }

    const coursesWithPrereqs = await Promise.all(
      coursesRes.rows.map(async (row) => {
        const prereqEval = await evaluatePrerequisitesWithTx(tx, actorUserId, circleId, row.course_id);
        return {
          ...row,
          is_locked: prereqEval.isLocked,
          lock_reason: prereqEval.lockReason || null,
          course: {
            id: row.course_id,
            title: row.course_title,
            slug: row.course_slug,
          } as unknown as CourseItem,
        };
      })
    );

    return {
      ...path,
      user_enrollment: enrollment,
      courses: coursesWithPrereqs,
    };
  });
}

export async function createLearningPath(
  actorUserId: string,
  circleId: string,
  input: {
    title: string;
    slug: string;
    description?: string;
    thumbnailUrl?: string | null;
    difficultyLevel?: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
    estimatedHours?: number;
    certificateTitle?: string | null;
  }
): Promise<LearningPathItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const id = crypto.randomUUID();
    const res = await tx.query<LearningPathItem>(
      `INSERT INTO public.learning_paths (
         id, circle_id, title, slug, description, thumbnail_url,
         difficulty_level, estimated_hours, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published')
       RETURNING *;`,
      [
        id,
        circleId,
        input.title.trim(),
        input.slug.trim().toLowerCase(),
        input.description?.trim() || '',
        input.thumbnailUrl || null,
        input.difficultyLevel || 'all_levels',
        input.estimatedHours || 0,
      ]
    );
    return res.rows[0];
  });
}

export async function addCourseToLearningPath(
  actorUserId: string,
  circleId: string,
  input: {
    pathId?: string;
    learningPathId?: string;
    courseId: string;
    sortOrder?: number;
    stepOrder?: number;
    isRequired?: boolean;
  }
): Promise<LearningPathCourseItem> {
  const targetPathId = input.pathId || input.learningPathId;
  if (!targetPathId) throw new ValidationError('pathId is required.');

  return withRlsTransaction(actorUserId, async (tx) => {
    const id = crypto.randomUUID();
    const res = await tx.query<LearningPathCourseItem>(
      `INSERT INTO public.learning_path_courses (
         id, path_id, course_id, circle_id, sort_order, is_required
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (path_id, course_id)
       DO UPDATE SET sort_order = EXCLUDED.sort_order, is_required = EXCLUDED.is_required
       RETURNING *;`,
      [
        id,
        targetPathId,
        input.courseId,
        circleId,
        input.sortOrder ?? input.stepOrder ?? 1,
        input.isRequired !== false,
      ]
    );
    return res.rows[0];
  });
}

export async function addCoursePrerequisite(
  actorUserId: string,
  circleId: string,
  input: {
    courseId: string;
    prerequisiteCourseId: string;
    minScorePercent?: number | null;
    minPassingScore?: number | null;
  }
): Promise<CoursePrerequisiteItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const id = crypto.randomUUID();
    const res = await tx.query<CoursePrerequisiteItem>(
      `INSERT INTO public.course_prerequisites (
         id, circle_id, course_id, prerequisite_course_id, min_score_percent
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (course_id, prerequisite_course_id)
       DO UPDATE SET min_score_percent = EXCLUDED.min_score_percent
       RETURNING *;`,
      [
        id,
        circleId,
        input.courseId,
        input.prerequisiteCourseId,
        input.minScorePercent ?? input.minPassingScore ?? 70,
      ]
    );
    return res.rows[0];
  });
}

async function evaluatePrerequisitesWithTx(
  tx: DbTransaction,
  actorUserId: string | null,
  circleId: string,
  courseId: string
): Promise<{ isLocked: boolean; lockReason?: string; unsatisfiedPrerequisites: CoursePrerequisiteItem[] }> {
  const prereqRes = await tx.query<CoursePrerequisiteItem & { prereq_title: string }>(
    `SELECT cp.*, c.title AS prereq_title
     FROM public.course_prerequisites cp
     JOIN public.courses c ON c.id = cp.prerequisite_course_id
     WHERE cp.circle_id = $1 AND cp.course_id = $2;`,
    [circleId, courseId]
  );

  if (prereqRes.rows.length === 0) {
    return { isLocked: false, unsatisfiedPrerequisites: [] };
  }

  if (!actorUserId) {
    return {
      isLocked: true,
      lockReason: `Requires completion of ${prereqRes.rows[0].prereq_title}. Sign in to check your progress.`,
      unsatisfiedPrerequisites: prereqRes.rows,
    };
  }

  // Check student completion for each prerequisite
  const unsatisfied: CoursePrerequisiteItem[] = [];
  for (const prereq of prereqRes.rows) {
    const countRes = await tx.query<{ total: string; completed: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM public.course_lessons WHERE course_id = $1 AND status = 'published') AS total,
         (SELECT COUNT(*)::text FROM public.course_lesson_completions WHERE course_id = $1 AND user_id = $2) AS completed;`,
      [prereq.prerequisite_course_id, actorUserId]
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const completed = parseInt(countRes.rows[0]?.completed || '0', 10);

    if (total === 0 || completed < total) {
      unsatisfied.push({
        ...prereq,
        prerequisite_course_title: prereq.prereq_title,
        is_satisfied: false,
      });
    }
  }

  if (unsatisfied.length > 0) {
    return {
      isLocked: true,
      lockReason: `Locked until prerequisite course "${unsatisfied[0].prerequisite_course_title}" is completed.`,
      unsatisfiedPrerequisites: unsatisfied,
    };
  }

  return { isLocked: false, unsatisfiedPrerequisites: [] };
}

export async function evaluateCoursePrerequisites(
  actorUserId: string | null,
  circleId: string,
  courseId: string
): Promise<{ isLocked: boolean; lockReason?: string; unsatisfiedPrerequisites: CoursePrerequisiteItem[] }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    return evaluatePrerequisitesWithTx(tx, actorUserId, circleId, courseId);
  });
}
