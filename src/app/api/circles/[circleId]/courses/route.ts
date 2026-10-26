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

    if (searchParams.get('mode') === 'leaderboard') {
      const leaderboard = await getCircleLeaderboard(
        user?.id ?? null,
        params.circleId
      );
      return NextResponse.json({ leaderboard });
    }

    if (searchParams.get('mode') === 'xp_summary') {
      if (!user) throw new UnauthorizedError();
      const summary = await getMemberXpSummary(user.id, params.circleId);
      return NextResponse.json({ summary });
    }

    if (searchParams.get('mode') === 'comments') {
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

    const course = await createCourse(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

