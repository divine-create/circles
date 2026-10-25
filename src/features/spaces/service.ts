import crypto from 'crypto';
import { withRlsTransaction } from '@/lib/db/postgres';
import { createSpaceSchema, normalizeSlug } from '@/lib/validation';
import { CircleRole, CircleSpace, CircleVisibility, MembershipStatus } from '@/types/domain';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCirclePermission } from '@/lib/authorization/permissions';
import { requireEnabledCapability } from '@/features/capabilities/service';

export async function listCircleSpaces(
  actorUserId: string | null,
  circleId: string,
  includeArchived = false
): Promise<CircleSpace[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ capability_key: string }>(
      `SELECT capability_key FROM public.circle_capabilities
       WHERE circle_id = $1 AND enabled = true;`,
      [circleId]
    );
    const enabledKeys = new Set(capRes.rows.map((r) => r.capability_key));
    if (!enabledKeys.has('spaces')) {
      return [];
    }

    const res = await tx.query<CircleSpace>(
      `SELECT * FROM public.circle_spaces
       WHERE circle_id = $1
         AND ($2::boolean = true OR is_archived = false)
       ORDER BY sort_order ASC, created_at ASC;`,
      [circleId, includeArchived]
    );

    return res.rows.filter(
      (sp) => includeArchived || !sp.capability_key || enabledKeys.has(sp.capability_key)
    );
  });
}

export async function createCircleSpace(
  actorUserId: string,
  circleId: string,
  input: unknown
): Promise<CircleSpace> {
  await requireEnabledCapability(actorUserId, circleId, 'spaces');

  const parsed = createSpaceSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid space data.');
  }

  const data = parsed.data;
  const slug = data.slug ? normalizeSlug(data.slug) : normalizeSlug(data.name);
  if (!slug) {
    throw new ValidationError('Space name must produce a valid slug.');
  }

  return withRlsTransaction(actorUserId, async (tx) => {
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
    const membership = memberRes.rows[0];

    assertCirclePermission('circle.manage_spaces', circle.visibility, {
      userId: actorUserId,
      circleRole: membership?.role ?? null,
      membershipStatus: membership?.status ?? null,
    });

    const dupCheck = await tx.query<{ id: string }>(
      `SELECT id FROM public.circle_spaces WHERE circle_id = $1 AND slug = $2 LIMIT 1;`,
      [circleId, slug]
    );
    if (dupCheck.rows.length > 0) {
      throw new ConflictError(`A space with slug "${slug}" already exists in this Circle.`);
    }

    const maxOrderRes = await tx.query<{ max_order: number | null }>(
      `SELECT MAX(sort_order) AS max_order FROM public.circle_spaces WHERE circle_id = $1;`,
      [circleId]
    );
    const nextOrder = (maxOrderRes.rows[0]?.max_order ?? 0) + 1;

    const spaceId = crypto.randomUUID();
    const inserted = await tx.query<CircleSpace>(
      `INSERT INTO public.circle_spaces (
         id, circle_id, name, slug, description, icon, capability_key,
         visibility, posting_policy, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *;`,
      [
        spaceId,
        circleId,
        data.name,
        slug,
        data.description,
        data.icon,
        data.capabilityKey ?? null,
        data.visibility,
        data.postingPolicy,
        nextOrder,
      ]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'space.created', 'circle_space', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        spaceId,
        JSON.stringify({ name: data.name, slug, capabilityKey: data.capabilityKey ?? null }),
      ]
    );

    const row = inserted.rows[0];
    if (!row) {
      throw new ForbiddenError('Unable to create space.');
    }
    return row;
  });
}

export async function archiveCircleSpace(
  actorUserId: string,
  circleId: string,
  spaceId: string,
  archived = true
): Promise<CircleSpace> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    if (!circleRes.rows[0]) {
      throw new NotFoundError('Circle not found.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.manage_spaces', circleRes.rows[0].visibility, {
      userId: actorUserId,
      circleRole: memberRes.rows[0]?.role ?? null,
      membershipStatus: memberRes.rows[0]?.status ?? null,
    });

    const updated = await tx.query<CircleSpace>(
      `UPDATE public.circle_spaces
       SET is_archived = $1, updated_at = NOW()
       WHERE id = $2 AND circle_id = $3
       RETURNING *;`,
      [archived, spaceId, circleId]
    );

    if (!updated.rows[0]) {
      throw new NotFoundError('Space not found in this Circle.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, 'circle_space', $5, $6::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        archived ? 'space.archived' : 'space.restored',
        spaceId,
        JSON.stringify({ spaceId, archived }),
      ]
    );

    return updated.rows[0];
  });
}

export async function reorderCircleSpaces(
  actorUserId: string,
  circleId: string,
  orderedSpaceIds: string[]
): Promise<void> {
  await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    if (!circleRes.rows[0]) {
      throw new NotFoundError('Circle not found.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.manage_spaces', circleRes.rows[0].visibility, {
      userId: actorUserId,
      circleRole: memberRes.rows[0]?.role ?? null,
      membershipStatus: memberRes.rows[0]?.status ?? null,
    });

    for (let i = 0; i < orderedSpaceIds.length; i++) {
      await tx.query(
        `UPDATE public.circle_spaces
         SET sort_order = $1, updated_at = NOW()
         WHERE id = $2 AND circle_id = $3;`,
        [i + 1, orderedSpaceIds[i], circleId]
      );
    }
  });
}
