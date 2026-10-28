import { NextRequest, NextResponse } from 'next/server';
import {
  listConversationMessages,
  sendDirectMessage,
  sendMessageSchema,
} from '@/features/messages/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string; convoId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) {
      throw new UnauthorizedError('Authentication required to read messages.');
    }

    const messages = await listConversationMessages(
      user.id,
      params.circleId,
      params.convoId
    );
    return NextResponse.json({ messages });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string; convoId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) {
      throw new UnauthorizedError('Authentication required to send messages.');
    }

    const body = await req.json();
    const parsed = sendMessageSchema.parse(body);

    const message = await sendDirectMessage(
      user.id,
      params.circleId,
      params.convoId,
      parsed
    );
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
