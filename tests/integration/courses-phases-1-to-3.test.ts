import { describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import {
  createCourse,
  createModule,
  createLesson,
  updateLessonBlocks,
  duplicateLesson,
  validateCourseForPublishing,
  publishCourseVersion,
  createQuestionBank,
  listQuestionBanks,
  createBankQuestion,
  listBankQuestions,
  createCourseQuiz,
  getQuizWithQuestions,
  startQuizAttempt,
  submitQuizAnswer,
  finalizeQuizAttempt,
  createLearningPath,
  listLearningPaths,
  addCourseToLearningPath,
  getLearningPathWithCourses,
  addCoursePrerequisite,
  evaluateCoursePrerequisites,
  getCourseWithCurriculum,
} from '@/features/courses/service';
import { withRlsTransaction } from '@/lib/db/postgres';

describe('Courses LMS Phases 1-3: Flexible Blocks, Quizzes, Question Banks, and Learning Paths', () => {
  it('Phase 1: Updates flexible lesson blocks, duplicates lessons, validates pre-publish requirements, and publishes versions', async () => {
    const suffix = Date.now();
    const instructor = await registerUser({
      email: `instructor-${suffix}@example.com`,
      username: `instructor_${suffix}`,
      displayName: 'Lead Instructor',
      password: 'Password123!',
    });

    const circle = await createCircle(instructor.user.id, {
      name: `AI Academy ${suffix}`,
      slug: `ai-academy-${suffix}`,
      description: 'Community for AI engineering.',
    });

    await updateCircleCapability(instructor.user.id, circle.id, 'learning_resources', true);

    const course = await createCourse(instructor.user.id, {
      circleId: circle.id,
      title: 'Neural Networks & Deep Learning',
      slug: `neural-networks-${suffix}`,
      description: 'Master architectures from scratch.',
      difficultyLevel: 'intermediate',
      estimatedDurationHours: 4.5,
    });

    const module = await createModule(instructor.user.id, {
      circleId: circle.id,
      courseId: course.id,
      title: 'Module 1: Foundations',
      description: 'Backpropagation and tensors',
      sortOrder: 1,
    });

    const lesson = await createLesson(instructor.user.id, {
      circleId: circle.id,
      courseId: course.id,
      moduleId: module.id,
      title: '1.1 Gradient Descent',
      slug: `gradient-descent-${suffix}`,
      durationMinutes: 20,
      contentBody: 'Initial lesson notes',
      sortOrder: 1,
    });

    // 1. Update flexible multi-content blocks
    const updatedLesson = await updateLessonBlocks(instructor.user.id, circle.id, {
      lessonId: lesson.id,
      contentBlocks: [
        {
          id: 'blk-video-1',
          type: 'video',
          title: 'Gradient Descent Walkthrough',
          url: 'https://youtube.com/watch?v=12345678901',
          provider: 'youtube',
        },
        {
          id: 'blk-text-1',
          type: 'rich_text',
          markdown: '### Math formulation\n$$\\nabla J(\\theta)$$ is the parameter vector gradient.',
        },
        {
          id: 'blk-code-1',
          type: 'code_sandbox',
          language: 'python',
          starterCode: 'def step(w, lr, grad):\n    return w - lr * grad',
          instructions: 'Implement SGD parameter update step.',
        },
      ],
      learningObjectives: [
        'Derive vector cost functions',
        'Implement optimizer step in Python',
      ],
      instructorNotes: 'Watch for student questions regarding learning rate decay.',
      isOptional: false,
      publishNow: true,
    });

    expect(updatedLesson.content_blocks?.length).toBe(3);
    expect(updatedLesson.learning_objectives?.length).toBe(2);
    expect(updatedLesson.instructor_notes).toBe('Watch for student questions regarding learning rate decay.');

    // 2. Duplicate lesson
    const duplicated = await duplicateLesson(instructor.user.id, circle.id, lesson.id, module.id);
    expect(duplicated.title).toBe('1.1 Gradient Descent (Copy)');
    expect(duplicated.content_blocks?.length).toBe(3);

    // 3. Validate course before publishing
    const validation = await validateCourseForPublishing(instructor.user.id, circle.id, course.id);
    expect(validation.isValid).toBe(true);

    // 4. Publish course version
    const published = await publishCourseVersion(instructor.user.id, circle.id, course.id);
    expect(published.published_version).toBe(2);
  });

  it('Phase 2: Creates reusable question banks, builds quizzes, and runs student attempt with autograding', async () => {
    const suffix = Date.now();
    const instructor = await registerUser({
      email: `inst2-${suffix}@example.com`,
      username: `inst2_${suffix}`,
      displayName: 'Assessment Lead',
      password: 'Password123!',
    });

    const student = await registerUser({
      email: `student-${suffix}@example.com`,
      username: `student_${suffix}`,
      displayName: 'Enrolled Student',
      password: 'Password123!',
    });

    const circle = await createCircle(instructor.user.id, {
      name: `Assessment Academy ${suffix}`,
      slug: `assessment-academy-${suffix}`,
      description: 'Rigorous community testing.',
    });

    await updateCircleCapability(instructor.user.id, circle.id, 'learning_resources', true);

    const course = await createCourse(instructor.user.id, {
      circleId: circle.id,
      title: 'Full-Stack Architecture',
      slug: `fs-arch-${suffix}`,
      description: 'System design and patterns.',
    });

    const module = await createModule(instructor.user.id, {
      circleId: circle.id,
      courseId: course.id,
      title: 'Module 1: Caching & DBs',
      description: 'State management',
    });

    const lesson = await createLesson(instructor.user.id, {
      circleId: circle.id,
      courseId: course.id,
      moduleId: module.id,
      title: 'Cache Invalidation Quiz Lesson',
      slug: `caching-quiz-${suffix}`,
    });

    // 1. Create Question Bank & Questions
    const bank = await createQuestionBank(instructor.user.id, circle.id, {
      title: 'System Design Question Bank',
      description: 'Database patterns, cache strategies, and CAP theorem',
      category: 'Backend',
      tags: ['caching', 'redis', 'architecture'],
    });

    const q1 = await createBankQuestion(instructor.user.id, circle.id, {
      bankId: bank.id,
      type: 'multiple_choice',
      questionText: 'What is the primary trade-off of write-through caching?',
      points: 10,
      difficulty: 'intermediate',
      options: [
        { id: 'opt-a', text: 'Higher write latency' },
        { id: 'opt-b', text: 'Inconsistent reads' },
        { id: 'opt-c', text: 'Loss of data on power outage' },
      ],
      correctAnswers: ['opt-a'],
      explanation: 'Write-through writes to cache and DB simultaneously, increasing write latency.',
    });

    const q2 = await createBankQuestion(instructor.user.id, circle.id, {
      bankId: bank.id,
      type: 'true_false',
      questionText: 'PostgreSQL Row-Level Security executes at the database kernel level.',
      points: 10,
      difficulty: 'beginner',
      options: [
        { id: 'opt-true', text: 'True' },
        { id: 'opt-false', text: 'False' },
      ],
      correctAnswers: ['opt-true'],
      explanation: 'RLS policies are enforced directly inside PostgreSQL query planner and executor.',
    });

    // 2. Build Course Quiz
    const quiz = await createCourseQuiz(instructor.user.id, circle.id, {
      courseId: course.id,
      lessonId: lesson.id,
      title: 'Caching Strategies Mastery Check',
      description: 'Validate your understanding before advancing.',
      passingScore: 75,
      timeLimitMinutes: 15,
      questionIds: [q1.id, q2.id],
    });

    expect(quiz.title).toBe('Caching Strategies Mastery Check');

    // 3. Student views quiz (correct answers must be stripped for academic integrity)
    const studentQuizView = await getQuizWithQuestions(student.user.id, circle.id, quiz.id);
    expect(studentQuizView?.questions?.[0].correct_answers).toBeUndefined();

    // 4. Student starts attempt
    const attempt = await startQuizAttempt(student.user.id, circle.id, quiz.id);
    expect(attempt.status).toBe('in_progress');

    // 5. Submit answers
    await submitQuizAnswer(student.user.id, circle.id, {
      attemptId: attempt.id,
      questionId: q1.id,
      answerData: { selectedOptionId: 'opt-a' },
    });

    await submitQuizAnswer(student.user.id, circle.id, {
      attemptId: attempt.id,
      questionId: q2.id,
      answerData: { selectedOptionId: 'opt-true' },
    });

    // 6. Finalize attempt & verify autograding
    const finalized = await finalizeQuizAttempt(student.user.id, circle.id, attempt.id);
    expect(finalized.status).toBe('graded');
    expect(finalized.score_percent).toBe(100);
    expect(finalized.is_passed).toBe(true);
  });

  it('Phase 3: Creates structured Learning Path, enforces prerequisites, and displays "Why is this locked?"', async () => {
    const suffix = Date.now();
    const instructor = await registerUser({
      email: `path-inst-${suffix}@example.com`,
      username: `path_inst_${suffix}`,
      displayName: 'Path Director',
      password: 'Password123!',
    });

    const student = await registerUser({
      email: `path-student-${suffix}@example.com`,
      username: `path_student_${suffix}`,
      displayName: 'Bootcamp Learner',
      password: 'Password123!',
    });

    const circle = await createCircle(instructor.user.id, {
      name: `Coding Bootcamp ${suffix}`,
      slug: `bootcamp-${suffix}`,
      description: 'Accelerated track.',
    });

    await updateCircleCapability(instructor.user.id, circle.id, 'learning_resources', true);

    // Create 2 courses: Foundations and Capstone
    const course1 = await createCourse(instructor.user.id, {
      circleId: circle.id,
      title: 'Course 1: TypeScript Foundations',
      slug: `ts-foundations-${suffix}`,
      description: 'Core types and patterns.',
    });

    const course2 = await createCourse(instructor.user.id, {
      circleId: circle.id,
      title: 'Course 2: Enterprise Microservices',
      slug: `enterprise-services-${suffix}`,
      description: 'Advanced production scale.',
    });

    // 1. Create Learning Path
    const path = await createLearningPath(instructor.user.id, circle.id, {
      title: 'Full-Stack Software Engineer Career Track',
      slug: `swe-track-${suffix}`,
      description: 'From syntax to enterprise architectural mastery.',
      certificateTitle: 'Certified Full-Stack Software Engineer',
    });

    expect(path.title).toBe('Full-Stack Software Engineer Career Track');

    // 2. Add courses in sequence
    await addCourseToLearningPath(instructor.user.id, circle.id, {
      learningPathId: path.id,
      courseId: course1.id,
      stepOrder: 1,
      isRequired: true,
    });

    await addCourseToLearningPath(instructor.user.id, circle.id, {
      learningPathId: path.id,
      courseId: course2.id,
      stepOrder: 2,
      isRequired: true,
    });

    // 3. Add prerequisite: Course 2 requires Course 1
    await addCoursePrerequisite(instructor.user.id, circle.id, {
      courseId: course2.id,
      prerequisiteCourseId: course1.id,
      minPassingScore: 80,
    });

    // 4. Student evaluates prerequisites for Course 2 (should be locked with clear reason)
    const prereqEval = await evaluateCoursePrerequisites(student.user.id, circle.id, course2.id);
    expect(prereqEval.isLocked).toBe(true);
    expect(prereqEval.unsatisfiedPrerequisites.length).toBe(1);
    expect(prereqEval.unsatisfiedPrerequisites[0].prerequisite_course_title).toBe('Course 1: TypeScript Foundations');

    // 5. Inspect learning path with courses
    const pathDetail = await getLearningPathWithCourses(student.user.id, circle.id, path.id);
    expect(pathDetail?.courses?.length).toBe(2);

    const step2 = pathDetail?.courses?.find((c) => c.course_id === course2.id);
    expect(step2?.is_locked).toBe(true);
    expect(step2?.lock_reason).toContain('Course 1: TypeScript Foundations');
  });
});
