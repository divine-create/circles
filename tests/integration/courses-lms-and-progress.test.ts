import { describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { joinPublicCircle } from '@/features/memberships/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import {
  awardMemberXp,
  createCourse,
  createCourseAssignment,
  createLesson,
  createLessonComment,
  createModule,
  enrollInCourse,
  getCircleLeaderboard,
  getCourseWithCurriculum,
  getMemberXpSummary,
  listCourses,
  listLessonComments,
  reviewAssignmentSubmission,
  submitAssignment,
  toggleLessonCompletion,
  updateCourse,
} from '@/features/courses/service';
import { withRlsTransaction } from '@/lib/db/postgres';
import { CapabilityDisabledError, ForbiddenError, NotFoundError } from '@/lib/errors';

describe('Courses, LMS Curriculum & Student Learning Progress Integration Suite', () => {
  it('enforces full course lifecycle, syllabus hierarchy, student progress tracking, and RLS multi-tenant boundaries', async () => {
    const suffix = Date.now();
    const owner = (
      await registerUser({
        email: `instructor-${suffix}@example.com`,
        username: `instructor_${suffix}`,
        displayName: 'Lead Instructor',
        password: 'Password123!',
      })
    ).user;

    const student = (
      await registerUser({
        email: `student-${suffix}@example.com`,
        username: `student_${suffix}`,
        displayName: 'Active Student',
        password: 'Password123!',
      })
    ).user;

    const outsider = (
      await registerUser({
        email: `outsider-${suffix}@example.com`,
        username: `outsider_${suffix}`,
        displayName: 'Outsider User',
        password: 'Password123!',
      })
    ).user;

    // 1. Create Circle
    const circle = await createCircle(owner.id, {
      name: `Academy Circle ${suffix}`,
      slug: `academy-${suffix}`,
      description: 'Online school for software engineering.',
      category: 'creator',
      visibility: 'public',
    });

    // Add student as active member
    await joinPublicCircle(student.id, circle.id);

    // Course creation fails if learning_resources capability is disabled
    await expect(
      createCourse(owner.id, {
        circleId: circle.id,
        title: 'Full-Stack Modern Web Development',
        slug: 'full-stack-web-dev',
        description: 'Comprehensive curriculum from scratch to production.',
        difficultyLevel: 'intermediate',
        estimatedDurationHours: 12.5,
      })
    ).rejects.toThrow(CapabilityDisabledError);

    // 2. Enable learning_resources capability
    await updateCircleCapability(owner.id, circle.id, 'spaces', true);
    await updateCircleCapability(owner.id, circle.id, 'learning_resources', true);

    // Outsider cannot create course
    await expect(
      createCourse(outsider.id, {
        circleId: circle.id,
        title: 'Hacked Course',
        slug: 'hacked-course',
        description: 'Should fail',
      })
    ).rejects.toThrow(ForbiddenError);

    // 3. Instructor creates Course
    const course = await createCourse(owner.id, {
      circleId: circle.id,
      title: 'Full-Stack Modern Web Development',
      slug: 'full-stack-web-dev',
      description: 'Comprehensive curriculum from scratch to production.',
      difficultyLevel: 'intermediate',
      estimatedDurationHours: 12.5,
    });
    expect(course.id).toBeDefined();
    expect(course.title).toBe('Full-Stack Modern Web Development');

    // 4. Instructor creates Modules
    const module1 = await createModule(owner.id, {
      circleId: circle.id,
      courseId: course.id,
      title: 'Module 1: Architecture & Foundations',
      description: 'Learn modern software patterns and architecture.',
      sortOrder: 1,
    });
    expect(module1.id).toBeDefined();

    const module2 = await createModule(owner.id, {
      circleId: circle.id,
      courseId: course.id,
      title: 'Module 2: Database Design & RLS',
      description: 'Multi-tenant database design with PostgreSQL.',
      sortOrder: 2,
    });

    // 5. Instructor creates Lessons
    const lesson1 = await createLesson(owner.id, {
      circleId: circle.id,
      courseId: course.id,
      moduleId: module1.id,
      title: '1.1 System Architecture Overview',
      slug: 'system-architecture-overview',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      durationMinutes: 18,
      contentBody: 'In this lesson we cover the modular monolith architecture.',
      sortOrder: 1,
    });
    expect(lesson1.id).toBeDefined();

    const lesson2 = await createLesson(owner.id, {
      circleId: circle.id,
      courseId: course.id,
      moduleId: module1.id,
      title: '1.2 TypeScript Strict Conventions',
      slug: 'typescript-strict-conventions',
      durationMinutes: 22,
      contentBody: 'Enforcing strict type boundaries across API and services.',
      sortOrder: 2,
    });

    const lesson3 = await createLesson(owner.id, {
      circleId: circle.id,
      courseId: course.id,
      moduleId: module2.id,
      title: '2.1 Row-Level Security in Practice',
      slug: 'rls-in-practice',
      durationMinutes: 30,
      contentBody: 'Writing defensive RLS policies with anti-IDOR checks.',
      sortOrder: 1,
    });

    // 6. Verify Course with full Curriculum syllabus
    const fullCourse = await getCourseWithCurriculum(student.id, circle.id, course.id);
    expect(fullCourse.modules?.length).toBe(2);
    expect(fullCourse.total_lessons_count).toBe(3);
    expect(fullCourse.completed_lessons_count).toBe(0);
    expect(fullCourse.progress_percentage).toBe(0);

    // 7. Student Progress Tracking
    // Outsider cannot toggle completion
    await expect(
      toggleLessonCompletion(outsider.id, circle.id, course.id, lesson1.id, true)
    ).rejects.toThrow(ForbiddenError);

    // Student completes Lesson 1.1
    const progress1 = await toggleLessonCompletion(
      student.id,
      circle.id,
      course.id,
      lesson1.id,
      true
    );
    expect(progress1.completed_lessons).toBe(1);
    expect(progress1.total_lessons).toBe(3);
    expect(progress1.progress_percentage).toBe(33);
    expect(progress1.next_lesson_id).toBe(lesson2.id);

    // Student completes Lesson 1.2
    const progress2 = await toggleLessonCompletion(
      student.id,
      circle.id,
      course.id,
      lesson2.id,
      true
    );
    expect(progress2.completed_lessons).toBe(2);
    expect(progress2.progress_percentage).toBe(67);
    expect(progress2.next_lesson_id).toBe(lesson3.id);

    // Verify course curriculum now reflects completed lessons
    const courseAfterCompletions = await getCourseWithCurriculum(
      student.id,
      circle.id,
      course.id
    );
    expect(courseAfterCompletions.completed_lessons_count).toBe(2);
    expect(courseAfterCompletions.progress_percentage).toBe(67);
    expect(courseAfterCompletions.modules?.[0]?.lessons[0]?.is_completed).toBe(true);
    expect(courseAfterCompletions.modules?.[0]?.lessons[1]?.is_completed).toBe(true);
    expect(courseAfterCompletions.modules?.[1]?.lessons[0]?.is_completed).toBe(false);

    // Student unmarks Lesson 1.1
    const progress3 = await toggleLessonCompletion(
      student.id,
      circle.id,
      course.id,
      lesson1.id,
      false
    );
    expect(progress3.completed_lessons).toBe(1);
    expect(progress3.progress_percentage).toBe(33);

    // 8. In-Lesson Contextual Discussions
    const comment1 = await createLessonComment(student.id, {
      circleId: circle.id,
      courseId: course.id,
      lessonId: lesson1.id,
      body: 'Should we use strict type-checking in all database boundary functions?',
    });
    expect(comment1.id).toBeDefined();

    // Outsider cannot comment
    await expect(
      createLessonComment(outsider.id, {
        circleId: circle.id,
        courseId: course.id,
        lessonId: lesson1.id,
        body: 'Spam comment',
      })
    ).rejects.toThrow(ForbiddenError);

    const comments = await listLessonComments(student.id, circle.id, course.id, lesson1.id);
    expect(comments.length).toBe(1);
    expect(comments[0]?.body).toContain('strict type-checking');

    // 9. Homework & Assignment Submissions
    // Instructor creates assignment
    const assignment = await createCourseAssignment(owner.id, {
      circleId: circle.id,
      courseId: course.id,
      lessonId: lesson1.id,
      title: 'Practical Exercise: Modular Monolith Design',
      promptBody: 'Submit your architectural diagram and directory structure.',
    });
    expect(assignment.id).toBeDefined();

    // Student submits assignment
    const submission = await submitAssignment(student.id, {
      circleId: circle.id,
      courseId: course.id,
      lessonId: lesson1.id,
      assignmentId: assignment.id,
      submissionBody: 'Here is my architecture repository link and notes.',
      attachmentUrl: 'https://github.com/student/arch-exercise',
      attachmentName: 'Repo Link',
    });
    expect(submission.id).toBeDefined();
    expect(submission.status).toBe('submitted');

    // Private student submission cannot be accessed by unrelated outsider under RLS
    await expect(
      withRlsTransaction(outsider.id, async (tx) => {
        const res = await tx.query(`SELECT * FROM public.course_assignment_submissions WHERE id = $1;`, [submission.id]);
        return res.rows;
      })
    ).resolves.toEqual([]);

    // Instructor reviews and grades submission
    const reviewed = await reviewAssignmentSubmission(owner.id, {
      circleId: circle.id,
      courseId: course.id,
      submissionId: submission.id,
      status: 'approved',
      gradeScore: 95,
      instructorFeedback: 'Excellent architecture separation and domain boundaries.',
    });
    expect(reviewed.status).toBe('approved');
    expect(reviewed.grade_score).toBe(95);

    // Student sees approved status and feedback in course curriculum
    const courseWithSubmission = await getCourseWithCurriculum(student.id, circle.id, course.id);
    const lesson1Data = courseWithSubmission.modules?.[0]?.lessons[0];
    expect(lesson1Data?.assignment?.user_submission?.status).toBe('approved');
    expect(lesson1Data?.assignment?.user_submission?.grade_score).toBe(95);

    // 10. Direct PostgreSQL RLS Anti-IDOR Test
    // Create another Circle
    const circleB = await createCircle(outsider.id, {
      name: `Other School ${suffix}`,
      slug: `other-school-${suffix}`,
      description: 'Second circle',
      category: 'creator',
      visibility: 'public',
    });
    await updateCircleCapability(outsider.id, circleB.id, 'spaces', true);
    await updateCircleCapability(outsider.id, circleB.id, 'learning_resources', true);

    // Outsider cannot insert modules into Circle A's course using Circle B's context
    await expect(
      withRlsTransaction(outsider.id, async (tx) => {
        await tx.query(
          `INSERT INTO public.course_modules (id, course_id, circle_id, title, sort_order)
           VALUES (gen_random_uuid(), $1, $2, 'Injected Module', 1);`,
          [course.id, circleB.id] // Mismatched circle_id vs course.circle_id
        );
      })
    ).rejects.toThrow();

    // 9. Non-Destructive Capability Disabling
    await updateCircleCapability(owner.id, circle.id, 'learning_resources', false);

    // Reading courses fails when capability is disabled
    await expect(listCourses(student.id, circle.id)).rejects.toThrow(CapabilityDisabledError);

    // Re-enabling restores access and preserves all courses, modules, and completion progress
    await updateCircleCapability(owner.id, circle.id, 'learning_resources', true);
    const restoredCourse = await getCourseWithCurriculum(student.id, circle.id, course.id);
    expect(restoredCourse.total_lessons_count).toBe(3);
    expect(restoredCourse.completed_lessons_count).toBe(1);
  });

  it('enforces drip content scheduling, gamification XP & levels, course access gating, and leaderboards', async () => {
    const suffix = Date.now() + 1;
    const instructor = (
      await registerUser({
        email: `inst-${suffix}@example.com`,
        username: `inst_${suffix}`,
        displayName: 'Gamification Instructor',
        password: 'Password123!',
      })
    ).user;

    const student1 = (
      await registerUser({
        email: `stud1-${suffix}@example.com`,
        username: `stud1_${suffix}`,
        displayName: 'Alice Student',
        password: 'Password123!',
      })
    ).user;

    const student2 = (
      await registerUser({
        email: `stud2-${suffix}@example.com`,
        username: `stud2_${suffix}`,
        displayName: 'Bob Student',
        password: 'Password123!',
      })
    ).user;

    const circle = await createCircle(instructor.id, {
      name: `Gamified Academy ${suffix}`,
      slug: `game-academy-${suffix}`,
      description: 'LMS with XP points, drip pacing, and access tiers.',
      category: 'creator',
      visibility: 'public',
    });
    await updateCircleCapability(instructor.id, circle.id, 'spaces', true);
    await updateCircleCapability(instructor.id, circle.id, 'learning_resources', true);

    await joinPublicCircle(student1.id, circle.id);
    await joinPublicCircle(student2.id, circle.id);

    // Initial XP is 0, Level 1
    const initialXp = await getMemberXpSummary(student1.id, circle.id);
    expect(initialXp.total_xp).toBe(0);
    expect(initialXp.current_level).toBe(1);

    // 1. Create a Beginner Course
    const course = await createCourse(instructor.id, {
      circleId: circle.id,
      title: 'Beginner Coding',
      slug: 'beginner-coding',
      description: 'Start here to earn XP.',
      accessRule: 'open',
    });

    // 2. Test Drip Scheduling on Modules
    const unlockTomorrow = new Date(Date.now() + 86400000).toISOString();
    const modInstant = await createModule(instructor.id, {
      circleId: circle.id,
      courseId: course.id,
      title: 'Module 1: Instant Start',
      sortOrder: 1,
      dripType: 'instant',
    });

    const modCalendar = await createModule(instructor.id, {
      circleId: circle.id,
      courseId: course.id,
      title: 'Module 2: Unlocks Tomorrow',
      sortOrder: 2,
      dripType: 'calendar_date',
      dripUnlockDate: unlockTomorrow,
    });

    const modRelative = await createModule(instructor.id, {
      circleId: circle.id,
      courseId: course.id,
      title: 'Module 3: 7 Days After Enrollment',
      sortOrder: 3,
      dripType: 'relative_days',
      dripDaysAfterEnrollment: 7,
    });

    const lesson1 = await createLesson(instructor.id, {
      circleId: circle.id,
      courseId: course.id,
      moduleId: modInstant.id,
      title: 'Lesson 1.1 Intro',
      slug: 'lesson-1-intro',
      durationMinutes: 10,
    });

    await createLesson(instructor.id, {
      circleId: circle.id,
      courseId: course.id,
      moduleId: modCalendar.id,
      title: 'Lesson 2.1 Advanced Concepts',
      slug: 'lesson-2-advanced',
      durationMinutes: 20,
    });

    // Student1 enrolls
    await enrollInCourse(student1.id, circle.id, course.id);

    // Student checks curriculum: modInstant is unlocked, modCalendar is locked, modRelative is locked
    const studentCurriculum = await getCourseWithCurriculum(student1.id, circle.id, course.id);
    const m1 = studentCurriculum.modules?.find((m) => m.id === modInstant.id);
    const m2 = studentCurriculum.modules?.find((m) => m.id === modCalendar.id);
    const m3 = studentCurriculum.modules?.find((m) => m.id === modRelative.id);
    expect(m1?.is_locked).toBe(false);
    expect(m2?.is_locked).toBe(true);
    expect(m3?.is_locked).toBe(true);

    // Instructor checks curriculum: instructors bypass drip locking
    const instructorCurriculum = await getCourseWithCurriculum(instructor.id, circle.id, course.id);
    const im2 = instructorCurriculum.modules?.find((m) => m.id === modCalendar.id);
    const im3 = instructorCurriculum.modules?.find((m) => m.id === modRelative.id);
    expect(im2?.is_locked).toBe(false);
    expect(im3?.is_locked).toBe(false);

    // 3. Test Gamification XP Point System
    // Completing lesson1 -> +10 XP
    await toggleLessonCompletion(student1.id, circle.id, course.id, lesson1.id, true);
    let xp = await getMemberXpSummary(student1.id, circle.id);
    expect(xp.total_xp).toBe(10);

    // Adding comment -> +5 XP
    await createLessonComment(student1.id, {
      circleId: circle.id,
      courseId: course.id,
      lessonId: lesson1.id,
      body: 'This lesson was super helpful!',
    });
    xp = await getMemberXpSummary(student1.id, circle.id);
    expect(xp.total_xp).toBe(15);

    // Add assignment to lesson1
    const assign = await createCourseAssignment(instructor.id, {
      circleId: circle.id,
      courseId: course.id,
      lessonId: lesson1.id,
      title: 'Homework 1',
      promptBody: 'Write your thoughts',
    });

    // Submitting homework -> +25 XP
    const sub = await submitAssignment(student1.id, {
      circleId: circle.id,
      courseId: course.id,
      assignmentId: assign.id,
      lessonId: lesson1.id,
      submissionBody: 'Here is my assignment submission.',
    });
    xp = await getMemberXpSummary(student1.id, circle.id);
    expect(xp.total_xp).toBe(40);

    // Reviewing and approving homework -> +50 XP
    await reviewAssignmentSubmission(instructor.id, {
      circleId: circle.id,
      courseId: course.id,
      submissionId: sub.id,
      status: 'approved',
      gradeScore: 100,
      instructorFeedback: 'Great work!',
    });
    xp = await getMemberXpSummary(student1.id, circle.id);
    expect(xp.total_xp).toBe(90);

    // Award +20 bonus XP via service to cross 100 XP threshold into Level 2
    await awardMemberXp(student1.id, circle.id, 20, 'discussion_post', crypto.randomUUID());
    xp = await getMemberXpSummary(student1.id, circle.id);
    expect(xp.total_xp).toBe(110);
    expect(xp.current_level).toBe(2);

    // 4. Test Course Access Gating (Level Gating)
    const masterclass = await createCourse(instructor.id, {
      circleId: circle.id,
      title: 'Masterclass (Level 2+ Required)',
      slug: 'masterclass-level-2',
      description: 'Exclusive to dedicated students.',
      accessRule: 'min_level',
      minLevelRequired: 2,
    });

    // Student2 has 0 XP (Level 1) and cannot enroll
    await expect(enrollInCourse(student2.id, circle.id, masterclass.id)).rejects.toThrow(
      ForbiddenError
    );

    const student2View = await getCourseWithCurriculum(student2.id, circle.id, masterclass.id);
    expect(student2View.viewer_can_access).toBe(false);
    expect(student2View.viewer_level).toBe(1);

    // Student1 has 110 XP (Level 2) and successfully enrolls
    const enrollment1 = await enrollInCourse(student1.id, circle.id, masterclass.id);
    expect(enrollment1.id).toBeDefined();

    const student1View = await getCourseWithCurriculum(student1.id, circle.id, masterclass.id);
    expect(student1View.viewer_can_access).toBe(true);
    expect(student1View.viewer_level).toBe(2);

    // 5. Anti-Tampering: Direct client insertion into public.member_xp_points is blocked by RLS
    await expect(
      withRlsTransaction(student2.id, async (tx) => {
        await tx.query(
          `INSERT INTO public.member_xp_points (id, circle_id, user_id, points, action_type)
           VALUES (gen_random_uuid(), $1, $2, 5000, 'hack');`,
          [circle.id, student2.id]
        );
      })
    ).rejects.toThrow();

    // 6. Leaderboard Ranking
    const leaderboard = await getCircleLeaderboard(student1.id, circle.id);
    expect(leaderboard.length).toBeGreaterThanOrEqual(1);
    expect(leaderboard[0].user_id).toBe(student1.id);
    expect(leaderboard[0].total_xp).toBe(110);
    expect(leaderboard[0].current_level).toBe(2);
    expect(leaderboard[0].rank).toBe(1);
  });
});
