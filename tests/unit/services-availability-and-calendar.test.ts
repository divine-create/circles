import { describe, expect, it } from 'vitest';
import { generateAvailableSlots, generateBookingIcs } from '@/features/marketplace/calendar-utils';
import { ServiceBookingItem } from '@/types/domain';

describe('Service Availability Slots & Calendar Sync (.ics)', () => {
  it('1. Generates recurring daily time slots according to provider schedule', () => {
    // Mon Oct 26 2026 is a Monday (day 1)
    const schedule = {
      days: [1, 2, 3, 4, 5],
      startTime: '10:00',
      endTime: '13:00',
      slotDurationMinutes: 60,
      bufferMinutes: 0,
    };

    const slots = generateAvailableSlots(schedule, '2026-10-26');
    expect(slots.length).toBe(3);
    expect(slots[0].label).toBe('10:00 - 11:00');
    expect(slots[1].label).toBe('11:00 - 12:00');
    expect(slots[2].label).toBe('12:00 - 13:00');
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it('2. Respects non-operating days of week (returns empty)', () => {
    // Sun Oct 25 2026 is Sunday (day 0)
    const schedule = {
      days: [1, 2, 3, 4, 5], // Monday through Friday only
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: 60,
      bufferMinutes: 0,
    };

    const slots = generateAvailableSlots(schedule, '2026-10-25');
    expect(slots.length).toBe(0);
  });

  it('3. Automatically marks conflicting approved bookings as unavailable', () => {
    const schedule = {
      days: [1],
      startTime: '09:00',
      endTime: '12:00',
      slotDurationMinutes: 60,
      bufferMinutes: 0,
    };

    // Existing booking from 10:00 to 11:00
    const existingBookings = [
      {
        starts_at: new Date('2026-10-26T10:00:00').toISOString(),
        ends_at: new Date('2026-10-26T11:00:00').toISOString(),
        status: 'approved',
      },
    ];

    const slots = generateAvailableSlots(schedule, '2026-10-26', existingBookings);
    expect(slots.length).toBe(3);
    expect(slots[0].available).toBe(true); // 09:00 - 10:00
    expect(slots[1].available).toBe(false); // 10:00 - 11:00 (booked!)
    expect(slots[2].available).toBe(true); // 11:00 - 12:00
  });

  it('4. Generates RFC 5545 iCalendar (.ics) content for approved reservations', () => {
    const booking: ServiceBookingItem = {
      id: 'b83c50fe-0000-4000-8000-000000000001',
      circle_id: 'c83c50fe-0000-4000-8000-000000000001',
      listing_id: 'l83c50fe-0000-4000-8000-000000000001',
      requester_id: 'u83c50fe-0000-4000-8000-000000000001',
      provider_id: 'u83c50fe-0000-4000-8000-000000000002',
      booking_type: 'service',
      starts_at: '2026-10-28T14:00:00.000Z',
      ends_at: '2026-10-28T15:00:00.000Z',
      notes: 'Need robotics mentoring',
      status: 'approved',
      provider_note: null,
      returned_at: null,
      calendar_uid: 'booking-b83c50fe@circles.dev',
      created_at: '2026-10-27T10:00:00.000Z',
      updated_at: '2026-10-27T10:00:00.000Z',
    };

    const ics = generateBookingIcs(booking, 'Robotics Tutoring & Lab Guidance', 'Edinburgh AI Society');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:booking-b83c50fe@circles.dev');
    expect(ics).toContain('SUMMARY:Robotics Tutoring & Lab Guidance (Service Booking)');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });
});
