import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  ChallengeSubmissionItem,
  CircleRole,
  CommunityChallengeItem,
  FundraisingCampaignItem,
  FundraisingPledgeItem,
  GovernanceProposalItem,
  MembershipStatus,
  SupportTicketItem,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import { createNotification } from '@/features/notifications/service';

export const createGovernanceProposalSchema = z.object({
  circleId: z.string().uuid(),
  committeeName: z.string().trim().max(120).nullable().optional(),
  title: z.string().trim().min(3).max(180),
  body: z.string().trim().min(5).max(10000),
});

export const decideGovernanceProposalSchema = z.object({
  status: z.enum(['under_review', 'approved', 'rejected', 'implemented', 'archived']),
  decisionRationale: z.string().trim().min(2).max(2000).optional(),
});

export const createFundraisingCampaignSchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(6000),
  goalAmount: z.number().positive().max(100000000),
  currency: z.string().trim().length(3).default('USD'),
  deadline: z.string().datetime().nullable().optional(),
});

export const createFundraisingPledgeSchema = z.object({
  pledgeAmount: z.number().positive().max(10000000),
  message: z.string().trim().max(500).default(''),
});

export const createChallengeSchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(4000),
  rules: z.string().trim().max(2000).default(''),
  rewardBadgeName: z.string().trim().min(2).max(80).default('Challenger'),
  rewardPoints: z.number().int().min(0).max(10000).default(50),
  endsAt: z.string().datetime().nullable().optional(),
});

export const submitChallengeEntrySchema = z.object({
  submissionText: z.string().trim().min(2).max(4000),
  proofUrl: z.string().url().nullable().optional(),
});

export const reviewChallengeSubmissionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  awardedPoints: z.number().int().min(0).max(10000).optional(),
  awardedBadge: z.string().trim().max(80).nullable().optional(),
});

export const createSupportTicketSchema = z.object({
  circleId: z.string().uuid(),
  category: z
    .enum(['general', 'technical', 'membership', 'mutual_aid', 'facilities'])
    .default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  isPrivate: z.boolean().default(true),
  subject: z.string().trim().min(3).max(180),
  description: z.string().trim().min(5).max(6000),
});

export const updateSupportTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().trim().max(4000).nullable().optional(),
});

// ============================================================================
// 1. GOVERNANCE PROPOSALS & COMMITTEES
// ============================================================================

export async function createGovernanceProposal(
  actorUserId: string,
  input: z.input<typeof createGovernanceProposalSchema>
): Promise<GovernanceProposalItem> {
  const parsed = createGovernanceProposalSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'governance_committees' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('governance_committees');
    }

    const inserted = await tx.query<GovernanceProposalItem>(
      `INSERT INTO public.governance_proposals (
         id, circle_id, proposer_id, committee_name, title, body, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'under_review')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.committeeName ?? null,
        parsed.title,
        parsed.body,
      ]
    );

    return inserted.rows[0];
  });
}

export async function decideGovernanceProposal(
  actorUserId: string,
  circleId: string,
  proposalId: string,
  input: z.input<typeof decideGovernanceProposalSchema>
): Promise<GovernanceProposalItem> {
  const parsed = decideGovernanceProposalSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenError(
        'Only Circle administrators or owners can record official governance decisions.'
      );
    }

    const updated = await tx.query<GovernanceProposalItem>(
      `UPDATE public.governance_proposals
       SET status = $1,
           decision_rationale = COALESCE($2, decision_rationale),
           decided_by = $3,
           decided_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND circle_id = $5
       RETURNING *;`,
      [parsed.status, parsed.decisionRationale ?? null, actorUserId, proposalId, circleId]
    );

    if (!updated.rows[0]) {
      throw new NotFoundError('Governance proposal not found.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'governance.decision_recorded', 'governance_proposal', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        proposalId,
        JSON.stringify({ status: parsed.status, rationale: parsed.decisionRationale }),
      ]
    );

    return updated.rows[0];
  });
}

export async function listGovernanceProposals(
  actorUserId: string | null,
  circleId: string
): Promise<GovernanceProposalItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'governance_committees' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('governance_committees');
    }

    const res = await tx.query<
      GovernanceProposalItem & {
        proposer_username: string;
        proposer_display_name: string;
      }
    >(
      `SELECT g.*,
         COALESCE(u.username, 'member') AS proposer_username,
         COALESCE(u.display_name, 'Member') AS proposer_display_name
       FROM public.governance_proposals g
       LEFT JOIN public.profiles u ON u.id = g.proposer_id
       WHERE g.circle_id = $1
       ORDER BY g.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      proposer_id: r.proposer_id,
      committee_name: r.committee_name,
      title: r.title,
      body: r.body,
      status: r.status,
      decision_rationale: r.decision_rationale,
      decided_by: r.decided_by,
      decided_at: r.decided_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      proposer: {
        id: r.proposer_id,
        username: r.proposer_username,
        display_name: r.proposer_display_name,
      },
    }));
  });
}

// ============================================================================
// 2. FUNDRAISING CAMPAIGNS & COMMUNITY PLEDGES (INTENTIONS)
// ============================================================================

export async function createFundraisingCampaign(
  actorUserId: string,
  input: z.input<typeof createFundraisingCampaignSchema>
): Promise<FundraisingCampaignItem> {
  const parsed = createFundraisingCampaignSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'fundraising_causes' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('fundraising_causes');
    }

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenError(
        'Only Circle administrators or owners can launch fundraising campaigns.'
      );
    }

    const res = await tx.query<FundraisingCampaignItem>(
      `INSERT INTO public.fundraising_campaigns (
         id, circle_id, creator_id, title, description, goal_amount, currency, deadline, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.title,
        parsed.description,
        parsed.goalAmount,
        parsed.currency.toUpperCase(),
        parsed.deadline ?? null,
      ]
    );

    return {
      ...res.rows[0],
      goal_amount: Number(res.rows[0].goal_amount),
      pledged_total: 0,
      pledge_count: 0,
    };
  });
}

export async function createFundraisingPledge(
  actorUserId: string,
  circleId: string,
  campaignId: string,
  input: z.input<typeof createFundraisingPledgeSchema>
): Promise<FundraisingPledgeItem> {
  const parsed = createFundraisingPledgeSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'fundraising_causes' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('fundraising_causes');
    }

    const res = await tx.query<FundraisingPledgeItem>(
      `INSERT INTO public.fundraising_pledges (
         id, campaign_id, circle_id, pledger_id, pledge_amount, message, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'pledged')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        campaignId,
        circleId,
        actorUserId,
        parsed.pledgeAmount,
        parsed.message,
      ]
    );

    return {
      ...res.rows[0],
      pledge_amount: Number(res.rows[0].pledge_amount),
    };
  });
}

export async function listFundraisingCampaigns(
  actorUserId: string | null,
  circleId: string
): Promise<FundraisingCampaignItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'fundraising_causes' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('fundraising_causes');
    }

    const res = await tx.query<
      FundraisingCampaignItem & {
        pledged_total: string | number;
        pledge_count: number;
      }
    >(
      `SELECT c.*,
         COALESCE(
           (SELECT SUM(p.pledge_amount) FROM public.fundraising_pledges p
            WHERE p.campaign_id = c.id AND p.status IN ('pledged', 'fulfilled_verified')),
           0
         ) AS pledged_total,
         (SELECT COUNT(*)::int FROM public.fundraising_pledges p
          WHERE p.campaign_id = c.id AND p.status IN ('pledged', 'fulfilled_verified')) AS pledge_count
       FROM public.fundraising_campaigns c
       WHERE c.circle_id = $1
       ORDER BY c.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      creator_id: r.creator_id,
      title: r.title,
      description: r.description,
      goal_amount: Number(r.goal_amount),
      currency: r.currency,
      deadline: r.deadline,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      pledged_total: Number(r.pledged_total ?? 0),
      pledge_count: Number(r.pledge_count ?? 0),
    }));
  });
}

// ============================================================================
// 3. CHALLENGES, SUBMISSIONS & REWARDS
// ============================================================================

export async function createCommunityChallenge(
  actorUserId: string,
  input: z.input<typeof createChallengeSchema>
): Promise<CommunityChallengeItem> {
  const parsed = createChallengeSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'challenges_rewards' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('challenges_rewards');
    }

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (
      !membership ||
      membership.status !== 'active' ||
      !['owner', 'admin', 'moderator'].includes(membership.role)
    ) {
      throw new ForbiddenError(
        'Only Circle moderators, administrators, or owners can create community challenges.'
      );
    }

    const res = await tx.query<CommunityChallengeItem>(
      `INSERT INTO public.community_challenges (
         id, circle_id, creator_id, title, description, rules,
         reward_badge_name, reward_points, ends_at, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.title,
        parsed.description,
        parsed.rules,
        parsed.rewardBadgeName,
        parsed.rewardPoints,
        parsed.endsAt ?? null,
      ]
    );

    return res.rows[0];
  });
}

export async function submitChallengeEntry(
  actorUserId: string,
  circleId: string,
  challengeId: string,
  input: z.input<typeof submitChallengeEntrySchema>
): Promise<ChallengeSubmissionItem> {
  const parsed = submitChallengeEntrySchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'challenges_rewards' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('challenges_rewards');
    }

    try {
      const inserted = await tx.query<ChallengeSubmissionItem>(
        `INSERT INTO public.challenge_submissions (
           id, challenge_id, circle_id, participant_id, submission_text,
           proof_url, status, awarded_points, awarded_badge
         ) VALUES ($1, $2, $3, $4, $5, $6, 'submitted', 0, NULL)
         RETURNING *;`,
        [
          crypto.randomUUID(),
          challengeId,
          circleId,
          actorUserId,
          parsed.submissionText,
          parsed.proofUrl ?? null,
        ]
      );
      return inserted.rows[0];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key')) {
        throw new ConflictError('You have already submitted an entry for this challenge.');
      }
      throw err;
    }
  });
}

export async function reviewChallengeSubmission(
  actorUserId: string,
  circleId: string,
  submissionId: string,
  input: z.input<typeof reviewChallengeSubmissionSchema>
): Promise<ChallengeSubmissionItem> {
  const parsed = reviewChallengeSubmissionSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (
      !membership ||
      membership.status !== 'active' ||
      !['owner', 'admin', 'moderator'].includes(membership.role)
    ) {
      throw new ForbiddenError(
        'Only Circle moderators, administrators, or owners can review challenge submissions or award badges.'
      );
    }

    const subRes = await tx.query<
      ChallengeSubmissionItem & {
        reward_points: number;
        reward_badge_name: string;
        circle_slug: string;
      }
    >(
      `SELECT s.*, c.reward_points, c.reward_badge_name, ci.slug AS circle_slug
       FROM public.challenge_submissions s
       INNER JOIN public.community_challenges c ON c.id = s.challenge_id AND c.circle_id = s.circle_id
       INNER JOIN public.circles ci ON ci.id = s.circle_id
       WHERE s.id = $1 AND s.circle_id = $2
       LIMIT 1;`,
      [submissionId, circleId]
    );
    const sub = subRes.rows[0];
    if (!sub) {
      throw new NotFoundError('Challenge submission not found.');
    }

    const pointsToAward =
      parsed.status === 'approved' ? (parsed.awardedPoints ?? sub.reward_points) : 0;
    const badgeToAward =
      parsed.status === 'approved'
        ? parsed.awardedBadge !== undefined
          ? parsed.awardedBadge
          : sub.reward_badge_name
        : null;

    const updated = await tx.query<ChallengeSubmissionItem>(
      `UPDATE public.challenge_submissions
       SET status = $1,
           awarded_points = $2,
           awarded_badge = $3,
           reviewed_by = $4,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $5 AND circle_id = $6
       RETURNING *;`,
      [parsed.status, pointsToAward, badgeToAward, actorUserId, submissionId, circleId]
    );

    return {
      submission: updated.rows[0],
      circleSlug: sub.circle_slug,
    };
  });

  if (outcome.submission.status === 'approved') {
    await createNotification({
      recipientId: outcome.submission.participant_id,
      actorId: actorUserId,
      circleId,
      eventType: 'challenge_reward',
      title: `Challenge Completed! Badge Awarded: ${outcome.submission.awarded_badge ?? 'Challenger'}`,
      body: `You earned ${outcome.submission.awarded_points} points in this Circle challenge.`,
      linkUrl: `/circles/${outcome.circleSlug}/community?tab=challenges`,
    });
  }

  return outcome.submission;
}

export async function listCommunityChallenges(
  actorUserId: string | null,
  circleId: string
): Promise<{
  challenges: CommunityChallengeItem[];
  submissions: ChallengeSubmissionItem[];
}> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'challenges_rewards' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('challenges_rewards');
    }

    const challengesRes = await tx.query<
      CommunityChallengeItem & { submission_count: number }
    >(
      `SELECT c.*,
         (SELECT COUNT(*)::int FROM public.challenge_submissions s WHERE s.challenge_id = c.id) AS submission_count
       FROM public.community_challenges c
       WHERE c.circle_id = $1
       ORDER BY c.created_at DESC;`,
      [circleId]
    );

    const subsRes = await tx.query<
      ChallengeSubmissionItem & {
        participant_username: string;
        participant_display_name: string;
      }
    >(
      `SELECT s.*,
         COALESCE(u.username, 'member') AS participant_username,
         COALESCE(u.display_name, 'Member') AS participant_display_name
       FROM public.challenge_submissions s
       LEFT JOIN public.profiles u ON u.id = s.participant_id
       WHERE s.circle_id = $1
       ORDER BY s.created_at DESC;`,
      [circleId]
    );

    const submissions: ChallengeSubmissionItem[] = subsRes.rows.map((s) => ({
      id: s.id,
      challenge_id: s.challenge_id,
      circle_id: s.circle_id,
      participant_id: s.participant_id,
      submission_text: s.submission_text,
      proof_url: s.proof_url,
      status: s.status,
      awarded_points: Number(s.awarded_points ?? 0),
      awarded_badge: s.awarded_badge,
      reviewed_by: s.reviewed_by,
      reviewed_at: s.reviewed_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
      participant: {
        id: s.participant_id,
        username: s.participant_username,
        display_name: s.participant_display_name,
      },
    }));

    return {
      challenges: challengesRes.rows.map((c) => ({
        ...c,
        reward_points: Number(c.reward_points),
        submission_count: Number(c.submission_count ?? 0),
        viewer_submission:
          submissions.find(
            (s) => s.challenge_id === c.id && s.participant_id === actorUserId
          ) ?? null,
      })),
      submissions,
    };
  });
}

// ============================================================================
// 4. HELP DESK & SUPPORT TICKETS
// ============================================================================

export async function createSupportTicket(
  actorUserId: string,
  input: z.input<typeof createSupportTicketSchema>
): Promise<SupportTicketItem> {
  const parsed = createSupportTicketSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'help_desk' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('help_desk');
    }

    const res = await tx.query<SupportTicketItem>(
      `INSERT INTO public.support_tickets (
         id, circle_id, requester_id, category, priority, is_private,
         subject, description, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.category,
        parsed.priority,
        parsed.isPrivate,
        parsed.subject,
        parsed.description,
      ]
    );

    return res.rows[0];
  });
}

export async function updateSupportTicket(
  actorUserId: string,
  circleId: string,
  ticketId: string,
  input: z.input<typeof updateSupportTicketSchema>
): Promise<SupportTicketItem> {
  const parsed = updateSupportTicketSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<SupportTicketItem & { circle_slug: string }>(
      `SELECT t.*, c.slug AS circle_slug
       FROM public.support_tickets t
       INNER JOIN public.circles c ON c.id = t.circle_id
       WHERE t.id = $1 AND t.circle_id = $2
       LIMIT 1;`,
      [ticketId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Support ticket not found.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (
      existing.requester_id !== actorUserId &&
      existing.assigned_to !== actorUserId &&
      !isStaff
    ) {
      throw new ForbiddenError('Not authorized to update this support ticket.');
    }

    if (parsed.assignedTo !== undefined && !isStaff) {
      throw new ForbiddenError('Only Circle moderators or administrators can assign support tickets.');
    }

    const updated = await tx.query<SupportTicketItem>(
      `UPDATE public.support_tickets
       SET status = $1,
           assigned_to = $2,
           resolution_notes = $3,
           updated_at = NOW()
       WHERE id = $4 AND circle_id = $5
       RETURNING *;`,
      [
        parsed.status ?? existing.status,
        parsed.assignedTo !== undefined ? parsed.assignedTo : existing.assigned_to,
        parsed.resolutionNotes !== undefined
          ? parsed.resolutionNotes
          : existing.resolution_notes,
        ticketId,
        circleId,
      ]
    );

    return {
      ticket: updated.rows[0],
      circleSlug: existing.circle_slug,
    };
  });

  if (outcome.ticket.requester_id !== actorUserId) {
    await createNotification({
      recipientId: outcome.ticket.requester_id,
      actorId: actorUserId,
      circleId,
      eventType: 'support_ticket',
      title: `Support Ticket Update: ${outcome.ticket.subject}`,
      body:
        outcome.ticket.resolution_notes ??
        `Your ticket status is now ${outcome.ticket.status}.`,
      linkUrl: `/circles/${outcome.circleSlug}/community?tab=support`,
    });
  }

  return outcome.ticket;
}

export async function listSupportTickets(
  actorUserId: string,
  circleId: string
): Promise<SupportTicketItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'help_desk' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('help_desk');
    }

    const res = await tx.query<
      SupportTicketItem & {
        requester_username: string;
        requester_display_name: string;
        assignee_username: string | null;
        assignee_display_name: string | null;
      }
    >(
      `SELECT t.*,
         COALESCE(ru.username, 'member') AS requester_username,
         COALESCE(ru.display_name, 'Member') AS requester_display_name,
         au.username AS assignee_username,
         au.display_name AS assignee_display_name
       FROM public.support_tickets t
       LEFT JOIN public.profiles ru ON ru.id = t.requester_id
       LEFT JOIN public.profiles au ON au.id = t.assigned_to
       WHERE t.circle_id = $1
       ORDER BY t.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      requester_id: r.requester_id,
      assigned_to: r.assigned_to,
      category: r.category,
      priority: r.priority,
      is_private: r.is_private,
      subject: r.subject,
      description: r.description,
      resolution_notes: r.resolution_notes,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      requester: {
        id: r.requester_id,
        username: r.requester_username,
        display_name: r.requester_display_name,
      },
      assignee: r.assigned_to
        ? {
            id: r.assigned_to,
            username: r.assignee_username ?? 'staff',
            display_name: r.assignee_display_name ?? 'Staff',
          }
        : null,
    }));
  });
}
