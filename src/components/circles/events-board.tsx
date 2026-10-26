'use client';

import React, { useState } from 'react';
import { Calendar, CheckCircle2, Clock, MapPin, Plus, Users } from 'lucide-react';
import { CircleEventItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export function EventsBoard({
  circleId,
  initialEvents,
  canCreateEvent,
  isMember,
}: {
  circleId: string;
  initialEvents: CircleEventItem[];
  canCreateEvent: boolean;
  isMember: boolean;
}) {
  const [events, setEvents] = useState<CircleEventItem[]>(initialEvents);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'event' | 'meetup' | 'workshop' | 'online'>('event');
  const [locationType, setLocationType] = useState<'in_person' | 'online' | 'hybrid'>('in_person');
  const [venueText, setVenueText] = useState('');
  const [capacity, setCapacity] = useState('');
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 86400_000);
    return d.toISOString().slice(0, 16);
  });
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date(Date.now() + 93600_000);
    return d.toISOString().slice(0, 16);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          eventType,
          locationType,
          venueText,
          capacity: capacity ? Number(capacity) : null,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event.');
      }
      setEvents((prev) => [data.event, ...prev]);
      setTitle('');
      setDescription('');
      setVenueText('');
      setCapacity('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create event.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRsvp(eventId: string, action: 'register' | 'cancel') {
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, eventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update RSVP.');
      }
      setEvents((prev) => prev.map((e) => (e.id === eventId ? data.event : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update RSVP.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Linear-Style Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Events & Meetups</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-900 border border-stone-200">
              {events.length} SESSIONS
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Community gatherings, RSVPs, waitlists, and attendance check-ins.
          </p>
        </div>
        {canCreateEvent && (
          <Button
            size="sm"
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showCreate ? 'Close Form' : 'Schedule Event'}</span>
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateEvent}
          className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-premium space-y-4"
        >
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Schedule New Event
            </h3>
            <span className="text-[11px] font-mono text-stone-400">All times local</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Event Title *
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Systems Seminar"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Format & Location Type
              </label>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={eventType}
                  onChange={(e) =>
                    setEventType(
                      e.target.value as 'event' | 'meetup' | 'workshop' | 'online'
                    )
                  }
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="event">Event</option>
                  <option value="meetup">Meetup</option>
                  <option value="workshop">Workshop</option>
                  <option value="online">Online Session</option>
                </select>
                <select
                  value={locationType}
                  onChange={(e) =>
                    setLocationType(e.target.value as 'in_person' | 'online' | 'hybrid')
                  }
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="in_person">In-Person</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Starts At *
              </label>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Ends At *
              </label>
              <input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Venue or Link
              </label>
              <input
                value={venueText}
                onChange={(e) => setVenueText(e.target.value)}
                placeholder="e.g. Appleton Tower Room 3.02 or Zoom link"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Capacity Limit (Waitlist auto-activates)
              </label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Leave blank for unlimited"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Description & Agenda
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What to expect, preparation notes, materials needed..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Publishing...' : 'Publish Event'}
            </Button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <Calendar className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">No Upcoming Events</h3>
          <p className="mt-1 text-xs text-stone-500">
            Schedule a gathering, workshop, or meetup for community members.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((ev) => {
            const isGoing = ev.viewer_rsvp_status === 'going';
            const isWaitlisted = ev.viewer_rsvp_status === 'waitlisted';
            const capacityRatio = ev.capacity
              ? Math.min(100, Math.round(((ev.going_count || 0) / ev.capacity) * 100))
              : null;

            return (
              <div
                key={ev.id}
                className="group rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs hover:border-black/30 hover:shadow-premium-hover transition-all duration-200 space-y-4"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-900 border border-stone-200">
                        {ev.event_type}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600 border border-stone-200/60">
                        {ev.location_type.replace('_', ' ')}
                      </span>
                      {ev.status === 'cancelled' && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-mono font-bold text-red-800">
                          CANCELLED
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-bold text-stone-900 group-hover:text-black transition-colors">
                      {ev.title}
                    </h3>
                    {ev.description && (
                      <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  {isMember && ev.status === 'published' && (
                    <div className="flex items-center gap-2 shrink-0">
                      {isGoing || isWaitlisted ? (
                        <>
                          <span
                            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                              isWaitlisted
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-zinc-950 text-white border border-zinc-900'
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{isWaitlisted ? 'Waitlisted' : 'Registered'}</span>
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRsvp(ev.id, 'cancel')}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => handleRsvp(ev.id, 'register')}>
                          RSVP
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress bar if capacity exists */}
                {capacityRatio !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-stone-500">
                      <span>RSVP Capacity</span>
                      <span>
                        {ev.going_count || 0} / {ev.capacity} spots ({capacityRatio}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black transition-all rounded-full"
                        style={{ width: `${capacityRatio}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-5 border-t border-stone-100 pt-3 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                    <Clock className="h-3.5 w-3.5 text-stone-900" />
                    {new Date(ev.starts_at).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  {ev.venue_text && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-stone-400" />
                      {ev.venue_text}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-stone-400" />
                    {ev.going_count ?? 0} confirmed
                    {(ev.waitlisted_count ?? 0) > 0 && (
                      <span className="text-amber-700 font-medium">
                        · {ev.waitlisted_count} waitlisted
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
