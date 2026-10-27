'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Users,
  Video,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  X,
  Edit3,
  Download,
  Layers,
} from 'lucide-react';
import { CircleEventItem, CircleRole, CircleSpace, EventRsvpItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export interface EventsBoardProps {
  circleId: string;
  circleSlug?: string;
  circleName?: string;
  initialEvents: CircleEventItem[];
  canCreateEvent: boolean;
  isMember: boolean;
  currentUserId?: string | null;
  currentUserRole?: CircleRole | null;
  spaces?: CircleSpace[];
}

export function EventsBoard({
  circleId,
  circleSlug = 'community',
  circleName = 'Circles Community',
  initialEvents,
  canCreateEvent,
  isMember,
  currentUserId,
  currentUserRole,
  spaces = [],
}: EventsBoardProps) {
  const [events, setEvents] = useState<CircleEventItem[]>(initialEvents);
  const [timeframe, setTimeframe] = useState<'upcoming' | 'past' | 'my_rsvps'>('upcoming');
  const [selectedType, setSelectedType] = useState<
    'all' | 'event' | 'meetup' | 'workshop' | 'online'
  >('all');
  const [selectedSpaceId, setSelectedSpaceId] = useState<'all' | string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Calendar month state
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);

  // Form modal state (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'event' | 'meetup' | 'workshop' | 'online'>('event');
  const [locationType, setLocationType] = useState<'in_person' | 'online' | 'hybrid'>('in_person');
  const [venueText, setVenueText] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [spaceId, setSpaceId] = useState<string>('');
  const [capacity, setCapacity] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  // Roster / Check-in Drawer state
  const [rosterEvent, setRosterEvent] = useState<CircleEventItem | null>(null);
  const [rosterRsvps, setRosterRsvps] = useState<EventRsvpItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'all' | 'going' | 'waitlisted' | 'attended'>('all');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaff = currentUserRole ? ['owner', 'admin', 'moderator'].includes(currentUserRole) : false;

  // Open Create Modal
  function handleOpenCreate() {
    setEditingEventId(null);
    setTitle('');
    setDescription('');
    setEventType('event');
    setLocationType('in_person');
    setVenueText('');
    setMeetingUrl('');
    setSpaceId('');
    setCapacity('');
    const now = Date.now();
    const start = new Date(now + 86400_000);
    const end = new Date(now + 93600_000);
    setStartsAt(start.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
    setModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(ev: CircleEventItem) {
    setEditingEventId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description || '');
    setEventType(ev.event_type);
    setLocationType(ev.location_type);
    setVenueText(ev.venue_text || '');
    setMeetingUrl(ev.meeting_url || '');
    setSpaceId(ev.space_id || '');
    setCapacity(ev.capacity ? String(ev.capacity) : '');
    setStartsAt(new Date(ev.starts_at).toISOString().slice(0, 16));
    setEndsAt(new Date(ev.ends_at).toISOString().slice(0, 16));
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingEventId(null);
    setError(null);
  }

  // Save Event (Create or Edit)
  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const isEdit = Boolean(editingEventId);
      const url = `/api/circles/${circleId}/events`;
      const method = isEdit ? 'PATCH' : 'POST';
      const payload = {
        ...(isEdit ? { eventId: editingEventId } : {}),
        title,
        description,
        eventType,
        locationType,
        venueText,
        meetingUrl: meetingUrl.trim() ? meetingUrl.trim() : null,
        spaceId: spaceId ? spaceId : null,
        capacity: capacity ? Number(capacity) : null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} event.`);
      }

      if (isEdit) {
        setEvents((prev) => prev.map((item) => (item.id === editingEventId ? data.event : item)));
      } else {
        setEvents((prev) => [data.event, ...prev]);
      }
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event.');
    } finally {
      setLoading(false);
    }
  }

  // Cancel Event
  async function handleCancelEvent(eventId: string) {
    if (!window.confirm('Are you sure you want to cancel this event? Attendees will be notified.')) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel event.');
      }
      setEvents((prev) => prev.map((e) => (e.id === eventId ? data.event : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel event.');
    }
  }

  // RSVP Register or Cancel
  async function handleRsvp(eventId: string, action: 'register' | 'cancel') {
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rsvp', rsvpAction: action, eventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update RSVP.');
      }
      if (data.event) {
        setEvents((prev) => prev.map((e) => (e.id === eventId ? data.event : e)));
      } else {
        // Fallback state update
        setEvents((prev) =>
          prev.map((e) => {
            if (e.id !== eventId) return e;
            const wasGoing = e.viewer_rsvp_status === 'going';
            const isReg = action === 'register';
            return {
              ...e,
              viewer_rsvp_status: isReg ? 'going' : null,
              going_count: Math.max(0, (e.going_count || 0) + (isReg ? 1 : wasGoing ? -1 : 0)),
            };
          })
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update RSVP.');
    }
  }

  // Open Roster & Fetch RSVPs
  async function handleOpenRoster(ev: CircleEventItem) {
    setRosterEvent(ev);
    setLoadingRoster(true);
    setRosterRsvps([]);
    try {
      const res = await fetch(`/api/circles/${circleId}/events?eventId=${ev.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendees.');
      setRosterRsvps(data.rsvps || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load attendees.');
    } finally {
      setLoadingRoster(false);
    }
  }

  // Check-in Toggle for Host
  async function handleToggleAttendance(targetUserId: string, currentAttended: boolean) {
    if (!rosterEvent) return;
    const nextAttended = !currentAttended;
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attendance',
          eventId: rosterEvent.id,
          targetUserId,
          attended: nextAttended,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update attendance.');
      setRosterRsvps((prev) =>
        prev.map((r) =>
          r.user_id === targetUserId
            ? {
                ...r,
                attended: nextAttended,
                checked_in_at: nextAttended ? new Date().toISOString() : null,
              }
            : r
        )
      );
      if (data.event) {
        setEvents((prev) => prev.map((e) => (e.id === rosterEvent.id ? data.event : e)));
        setRosterEvent(data.event);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Attendance update failed.');
    }
  }

  // Calendar sync helpers
  function getGoogleCalendarUrl(ev: CircleEventItem): string {
    const formatGCalDate = (isoStr: string) =>
      new Date(isoStr).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const start = formatGCalDate(ev.starts_at);
    const end = formatGCalDate(ev.ends_at);
    const details = encodeURIComponent(
      `${ev.description || ''}\n\nCommunity: ${circleName}\nEvent Link: /circles/${circleSlug}/events${
        ev.meeting_url ? `\nMeeting Link: ${ev.meeting_url}` : ''
      }`
    );
    const titleEnc = encodeURIComponent(ev.title);
    const locationEnc = encodeURIComponent(
      ev.location_type === 'online' ? ev.meeting_url || 'Online Session' : ev.venue_text || ''
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleEnc}&dates=${start}/${end}&details=${details}&location=${locationEnc}`;
  }

  function downloadIcsFile(ev: CircleEventItem) {
    const formatIcsDate = (isoStr: string) =>
      new Date(isoStr).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const start = formatIcsDate(ev.starts_at);
    const end = formatIcsDate(ev.ends_at);
    const now = formatIcsDate(new Date().toISOString());

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Circles Platform//Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ev.id}@circles-platform`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${ev.title.replace(/\n/g, ' ')}`,
      `DESCRIPTION:${(ev.description || '').replace(/\n/g, '\\n')}\\n\\nCommunity: ${circleName}\\nLink: /circles/${circleSlug}/events`,
      `LOCATION:${(ev.location_type === 'online' ? ev.meeting_url : ev.venue_text) || 'Online'}`,
      `STATUS:${ev.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const nowMs = Date.now();
    return events.filter((ev) => {
      // Timeframe filter
      const endsMs = new Date(ev.ends_at).getTime();
      if (timeframe === 'upcoming') {
        if (endsMs < nowMs && ev.status !== 'published') return false;
        if (ev.status === 'cancelled') return false;
      } else if (timeframe === 'past') {
        if (endsMs >= nowMs && ev.status !== 'completed') return false;
      } else if (timeframe === 'my_rsvps') {
        if (!ev.viewer_rsvp_status || ev.viewer_rsvp_status === 'cancelled') return false;
      }

      // Event Type filter
      if (selectedType !== 'all' && ev.event_type !== selectedType) {
        return false;
      }

      // Space filter
      if (selectedSpaceId !== 'all' && ev.space_id !== selectedSpaceId) {
        return false;
      }

      // Selected calendar day filter
      if (selectedDayFilter) {
        const evDateStr = new Date(ev.starts_at).toISOString().slice(0, 10);
        if (evDateStr !== selectedDayFilter) return false;
      }

      return true;
    });
  }, [events, timeframe, selectedType, selectedSpaceId, selectedDayFilter]);

  // Calendar calculations
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const days: Array<{ dayNumber: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthTotalDays = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const d = new Date(calendarYear, calendarMonth - 1, dayNum);
      days.push({
        dayNumber: dayNum,
        dateStr: d.toISOString().slice(0, 10),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(calendarYear, calendarMonth, i);
      days.push({
        dayNumber: i,
        dateStr: d.toISOString().slice(0, 10),
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(calendarYear, calendarMonth + 1, i);
      days.push({
        dayNumber: i,
        dateStr: d.toISOString().slice(0, 10),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  // Group events by YYYY-MM-DD for calendar markers
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CircleEventItem[]>();
    for (const ev of events) {
      const dateStr = new Date(ev.starts_at).toISOString().slice(0, 10);
      const list = map.get(dateStr) || [];
      list.push(ev);
      map.set(dateStr, list);
    }
    return map;
  }, [events]);

  return (
    <div className="space-y-6">
      {/* Platform Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-stone-900">Events & Meetups</h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-emerald-800 border border-emerald-200">
              {events.length} SESSIONS
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Community workshops, meetups, live streams, and attendance tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-xl bg-stone-100 p-0.5 border border-stone-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-stone-950 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Agenda
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-stone-950 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Calendar
            </button>
          </div>

          {canCreateEvent && (
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Schedule Event</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Control Bar: Tabs & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        {/* Timeframe Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTimeframe('upcoming');
              setSelectedDayFilter(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              timeframe === 'upcoming' && !selectedDayFilter
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            Upcoming
          </button>
          {isMember && (
            <button
              type="button"
              onClick={() => {
                setTimeframe('my_rsvps');
                setSelectedDayFilter(null);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                timeframe === 'my_rsvps'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
              }`}
            >
              My RSVPs
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setTimeframe('past');
              setSelectedDayFilter(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              timeframe === 'past'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            Past Sessions
          </button>
        </div>

        {/* Format Pill Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {spaces.length > 0 && (
            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 font-medium focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="all">All Spaces</option>
              {spaces.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1">
            {(['all', 'workshop', 'meetup', 'online', 'event'] as const).map((typeKey) => (
              <button
                key={typeKey}
                type="button"
                onClick={() => setSelectedType(typeKey)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-all ${
                  selectedType === typeKey
                    ? 'bg-stone-200 text-stone-900 font-bold'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}
              >
                {typeKey}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Day Filter Banner */}
      {selectedDayFilter && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-medium text-emerald-900">
          <span>
            Filtering events for <strong>{selectedDayFilter}</strong>
          </span>
          <button
            type="button"
            onClick={() => setSelectedDayFilter(null)}
            className="text-emerald-700 underline hover:text-emerald-900 text-xs"
          >
            Clear Date Filter
          </button>
        </div>
      )}

      {/* Month Calendar Grid View */}
      {viewMode === 'calendar' && (
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider font-mono">
              {monthName}
            </h3>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px rounded-xl bg-stone-200 overflow-hidden border border-stone-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="bg-stone-50/90 py-2 text-center text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
            {calendarDays.map((calDay, idx) => {
              const dayEvents = eventsByDate.get(calDay.dateStr) || [];
              const isToday =
                new Date().toISOString().slice(0, 10) === calDay.dateStr;
              const isSelected = selectedDayFilter === calDay.dateStr;

              return (
                <div
                  key={`${calDay.dateStr}-${idx}`}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDayFilter(
                        selectedDayFilter === calDay.dateStr ? null : calDay.dateStr
                      );
                    }
                  }}
                  className={`min-h-[90px] p-2 transition-colors relative flex flex-col justify-between ${
                    calDay.isCurrentMonth ? 'bg-white' : 'bg-stone-50/50 text-stone-400'
                  } ${dayEvents.length > 0 ? 'cursor-pointer hover:bg-stone-50/90' : ''} ${
                    isSelected ? 'ring-2 ring-emerald-600 ring-inset bg-emerald-50/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-semibold rounded-full h-5 w-5 flex items-center justify-center ${
                        isToday
                          ? 'bg-emerald-700 text-white'
                          : calDay.isCurrentMonth
                          ? 'text-stone-800'
                          : 'text-stone-400'
                      }`}
                    >
                      {calDay.dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 rounded-full px-1.5 py-0.2">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium bg-stone-100 text-stone-900 hover:bg-emerald-100 hover:text-emerald-950 transition-colors border border-stone-200/60"
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-stone-400 font-mono px-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda Card List */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <CalendarIcon className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">No Events Found</h3>
          <p className="mt-1 text-xs text-stone-500">
            {timeframe === 'my_rsvps'
              ? 'You have not RSVP’d to any events in this community yet.'
              : 'There are no events matching your selected filters.'}
          </p>
          {canCreateEvent && (
            <Button size="sm" onClick={handleOpenCreate} className="mt-4">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Schedule the First Event
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((ev) => {
            const isGoing = ev.viewer_rsvp_status === 'going';
            const isWaitlisted = ev.viewer_rsvp_status === 'waitlisted';
            const capacityRatio = ev.capacity
              ? Math.min(100, Math.round(((ev.going_count || 0) / ev.capacity) * 100))
              : null;
            const isFull = ev.capacity !== null && (ev.going_count || 0) >= ev.capacity;
            const canManage =
              currentUserId === ev.organizer_id || isStaff;

            const startDate = new Date(ev.starts_at);
            const monthStr = startDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const dayNum = startDate.getDate();
            const weekDay = startDate.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();

            return (
              <div
                key={ev.id}
                className="group relative rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-stone-400 hover:shadow-premium-hover transition-all duration-200"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  {/* Date Ribbon Badge */}
                  <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-center sm:justify-center rounded-xl bg-stone-50 px-3.5 py-2.5 border border-stone-200/80 shrink-0 sm:w-20 sm:text-center">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-800">
                      {monthStr}
                    </span>
                    <span className="text-xl font-black text-stone-900 tracking-tight">
                      {dayNum}
                    </span>
                    <span className="text-[10px] font-mono text-stone-500 font-semibold">
                      {weekDay}
                    </span>
                  </div>

                  {/* Main Event Body */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-900 border border-emerald-200">
                        {ev.event_type}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-mono text-stone-700 border border-stone-200">
                        {ev.location_type.replace('_', ' ')}
                      </span>
                      {ev.space_name && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-50 px-2.5 py-0.5 text-[10px] font-mono text-stone-600 border border-stone-200/70">
                          <Layers className="h-3 w-3" />
                          {ev.space_name}
                        </span>
                      )}
                      {ev.status === 'cancelled' && (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-red-800 border border-red-200">
                          CANCELLED
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-emerald-950 transition-colors">
                        {ev.title}
                      </h3>
                      {ev.description && (
                        <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal whitespace-pre-line">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
                      <span className="inline-flex items-center gap-1.5 font-medium text-stone-800">
                        <Clock className="h-3.5 w-3.5 text-emerald-800" />
                        {startDate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        –{' '}
                        {new Date(ev.ends_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        <span className="text-[10px] font-mono text-stone-400">
                          ({ev.timezone || 'UTC'})
                        </span>
                      </span>

                      {ev.venue_text && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-stone-400" />
                          {ev.venue_text}
                        </span>
                      )}

                      {ev.organizer && (
                        <span className="text-stone-500">
                          Hosted by{' '}
                          <strong className="text-stone-700 font-medium">
                            {ev.organizer.display_name}
                          </strong>
                        </span>
                      )}
                    </div>

                    {/* Gated Online Live Session Link */}
                    {ev.location_type !== 'in_person' && ev.meeting_url && (
                      <div className="mt-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-emerald-800 shrink-0" />
                          <div className="text-xs">
                            <span className="font-semibold text-emerald-950">
                              Online Session Access
                            </span>
                            <p className="text-[11px] text-emerald-800 font-normal">
                              {isGoing
                                ? 'Your RSVP is confirmed. You can join the session directly.'
                                : 'RSVP to unlock meeting link.'}
                            </p>
                          </div>
                        </div>

                        {isGoing ? (
                          <a
                            href={ev.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-900 transition-colors shrink-0"
                          >
                            <span>Join Live Session</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-lg">
                            Locked until RSVP
                          </span>
                        )}
                      </div>
                    )}

                    {/* Capacity Progress Bar */}
                    {capacityRatio !== null && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] font-mono text-stone-500">
                          <span>Registration Capacity</span>
                          <span>
                            {ev.going_count || 0} / {ev.capacity} spots ({capacityRatio}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              capacityRatio >= 100 ? 'bg-amber-600' : 'bg-emerald-700'
                            }`}
                            style={{ width: `${capacityRatio}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 text-xs">
                      {/* Left: Attendee stats & Calendar Export */}
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-stone-600 font-medium">
                          <Users className="h-3.5 w-3.5 text-stone-400" />
                          {ev.going_count ?? 0} confirmed
                          {(ev.waitlisted_count ?? 0) > 0 && (
                            <span className="text-amber-700 font-semibold">
                              · {ev.waitlisted_count} waitlisted
                            </span>
                          )}
                        </span>

                        <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
                          <a
                            href={getGoogleCalendarUrl(ev)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 underline"
                            title="Add to Google Calendar"
                          >
                            <CalendarIcon className="h-3 w-3" />
                            <span>Google Cal</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadIcsFile(ev)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 underline ml-1"
                            title="Download iCal (.ics) file"
                          >
                            <Download className="h-3 w-3" />
                            <span>.ics</span>
                          </button>
                        </div>
                      </div>

                      {/* Right: RSVP & Management Controls */}
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenRoster(ev)}
                              className="text-xs"
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              <span>Roster & Check-In</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(ev)}
                              title="Edit Event"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>

                            {ev.status !== 'cancelled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelEvent(ev.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Cancel Event"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}

                        {isMember && ev.status === 'published' && (
                          <div className="flex items-center gap-2">
                            {isGoing || isWaitlisted ? (
                              <>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold ${
                                    isWaitlisted
                                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                      : 'bg-emerald-900 text-white'
                                  }`}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
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
                              <Button
                                size="sm"
                                variant={isFull ? 'secondary' : 'primary'}
                                onClick={() => handleRsvp(ev.id, 'register')}
                              >
                                {isFull ? 'Join Waitlist' : 'RSVP'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {editingEventId ? 'Edit Event Details' : 'Schedule New Community Event'}
                </h3>
                <p className="text-xs text-stone-500">
                  Configure gathering format, agenda, location, and capacity limits.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Event Title *
                  </label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Next.js Architecture Deep Dive & Workshop"
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Format & Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) =>
                      setEventType(e.target.value as 'event' | 'meetup' | 'workshop' | 'online')
                    }
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="event">Event / Gathering</option>
                    <option value="workshop">Workshop / Seminar</option>
                    <option value="meetup">Informal Meetup</option>
                    <option value="online">Online Stream / Session</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Location Type
                  </label>
                  <select
                    value={locationType}
                    onChange={(e) =>
                      setLocationType(e.target.value as 'in_person' | 'online' | 'hybrid')
                    }
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="in_person">In-Person Only</option>
                    <option value="online">Online Only</option>
                    <option value="hybrid">Hybrid (In-Person & Online)</option>
                  </select>
                </div>

                {spaces.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                      Associated Space (Optional)
                    </label>
                    <select
                      value={spaceId}
                      onChange={(e) => setSpaceId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                    >
                      <option value="">No specific Space</option>
                      {spaces.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Capacity Limit (Auto-Waitlist)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
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
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
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
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                {locationType !== 'online' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                      Physical Venue Address / Room
                    </label>
                    <input
                      value={venueText}
                      onChange={(e) => setVenueText(e.target.value)}
                      placeholder="e.g. Turing Lecture Theatre or Main Hall Room 2.1"
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                  </div>
                )}

                {locationType !== 'in_person' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                      Online Meeting URL (Zoom / Google Meet / Discord)
                    </label>
                    <input
                      type="url"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      placeholder="https://meet.google.com/xyz-abcd-efg"
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                    />
                    <span className="text-[11px] text-stone-500 mt-1 block">
                      Protected: Revealed prominently to confirmed attendees upon RSVP.
                    </span>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Description & Agenda
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide context, speaker bios, topics covered, prerequisites..."
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <Button type="button" variant="ghost" size="sm" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? 'Saving...' : editingEventId ? 'Update Event' : 'Publish Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Host Attendee Roster & Check-in Drawer */}
      {rosterEvent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-6 space-y-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Attendee Roster & Attendance
                </h3>
                <p className="text-xs text-stone-500 font-normal truncate max-w-sm">
                  {rosterEvent.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRosterEvent(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Attendance Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-stone-50 p-3 border border-stone-200/80 text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                  Confirmed
                </div>
                <div className="text-lg font-black text-stone-900 mt-0.5">
                  {rosterEvent.going_count || 0}
                  {rosterEvent.capacity && (
                    <span className="text-xs font-normal text-stone-500">
                      {' '}
                      / {rosterEvent.capacity}
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50/60 p-3 border border-amber-200/80 text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-800">
                  Waitlist
                </div>
                <div className="text-lg font-black text-amber-900 mt-0.5">
                  {rosterEvent.waitlisted_count || 0}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50/60 p-3 border border-emerald-200/80 text-center">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-800">
                  Checked In
                </div>
                <div className="text-lg font-black text-emerald-900 mt-0.5">
                  {rosterEvent.attended_count || 0}
                </div>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Search attendee by name or username..."
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/60 pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex rounded-lg bg-stone-100 p-0.5 border border-stone-200 text-[11px]">
                {(['all', 'going', 'waitlisted', 'attended'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setRosterFilter(st)}
                    className={`rounded px-2 py-1 font-semibold uppercase text-[10px] transition-all ${
                      rosterFilter === st
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendees List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingRoster ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  Loading attendee roster...
                </div>
              ) : rosterRsvps.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  No RSVPs found for this event yet.
                </div>
              ) : (
                rosterRsvps
                  .filter((r) => {
                    if (rosterFilter === 'going' && r.status !== 'going') return false;
                    if (rosterFilter === 'waitlisted' && r.status !== 'waitlisted') return false;
                    if (rosterFilter === 'attended' && !r.attended) return false;
                    if (rosterSearch.trim()) {
                      const q = rosterSearch.toLowerCase();
                      const name = (r.profile?.display_name || '').toLowerCase();
                      const uname = (r.profile?.username || '').toLowerCase();
                      return name.includes(q) || uname.includes(q);
                    }
                    return true;
                  })
                  .map((rsvp) => {
                    return (
                      <div
                        key={rsvp.id}
                        className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-white p-3 hover:border-stone-300 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {rsvp.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rsvp.profile.avatar_url}
                              alt={rsvp.profile.display_name || 'Member'}
                              className="h-8 w-8 rounded-full object-cover border border-stone-200"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center border border-emerald-200">
                              {(rsvp.profile?.display_name || 'M')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-bold text-stone-900">
                              {rsvp.profile?.display_name || 'Member'}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              @{rsvp.profile?.username || 'member'} ·{' '}
                              <span
                                className={`font-semibold ${
                                  rsvp.status === 'going'
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {rsvp.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Check-in Toggle Button */}
                        <Button
                          size="sm"
                          variant={rsvp.attended ? 'secondary' : 'outline'}
                          onClick={() => handleToggleAttendance(rsvp.user_id, rsvp.attended)}
                          className={`text-xs ${
                            rsvp.attended
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                              : ''
                          }`}
                        >
                          <CheckCircle2
                            className={`h-3.5 w-3.5 mr-1 ${
                              rsvp.attended ? 'text-emerald-700' : 'text-stone-400'
                            }`}
                          />
                          <span>{rsvp.attended ? 'Checked In' : 'Check In'}</span>
                        </Button>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setRosterEvent(null)}>
                Close Roster
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
