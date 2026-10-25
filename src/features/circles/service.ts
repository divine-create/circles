import crypto from 'crypto';
import { withRlsTransaction } from '@/lib/db/postgres';
import { createCircleSchema, normalizeSlug, updateCircleSchema } from '@/lib/validation';
import {
  AuditLogItem,
  Circle,
  CircleCategory,
  CircleRole,
  CircleVisibility,
  JoinRequestStatus,
  MembershipPolicy,
  MembershipStatus,
} from '@/types/domain';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { CIRCLE_TEMPLATES } from '@/features/templates/registry';
import { CAPABILITY_REGISTRY, getDefaultEnabledCapabilityKeys } from '@/features/capabilities/registry';
import { assertCirclePermission } from '@/lib/authorization/permissions';

function reconcileVisibilityAndPolicy(
  visibility: CircleVisibility,
  policy: MembershipPolicy
): { visibility: CircleVisibility; membershipPolicy: MembershipPolicy } {
  if (visibility === 'private') {
    return { visibility: 'private', membershipPolicy: 'invite_only' };
  }
  if (visibility === 'discoverable_approval') {
    return {
      visibility: 'discoverable_approval',
      membershipPolicy: policy === 'invite_only' ? 'invite_only' : 'approval',
    };
  }
  return {
    visibility: 'public',
    membershipPolicy: policy === 'approval' ? 'approval' : 'open',
  };
}

export async function createCircle(actorUserId: string, input: unknown): Promise<Circle> {
  const parsed = createCircleSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid Circle parameters.');
  }

  const data = parsed.data;
  const template = data.templateKey ? CIRCLE_TEMPLATES[data.templateKey] : undefined;

  const baseSlug = data.slug ? normalizeSlug(data.slug) : normalizeSlug(data.name);
  if (!baseSlug || baseSlug.length < 2) {
    throw new ValidationError('Circle name must contain at least 2 alphanumeric characters.');
  }

  const rawVisibility = data.visibility ?? template?.defaultVisibility ?? 'public';
  const rawPolicy = data.membershipPolicy ?? template?.defaultMembershipPolicy ?? 'open';
  const { visibility, membershipPolicy } = reconcileVisibilityAndPolicy(rawVisibility, rawPolicy);
  const category = (data.category ?? template?.category ?? 'general') as CircleCategory;

  return withRlsTransaction(actorUserId, async (tx) => {
    let finalSlug = baseSlug;
    const slugCheck = await tx.query<{ id: string }>(
      `SELECT id FROM public.circles WHERE slug = $1 LIMIT 1;`,
      [finalSlug]
    );
    if (slugCheck.rows.length > 0) {
      if (data.slug) {
        throw new ConflictError(`A Circle with slug "${finalSlug}" already exists.`);
      }
      finalSlug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const circleId = crypto.randomUUID();

    const circleRes = await tx.query<Circle>(
      `INSERT INTO public.circles (
         id, name, slug, description, category, location, visibility, membership_policy,
         owner_id, template_key, template_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *;`,
      [
        circleId,
        data.name,
        finalSlug,
        data.description || template?.summary || '',
        category,
        data.location ?? null,
        visibility,
        membershipPolicy,
        actorUserId,
        template?.key ?? null,
        template?.version ?? null,
      ]
    );

    const createdCircle = circleRes.rows[0];

    // 1. Create active Owner membership for creator
    await tx.query(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
       VALUES ($1, $2, $3, 'owner', 'active');`,
      [crypto.randomUUID(), circleId, actorUserId]
    );

    // 2. Initialize capabilities from template or defaults
    const capabilityKeys = new Set<string>(
      template ? template.enabledCapabilities : getDefaultEnabledCapabilityKeys()
    );

    for (const capKey of capabilityKeys) {
      const def = CAPABILITY_REGISTRY[capKey];
      if (!def) continue;
      await tx.query(
        `INSERT INTO public.circle_capabilities (
           id, circle_id, capability_key, enabled, settings, enabled_by, enabled_at
         ) VALUES ($1, $2, $3, true, $4::jsonb, $5, NOW())
         ON CONFLICT (circle_id, capability_key) DO NOTHING;`,
        [
          crypto.randomUUID(),
          circleId,
          capKey,
          JSON.stringify(def.default_settings),
          actorUserId,
        ]
      );
    }

    // 3. Initialize default spaces
    const initialSpaces = template?.suggestedSpaces ?? [
      {
        name: 'Announcements',
        slug: 'announcements',
        description: 'Important updates and community notices.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'moderators' as const,
      },
      {
        name: 'General Discussion',
        slug: 'general',
        description: 'Open conversation for all members of the Circle.',
        icon: 'message-square',
        capabilityKey: 'discussions',
        postingPolicy: 'members' as const,
      },
    ];

    let sortOrder = 1;
    for (const sp of initialSpaces) {
      await tx.query(
        `INSERT INTO public.circle_spaces (
           id, circle_id, name, slug, description, icon, capability_key,
           visibility, posting_policy, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (circle_id, slug) DO NOTHING;`,
        [
          crypto.randomUUID(),
          circleId,
          sp.name,
          sp.slug,
          sp.description,
          sp.icon,
          sp.capabilityKey,
          visibility === 'public' ? 'public' : 'members',
          sp.postingPolicy,
          sortOrder++,
        ]
      );
    }

    // 4. Record audit log
    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'circle.created', 'circle', $4::text, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        circleId,
        JSON.stringify({
          name: createdCircle.name,
          slug: createdCircle.slug,
          visibility,
          membershipPolicy,
          templateKey: template?.key ?? null,
        }),
      ]
    );

    return {
      ...createdCircle,
      member_count: 1,
      current_user_role: 'owner',
      current_user_membership_status: 'active',
    };
  });
}

export async function updateCircle(
  actorUserId: string,
  circleId: string,
  input: unknown
): Promise<Circle> {
  const parsed = updateCircleSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid Circle settings.');
  }

  const updates = parsed.data;

  return withRlsTransaction(actorUserId, async (tx) => {
    const existingRes = await tx.query<Circle>(
      `SELECT * FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Circle not found or inaccessible.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];

    assertCirclePermission('circle.update_settings', existing.visibility, {
      userId: actorUserId,
      circleRole: membership?.role ?? null,
      membershipStatus: membership?.status ?? null,
    });

    const nextVisibility = updates.visibility ?? existing.visibility;
    const nextPolicyRaw = updates.membershipPolicy ?? existing.membership_policy;
    const { visibility, membershipPolicy } = reconcileVisibilityAndPolicy(
      nextVisibility,
      nextPolicyRaw
    );

    const updatedRes = await tx.query<Circle>(
      `UPDATE public.circles
       SET name = $1,
           description = $2,
           category = $3,
           location = $4,
           avatar_url = $5,
           cover_url = $6,
           visibility = $7,
           membership_policy = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *;`,
      [
        updates.name ?? existing.name,
        updates.description ?? existing.description,
        updates.category ?? existing.category,
        updates.location !== undefined ? updates.location : existing.location,
        updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatar_url,
        updates.coverUrl !== undefined ? updates.coverUrl : existing.cover_url,
        visibility,
        membershipPolicy,
        circleId,
      ]
    );

    const updated = updatedRes.rows[0];
    if (!updated) {
      throw new ForbiddenError('You do not have permission to update this Circle.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'circle.updated', 'circle', $4::text, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        circleId,
        JSON.stringify({
          name: updated.name,
          visibility: updated.visibility,
          membership_policy: updated.membership_policy,
          category: updated.category,
        }),
      ]
    );

    return {
      ...updated,
      current_user_role: membership?.role ?? null,
      current_user_membership_status: membership?.status ?? null,
    };
  });
}

export async function getCircleBySlugOrId(
  actorUserId: string | null,
  slugOrId: string
): Promise<Circle | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      Circle & {
        member_count: string;
        current_user_role: CircleRole | null;
        current_user_membership_status: MembershipStatus | null;
        current_user_join_request_status: JoinRequestStatus | null;
      }
    >(
      `SELECT c.*,
         (SELECT COUNT(*)::text FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.status = 'active') AS member_count,
         (SELECT m.role FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.user_id = $2::uuid LIMIT 1) AS current_user_role,
         (SELECT m.status FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.user_id = $2::uuid LIMIT 1) AS current_user_membership_status,
         (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = c.id AND jr.user_id = $2::uuid ORDER BY jr.created_at DESC LIMIT 1) AS current_user_join_request_status
       FROM public.circles c
       WHERE ${isUuid ? 'c.id = $1::uuid' : 'c.slug = $1'}
       LIMIT 1;`,
      [slugOrId, actorUserId]
    );

    const row = res.rows[0];
    if (!row) return null;

    return {
      ...row,
      member_count: parseInt(row.member_count ?? '0', 10),
    };
  });
}

export interface DiscoverCirclesOptions {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export async function discoverCircles(
  actorUserId: string | null,
  options: DiscoverCirclesOptions = {}
): Promise<Circle[]> {
  const search = options.search?.trim() ?? '';
  const category = options.category && options.category !== 'all' ? options.category : null;
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 60);
  const offset = Math.max(options.offset ?? 0, 0);

  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      Circle & {
        member_count: string;
        current_user_role: CircleRole | null;
        current_user_membership_status: MembershipStatus | null;
        current_user_join_request_status: JoinRequestStatus | null;
      }
    >(
      `SELECT c.*,
         (SELECT COUNT(*)::text FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.status = 'active') AS member_count,
         (SELECT m.role FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.user_id = $1::uuid LIMIT 1) AS current_user_role,
         (SELECT m.status FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.user_id = $1::uuid LIMIT 1) AS current_user_membership_status,
         (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = c.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS current_user_join_request_status
       FROM public.circles c
       WHERE c.status = 'active'
         AND c.visibility IN ('public', 'discoverable_approval')
         AND ($2::text IS NULL OR c.category = $2::text)
         AND (
           $3::text = ''
           OR c.name ILIKE '%' || $3::text || '%'
           OR c.description ILIKE '%' || $3::text || '%'
           OR c.location ILIKE '%' || $3::text || '%'
         )
       ORDER BY c.created_at DESC
       LIMIT $4 OFFSET $5;`,
      [actorUserId, category, search, limit, offset]
    );

    return res.rows.map((row) => ({
      ...row,
      member_count: parseInt(row.member_count ?? '0', 10),
    }));
  });
}

export async function listMyCircles(actorUserId: string): Promise<Circle[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      Circle & {
        member_count: string;
        current_user_role: CircleRole;
        current_user_membership_status: MembershipStatus;
      }
    >(
      `SELECT c.*,
         (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = c.id AND cm.status = 'active') AS member_count,
         m.role AS current_user_role,
         m.status AS current_user_membership_status
       FROM public.circle_memberships m
       JOIN public.circles c ON c.id = m.circle_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY
         CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END,
         c.name ASC;`,
      [actorUserId]
    );

    return res.rows.map((row) => ({
      ...row,
      member_count: parseInt(row.member_count ?? '0', 10),
    }));
  });
}

export async function getCircleAuditLogs(
  actorUserId: string,
  circleId: string
): Promise<AuditLogItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<AuditLogItem>(
      `SELECT al.*, p.display_name AS actor_name
       FROM public.audit_logs al
       LEFT JOIN public.profiles p ON p.id = al.actor_id
       WHERE al.circle_id = $1
       ORDER BY al.created_at DESC
       LIMIT 40;`,
      [circleId]
    );
    return res.rows;
  });
}
