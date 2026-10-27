import React from 'react';
import { notFound } from 'next/navigation';
import { CreditCard, Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import {
  getTreasuryLedger,
  getTreasurySummary,
  listInvoices,
  listMemberEntitlements,
  listPricingPlans,
} from '@/features/finances/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CircleFinancesClient } from '@/components/circles/circle-finances-client';
import { CapabilityDisabledError } from '@/lib/errors';
import {
  CommunityTreasuryLedgerItem,
  InvoiceItem,
  MemberEntitlementItem,
  PricingPlanItem,
  TreasurySummary,
} from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleFinancesPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const canRead = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  if (!canRead) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-xs">
          <Lock className="mx-auto h-8 w-8 text-stone-600" />
          <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Community</h2>
          <p className="mt-1 text-sm text-stone-600">
            Join or request access to {circle.name} to view dues and financial plans.
          </p>
        </div>
      </div>
    );
  }

  let plans: PricingPlanItem[] = [];
  let invoices: InvoiceItem[] = [];
  let entitlements: MemberEntitlementItem[] = [];
  let treasurySummary: TreasurySummary | null = null;
  let treasuryLedger: CommunityTreasuryLedgerItem[] = [];

  try {
    plans = await listPricingPlans(user?.id ?? null, circle.id);

    if (user) {
      invoices = await listInvoices(user.id, circle.id).catch(() => []);
      entitlements = await listMemberEntitlements(user.id, circle.id).catch(() => []);
      treasurySummary = await getTreasurySummary(user.id, circle.id).catch(() => null);
      treasuryLedger = await getTreasuryLedger(user.id, circle.id).catch(() => []);
    }
  } catch (err) {
    if (err instanceof CapabilityDisabledError) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-10 text-center shadow-xs">
            <CreditCard className="mx-auto h-8 w-8 text-stone-400" />
            <h2 className="mt-3 text-lg font-bold text-stone-900">
              Payments & Finances Capability Disabled
            </h2>
            <p className="mt-1 text-sm text-stone-600 max-w-md mx-auto">
              Enable Payments & Finances in Circle Studio to collect membership dues, issue
              invoices, and manage your community balance sheet.
            </p>
          </div>
        </div>
      );
    }
    console.error('Failed to load finances:', err);
    throw err;
  }

  // RSC serialization
  const serialized = JSON.parse(
    JSON.stringify({
      circle,
      currentUserId: user?.id ?? null,
      plans,
      invoices,
      entitlements,
      treasurySummary,
      treasuryLedger,
    })
  );

  return (
    <CircleFinancesClient
      circle={serialized.circle}
      currentUserId={serialized.currentUserId}
      plans={serialized.plans}
      invoices={serialized.invoices}
      entitlements={serialized.entitlements}
      treasurySummary={serialized.treasurySummary}
      treasuryLedger={serialized.treasuryLedger}
    />
  );
}
