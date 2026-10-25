import { NextRequest, NextResponse } from 'next/server';
import {
  createComment,
  deletePost,
  getPostWithComments,
  saveItem,
  toggleReaction,
  updatePost,
} from '@/features/discussions/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string; postId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const result = await getPostWithComments(user?.id ?? null, params.circleId, params.postId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string; postId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const action = body.action as string;

    if (action === 'comment') {
      const comment = await createComment(user.id, {
        circleId: params.circleId,
        postId: params.postId,
        body: body.body,
      });
      return NextResponse.json({ comment }, { status: 201 });
    }

    if (action === 'react') {
      const reaction = await toggleReaction(
        user.id,
        params.circleId,
        params.postId,
        body.reactionType || 'like'
      );
      return NextResponse.json(reaction);
    }

    if (action === 'save') {
      const saved = await saveItem(user.id, params.circleId, params.postId);
      return NextResponse.json(saved);
    }

    throw new ValidationError('Invalid post interaction action.');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string; postId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const post = await updatePost(user.id, params.circleId, params.postId, body);
    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { circleId: string; postId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    await deletePost(user.id, params.circleId, params.postId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
