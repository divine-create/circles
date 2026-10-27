import { beforeAll, describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import { joinPublicCircle } from '@/features/memberships/service';
import {
  createPricingPlan,
  listPricingPlans,
  getPricingPlan,
  updatePricingPlan,
  createInvoice,
  listInvoices,
  getInvoice,
  recordOfflinePayment,
  grantMemberEntitlement,
  listMemberEntitlements,
  checkMemberEntitlement,
  recordTreasuryEntry,
  getTreasuryLedger,
  getTreasurySummary,
} from '@/features/finances/service';
import { CapabilityDisabledError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { runDatabaseMigrations } from '@/lib/db/postgres';

describe('Phase 1: Hyper-Configurable Financial & Pricing Engine Integration Suite', () => {
  beforeAll(async () => {
    await runDatabaseMigrations();
  });

  it('1. Enforces capability gating: rejects operations when payments_finances is disabled', async () => {
    const { user: owner } = await registerUser({
      email: `fin-owner-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `finowner_${Date.now()}`,
      displayName: 'Finance Owner',
    });

    const circle = await createCircle(owner.id, {
      name: `Fin Gated Circle ${Date.now()}`,
      slug: `fin-gated-${Date.now()}`,
      description: 'Circle with disabled finances capability',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    // Capability is disabled by default
    await expect(
      createPricingPlan(owner.id, {
        circleId: circle.id,
        slug: 'hoa-monthly-dues',
        name: 'Monthly Maintenance Dues',
        billingType: 'recurring',
        amountCents: 5000,
        currency: 'USD',
        intervalUnit: 'month',
        intervalCount: 1,
      })
    ).rejects.toThrow(CapabilityDisabledError);

    await expect(listPricingPlans(owner.id, circle.id)).rejects.toThrow(CapabilityDisabledError);
  });

  it('2. Supports polymorphic pricing plans across domains (HOA dues, recurring subscriptions, installments, metered packs, donations)', async () => {
    const { user: owner } = await registerUser({
      email: `fin-admin-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `finadmin_${Date.now()}`,
      displayName: 'HOA Admin',
    });

    const { user: resident } = await registerUser({
      email: `fin-resident-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `resident_${Date.now()}`,
      displayName: 'John Resident',
    });

    const circle = await createCircle(owner.id, {
      name: `Highland Estate HOA ${Date.now()}`,
      slug: `highland-estate-${Date.now()}`,
      description: 'Residential community with diverse billing models',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    // Enable finances capability
    await updateCircleCapability(owner.id, circle.id, 'payments_finances', true);

    // Resident joins circle
    await joinPublicCircle(resident.id, circle.id);

    // 1. Residential HOA Dues Plan (Recurring monthly with membership & space entitlements)
    const hoaPlan = await createPricingPlan(owner.id, {
      circleId: circle.id,
      slug: 'estate-levy-monthly',
      name: 'Estate Maintenance & Security Levy',
      description: 'Monthly service dues covering 24/7 security, gardening, and estate lighting.',
      billingType: 'recurring',
      amountCents: 7500, // $75.00
      currency: 'USD',
      intervalUnit: 'month',
      intervalCount: 1,
      entitlements: [
        {
          targetType: 'circle_membership',
          metadata: { tier: 'homeowner' },
        },
        {
          targetType: 'space_access',
          targetId: 'residents-council-channel',
        },
      ],
    });

    expect(hoaPlan.slug).toBe('estate-levy-monthly');
    expect(hoaPlan.amount_cents).toBe(7500);
    expect(hoaPlan.entitlements).toHaveLength(2);

    // 2. Sports Club / Facility Metered Pack Plan (10 hours tennis court quota)
    const courtPlan = await createPricingPlan(owner.id, {
      circleId: circle.id,
      slug: 'tennis-court-10hr-pass',
      name: 'Tennis Court 10-Hour Credit Pack',
      description: 'Prepaid hours for reserving the estate tennis court.',
      billingType: 'metered_pack',
      amountCents: 12000, // $120.00
      currency: 'USD',
      entitlements: [
        {
          targetType: 'resource_quota',
          targetId: 'tennis_court',
          quotaQuantity: 10,
        },
      ],
    });

    expect(courtPlan.billing_type).toBe('metered_pack');
    expect(courtPlan.entitlements?.[0].quota_quantity).toBe(10);

    // 3. Academy / Tuition Plan with Installments (3 payments of $150)
    const tuitionPlan = await createPricingPlan(owner.id, {
      circleId: circle.id,
      slug: 'estate-sustainability-course',
      name: 'Green Estate & Solar Certification',
      description: '3-month installment tuition for homeowner solar initiative.',
      billingType: 'installments',
      amountCents: 15000, // $150.00 per installment
      currency: 'USD',
      installmentCount: 3,
      entitlements: [
        {
          targetType: 'course_access',
          targetId: 'solar-energy-101',
        },
      ],
    });

    expect(tuitionPlan.billing_type).toBe('installments');
    expect(tuitionPlan.installment_count).toBe(3);

    // 4. Non-Profit / Co-op Sliding Scale Donation Plan
    const donationPlan = await createPricingPlan(owner.id, {
      circleId: circle.id,
      slug: 'community-garden-patron',
      name: 'Community Garden Patron Donation',
      description: 'Pay what you wish to support the children playground and garden.',
      billingType: 'sliding_scale',
      amountCents: 0,
      minAmountCents: 500, // minimum $5
      suggestedAmountsCents: [1000, 2500, 5000, 10000],
      currency: 'USD',
      entitlements: [
        {
          targetType: 'badge_grant',
          targetId: 'garden_patron',
        },
      ],
    });

    expect(donationPlan.billing_type).toBe('sliding_scale');
    expect(donationPlan.min_amount_cents).toBe(500);
    expect(donationPlan.suggested_amounts_cents).toEqual([1000, 2500, 5000, 10000]);

    // List all plans
    const allPlans = await listPricingPlans(resident.id, circle.id);
    expect(allPlans.length).toBe(4);

    // Update a plan
    const updated = await updatePricingPlan(owner.id, circle.id, hoaPlan.id, {
      name: 'Estate Maintenance & Security Levy (Updated)',
      amountCents: 8000,
    });
    expect(updated.name).toBe('Estate Maintenance & Security Levy (Updated)');
    expect(updated.amount_cents).toBe(8000);
  });

  it('3. Generates invoices and executes offline reconciliation with automatic universal entitlement fulfillment', async () => {
    const { user: owner } = await registerUser({
      email: `fin-owner-reconcile-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `reconcile_owner_${Date.now()}`,
      displayName: 'Estate Treasurer',
    });

    const { user: resident } = await registerUser({
      email: `fin-resident-reconcile-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `reconcile_res_${Date.now()}`,
      displayName: 'Alice Resident',
    });

    const circle = await createCircle(owner.id, {
      name: `Pine Valley Co-op ${Date.now()}`,
      slug: `pine-valley-${Date.now()}`,
      description: 'Co-op community with offline wire reconciliation',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await updateCircleCapability(owner.id, circle.id, 'payments_finances', true);
    await joinPublicCircle(resident.id, circle.id);

    // Create plan with space entitlement
    const plan = await createPricingPlan(owner.id, {
      circleId: circle.id,
      slug: 'executive-lounge-pass',
      name: 'Executive Lounge Access Pass',
      billingType: 'recurring',
      amountCents: 5000,
      currency: 'USD',
      intervalUnit: 'month',
      entitlements: [
        {
          targetType: 'space_access',
          targetId: 'space-exec-lounge-uuid',
        },
      ],
    });

    // Check entitlement before payment -> false
    const hasAccessBefore = await checkMemberEntitlement(
      circle.id,
      resident.id,
      'space_access',
      'space-exec-lounge-uuid'
    );
    expect(hasAccessBefore).toBe(false);

    // Issue invoice to resident
    const invoice = await createInvoice(owner.id, {
      circleId: circle.id,
      userId: resident.id,
      planId: plan.id,
      title: 'Monthly Executive Lounge Membership',
      totalCents: 5000,
      currency: 'USD',
      paymentMethod: 'bank_transfer',
      status: 'open',
    });

    expect(invoice.status).toBe('open');
    expect(invoice.invoice_number).toMatch(/^INV-\d{4}-[A-F0-9]{6}$/);

    // Resident can view their own invoice
    const residentInvoices = await listInvoices(resident.id, circle.id);
    expect(residentInvoices.length).toBe(1);
    expect(residentInvoices[0].id).toBe(invoice.id);

    // Reconcile offline payment (bank wire)
    const paymentResult = await recordOfflinePayment(owner.id, {
      circleId: circle.id,
      invoiceId: invoice.id,
      paymentMethod: 'bank_transfer',
      paymentReference: 'WIRE-CHASE-77889922',
      notes: 'Verified against October Citibank statement line 42',
      recordInTreasury: true,
      treasuryCategory: 'dues',
    });

    expect(paymentResult.invoice.status).toBe('paid');
    expect(paymentResult.invoice.payment_reference).toBe('WIRE-CHASE-77889922');
    expect(paymentResult.entitlementsGranted.length).toBe(1);
    expect(paymentResult.entitlementsGranted[0].target_type).toBe('space_access');
    expect(paymentResult.entitlementsGranted[0].target_id).toBe('space-exec-lounge-uuid');

    // Check entitlement after payment -> true!
    const hasAccessAfter = await checkMemberEntitlement(
      circle.id,
      resident.id,
      'space_access',
      'space-exec-lounge-uuid'
    );
    expect(hasAccessAfter).toBe(true);

    // Double payment prevention
    await expect(
      recordOfflinePayment(owner.id, {
        circleId: circle.id,
        invoiceId: invoice.id,
        paymentMethod: 'bank_transfer',
        paymentReference: 'WIRE-DUPLICATE',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('4. Maintains transparent community treasury ledger and calculates revenue/expense balance summaries', async () => {
    const { user: owner } = await registerUser({
      email: `fin-treasurer-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `treasurer_${Date.now()}`,
      displayName: 'Estate Chief Financial Officer',
    });

    const { user: member } = await registerUser({
      email: `fin-member-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `finmember_${Date.now()}`,
      displayName: 'Bob Member',
    });

    const circle = await createCircle(owner.id, {
      name: `Cedar Grove Community ${Date.now()}`,
      slug: `cedar-grove-${Date.now()}`,
      description: 'Community with transparent treasury reporting',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await updateCircleCapability(owner.id, circle.id, 'payments_finances', true);
    await joinPublicCircle(member.id, circle.id);

    // 1. Record Revenue: Annual HOA Dues Collection
    await recordTreasuryEntry(owner.id, {
      circleId: circle.id,
      entryType: 'revenue',
      category: 'dues',
      amountCents: 1500000, // $15,000.00
      currency: 'USD',
      description: 'Q4 General dues assessment collected from 50 households',
      isPublicToMembers: true,
    });

    // 2. Record Expense: Security & Gate Maintenance
    await recordTreasuryEntry(owner.id, {
      circleId: circle.id,
      entryType: 'expense',
      category: 'maintenance',
      amountCents: 450000, // $4,500.00
      currency: 'USD',
      description: 'Replacement of perimeter security sensor cables and gate motor service',
      isPublicToMembers: true,
    });

    // 3. Record Expense: Private legal/audit fees (confidential, not public to members)
    await recordTreasuryEntry(owner.id, {
      circleId: circle.id,
      entryType: 'expense',
      category: 'other',
      amountCents: 120000, // $1,200.00
      currency: 'USD',
      description: 'Internal audit & legal consultation',
      isPublicToMembers: false,
    });

    // Admin views complete ledger -> 3 items
    const adminLedger = await getTreasuryLedger(owner.id, circle.id);
    expect(adminLedger.length).toBe(3);

    // Regular member views ledger -> 2 items (private legal fee is excluded)
    const memberLedger = await getTreasuryLedger(member.id, circle.id);
    expect(memberLedger.length).toBe(2);
    expect(memberLedger.some((e) => e.description.includes('Internal audit'))).toBe(false);

    // Check treasury summary for member (only public entries)
    const memberSummary = await getTreasurySummary(member.id, circle.id);
    expect(memberSummary.total_revenue_cents).toBe(1500000);
    expect(memberSummary.total_expense_cents).toBe(450000);
    expect(memberSummary.net_balance_cents).toBe(1050000);
    expect(memberSummary.category_breakdown.dues).toBe(1500000);
    expect(memberSummary.category_breakdown.maintenance).toBe(450000);

    // Check treasury summary for admin (includes all entries)
    const adminSummary = await getTreasurySummary(owner.id, circle.id);
    expect(adminSummary.total_expense_cents).toBe(570000); // 450000 + 120000
    expect(adminSummary.net_balance_cents).toBe(930000);
  });
});
