import { NextRequest, NextResponse } from 'next/server';
import {
  createCourse,
  createCourseAssignment,
  createLesson,
  createLessonComment,
  createModule,
  enrollInCourse,
  getCircleLeaderboard,
  getMemberXpSummary,
  listCourses,
  listLessonComments,
  reviewAssignmentSubmission,
  submitAssignment,
  updateLessonBlocks,
  reorderCurriculum,
  duplicateLesson,
  validateCourseForPublishing,
  publishCourseVersion,
  listQuestionBanks,
  createQuestionBank,
  listBankQuestions,
  createBankQuestion,
  createCourseQuiz,
  getQuizWithQuestions,
  startQuizAttempt,
  submitQuizAnswer,
  finalizeQuizAttempt,
  listLearningPaths,
  getLearningPathWithCourses,
  createLearningPath,
  addCourseToLearningPath,
  addCoursePrerequisite,
  evaluateCoursePrerequisites,
} from '@/features/courses/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'leaderboard') {
      const leaderboard = await getCircleLeaderboard(
        user?.id ?? null,
        params.circleId
      );
      return NextResponse.json({ leaderboard });
    }

    if (mode === 'xp_summary') {
      if (!user) throw new UnauthorizedError();
      const summary = await getMemberXpSummary(user.id, params.circleId);
      return NextResponse.json({ summary });
    }

    if (mode === 'comments') {
      const courseId = searchParams.get('courseId');
      const lessonId = searchParams.get('lessonId');
      if (!courseId || !lessonId) {
        throw new ValidationError('courseId and lessonId are required.');
      }
      const comments = await listLessonComments(
        user?.id ?? null,
        params.circleId,
        courseId,
        lessonId
      );
      return NextResponse.json({ comments });
    }

    if (mode === 'question_banks') {
      if (!user) throw new UnauthorizedError();
      const banks = await listQuestionBanks(user.id, params.circleId);
      return NextResponse.json({ banks });
    }

    if (mode === 'bank_questions') {
      if (!user) throw new UnauthorizedError();
      const bankId = searchParams.get('bankId') || undefined;
      const questions = await listBankQuestions(user.id, params.circleId, bankId);
      return NextResponse.json({ questions });
    }

    if (mode === 'quiz') {
      const quizId = searchParams.get('quizId');
      if (!quizId) throw new ValidationError('quizId is required.');
      const quiz = await getQuizWithQuestions(user?.id ?? null, params.circleId, quizId);
      return NextResponse.json({ quiz });
    }

    if (mode === 'learning_paths') {
      const paths = await listLearningPaths(user?.id ?? null, params.circleId);
      return NextResponse.json({ paths });
    }

    if (mode === 'learning_path') {
      const pathId = searchParams.get('pathId');
      if (!pathId) throw new ValidationError('pathId is required.');
      const path = await getLearningPathWithCourses(user?.id ?? null, params.circleId, pathId);
      return NextResponse.json({ path });
    }

    if (mode === 'prereq_evaluation') {
      const courseId = searchParams.get('courseId');
      if (!courseId) throw new ValidationError('courseId is required.');
      const evaluation = await evaluateCoursePrerequisites(user?.id ?? null, params.circleId, courseId);
      return NextResponse.json({ evaluation });
    }

    const courses = await listCourses(user?.id ?? null, params.circleId);
    return NextResponse.json({ courses });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();

    if (body.action === 'enroll') {
      if (!body.courseId) throw new ValidationError('courseId is required.');
      const enrollment = await enrollInCourse(
        user.id,
        params.circleId,
        body.courseId
      );
      return NextResponse.json({ enrollment }, { status: 201 });
    }

    if (body.action === 'create_comment') {
      const comment = await createLessonComment(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ comment }, { status: 201 });
    }

    if (body.action === 'create_assignment') {
      const assignment = await createCourseAssignment(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ assignment }, { status: 201 });
    }

    if (body.action === 'submit_assignment') {
      const submission = await submitAssignment(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ submission }, { status: 201 });
    }

    if (body.action === 'review_submission') {
      const submission = await reviewAssignmentSubmission(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ submission });
    }

    if (body.action === 'create_module') {
      if (!body.courseId) throw new ValidationError('courseId is required.');
      const createdModule = await createModule(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ module: createdModule }, { status: 201 });
    }

    if (body.action === 'create_lesson') {
      if (!body.courseId || !body.moduleId) {
        throw new ValidationError('courseId and moduleId are required.');
      }
      const lesson = await createLesson(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ lesson }, { status: 201 });
    }

    if (body.action === 'update_lesson_blocks') {
      const updated = await updateLessonBlocks(user.id, params.circleId, body);
      return NextResponse.json({ lesson: updated });
    }

    if (body.action === 'reorder_curriculum') {
      if (!body.courseId) throw new ValidationError('courseId is required.');
      const res = await reorderCurriculum(user.id, params.circleId, body.courseId, body);
      return NextResponse.json(res);
    }

    if (body.action === 'duplicate_lesson') {
      if (!body.lessonId) throw new ValidationError('lessonId is required.');
      const lesson = await duplicateLesson(user.id, params.circleId, body.lessonId, body.targetModuleId);
      return NextResponse.json({ lesson }, { status: 201 });
    }

    if (body.action === 'validate_course') {
      if (!body.courseId) throw new ValidationError('courseId is required.');
      const validation = await validateCourseForPublishing(user.id, params.circleId, body.courseId);
      return NextResponse.json({ validation });
    }

    if (body.action === 'publish_version') {
      if (!body.courseId) throw new ValidationError('courseId is required.');
      const course = await publishCourseVersion(user.id, params.circleId, body.courseId);
      return NextResponse.json({ course });
    }

    if (body.action === 'create_question_bank') {
      const bank = await createQuestionBank(user.id, params.circleId, body);
      return NextResponse.json({ bank }, { status: 201 });
    }

    if (body.action === 'create_question') {
      const question = await createBankQuestion(user.id, params.circleId, body);
      return NextResponse.json({ question }, { status: 201 });
    }

    if (body.action === 'create_quiz') {
      const quiz = await createCourseQuiz(user.id, params.circleId, body);
      return NextResponse.json({ quiz }, { status: 201 });
    }

    if (body.action === 'start_quiz_attempt') {
      if (!body.quizId) throw new ValidationError('quizId is required.');
      const attempt = await startQuizAttempt(user.id, params.circleId, body.quizId);
      return NextResponse.json({ attempt }, { status: 201 });
    }

    if (body.action === 'submit_quiz_answer') {
      const answer = await submitQuizAnswer(user.id, params.circleId, body);
      return NextResponse.json({ answer });
    }

    if (body.action === 'finalize_quiz_attempt') {
      if (!body.attemptId) throw new ValidationError('attemptId is required.');
      const attempt = await finalizeQuizAttempt(user.id, params.circleId, body.attemptId);
      return NextResponse.json({ attempt });
    }

    if (body.action === 'create_learning_path') {
      const path = await createLearningPath(user.id, params.circleId, body);
      return NextResponse.json({ path }, { status: 201 });
    }

    if (body.action === 'add_path_course') {
      const pathCourse = await addCourseToLearningPath(user.id, params.circleId, body);
      return NextResponse.json({ pathCourse }, { status: 201 });
    }

    if (body.action === 'add_prerequisite') {
      const prereq = await addCoursePrerequisite(user.id, params.circleId, body);
      return NextResponse.json({ prerequisite: prereq }, { status: 201 });
    }

    const course = await createCourse(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

