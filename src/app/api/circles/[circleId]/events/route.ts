import { NextRequest, NextResponse } from 'next/server';
import {
  createCircleEvent,
  listCircleEvents,
  listEventRsvps,
  recordEventAttendance,
  rsvpToCircleEvent,
  updateCircleEvent,
} from '@/features/events/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    if (eventId) {
      const rsvps = await listEventRsvps(user?.id ?? null, params.circleId, eventId);
      return NextResponse.json({ rsvps });
    }

    const timeframeParam = searchParams.get('timeframe');
    const timeframe =
      timeframeParam === 'upcoming' || timeframeParam === 'past' ? timeframeParam : 'all';
    const eventTypeParam = searchParams.get('eventType');
    const eventType =
      eventTypeParam === 'event' ||
      eventTypeParam === 'meetup' ||
      eventTypeParam === 'workshop' ||
      eventTypeParam === 'online'
        ? eventTypeParam
        : undefined;

    const events = await listCircleEvents(user?.id ?? null, params.circleId, {
      timeframe,
      eventType,
    });
    return NextResponse.json({ events });
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
    if (
      body.action === 'rsvp' ||
      body.rsvpAction ||
      body.action === 'register' ||
      body.action === 'cancel'
    ) {
      if (!body.eventId) throw new ValidationError('eventId is required.');
      const desiredAction =
        body.rsvpAction === 'cancel' || body.action === 'cancel' ? 'cancel' : 'register';
      const outcome = await rsvpToCircleEvent(
        user.id,
        params.circleId,
        String(body.eventId),
        desiredAction
      );
      const events = await listCircleEvents(user.id, params.circleId);
      const updatedEvent = events.find((e) => e.id === body.eventId) ?? null;
      return NextResponse.json({ ...outcome, event: updatedEvent });
    }

    const event = await createCircleEvent(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ event }, { status: 201 });
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
    if (!body.eventId) throw new ValidationError('eventId is required.');

    if (body.action === 'attendance') {
      if (!body.targetUserId) throw new ValidationError('targetUserId is required.');
      const rsvp = await recordEventAttendance(
        user.id,
        params.circleId,
        String(body.eventId),
        String(body.targetUserId),
        Boolean(body.attended)
      );
      const events = await listCircleEvents(user.id, params.circleId);
      const updatedEvent = events.find((e) => e.id === body.eventId) ?? null;
      return NextResponse.json({ rsvp, event: updatedEvent });
    }

    const event = await updateCircleEvent(
      user.id,
      params.circleId,
      String(body.eventId),
      body
    );
    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error);
  }
}
