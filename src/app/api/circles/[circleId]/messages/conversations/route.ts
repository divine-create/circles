import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateDirectConversation,
  listUserConversations,
  startConversationSchema,
} from '@/features/messages/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) {
      throw new UnauthorizedError('Authentication required to view conversations.');
    }

    const conversations = await listUserConversations(user.id, params.circleId);
    return NextResponse.json({ conversations });
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
    if (!user) {
      throw new UnauthorizedError('Authentication required to start a conversation.');
    }

    const body = await req.json();
    const parsed = startConversationSchema.parse(body);

    const conversation = await getOrCreateDirectConversation(
      user.id,
      params.circleId,
      parsed.targetUserId,
      parsed.listingId
    );

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
