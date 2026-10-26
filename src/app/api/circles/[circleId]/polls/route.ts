import { NextRequest, NextResponse } from 'next/server';
import {
  castPollVote,
  createCirclePoll,
  listCirclePolls,
  updatePollStatus,
} from '@/features/polls/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const polls = await listCirclePolls(user?.id ?? null, params.circleId);
    return NextResponse.json({ polls });
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
    if (body.action === 'vote') {
      if (!body.pollId) throw new ValidationError('pollId is required.');
      const poll = await castPollVote(user.id, params.circleId, String(body.pollId), {
        optionIds: Array.isArray(body.optionIds) ? body.optionIds : [],
      });
      return NextResponse.json({ poll });
    }

    const poll = await createCirclePoll(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ poll }, { status: 201 });
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
    if (!body.pollId) throw new ValidationError('pollId is required.');

    const poll = await updatePollStatus(user.id, params.circleId, String(body.pollId), {
      status: body.status,
      decisionSummary: body.decisionSummary,
    });
    return NextResponse.json({ poll });
  } catch (error) {
    return handleApiError(error);
  }
}
