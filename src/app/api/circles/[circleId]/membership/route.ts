import { NextRequest, NextResponse } from 'next/server';
import {
  acceptInvitation,
  approveJoinRequest,
  inviteToCircle,
  joinPublicCircle,
  leaveCircle,
  rejectJoinRequest,
  requestToJoinCircle,
  transferCircleOwnership,
  updateMemberRole,
} from '@/features/memberships/service';
import {
  checkRateLimit,
  handleApiError,
  resolveApiUser,
} from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    if (!checkRateLimit(`membership:${user.id}`, 30, 60_000)) {
      return NextResponse.json(
        { error: 'Too many membership requests. Please try again shortly.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === 'join') {
      const membership = await joinPublicCircle(user.id, params.circleId);
      return NextResponse.json({ membership }, { status: 201 });
    }

    if (action === 'request') {
      const joinRequest = await requestToJoinCircle(user.id, params.circleId, body.message || '');
      return NextResponse.json({ joinRequest }, { status: 201 });
    }

    if (action === 'invite') {
      const result = await inviteToCircle(user.id, params.circleId, body.email || '', body.role || 'member');
      return NextResponse.json(result, { status: 201 });
    }

    if (action === 'accept_invite') {
      const membership = await acceptInvitation(user.id, body.token || '');
      return NextResponse.json({ membership }, { status: 200 });
    }

    if (action === 'leave') {
      await leaveCircle(user.id, params.circleId);
      return NextResponse.json({ success: true });
    }

    throw new ValidationError(`Unsupported membership action: "${action}"`);
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
    const action = body.action as string;

    if (action === 'approve_request') {
      const membership = await approveJoinRequest(user.id, params.circleId, body.requestId);
      return NextResponse.json({ membership });
    }

    if (action === 'reject_request') {
      const joinRequest = await rejectJoinRequest(user.id, params.circleId, body.requestId, body.reviewNote || '');
      return NextResponse.json({ joinRequest });
    }

    if (action === 'update_role') {
      const membership = await updateMemberRole(user.id, params.circleId, body.targetUserId, body.role);
      return NextResponse.json({ membership });
    }

    if (action === 'transfer_ownership') {
      await transferCircleOwnership(user.id, params.circleId, body.newOwnerUserId);
      return NextResponse.json({ success: true });
    }

    throw new ValidationError(`Unsupported membership update action: "${action}"`);
  } catch (error) {
    return handleApiError(error);
  }
}
