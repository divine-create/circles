-- ============================================================================
-- Migration 0015: Financial Webhooks, ERP Integrations & Outbound Event Bus
-- Enables:
-- 1. Inbound Webhook Auth: Secure external API keys for ERPs (Yardi, AppFolio, custom student/resident portals)
-- 2. Outbound Webhook Registry: HMAC-signed event dispatching to accounting systems (QuickBooks, Xero, Zapier, Make)
-- 3. Webhook Delivery Logs: Audit trail of dispatched events and response statuses
-- ============================================================================

-- 1. Outbound Webhook Subscriptions
CREATE TABLE IF NOT EXISTS public.circle_webhooks (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{invoice.paid,entitlement.granted,entitlement.revoked}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_webhooks_circle ON public.circle_webhooks(circle_id, is_active);

-- 2. Outbound Webhook Delivery Logs
CREATE TABLE IF NOT EXISTS public.circle_webhook_deliveries (
  id UUID PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.circle_webhooks(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER DEFAULT NULL,
  response_body TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'failed', 'retrying')),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_lookup ON public.circle_webhook_deliveries(webhook_id, delivered_at DESC);

-- 3. External Inbound Integration API Keys
CREATE TABLE IF NOT EXISTS public.circle_api_keys (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  permissions TEXT[] NOT NULL DEFAULT '{finances.inbound_webhooks,entitlements.grant}',
  last_used_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, name)
);

CREATE INDEX IF NOT EXISTS idx_circle_api_keys_hash ON public.circle_api_keys(key_hash, is_active);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.circle_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_webhooks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_webhook_deliveries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.circle_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_api_keys FORCE ROW LEVEL SECURITY;

-- Webhooks: only staff can inspect and manage
DROP POLICY IF EXISTS circle_webhooks_all ON public.circle_webhooks;
CREATE POLICY circle_webhooks_all ON public.circle_webhooks
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Webhook Deliveries: only staff can inspect
DROP POLICY IF EXISTS circle_webhook_deliveries_select ON public.circle_webhook_deliveries;
CREATE POLICY circle_webhook_deliveries_select ON public.circle_webhook_deliveries
  FOR SELECT TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- API Keys: only staff can inspect and manage
DROP POLICY IF EXISTS circle_api_keys_all ON public.circle_api_keys;
CREATE POLICY circle_api_keys_all ON public.circle_api_keys
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_webhooks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_webhook_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_api_keys TO authenticated;

GRANT ALL ON public.circle_webhooks TO service_role;
GRANT ALL ON public.circle_webhook_deliveries TO service_role;
GRANT ALL ON public.circle_api_keys TO service_role;
