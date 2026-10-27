-- ============================================================================
-- Migration 0014: Hyper-Configurable Financial & Pricing Engine
-- Supports multi-domain community financial workflows:
-- - Residential HOAs (recurring maintenance dues, facility booking fees, violation levies)
-- - Professional Associations (annual membership tiers, corporate seat packages)
-- - Coworking / Makerspaces (recurring memberships + metered credits)
-- - Academies / Studios (course fees, cohort passes, installment plans)
-- - Non-Profits / Co-ops (pay-what-you-can donations, transparent treasury ledger)
-- ============================================================================

-- 1. Polymorphic Pricing Plans
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  billing_type TEXT NOT NULL CHECK (billing_type IN ('one_time', 'recurring', 'installments', 'sliding_scale', 'metered_pack')),
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  interval_unit TEXT CHECK (interval_unit IS NULL OR interval_unit IN ('day', 'week', 'month', 'quarter', 'year')),
  interval_count INTEGER DEFAULT 1 CHECK (interval_count IS NULL OR interval_count > 0),
  installment_count INTEGER CHECK (installment_count IS NULL OR installment_count > 0),
  min_amount_cents INTEGER CHECK (min_amount_cents IS NULL OR min_amount_cents >= 0),
  suggested_amounts_cents INTEGER[] DEFAULT '{}'::INTEGER[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_circle ON public.pricing_plans(circle_id, is_active, is_public);

-- 2. Composable Plan Entitlements (What privileges the plan grants)
CREATE TABLE IF NOT EXISTS public.pricing_plan_entitlements (
  id UUID PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('circle_membership', 'space_access', 'course_access', 'role_grant', 'resource_quota', 'badge_grant')),
  target_id TEXT DEFAULT NULL,
  quota_quantity INTEGER DEFAULT NULL CHECK (quota_quantity IS NULL OR quota_quantity >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_entitlements_lookup ON public.pricing_plan_entitlements(plan_id, target_type);

-- 3. Invoices & Billing Records
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded')),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'manual_credit' CHECK (payment_method IN ('stripe', 'bank_transfer', 'cash', 'manual_credit', 'external_erp', 'free_grant')),
  payment_reference TEXT DEFAULT NULL,
  due_date TIMESTAMPTZ DEFAULT NULL,
  paid_at TIMESTAMPTZ DEFAULT NULL,
  notes TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON public.invoices(circle_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(circle_id, status, created_at DESC);

-- 4. Active Member Entitlements (Resolved privileges per user)
CREATE TABLE IF NOT EXISTS public.member_entitlements (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('circle_membership', 'space_access', 'course_access', 'role_grant', 'resource_quota', 'badge_grant')),
  target_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'grace_period', 'expired', 'revoked')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  grace_period_ends_at TIMESTAMPTZ DEFAULT NULL,
  remaining_quota INTEGER DEFAULT NULL CHECK (remaining_quota IS NULL OR remaining_quota >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_entitlements_lookup ON public.member_entitlements(circle_id, user_id, target_type, status);

-- 5. Community Treasury Ledger (Transparent or private financial bookkeeping)
CREATE TABLE IF NOT EXISTS public.community_treasury_ledger (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('revenue', 'expense', 'transfer')),
  category TEXT NOT NULL CHECK (category IN ('dues', 'maintenance', 'amenities', 'courses', 'events', 'utilities', 'reserve_fund', 'refunds', 'other')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  is_public_to_members BOOLEAN NOT NULL DEFAULT true,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_ledger_circle ON public.community_treasury_ledger(circle_id, entry_date DESC);

-- ============================================================================
-- Enable Row Level Security & Multi-Tenant Defense-in-Depth
-- ============================================================================

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pricing_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_plan_entitlements FORCE ROW LEVEL SECURITY;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;

ALTER TABLE public.member_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_entitlements FORCE ROW LEVEL SECURITY;

ALTER TABLE public.community_treasury_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_treasury_ledger FORCE ROW LEVEL SECURITY;

-- Pricing Plans Policies (Public plans discoverable, admin/staff can manage)
DROP POLICY IF EXISTS pricing_plans_select ON public.pricing_plans;
CREATE POLICY pricing_plans_select ON public.pricing_plans
  FOR SELECT TO anon, authenticated
  USING (
    public.can_discover_circle(circle_id, auth.uid()) AND
    (is_public = true OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS pricing_plans_write ON public.pricing_plans;
CREATE POLICY pricing_plans_write ON public.pricing_plans
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Pricing Plan Entitlements Policies
DROP POLICY IF EXISTS pricing_plan_entitlements_select ON public.pricing_plan_entitlements;
CREATE POLICY pricing_plan_entitlements_select ON public.pricing_plan_entitlements
  FOR SELECT TO anon, authenticated
  USING (public.can_discover_circle(circle_id, auth.uid()));

DROP POLICY IF EXISTS pricing_plan_entitlements_write ON public.pricing_plan_entitlements;
CREATE POLICY pricing_plan_entitlements_write ON public.pricing_plan_entitlements
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Invoices Policies (Users see their own, staff see all circle invoices)
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS invoices_write ON public.invoices;
CREATE POLICY invoices_write ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Member Entitlements Policies (Users see their own, staff see all)
DROP POLICY IF EXISTS member_entitlements_select ON public.member_entitlements;
CREATE POLICY member_entitlements_select ON public.member_entitlements
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS member_entitlements_write ON public.member_entitlements;
CREATE POLICY member_entitlements_write ON public.member_entitlements
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- Treasury Ledger Policies (Staff see all; members see entries flagged is_public_to_members)
DROP POLICY IF EXISTS treasury_ledger_select ON public.community_treasury_ledger;
CREATE POLICY treasury_ledger_select ON public.community_treasury_ledger
  FOR SELECT TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin') OR
    (is_public_to_members = true AND public.is_active_circle_member(circle_id, auth.uid()))
  );

DROP POLICY IF EXISTS treasury_ledger_write ON public.community_treasury_ledger;
CREATE POLICY treasury_ledger_write ON public.community_treasury_ledger
  FOR ALL TO authenticated
  USING (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_circle_staff_role(circle_id, auth.uid(), 'admin'));

-- ============================================================================
-- Grant Schema Privileges
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_plan_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_treasury_ledger TO authenticated;

GRANT SELECT ON public.pricing_plans TO anon;
GRANT SELECT ON public.pricing_plan_entitlements TO anon;

GRANT ALL ON public.pricing_plans TO service_role;
GRANT ALL ON public.pricing_plan_entitlements TO service_role;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.member_entitlements TO service_role;
GRANT ALL ON public.community_treasury_ledger TO service_role;
