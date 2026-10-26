import { describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { joinPublicCircle } from '@/features/memberships/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import {
  createCourse,
  createModule,
  createLesson,
  getCourseWithCurriculum,
  listCourses,
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

    // 8. Direct PostgreSQL RLS Anti-IDOR Test
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
});
