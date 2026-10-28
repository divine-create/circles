-- ============================================================================
-- Migration 0017: Service Availability, Recurring Scheduling & Calendar Sync
-- ============================================================================

ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS availability_schedule JSONB NOT NULL DEFAULT '{"days":[1,2,3,4,5],"startTime":"09:00","endTime":"17:00","slotDurationMinutes":60,"bufferMinutes":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_instant_bookable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS calendar_uid TEXT;

-- Index to quickly look up service bookings with their calendar uid
CREATE INDEX IF NOT EXISTS idx_service_bookings_calendar_uid
  ON public.service_bookings(circle_id, calendar_uid)
  WHERE calendar_uid IS NOT NULL;
