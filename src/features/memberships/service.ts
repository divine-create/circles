import crypto from 'crypto';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  CircleInvitation,
  CircleJoinRequest,
  CircleMembership,
  CircleRole,
  CircleVisibility,
  MembershipPolicy,
  MembershipStatus,
} from '@/types/domain';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCirclePermission } from '@/lib/authorization/permissions';
import { createNotification } from '@/features/notifications/service';

export async function joinPublicCircle(
  actorUserId: string,
  circleId: string
): Promise<CircleMembership> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
      membership_policy: MembershipPolicy;
      status: string;
    }>(
      `SELECT id, name, slug, visibility, membership_policy, status
       FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );

    const circle = circleRes.rows[0];
    if (!circle || circle.status !== 'active') {
      throw new NotFoundError('Circle not found or inactive.');
    }

    if (circle.visibility !== 'public' || circle.membership_policy !== 'open') {
      throw new ForbiddenError(
        'This Circle does not allow direct joining. Please submit a membership request or use an invitation.'
      );
    }

    const existingRes = await tx.query<CircleMembership>(
      `SELECT * FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const existing = existingRes.rows[0];

    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictError('You are already an active member of this Circle.');
      }
      if (existing.status === 'suspended') {
        throw new ForbiddenError('Your membership in this Circle is suspended.');
      }
      const rejoined = await tx.query<CircleMembership>(
        `UPDATE public.circle_memberships
         SET status = 'active', role = 'member', updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [existing.id]
      );
      return rejoined.rows[0];
    }

    const inserted = await tx.query<CircleMembership>(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
       VALUES ($1, $2, $3, 'member', 'active')
       RETURNING *;`,
      [crypto.randomUUID(), circleId, actorUserId]
    );

    return inserted.rows[0];
  });
}

export async function requestToJoinCircle(
  actorUserId: string,
  circleId: string,
  message = ''
): Promise<CircleJoinRequest> {
  const cleanMessage = message.trim().slice(0, 500);

  const result = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      owner_id: string;
      visibility: CircleVisibility;
      membership_policy: MembershipPolicy;
      status: string;
    }>(
      `SELECT id, name, slug, owner_id, visibility, membership_policy, status
       FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );

    const circle = circleRes.rows[0];
    if (!circle || circle.status !== 'active') {
      throw new NotFoundError('Circle not found.');
    }

    if (circle.membership_policy !== 'approval') {
      throw new ValidationError(
        circle.membership_policy === 'open'
          ? 'This Circle is open—you can join directly without requesting approval.'
          : 'This Circle is invite-only.'
      );
    }

    const existingMember = await tx.query<{ status: MembershipStatus }>(
      `SELECT status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    if (existingMember.rows[0]?.status === 'active') {
      throw new ConflictError('You are already an active member of this Circle.');
    }
    if (existingMember.rows[0]?.status === 'suspended') {
      throw new ForbiddenError('Your membership in this Circle is suspended.');
    }

    const pendingCheck = await tx.query<{ id: string }>(
      `SELECT id FROM public.circle_join_requests
       WHERE circle_id = $1 AND user_id = $2 AND status = 'pending' LIMIT 1;`,
      [circleId, actorUserId]
    );
    if (pendingCheck.rows.length > 0) {
      throw new ConflictError('You already have a pending join request for this Circle.');
    }

    const reqId = crypto.randomUUID();
    const inserted = await tx.query<CircleJoinRequest>(
      `INSERT INTO public.circle_join_requests (id, circle_id, user_id, message, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *;`,
      [reqId, circleId, actorUserId, cleanMessage]
    );

    return { request: inserted.rows[0], circle };
  });

  await createNotification({
    recipientId: result.circle.owner_id,
    actorId: actorUserId,
    circleId,
    eventType: 'join_request_received',
    title: `New membership request for ${result.circle.name}`,
    body: cleanMessage
      ? `A user requested to join with note: "${cleanMessage}"`
      : 'A user requested to join your Circle.',
    linkUrl: `/circles/${result.circle.slug}/studio`,
    idempotencyKey: `join-req-${result.request.id}`,
    sendEmail: true,
  });

  return result.request;
}

export async function approveJoinRequest(
  actorUserId: string,
  circleId: string,
  requestId: string
): Promise<CircleMembership> {
  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
    }>(`SELECT id, name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.approve_requests', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    const reqRes = await tx.query<CircleJoinRequest>(
      `SELECT * FROM public.circle_join_requests
       WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [requestId, circleId]
    );
    const req = reqRes.rows[0];
    if (!req) {
      throw new NotFoundError('Join request not found in this Circle.');
    }
    if (req.status !== 'pending') {
      throw new ConflictError(`Join request has already been ${req.status}.`);
    }

    await tx.query(
      `UPDATE public.circle_join_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2;`,
      [actorUserId, requestId]
    );

    const memberRes = await tx.query<CircleMembership>(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
       VALUES ($1, $2, $3, 'member', 'active')
       ON CONFLICT (circle_id, user_id)
       DO UPDATE SET status = 'active', role = 'member', updated_at = NOW()
       RETURNING *;`,
      [crypto.randomUUID(), circleId, req.user_id]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'join_request.approved', 'circle_join_request', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        requestId,
        JSON.stringify({ userId: req.user_id }),
      ]
    );

    return { membership: memberRes.rows[0], circle, applicantId: req.user_id };
  });

  await createNotification({
    recipientId: outcome.applicantId,
    actorId: actorUserId,
    circleId,
    eventType: 'join_request_approved',
    title: `Your request to join ${outcome.circle.name} was approved`,
    body: `Welcome to ${outcome.circle.name}! You now have member access to spaces and discussions.`,
    linkUrl: `/circles/${outcome.circle.slug}`,
    idempotencyKey: `join-approved-${requestId}`,
    sendEmail: true,
  });

  return outcome.membership;
}

export async function rejectJoinRequest(
  actorUserId: string,
  circleId: string,
  requestId: string,
  reviewNote = ''
): Promise<CircleJoinRequest> {
  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
    }>(`SELECT id, name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.approve_requests', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    const updated = await tx.query<CircleJoinRequest>(
      `UPDATE public.circle_join_requests
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_note = $2,
           updated_at = NOW()
       WHERE id = $3 AND circle_id = $4 AND status = 'pending'
       RETURNING *;`,
      [actorUserId, reviewNote.trim().slice(0, 300) || null, requestId, circleId]
    );

    const req = updated.rows[0];
    if (!req) {
      throw new NotFoundError('Pending join request not found.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'join_request.rejected', 'circle_join_request', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        requestId,
        JSON.stringify({ userId: req.user_id }),
      ]
    );

    return { req, circle };
  });

  await createNotification({
    recipientId: outcome.req.user_id,
    actorId: actorUserId,
    circleId,
    eventType: 'join_request_rejected',
    title: `Update on your membership request for ${outcome.circle.name}`,
    body: `Your membership request for ${outcome.circle.name} was not approved at this time.`,
    linkUrl: `/explore`,
    idempotencyKey: `join-rejected-${requestId}`,
  });

  return outcome.req;
}

export async function leaveCircle(actorUserId: string, circleId: string): Promise<void> {
  await withRlsTransaction(actorUserId, async (tx) => {
    const memberRes = await tx.query<CircleMembership>(
      `SELECT * FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];
    if (!membership) {
      throw new NotFoundError('Active membership not found.');
    }

    // Note: if the user is the last owner, both our service check and the PostgreSQL trigger
    // `trg_prevent_last_owner_loss` will prevent leaving without transferring ownership.
    if (membership.role === 'owner') {
      const otherOwners = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.circle_memberships
         WHERE circle_id = $1 AND role = 'owner' AND status = 'active' AND user_id <> $2;`,
        [circleId, actorUserId]
      );
      if (parseInt(otherOwners.rows[0]?.count ?? '0', 10) === 0) {
        throw new ForbiddenError(
          'You are the sole owner of this Circle. Transfer ownership to another member before leaving.'
        );
      }
    }

    await tx.query(
      `UPDATE public.circle_memberships
       SET status = 'left', updated_at = NOW()
       WHERE id = $1;`,
      [membership.id]
    );
  });
}

export async function inviteToCircle(
  actorUserId: string,
  circleId: string,
  invitedEmail: string,
  role: Exclude<CircleRole, 'owner'> = 'member'
): Promise<{ invitation: CircleInvitation; rawToken: string }> {
  const cleanEmail = invitedEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new ValidationError('Please enter a valid email address to invite.');
  }
  if (!['admin', 'moderator', 'member'].includes(role)) {
    throw new ValidationError('Invalid invitation role.');
  }

  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
    }>(`SELECT id, name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.invite', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    const userRes = await tx.query<{ id: string }>(
      `SELECT id FROM public.profiles WHERE lower(email) = $1 LIMIT 1;`,
      [cleanEmail]
    );
    const invitedUserId = userRes.rows[0]?.id ?? null;

    const invId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    const invRes = await tx.query<CircleInvitation>(
      `INSERT INTO public.circle_invitations (
         id, circle_id, inviter_id, invited_email, invited_user_id, role, token_hash, status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
       RETURNING id, circle_id, inviter_id, invited_email, invited_user_id, role, status, expires_at, accepted_at, created_at;`,
      [invId, circleId, actorUserId, cleanEmail, invitedUserId, role, tokenHash, expiresAt]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'member.invited', 'circle_invitation', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        invId,
        JSON.stringify({ invitedEmail: cleanEmail, role }),
      ]
    );

    return { invitation: invRes.rows[0], circle, invitedUserId };
  });

  if (outcome.invitedUserId) {
    await createNotification({
      recipientId: outcome.invitedUserId,
      actorId: actorUserId,
      circleId,
      eventType: 'invitation_received',
      title: `You've been invited to join ${outcome.circle.name}`,
      body: `You received an invitation to join ${outcome.circle.name} as a ${role}.`,
      linkUrl: `/circles/${outcome.circle.slug}?inviteToken=${rawToken}`,
      idempotencyKey: `invite-${outcome.invitation.id}`,
      sendEmail: true,
    });
  }

  return { invitation: outcome.invitation, rawToken };
}

export async function acceptInvitation(
  actorUserId: string,
  rawToken: string
): Promise<CircleMembership> {
  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  return withServiceRoleTransaction(async (tx) => {
    const profileRes = await tx.query<{ id: string; email: string }>(
      `SELECT id, email FROM public.profiles WHERE id = $1 LIMIT 1;`,
      [actorUserId]
    );
    const profile = profileRes.rows[0];
    if (!profile) {
      throw new NotFoundError('Authenticated user profile not found.');
    }

    const invRes = await tx.query<CircleInvitation & { token_hash: string }>(
      `SELECT * FROM public.circle_invitations WHERE token_hash = $1 LIMIT 1;`,
      [tokenHash]
    );
    const inv = invRes.rows[0];
    if (!inv) {
      throw new NotFoundError('Invitation token is invalid.');
    }
    if (inv.status !== 'pending') {
      throw new ConflictError(`Invitation has already been ${inv.status}.`);
    }
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      await tx.query(`UPDATE public.circle_invitations SET status = 'expired' WHERE id = $1;`, [
        inv.id,
      ]);
      throw new ValidationError('This invitation has expired.');
    }
    if (
      inv.invited_email.toLowerCase() !== profile.email.toLowerCase() &&
      inv.invited_user_id !== actorUserId
    ) {
      throw new ForbiddenError('This invitation was issued for a different email address.');
    }

    await tx.query(
      `UPDATE public.circle_invitations
       SET status = 'accepted', accepted_at = NOW(), invited_user_id = $1
       WHERE id = $2;`,
      [actorUserId, inv.id]
    );

    const memberRes = await tx.query<CircleMembership>(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (circle_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()
       RETURNING *;`,
      [crypto.randomUUID(), inv.circle_id, actorUserId, inv.role]
    );

    return memberRes.rows[0];
  });
}

export async function updateMemberRole(
  actorUserId: string,
  circleId: string,
  targetUserId: string,
  newRole: Exclude<CircleRole, 'owner'>
): Promise<CircleMembership> {
  if (!['admin', 'moderator', 'member'].includes(newRole)) {
    throw new ValidationError('Invalid target role.');
  }

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ name: string; slug: string; visibility: CircleVisibility }>(
      `SELECT name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );

    assertCirclePermission('circle.manage_members', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    if (newRole === 'admin' && actorMember.rows[0]?.role !== 'owner') {
      throw new ForbiddenError('Only a Circle owner can promote members to administrator.');
    }

    const updated = await tx.query<CircleMembership>(
      `UPDATE public.circle_memberships
       SET role = $1, updated_at = NOW()
       WHERE circle_id = $2 AND user_id = $3
       RETURNING *;`,
      [newRole, circleId, targetUserId]
    );

    if (!updated.rows[0]) {
      throw new NotFoundError('Target membership not found.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'member.role_updated', 'circle_membership', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        updated.rows[0].id,
        JSON.stringify({ targetUserId, newRole }),
      ]
    );

    return { membership: updated.rows[0], circle };
  });

  await createNotification({
    recipientId: targetUserId,
    actorId: actorUserId,
    circleId,
    eventType: 'role_changed',
    title: `Your role in ${outcome.circle.name} was updated`,
    body: `Your Circle role is now ${newRole}.`,
    linkUrl: `/circles/${outcome.circle.slug}`,
  });

  return outcome.membership;
}

export async function transferCircleOwnership(
  actorOwnerId: string,
  circleId: string,
  newOwnerUserId: string
): Promise<void> {
  if (actorOwnerId === newOwnerUserId) {
    throw new ValidationError('You are already the owner of this Circle.');
  }

  await withRlsTransaction(actorOwnerId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    if (!circleRes.rows[0]) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorOwnerId]
    );

    assertCirclePermission('circle.transfer_ownership', circleRes.rows[0].visibility, {
      userId: actorOwnerId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    // Promote new owner first so last-owner trigger is always satisfied
    const promoted = await tx.query<CircleMembership>(
      `UPDATE public.circle_memberships
       SET role = 'owner', updated_at = NOW()
       WHERE circle_id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *;`,
      [circleId, newOwnerUserId]
    );
    if (!promoted.rows[0]) {
      throw new ValidationError('New owner must be an active member of the Circle.');
    }

    // Demote previous owner to admin
    await tx.query(
      `UPDATE public.circle_memberships
       SET role = 'admin', updated_at = NOW()
       WHERE circle_id = $1 AND user_id = $2;`,
      [circleId, actorOwnerId]
    );

    await tx.query(
      `UPDATE public.circles SET owner_id = $1, updated_at = NOW() WHERE id = $2;`,
      [newOwnerUserId, circleId]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'circle.ownership_transferred', 'circle', $4::text, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorOwnerId,
        circleId,
        JSON.stringify({ previousOwnerId: actorOwnerId, newOwnerId: newOwnerUserId }),
      ]
    );
  });
}

export async function listCircleMembers(
  actorUserId: string | null,
  circleId: string
): Promise<CircleMembership[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      CircleMembership & {
        username: string;
        display_name: string;
        avatar_url: string | null;
        bio: string;
      }
    >(
      `SELECT m.*, p.username, p.display_name, p.avatar_url, p.bio
       FROM public.circle_memberships m
       JOIN public.profiles p ON p.id = m.user_id
       WHERE m.circle_id = $1 AND m.status IN ('active', 'suspended')
       ORDER BY
         CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END,
         m.joined_at ASC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      user_id: r.user_id,
      role: r.role,
      status: r.status,
      joined_at: r.joined_at,
      updated_at: r.updated_at,
      profile: {
        id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        bio: r.bio,
      },
    }));
  });
}

export async function listCircleJoinRequests(
  actorUserId: string,
  circleId: string
): Promise<CircleJoinRequest[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      CircleJoinRequest & {
        username: string;
        display_name: string;
        email: string;
        avatar_url: string | null;
      }
    >(
      `SELECT jr.*, p.username, p.display_name, p.email, p.avatar_url
       FROM public.circle_join_requests jr
       JOIN public.profiles p ON p.id = jr.user_id
       WHERE jr.circle_id = $1
       ORDER BY
         CASE jr.status WHEN 'pending' THEN 1 ELSE 2 END,
         jr.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      user_id: r.user_id,
      message: r.message,
      status: r.status,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
      review_note: r.review_note,
      created_at: r.created_at,
      updated_at: r.updated_at,
      profile: {
        id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        email: r.email,
        avatar_url: r.avatar_url,
      },
    }));
  });
}

export async function listCircleInvitations(
  actorUserId: string,
  circleId: string
): Promise<CircleInvitation[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<CircleInvitation>(
      `SELECT id, circle_id, inviter_id, invited_email, invited_user_id, role, status, expires_at, accepted_at, created_at
       FROM public.circle_invitations
       WHERE circle_id = $1
       ORDER BY created_at DESC;`,
      [circleId]
    );
    return res.rows;
  });
}
