import { NextRequest, NextResponse } from 'next/server';
import {
  getCourseWithCurriculum,
  updateCourse,
} from '@/features/courses/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const course = await getCourseWithCurriculum(
      user?.id ?? null,
      params.circleId,
      params.courseId
    );
    return NextResponse.json({ course });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const course = await updateCourse(
      user.id,
      params.circleId,
      params.courseId,
      body
    );
    return NextResponse.json({ course });
  } catch (error) {
    return handleApiError(error);
  }
}
