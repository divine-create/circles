import { NextRequest, NextResponse } from 'next/server';
import {
  createCommunityChallenge,
  createFundraisingCampaign,
  createFundraisingPledge,
  createGovernanceProposal,
  createSupportTicket,
  decideGovernanceProposal,
  listCommunityChallenges,
  listFundraisingCampaigns,
  listGovernanceProposals,
  listSupportTickets,
  reviewChallengeSubmission,
  submitChallengeEntry,
  updateSupportTicket,
} from '@/features/governance/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section') || 'all';

    const response: Record<string, unknown> = {};

    if (section === 'proposals' || section === 'all') {
      try {
        response.proposals = await listGovernanceProposals(user?.id ?? null, params.circleId);
      } catch {
        response.proposals = [];
      }
    }

    if (section === 'campaigns' || section === 'all') {
      try {
        response.campaigns = await listFundraisingCampaigns(user?.id ?? null, params.circleId);
      } catch {
        response.campaigns = [];
      }
    }

    if (section === 'challenges' || section === 'all') {
      try {
        const challengeData = await listCommunityChallenges(user?.id ?? null, params.circleId);
        response.challenges = challengeData.challenges;
        response.submissions = challengeData.submissions;
      } catch {
        response.challenges = [];
        response.submissions = [];
      }
    }

    if ((section === 'tickets' || section === 'all') && user) {
      try {
        response.tickets = await listSupportTickets(user.id, params.circleId);
      } catch {
        response.tickets = [];
      }
    }

    return NextResponse.json(response);
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

    if (body.action === 'create_proposal') {
      const proposal = await createGovernanceProposal(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ proposal }, { status: 201 });
    }

    if (body.action === 'create_campaign') {
      const campaign = await createFundraisingCampaign(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ campaign }, { status: 201 });
    }

    if (body.action === 'create_pledge') {
      if (!body.campaignId) throw new ValidationError('campaignId is required.');
      const pledge = await createFundraisingPledge(
        user.id,
        params.circleId,
        String(body.campaignId),
        {
          pledgeAmount: Number(body.pledgeAmount),
          message: body.message,
        }
      );
      return NextResponse.json({ pledge }, { status: 201 });
    }

    if (body.action === 'create_challenge') {
      const challenge = await createCommunityChallenge(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ challenge }, { status: 201 });
    }

    if (body.action === 'submit_challenge') {
      if (!body.challengeId) throw new ValidationError('challengeId is required.');
      const submission = await submitChallengeEntry(
        user.id,
        params.circleId,
        String(body.challengeId),
        {
          submissionText: body.submissionText,
          proofUrl: body.proofUrl,
        }
      );
      return NextResponse.json({ submission }, { status: 201 });
    }

    if (body.action === 'create_ticket') {
      const ticket = await createSupportTicket(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ ticket }, { status: 201 });
    }

    throw new ValidationError('Invalid governance/community action.');
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

    if (body.action === 'decide_proposal') {
      if (!body.proposalId) throw new ValidationError('proposalId is required.');
      const proposal = await decideGovernanceProposal(
        user.id,
        params.circleId,
        String(body.proposalId),
        {
          status: body.status,
          decisionRationale: body.decisionRationale,
        }
      );
      return NextResponse.json({ proposal });
    }

    if (body.action === 'review_challenge_submission') {
      if (!body.submissionId) throw new ValidationError('submissionId is required.');
      const submission = await reviewChallengeSubmission(
        user.id,
        params.circleId,
        String(body.submissionId),
        {
          status: body.status,
          awardedPoints: body.awardedPoints,
          awardedBadge: body.awardedBadge,
        }
      );
      return NextResponse.json({ submission });
    }

    if (body.action === 'update_ticket') {
      if (!body.ticketId) throw new ValidationError('ticketId is required.');
      const ticket = await updateSupportTicket(
        user.id,
        params.circleId,
        String(body.ticketId),
        {
          status: body.status,
          assignedTo: body.assignedTo,
          resolutionNotes: body.resolutionNotes,
        }
      );
      return NextResponse.json({ ticket });
    }

    throw new ValidationError('Invalid governance/community update action.');
  } catch (error) {
    return handleApiError(error);
  }
}
