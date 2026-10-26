import { NextRequest, NextResponse } from 'next/server';
import { toggleLessonCompletion } from '@/features/courses/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    if (!body.lessonId) {
      throw new ValidationError('lessonId is required.');
    }
    const completed = body.completed !== false;

    const progress = await toggleLessonCompletion(
      user.id,
      params.circleId,
      params.courseId,
      String(body.lessonId),
      completed
    );

    return NextResponse.json({ progress });
  } catch (error) {
    return handleApiError(error);
  }
}
