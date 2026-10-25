import { NextRequest, NextResponse } from 'next/server';
import { createPost, listCirclePosts } from '@/features/discussions/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const spaceId = searchParams.get('spaceId') || null;
    const posts = await listCirclePosts(user?.id ?? null, params.circleId, { spaceId });
    return NextResponse.json({ posts });
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
    const post = await createPost(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
