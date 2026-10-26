import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  CircleEventItem,
  CircleRole,
  CircleVisibility,
  EventRsvpItem,
  MembershipStatus,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { createNotification } from '@/features/notifications/service';

export const createEventSchema = z.object({
  circleId: z.string().uuid(),
  spaceId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(8000).default(''),
  eventType: z.enum(['event', 'meetup', 'workshop', 'online']).default('event'),
  locationType: z.enum(['in_person', 'online', 'hybrid']).default('in_person'),
  venueText: z.string().trim().max(300).default(''),
  meetingUrl: z.string().url().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80).default('UTC'),
  capacity: z.number().int().min(1).max(100000).nullable().optional(),
  registrationClosesAt: z.string().datetime().nullable().optional(),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(8000).optional(),
  locationType: z.enum(['in_person', 'online', 'hybrid']).optional(),
  venueText: z.string().trim().max(300).optional(),
  meetingUrl: z.string().url().nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  capacity: z.number().int().min(1).max(100000).nullable().optional(),
  registrationClosesAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
});

const EVENT_CAPABILITY_KEYS = ['events', 'rsvps', 'attendance', 'activities_meetups'];

async function assertEventCapabilityAndMembership(
  tx: { query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  circleId: string,
  actorUserId: string | null
): Promise<{
  circle: { id: string; name: string; slug: string; visibility: CircleVisibility };
  membership: { role: CircleRole; status: MembershipStatus } | null;
  enabledKeys: Set<string>;
  allowMemberEvents: boolean;
  enableWaitlist: boolean;
}> {
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

  const capRes = await tx.query<{
    capability_key: string;
    enabled: boolean;
    settings: Record<string, unknown>;
  }>(
    `SELECT capability_key, enabled, settings FROM public.circle_capabilities
     WHERE circle_id = $1 AND capability_key = ANY($2::text[]) AND enabled = true;`,
    [circleId, EVENT_CAPABILITY_KEYS]
  );

  if (capRes.rows.length === 0) {
    throw new CapabilityDisabledError('events');
  }

  const enabledKeys = new Set(capRes.rows.map((r) => r.capability_key));
  const eventsCap = capRes.rows.find((r) => r.capability_key === 'events');
  const rsvpsCap = capRes.rows.find((r) => r.capability_key === 'rsvps');
  const allowMemberEvents = eventsCap?.settings?.allowMemberEvents !== false;
  const enableWaitlist = rsvpsCap?.settings?.enableWaitlist !== false;

  let membership: { role: CircleRole; status: MembershipStatus } | null = null;
  if (actorUserId) {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    membership = memRes.rows[0] ?? null;
  }

  return { circle, membership, enabledKeys, allowMemberEvents, enableWaitlist };
}

export async function createCircleEvent(
  actorUserId: string,
  input: z.input<typeof createEventSchema>
): Promise<CircleEventItem> {
  const parsed = createEventSchema.parse(input);
  if (new Date(parsed.endsAt).getTime() <= new Date(parsed.startsAt).getTime()) {
    throw new ValidationError('Event end time must be after start time.');
  }

  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership, allowMemberEvents } = await assertEventCapabilityAndMembership(
      tx,
      parsed.circleId,
      actorUserId
    );

    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can create events.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (!allowMemberEvents && !isStaff) {
      throw new ForbiddenError(
        'This Circle restricts event creation to moderators, administrators, and owners.'
      );
    }

    const eventId = crypto.randomUUID();
    const inserted = await tx.query<CircleEventItem>(
      `INSERT INTO public.circle_events (
         id, circle_id, space_id, organizer_id, title, description, event_type,
         location_type, venue_text, meeting_url, starts_at, ends_at, timezone,
         capacity, registration_closes_at, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'published')
       RETURNING *;`,
      [
        eventId,
        parsed.circleId,
        parsed.spaceId ?? null,
        actorUserId,
        parsed.title,
        parsed.description,
        parsed.eventType,
        parsed.locationType,
        parsed.venueText,
        parsed.meetingUrl ?? null,
        parsed.startsAt,
        parsed.endsAt,
        parsed.timezone,
        parsed.capacity ?? null,
        parsed.registrationClosesAt ?? null,
      ]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'event.created', 'circle_event', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        eventId,
        JSON.stringify({ title: parsed.title, eventType: parsed.eventType }),
      ]
    );

    return {
      ...inserted.rows[0],
      going_count: 0,
      waitlisted_count: 0,
      attended_count: 0,
      viewer_rsvp_status: null,
      viewer_attended: false,
    };
  });
}

export async function listCircleEvents(
  actorUserId: string | null,
  circleId: string,
  options?: {
    timeframe?: 'upcoming' | 'past' | 'all';
    eventType?: 'event' | 'meetup' | 'workshop' | 'online';
  }
): Promise<CircleEventItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertEventCapabilityAndMembership(
      tx,
      circleId,
      actorUserId
    );

    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view events in this Circle.');
    }

    const res = await tx.query<
      CircleEventItem & {
        organizer_username: string;
        organizer_display_name: string;
        organizer_avatar_url: string | null;
        going_count: number;
        waitlisted_count: number;
        attended_count: number;
        viewer_rsvp_status: 'going' | 'waitlisted' | 'cancelled' | null;
        viewer_attended: boolean | null;
      }
    >(
      `SELECT e.*,
         COALESCE(p.username, 'member') AS organizer_username,
         COALESCE(p.display_name, 'Organizer') AS organizer_display_name,
         p.avatar_url AS organizer_avatar_url,
         (SELECT COUNT(*)::int FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count,
         (SELECT COUNT(*)::int FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'waitlisted') AS waitlisted_count,
         (SELECT COUNT(*)::int FROM public.event_rsvps r WHERE r.event_id = e.id AND r.attended = true) AS attended_count,
         (SELECT r.status FROM public.event_rsvps r WHERE r.event_id = e.id AND r.user_id = $2 LIMIT 1) AS viewer_rsvp_status,
         (SELECT r.attended FROM public.event_rsvps r WHERE r.event_id = e.id AND r.user_id = $2 LIMIT 1) AS viewer_attended
       FROM public.circle_events e
       LEFT JOIN public.profiles p ON p.id = e.organizer_id
       WHERE e.circle_id = $1
       ORDER BY e.starts_at ASC;`,
      [circleId, actorUserId]
    );

    const nowMs = Date.now();
    const timeframe = options?.timeframe ?? 'all';

    return res.rows
      .filter((row) => {
        if (options?.eventType && row.event_type !== options.eventType) {
          return false;
        }
        const endsMs = new Date(row.ends_at).getTime();
        if (timeframe === 'upcoming') {
          return endsMs >= nowMs && row.status !== 'cancelled';
        }
        if (timeframe === 'past') {
          return endsMs < nowMs || row.status === 'completed';
        }
        return true;
      })
      .map((row) => ({
        id: row.id,
        circle_id: row.circle_id,
        space_id: row.space_id,
        organizer_id: row.organizer_id,
        title: row.title,
        description: row.description,
        event_type: row.event_type,
        location_type: row.location_type,
        venue_text: row.venue_text,
        meeting_url: row.meeting_url,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        timezone: row.timezone,
        capacity: row.capacity,
        registration_closes_at: row.registration_closes_at,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        organizer: {
          id: row.organizer_id,
          username: row.organizer_username,
          display_name: row.organizer_display_name,
          avatar_url: row.organizer_avatar_url,
        },
        going_count: Number(row.going_count ?? 0),
        waitlisted_count: Number(row.waitlisted_count ?? 0),
        attended_count: Number(row.attended_count ?? 0),
        viewer_rsvp_status: row.viewer_rsvp_status ?? null,
        viewer_attended: Boolean(row.viewer_attended),
      }));
  });
}

export async function updateCircleEvent(
  actorUserId: string,
  circleId: string,
  eventId: string,
  input: z.input<typeof updateEventSchema>
): Promise<CircleEventItem> {
  const parsed = updateEventSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertEventCapabilityAndMembership(
      tx,
      circleId,
      actorUserId
    );
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<CircleEventItem>(
      `SELECT * FROM public.circle_events WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [eventId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Event not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (existing.organizer_id !== actorUserId && !isStaff) {
      throw new ForbiddenError('Only the event organizer or a Circle moderator can edit this event.');
    }

    const nextStartsAt = parsed.startsAt ?? existing.starts_at;
    const nextEndsAt = parsed.endsAt ?? existing.ends_at;
    if (new Date(nextEndsAt).getTime() <= new Date(nextStartsAt).getTime()) {
      throw new ValidationError('Event end time must be after start time.');
    }

    const updatedRes = await tx.query<CircleEventItem>(
      `UPDATE public.circle_events
       SET title = $1,
           description = $2,
           location_type = $3,
           venue_text = $4,
           meeting_url = $5,
           starts_at = $6,
           ends_at = $7,
           capacity = $8,
           registration_closes_at = $9,
           status = $10,
           updated_at = NOW()
       WHERE id = $11 AND circle_id = $12
       RETURNING *;`,
      [
        parsed.title ?? existing.title,
        parsed.description ?? existing.description,
        parsed.locationType ?? existing.location_type,
        parsed.venueText ?? existing.venue_text,
        parsed.meetingUrl !== undefined ? parsed.meetingUrl : existing.meeting_url,
        nextStartsAt,
        nextEndsAt,
        parsed.capacity !== undefined ? parsed.capacity : existing.capacity,
        parsed.registrationClosesAt !== undefined
          ? parsed.registrationClosesAt
          : existing.registration_closes_at,
        parsed.status ?? existing.status,
        eventId,
        circleId,
      ]
    );

    const attendeesRes = await tx.query<{ user_id: string }>(
      `SELECT user_id FROM public.event_rsvps
       WHERE event_id = $1 AND circle_id = $2 AND status IN ('going', 'waitlisted');`,
      [eventId, circleId]
    );

    return {
      updated: updatedRes.rows[0],
      circleSlug: circle.slug,
      attendeeIds: attendeesRes.rows.map((r) => r.user_id).filter((id) => id !== actorUserId),
    };
  });

  if (parsed.status === 'cancelled') {
    for (const userId of outcome.attendeeIds) {
      await createNotification({
        recipientId: userId,
        actorId: actorUserId,
        circleId,
        eventType: 'event_updated',
        title: `Event Cancelled: ${outcome.updated.title}`,
        body: `The event "${outcome.updated.title}" has been cancelled.`,
        linkUrl: `/circles/${outcome.circleSlug}/events`,
      });
    }
  }

  return outcome.updated;
}

export async function rsvpToCircleEvent(
  actorUserId: string,
  circleId: string,
  eventId: string,
  desiredAction: 'register' | 'cancel'
): Promise<{
  rsvp: EventRsvpItem;
  promotedUserId: string | null;
}> {
  const result = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership, enableWaitlist } = await assertEventCapabilityAndMembership(
      tx,
      circleId,
      actorUserId
    );
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can RSVP to events.');
    }

    const eventRes = await tx.query<CircleEventItem>(
      `SELECT * FROM public.circle_events WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [eventId, circleId]
    );
    const event = eventRes.rows[0];
    if (!event) {
      throw new NotFoundError('Event not found in this Circle.');
    }

    if (event.status !== 'published') {
      throw new ValidationError(`Cannot RSVP to a ${event.status} event.`);
    }

    const existingRes = await tx.query<EventRsvpItem>(
      `SELECT * FROM public.event_rsvps
       WHERE event_id = $1 AND circle_id = $2 AND user_id = $3 LIMIT 1;`,
      [eventId, circleId, actorUserId]
    );
    const existing = existingRes.rows[0];

    if (desiredAction === 'cancel') {
      if (!existing || existing.status === 'cancelled') {
        throw new ValidationError('You do not have an active RSVP for this event.');
      }

      const wasGoing = existing.status === 'going';
      const cancelledRes = await tx.query<EventRsvpItem>(
        `UPDATE public.event_rsvps
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [existing.id]
      );

      let promotedUserId: string | null = null;
      if (wasGoing && event.capacity !== null) {
        // Promote earliest waitlisted member using service_role helper inside or after transaction
        const nextWaitlisted = await tx.query<{ id: string; user_id: string }>(
          `SELECT id, user_id FROM public.event_rsvps
           WHERE event_id = $1 AND circle_id = $2 AND status = 'waitlisted'
           ORDER BY created_at ASC
           LIMIT 1;`,
          [eventId, circleId]
        );
        if (nextWaitlisted.rows[0]) {
          promotedUserId = nextWaitlisted.rows[0].user_id;
        }
      }

      return {
        rsvp: cancelledRes.rows[0],
        promotedRsvpId: wasGoing && event.capacity !== null ? true : false,
        promotedUserId,
        eventTitle: event.title,
        organizerId: event.organizer_id,
        circleSlug: circle.slug,
      };
    }

    if (
      event.registration_closes_at &&
      new Date(event.registration_closes_at).getTime() <= Date.now()
    ) {
      throw new ValidationError('Registration for this event has closed.');
    }

    if (existing && (existing.status === 'going' || existing.status === 'waitlisted')) {
      return {
        rsvp: existing,
        promotedRsvpId: false,
        promotedUserId: null,
        eventTitle: event.title,
        organizerId: event.organizer_id,
        circleSlug: circle.slug,
      };
    }

    const goingCountRes = await tx.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM public.event_rsvps
       WHERE event_id = $1 AND circle_id = $2 AND status = 'going';`,
      [eventId, circleId]
    );
    const goingCount = Number(goingCountRes.rows[0]?.count ?? 0);

    let targetStatus: 'going' | 'waitlisted' = 'going';
    if (event.capacity !== null && goingCount >= event.capacity) {
      if (!enableWaitlist) {
        throw new ConflictError('This event has reached full capacity.');
      }
      targetStatus = 'waitlisted';
    }

    let rsvpRow: EventRsvpItem;
    if (existing) {
      const updated = await tx.query<EventRsvpItem>(
        `UPDATE public.event_rsvps
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *;`,
        [targetStatus, existing.id]
      );
      rsvpRow = updated.rows[0];
    } else {
      const inserted = await tx.query<EventRsvpItem>(
        `INSERT INTO public.event_rsvps (id, event_id, circle_id, user_id, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *;`,
        [crypto.randomUUID(), eventId, circleId, actorUserId, targetStatus]
      );
      rsvpRow = inserted.rows[0];
    }

    return {
      rsvp: rsvpRow,
      promotedRsvpId: false,
      promotedUserId: null,
      eventTitle: event.title,
      organizerId: event.organizer_id,
      circleSlug: circle.slug,
    };
  });

  if (result.promotedUserId) {
    await withServiceRoleTransaction(async (tx) => {
      await tx.query(
        `UPDATE public.event_rsvps
         SET status = 'going', updated_at = NOW()
         WHERE event_id = $1 AND circle_id = $2 AND user_id = $3 AND status = 'waitlisted';`,
        [eventId, circleId, result.promotedUserId]
      );
    });

    await createNotification({
      recipientId: result.promotedUserId,
      actorId: actorUserId,
      circleId,
      eventType: 'event_rsvp',
      title: `Promoted from Waitlist: ${result.eventTitle}`,
      body: `A spot opened up for "${result.eventTitle}" and your RSVP is now confirmed!`,
      linkUrl: `/circles/${result.circleSlug}/events`,
    });
  } else if (desiredAction === 'register' && result.organizerId !== actorUserId) {
    await createNotification({
      recipientId: result.organizerId,
      actorId: actorUserId,
      circleId,
      eventType: 'event_rsvp',
      title: `New Event RSVP: ${result.eventTitle}`,
      body: `A member registered (${result.rsvp.status}) for "${result.eventTitle}".`,
      linkUrl: `/circles/${result.circleSlug}/events`,
    });
  }

  return {
    rsvp: result.rsvp,
    promotedUserId: result.promotedUserId,
  };
}

export async function recordEventAttendance(
  actorUserId: string,
  circleId: string,
  eventId: string,
  targetUserId: string,
  attended: boolean
): Promise<EventRsvpItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertEventCapabilityAndMembership(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const eventRes = await tx.query<CircleEventItem>(
      `SELECT * FROM public.circle_events WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [eventId, circleId]
    );
    const event = eventRes.rows[0];
    if (!event) {
      throw new NotFoundError('Event not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (event.organizer_id !== actorUserId && !isStaff) {
      throw new ForbiddenError(
        'Only the event organizer or a Circle moderator can record attendance.'
      );
    }

    const updatedRes = await tx.query<EventRsvpItem>(
      `UPDATE public.event_rsvps
       SET attended = $1,
           checked_in_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
           checked_in_by = CASE WHEN $1 = true THEN $2::uuid ELSE NULL END,
           updated_at = NOW()
       WHERE event_id = $3 AND circle_id = $4 AND user_id = $5
       RETURNING *;`,
      [attended, actorUserId, eventId, circleId, targetUserId]
    );

    if (!updatedRes.rows[0]) {
      throw new NotFoundError('RSVP record not found for that participant.');
    }

    return updatedRes.rows[0];
  });
}

export async function listEventRsvps(
  actorUserId: string | null,
  circleId: string,
  eventId: string
): Promise<EventRsvpItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertEventCapabilityAndMembership(
      tx,
      circleId,
      actorUserId
    );
    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view RSVPs in this Circle.');
    }

    const res = await tx.query<
      EventRsvpItem & {
        username: string;
        display_name: string;
        avatar_url: string | null;
      }
    >(
      `SELECT r.*,
         COALESCE(p.username, 'member') AS username,
         COALESCE(p.display_name, 'Member') AS display_name,
         p.avatar_url
       FROM public.event_rsvps r
       LEFT JOIN public.profiles p ON p.id = r.user_id
       WHERE r.event_id = $1 AND r.circle_id = $2
       ORDER BY r.created_at ASC;`,
      [eventId, circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      event_id: r.event_id,
      circle_id: r.circle_id,
      user_id: r.user_id,
      status: r.status,
      attended: r.attended,
      checked_in_at: r.checked_in_at,
      checked_in_by: r.checked_in_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      profile: {
        id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
      },
    }));
  });
}
