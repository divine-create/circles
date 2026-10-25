import { NextRequest, NextResponse } from 'next/server';
import { getCircleBySlugOrId, updateCircle } from '@/features/circles/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const circle = await getCircleBySlugOrId(user?.id ?? null, params.circleId);
    if (!circle) {
      throw new NotFoundError('Circle not found or private.');
    }
    return NextResponse.json({ circle });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const circle = await updateCircle(user.id, params.circleId, body);
    return NextResponse.json({ circle });
  } catch (error) {
    return handleApiError(error);
  }
}
