import crypto from 'crypto';
import { withRlsTransaction } from '@/lib/db/postgres';
import { createReportSchema } from '@/lib/validation';
import { CircleRole, CircleVisibility, ContentReportItem, MembershipStatus } from '@/types/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCirclePermission } from '@/lib/authorization/permissions';

export async function reportContent(
  actorUserId: string,
  input: unknown
): Promise<ContentReportItem> {
  const parsed = createReportSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid report submission.');
  }

  const {
    circleId,
    targetType,
    targetPostId,
    targetCommentId,
    targetUserId,
    targetListingId,
    reason,
    details,
  } = parsed.data;

  if (targetType === 'post' && !targetPostId) {
    throw new ValidationError('targetPostId is required when reporting a post.');
  }
  if (targetType === 'comment' && !targetCommentId) {
    throw new ValidationError('targetCommentId is required when reporting a comment.');
  }
  if (targetType === 'member' && !targetUserId) {
    throw new ValidationError('targetUserId is required when reporting a member.');
  }
  if (targetType === 'listing' && !targetListingId) {
    throw new ValidationError('targetListingId is required when reporting a listing.');
  }

  return withRlsTransaction(actorUserId, async (tx) => {
    const reportId = crypto.randomUUID();
    const res = await tx.query<ContentReportItem>(
      `INSERT INTO public.content_reports (
         id, circle_id, reporter_id, target_type, target_post_id, target_comment_id, target_user_id, target_listing_id, reason, details, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
       RETURNING *;`,
      [
        reportId,
        circleId,
        actorUserId,
        targetType,
        targetPostId ?? null,
        targetCommentId ?? null,
        targetUserId ?? null,
        targetListingId ?? null,
        reason,
        details,
      ]
    );

    if (!res.rows[0]) {
      throw new ForbiddenError('Unable to submit report for this Circle.');
    }

    return res.rows[0];
  });
}

export async function listModerationReports(
  actorUserId: string,
  circleId?: string
): Promise<ContentReportItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<ContentReportItem>(
      `SELECT r.*,
         c.name AS circle_name,
         c.slug AS circle_slug,
         p.display_name AS reporter_name,
         COALESCE(po.title, co.body, tu.display_name) AS target_preview
       FROM public.content_reports r
       JOIN public.circles c ON c.id = r.circle_id
       JOIN public.profiles p ON p.id = r.reporter_id
       LEFT JOIN public.posts po ON po.id = r.target_post_id
       LEFT JOIN public.comments co ON co.id = r.target_comment_id
       LEFT JOIN public.profiles tu ON tu.id = r.target_user_id
       WHERE ($1::uuid IS NULL OR r.circle_id = $1::uuid)
       ORDER BY
         CASE r.status WHEN 'open' THEN 1 ELSE 2 END,
         r.created_at DESC
       LIMIT 60;`,
      [circleId ?? null]
    );
    return res.rows;
  });
}

export interface ModerateContentInput {
  circleId: string;
  reportId?: string | null;
  actionType?:
    | 'remove_post'
    | 'restore_post'
    | 'remove_comment'
    | 'restore_comment'
    | 'suspend_member'
    | 'restore_member'
    | 'resolve_report'
    | 'dismiss_report';
  action?:
    | 'remove_post'
    | 'restore_post'
    | 'remove_comment'
    | 'restore_comment'
    | 'suspend_member'
    | 'restore_member'
    | 'resolve_report'
    | 'dismiss_report';
  targetId?: string;
  targetUserId?: string;
  reason?: string;
  note?: string;
}

const VALID_MODERATION_ACTIONS = new Set([
  'remove_post',
  'restore_post',
  'remove_comment',
  'restore_comment',
  'suspend_member',
  'restore_member',
  'resolve_report',
  'dismiss_report',
]);

export async function moderateContent(
  actorUserId: string,
  input: ModerateContentInput
): Promise<void> {
  const circleId = input.circleId;
  const reportId = input.reportId ?? null;
  const actionType = input.actionType ?? input.action;
  const targetId = input.targetId ?? input.targetUserId;
  const reason = (input.reason ?? input.note ?? '').trim().slice(0, 500);

  if (!circleId || !actionType || !VALID_MODERATION_ACTIONS.has(actionType) || !targetId) {
    throw new ValidationError(
      'circleId, a valid moderation actionType, and targetId are required.'
    );
  }

  await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const platformAdminRes = await tx.query<{ role: string }>(
      `SELECT role FROM public.platform_roles WHERE user_id = $1 LIMIT 1;`,
      [actorUserId]
    );

    const actorRole = memberRes.rows[0]?.role ?? null;
    const isPlatformAdmin = platformAdminRes.rows.length > 0;

    assertCirclePermission('moderation.review_reports', circle.visibility, {
      userId: actorUserId,
      isPlatformAdmin,
      circleRole: actorRole,
      membershipStatus: memberRes.rows[0]?.status ?? null,
    });

    if (actionType === 'remove_post') {
      await tx.query(
        `UPDATE public.posts SET status = 'removed', updated_at = NOW() WHERE id = $1 AND circle_id = $2;`,
        [targetId, circleId]
      );
    } else if (actionType === 'restore_post') {
      await tx.query(
        `UPDATE public.posts SET status = 'published', updated_at = NOW() WHERE id = $1 AND circle_id = $2;`,
        [targetId, circleId]
      );
    } else if (actionType === 'remove_comment') {
      await tx.query(
        `UPDATE public.comments SET status = 'removed', updated_at = NOW() WHERE id = $1 AND circle_id = $2;`,
        [targetId, circleId]
      );
    } else if (actionType === 'restore_comment') {
      await tx.query(
        `UPDATE public.comments SET status = 'published', updated_at = NOW() WHERE id = $1 AND circle_id = $2;`,
        [targetId, circleId]
      );
    } else if (actionType === 'suspend_member' || actionType === 'restore_member') {
      const targetMemberRes = await tx.query<{ role: CircleRole }>(
        `SELECT role FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
        [circleId, targetId]
      );
      const targetMember = targetMemberRes.rows[0];
      if (!targetMember) {
        throw new NotFoundError('Target member not found in this Circle.');
      }
      if (targetMember.role === 'owner') {
        throw new ForbiddenError('Cannot suspend a Circle owner.');
      }
      if (actorRole === 'moderator' && !isPlatformAdmin && targetMember.role !== 'member') {
        throw new ForbiddenError('Moderators can only suspend or restore ordinary members.');
      }
      if (actorRole === 'admin' && !isPlatformAdmin && targetMember.role === 'admin') {
        throw new ForbiddenError('Administrators cannot suspend fellow administrators.');
      }

      const nextStatus = actionType === 'suspend_member' ? 'suspended' : 'active';
      const updatedRes = await tx.query<{ id: string }>(
        `UPDATE public.circle_memberships
         SET status = $1, updated_at = NOW()
         WHERE circle_id = $2 AND user_id = $3 AND role <> 'owner'
         RETURNING id;`,
        [nextStatus, circleId, targetId]
      );
      if (updatedRes.rows.length === 0) {
        throw new ForbiddenError('Unable to update member status.');
      }
    }

    if (reportId) {
      const nextStatus = actionType === 'dismiss_report' ? 'dismissed' : 'resolved';
      await tx.query(
        `UPDATE public.content_reports
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(), resolution_note = $3
         WHERE id = $4 AND circle_id = $5;`,
        [nextStatus, actorUserId, reason || actionType, reportId, circleId]
      );
    }

    await tx.query(
      `INSERT INTO public.moderation_actions (
         id, circle_id, actor_id, action_type, target_type, target_id, report_id, reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        actionType,
        actionType.includes('post')
          ? 'post'
          : actionType.includes('comment')
            ? 'comment'
            : actionType.includes('member')
              ? 'member'
              : 'report',
        targetId,
        reportId ?? null,
        reason,
      ]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, 'moderation', $5, $6::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        `moderation.${actionType}`,
        targetId,
        JSON.stringify({ reportId: reportId ?? null, reason }),
      ]
    );
  });
}
