import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  CirclePollItem,
  CircleRole,
  CircleVisibility,
  MembershipStatus,
  PollOptionItem,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { canReadCircleContent } from '@/lib/authorization/permissions';

export const createPollSchema = z.object({
  circleId: z.string().uuid(),
  spaceId: z.string().uuid().nullable().optional(),
  question: z.string().trim().min(3).max(240),
  description: z.string().trim().max(4000).default(''),
  allowMultiple: z.boolean().default(false),
  resultsVisibility: z.enum(['always', 'after_vote', 'after_close']).default('always'),
  closesAt: z.string().datetime().nullable().optional(),
  options: z.array(z.string().trim().min(1).max(160)).min(2).max(12),
});

export const votePollSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1).max(12),
});

export const closePollSchema = z.object({
  status: z.enum(['open', 'closed', 'archived']).default('closed'),
  decisionSummary: z.string().trim().max(2000).nullable().optional(),
});

async function assertPollCapability(
  tx: { query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  circleId: string,
  actorUserId: string | null
): Promise<{
  circle: { id: string; visibility: CircleVisibility };
  membership: { role: CircleRole; status: MembershipStatus } | null;
}> {
  const circleRes = await tx.query<{ id: string; visibility: CircleVisibility }>(
    `SELECT id, visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
    [circleId]
  );
  const circle = circleRes.rows[0];
  if (!circle) {
    throw new NotFoundError('Circle not found.');
  }

  const capRes = await tx.query<{ enabled: boolean }>(
    `SELECT enabled FROM public.circle_capabilities
     WHERE circle_id = $1 AND capability_key = 'polls_decisions' AND enabled = true LIMIT 1;`,
    [circleId]
  );
  if (!capRes.rows[0]?.enabled) {
    throw new CapabilityDisabledError('polls_decisions');
  }

  let membership: { role: CircleRole; status: MembershipStatus } | null = null;
  if (actorUserId) {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    membership = memRes.rows[0] ?? null;
  }

  return { circle, membership };
}

export async function createCirclePoll(
  actorUserId: string,
  input: z.input<typeof createPollSchema>
): Promise<CirclePollItem> {
  const parsed = createPollSchema.parse(input);
  const uniqueLabels = new Set(parsed.options.map((o) => o.toLowerCase()));
  if (uniqueLabels.size !== parsed.options.length) {
    throw new ValidationError('Poll options must be distinct.');
  }

  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertPollCapability(tx, parsed.circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can create polls.');
    }

    const pollId = crypto.randomUUID();
    const pollRes = await tx.query<{
      id: string;
      circle_id: string;
      space_id: string | null;
      creator_id: string;
      question: string;
      description: string;
      allow_multiple: boolean;
      results_visibility: 'always' | 'after_vote' | 'after_close';
      closes_at: string | null;
      status: 'open' | 'closed' | 'archived';
      decision_summary: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO public.circle_polls (
         id, circle_id, space_id, creator_id, question, description,
         allow_multiple, results_visibility, closes_at, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
       RETURNING *;`,
      [
        pollId,
        parsed.circleId,
        parsed.spaceId ?? null,
        actorUserId,
        parsed.question,
        parsed.description,
        parsed.allowMultiple,
        parsed.resultsVisibility,
        parsed.closesAt ?? null,
      ]
    );

    const options: PollOptionItem[] = [];
    for (let idx = 0; idx < parsed.options.length; idx++) {
      const optId = crypto.randomUUID();
      await tx.query(
        `INSERT INTO public.poll_options (id, poll_id, circle_id, label, sort_order)
         VALUES ($1, $2, $3, $4, $5);`,
        [optId, pollId, parsed.circleId, parsed.options[idx], idx]
      );
      options.push({
        id: optId,
        poll_id: pollId,
        circle_id: parsed.circleId,
        label: parsed.options[idx],
        sort_order: idx,
        vote_count: parsed.resultsVisibility === 'always' ? 0 : null,
        percentage: parsed.resultsVisibility === 'always' ? 0 : null,
        viewer_voted: false,
      });
    }

    const row = pollRes.rows[0];
    return {
      ...row,
      total_votes: parsed.resultsVisibility === 'always' ? 0 : null,
      results_visible_to_viewer: parsed.resultsVisibility === 'always',
      viewer_has_voted: false,
      options,
    };
  });
}

export async function listCirclePolls(
  actorUserId: string | null,
  circleId: string
): Promise<CirclePollItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertPollCapability(tx, circleId, actorUserId);
    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view polls in this Circle.');
    }

    const pollsRes = await tx.query<{
      id: string;
      circle_id: string;
      space_id: string | null;
      creator_id: string;
      question: string;
      description: string;
      allow_multiple: boolean;
      results_visibility: 'always' | 'after_vote' | 'after_close';
      closes_at: string | null;
      status: 'open' | 'closed' | 'archived';
      decision_summary: string | null;
      created_at: string;
      updated_at: string;
      creator_username: string;
      creator_display_name: string;
      creator_avatar_url: string | null;
    }>(
      `SELECT p.*,
         COALESCE(u.username, 'member') AS creator_username,
         COALESCE(u.display_name, 'Member') AS creator_display_name,
         u.avatar_url AS creator_avatar_url
       FROM public.circle_polls p
       LEFT JOIN public.profiles u ON u.id = p.creator_id
       WHERE p.circle_id = $1
       ORDER BY p.created_at DESC;`,
      [circleId]
    );

    if (pollsRes.rows.length === 0) {
      return [];
    }

    const optionsRes = await tx.query<{
      id: string;
      poll_id: string;
      circle_id: string;
      label: string;
      sort_order: number;
      vote_count: number;
      viewer_voted: boolean;
    }>(
      `SELECT o.*,
         (SELECT COUNT(*)::int FROM public.poll_votes v WHERE v.option_id = o.id) AS vote_count,
         EXISTS (
           SELECT 1 FROM public.poll_votes v
           WHERE v.option_id = o.id AND v.voter_id = $2
         ) AS viewer_voted
       FROM public.poll_options o
       WHERE o.circle_id = $1
       ORDER BY o.sort_order ASC;`,
      [circleId, actorUserId]
    );

    const isStaff = membership && ['owner', 'admin', 'moderator'].includes(membership.role);
    const nowMs = Date.now();

    return pollsRes.rows.map((poll) => {
      const pollOpts = optionsRes.rows.filter((o) => o.poll_id === poll.id);
      const viewerHasVoted = pollOpts.some((o) => Boolean(o.viewer_voted));
      const isClosedByTime =
        poll.closes_at !== null && new Date(poll.closes_at).getTime() <= nowMs;
      const effectiveClosed = poll.status !== 'open' || isClosedByTime;

      const resultsVisible =
        Boolean(isStaff) ||
        poll.creator_id === actorUserId ||
        poll.results_visibility === 'always' ||
        (poll.results_visibility === 'after_vote' && (viewerHasVoted || effectiveClosed)) ||
        (poll.results_visibility === 'after_close' && effectiveClosed);

      const totalVotes = pollOpts.reduce((acc, o) => acc + Number(o.vote_count ?? 0), 0);

      return {
        id: poll.id,
        circle_id: poll.circle_id,
        space_id: poll.space_id,
        creator_id: poll.creator_id,
        question: poll.question,
        description: poll.description,
        allow_multiple: poll.allow_multiple,
        results_visibility: poll.results_visibility,
        closes_at: poll.closes_at,
        status: poll.status,
        decision_summary: poll.decision_summary,
        created_at: poll.created_at,
        updated_at: poll.updated_at,
        creator: {
          id: poll.creator_id,
          username: poll.creator_username,
          display_name: poll.creator_display_name,
          avatar_url: poll.creator_avatar_url,
        },
        total_votes: resultsVisible ? totalVotes : null,
        results_visible_to_viewer: resultsVisible,
        viewer_has_voted: viewerHasVoted,
        options: pollOpts.map((opt) => {
          const count = Number(opt.vote_count ?? 0);
          return {
            id: opt.id,
            poll_id: opt.poll_id,
            circle_id: opt.circle_id,
            label: opt.label,
            sort_order: opt.sort_order,
            vote_count: resultsVisible ? count : null,
            percentage:
              resultsVisible && totalVotes > 0 ? Math.round((count / totalVotes) * 100) : resultsVisible ? 0 : null,
            viewer_voted: Boolean(opt.viewer_voted),
          };
        }),
      };
    });
  });
}

export async function castPollVote(
  actorUserId: string,
  circleId: string,
  pollId: string,
  input: z.input<typeof votePollSchema>
): Promise<CirclePollItem> {
  const parsed = votePollSchema.parse(input);
  const uniqueOptionIds = Array.from(new Set(parsed.optionIds));

  await withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertPollCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can vote on polls.');
    }

    const pollRes = await tx.query<{
      id: string;
      allow_multiple: boolean;
      status: string;
      closes_at: string | null;
    }>(
      `SELECT id, allow_multiple, status, closes_at
       FROM public.circle_polls
       WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [pollId, circleId]
    );
    const poll = pollRes.rows[0];
    if (!poll) {
      throw new NotFoundError('Poll not found in this Circle.');
    }

    if (poll.status !== 'open') {
      throw new ValidationError('Cannot vote on a closed or archived poll.');
    }

    if (poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) {
      throw new ValidationError('Voting period for this poll has ended.');
    }

    if (!poll.allow_multiple && uniqueOptionIds.length > 1) {
      throw new ValidationError('Single-choice polls allow selecting only one option.');
    }

    for (const optionId of uniqueOptionIds) {
      try {
        await tx.query(
          `INSERT INTO public.poll_votes (id, poll_id, option_id, circle_id, voter_id)
           VALUES ($1, $2, $3, $4, $5);`,
          [crypto.randomUUID(), pollId, optionId, circleId, actorUserId]
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('duplicate key') ||
          message.includes('Single-choice polls allow only one vote')
        ) {
          throw new ConflictError('You have already voted on this poll.');
        }
        throw err;
      }
    }
  });

  const allPolls = await listCirclePolls(actorUserId, circleId);
  const updated = allPolls.find((p) => p.id === pollId);
  if (!updated) {
    throw new NotFoundError('Poll not found after voting.');
  }
  return updated;
}

export async function updatePollStatus(
  actorUserId: string,
  circleId: string,
  pollId: string,
  input: z.input<typeof closePollSchema>
): Promise<CirclePollItem> {
  const parsed = closePollSchema.parse(input);

  await withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertPollCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<{ id: string; creator_id: string }>(
      `SELECT id, creator_id FROM public.circle_polls
       WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [pollId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Poll not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (existing.creator_id !== actorUserId && !isStaff) {
      throw new ForbiddenError('Only the poll creator or a Circle moderator can close this poll.');
    }

    await tx.query(
      `UPDATE public.circle_polls
       SET status = $1,
           decision_summary = COALESCE($2, decision_summary),
           updated_at = NOW()
       WHERE id = $3 AND circle_id = $4;`,
      [parsed.status, parsed.decisionSummary ?? null, pollId, circleId]
    );
  });

  const allPolls = await listCirclePolls(actorUserId, circleId);
  const updated = allPolls.find((p) => p.id === pollId);
  if (!updated) {
    throw new NotFoundError('Poll not found.');
  }
  return updated;
}
