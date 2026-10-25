import { NextRequest, NextResponse } from 'next/server';
import {
  archiveCircleSpace,
  createCircleSpace,
  listCircleSpaces,
  reorderCircleSpaces,
} from '@/features/spaces/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const spaces = await listCircleSpaces(user?.id ?? null, params.circleId);
    return NextResponse.json({ spaces });
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
    const space = await createCircleSpace(user.id, params.circleId, body);
    return NextResponse.json({ space }, { status: 201 });
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
    if (body.action === 'archive') {
      const space = await archiveCircleSpace(
        user.id,
        params.circleId,
        body.spaceId,
        Boolean(body.archived ?? true)
      );
      return NextResponse.json({ space });
    }
    if (body.action === 'reorder' && Array.isArray(body.orderedSpaceIds)) {
      await reorderCircleSpaces(user.id, params.circleId, body.orderedSpaceIds);
      return NextResponse.json({ success: true });
    }

    throw new ValidationError('Invalid space update action.');
  } catch (error) {
    return handleApiError(error);
  }
}
