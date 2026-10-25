import { NextRequest, NextResponse } from 'next/server';
import { updateUserProfile } from '@/features/auth/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const targetUserId = body.targetUserId || user.id;
    if (targetUserId !== user.id) {
      throw new ForbiddenError('You can only update your own profile.');
    }
    const updated = await updateUserProfile(user.id, user.id, body);
    return NextResponse.json({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
