import { AvailabilitySchedule, ServiceBookingItem } from '@/types/domain';

/**
 * Generates available daily time slots based on a listing's recurring availability schedule
 * and existing booked intervals.
 */
export function generateAvailableSlots(
  schedule: AvailabilitySchedule | null | undefined,
  dateStr: string, // "YYYY-MM-DD"
  existingBookings: { starts_at: string; ends_at: string; status: string }[] = []
): { startsAt: string; endsAt: string; label: string; available: boolean }[] {
  const days = schedule?.days && schedule.days.length > 0 ? schedule.days : [1, 2, 3, 4, 5];
  const startTime = schedule?.startTime || '09:00';
  const endTime = schedule?.endTime || '17:00';
  const slotDuration = schedule?.slotDurationMinutes || 60;
  const buffer = schedule?.bufferMinutes || 0;

  const targetDate = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = targetDate.getDay();

  // If the listing doesn't operate on this day of week, return empty array
  if (!days.includes(dayOfWeek)) {
    return [];
  }

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMs = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`).getTime();
  const endMs = new Date(`${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`).getTime();

  const slotStepMs = (slotDuration + buffer) * 60 * 1000;
  const slotDurationMs = slotDuration * 60 * 1000;

  const slots: { startsAt: string; endsAt: string; label: string; available: boolean }[] = [];

  for (let current = startMs; current + slotDurationMs <= endMs; current += slotStepMs) {
    const slotStart = new Date(current);
    const slotEnd = new Date(current + slotDurationMs);

    const slotStartIso = slotStart.toISOString();
    const slotEndIso = slotEnd.toISOString();

    const conflicts = existingBookings.some((b) => {
      if (b.status === 'rejected' || b.status === 'cancelled') return false;
      const bStart = new Date(b.starts_at).getTime();
      const bEnd = new Date(b.ends_at).getTime();
      return bStart < slotEnd.getTime() && bEnd > slotStart.getTime();
    });

    const formatTime = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    slots.push({
      startsAt: slotStartIso,
      endsAt: slotEndIso,
      label: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
      available: !conflicts,
    });
  }

  return slots;
}

/**
 * Generates an RFC 5545 iCalendar (.ics) string for export and calendar synchronization.
 */
export function generateBookingIcs(
  booking: ServiceBookingItem,
  listingTitle: string,
  circleName?: string
): string {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtStart = new Date(booking.starts_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtEnd = new Date(booking.ends_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = booking.calendar_uid || `booking-${booking.id}@circles.dev`;
  const summary = `${listingTitle} (${booking.booking_type === 'rental' ? 'Rental' : 'Service Booking'})`;
  const description = `Confirmed reservation in Circles ${circleName ? `(${circleName})` : ''}. Notes: ${booking.notes || 'None'}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Circles Platform//Community Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `STATUS:${booking.status === 'approved' ? 'CONFIRMED' : 'TENTATIVE'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
