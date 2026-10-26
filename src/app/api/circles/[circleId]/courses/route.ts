import { NextRequest, NextResponse } from 'next/server';
import {
  createCourse,
  createLesson,
  createModule,
  listCourses,
} from '@/features/courses/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
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
