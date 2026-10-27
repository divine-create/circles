import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction, withServiceRoleTransaction, DbTransaction } from '@/lib/db/postgres';
import {
  CommunityTreasuryLedgerItem,
  EntitlementTargetType,
  InvoiceItem,
  InvoiceStatus,
  MemberEntitlementItem,
  PricingPlanEntitlementItem,
  PricingPlanItem,
  TreasuryCategory,
  TreasuryEntryType,
  TreasurySummary,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import { createNotification } from '@/features/notifications/service';

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const createPricingPlanSchema = z.object({
  circleId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase alphanumeric characters and hyphens.'),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  billingType: z.enum(['one_time', 'recurring', 'installments', 'sliding_scale', 'metered_pack']),
  amountCents: z.number().int().min(0).default(0),
  currency: z.string().trim().length(3).default('USD'),
  intervalUnit: z.enum(['day', 'week', 'month', 'quarter', 'year']).nullable().optional(),
  intervalCount: z.number().int().min(1).default(1),
  installmentCount: z.number().int().min(1).nullable().optional(),
  minAmountCents: z.number().int().min(0).nullable().optional(),
  suggestedAmountsCents: z.array(z.number().int().min(0)).default([]),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
  entitlements: z
    .array(
      z.object({
        targetType: z.enum([
          'circle_membership',
          'space_access',
          'course_access',
          'role_grant',
          'resource_quota',
          'badge_grant',
        ]),
        targetId: z.string().nullable().optional(),
        quotaQuantity: z.number().int().min(0).nullable().optional(),
        metadata: z.record(z.unknown()).default({}),
      })
    )
    .default([]),
});

export const updatePricingPlanSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  amountCents: z.number().int().min(0).optional(),
  minAmountCents: z.number().int().min(0).nullable().optional(),
  suggestedAmountsCents: z.array(z.number().int().min(0)).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createInvoiceSchema = z.object({
  circleId: z.string().uuid(),
  userId: z.string().uuid(),
  planId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).default(''),
  totalCents: z.number().int().min(0),
  currency: z.string().trim().length(3).default('USD'),
  paymentMethod: z
    .enum(['stripe', 'bank_transfer', 'cash', 'manual_credit', 'external_erp', 'free_grant'])
    .default('manual_credit'),
  paymentReference: z.string().trim().max(200).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible', 'refunded']).default('open'),
  notes: z.string().trim().max(2000).default(''),
  metadata: z.record(z.unknown()).default({}),
});

export const recordOfflinePaymentSchema = z.object({
  circleId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  paymentMethod: z.enum(['bank_transfer', 'cash', 'manual_credit', 'external_erp']),
  paymentReference: z.string().trim().min(1).max(200),
  paidAt: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).default(''),
  recordInTreasury: z.boolean().default(true),
  treasuryCategory: z
    .enum([
      'dues',
      'maintenance',
      'amenities',
      'courses',
      'events',
      'utilities',
      'reserve_fund',
      'refunds',
      'other',
    ])
    .default('dues'),
});

export const recordTreasuryEntrySchema = z.object({
  circleId: z.string().uuid(),
  entryType: z.enum(['revenue', 'expense', 'transfer']),
  category: z.enum([
    'dues',
    'maintenance',
    'amenities',
    'courses',
    'events',
    'utilities',
    'reserve_fund',
    'refunds',
    'other',
  ]),
  amountCents: z.number().int().min(0),
  currency: z.string().trim().length(3).default('USD'),
  description: z.string().trim().min(3).max(500),
  isPublicToMembers: z.boolean().default(true),
  invoiceId: z.string().uuid().nullable().optional(),
  entryDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const grantEntitlementSchema = z.object({
  circleId: z.string().uuid(),
  userId: z.string().uuid(),
  targetType: z.enum([
    'circle_membership',
    'space_access',
    'course_access',
    'role_grant',
    'resource_quota',
    'badge_grant',
  ]),
  targetId: z.string().nullable().optional(),
  planId: z.string().uuid().nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  durationDays: z.number().int().min(1).nullable().optional(),
  quotaQuantity: z.number().int().min(0).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

// ============================================================================
// Internal Capability and Security Helpers
// ============================================================================

export async function assertFinancesCapability(tx: DbTransaction, circleId: string): Promise<void> {
  const capRes = await tx.query<{ enabled: boolean }>(
    `SELECT enabled FROM public.circle_capabilities
     WHERE circle_id = $1 AND capability_key = 'payments_finances'
     LIMIT 1;`,
    [circleId]
  );
  if (!capRes.rows[0]?.enabled) {
    throw new CapabilityDisabledError('payments_finances');
  }
}

export function generateInvoiceNumber(prefix = 'INV'): string {
  const year = new Date().getFullYear();
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${randomPart}`;
}

// ============================================================================
// Pricing Plans Management
// ============================================================================

export async function createPricingPlan(
  actorUserId: string,
  rawInput: z.input<typeof createPricingPlanSchema>
): Promise<PricingPlanItem> {
  const input = createPricingPlanSchema.parse(rawInput);

  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, input.circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [input.circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can create pricing plans.');
    }

    const planId = crypto.randomUUID();
    const planRes = await tx.query<PricingPlanItem>(
      `INSERT INTO public.pricing_plans (
         id, circle_id, slug, name, description, billing_type, amount_cents, currency,
         interval_unit, interval_count, installment_count, min_amount_cents,
         suggested_amounts_cents, is_active, is_public, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *;`,
      [
        planId,
        input.circleId,
        input.slug,
        input.name,
        input.description,
        input.billingType,
        input.amountCents,
        input.currency.toUpperCase(),
        input.intervalUnit ?? null,
        input.intervalCount,
        input.installmentCount ?? null,
        input.minAmountCents ?? null,
        input.suggestedAmountsCents,
        input.isActive,
        input.isPublic,
        JSON.stringify(input.metadata),
      ]
    );

    const createdPlan = planRes.rows[0];
    const createdEntitlements: PricingPlanEntitlementItem[] = [];

    for (const ent of input.entitlements) {
      const entId = crypto.randomUUID();
      const entRes = await tx.query<PricingPlanEntitlementItem>(
        `INSERT INTO public.pricing_plan_entitlements (
           id, plan_id, circle_id, target_type, target_id, quota_quantity, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;`,
        [
          entId,
          planId,
          input.circleId,
          ent.targetType,
          ent.targetId ?? null,
          ent.quotaQuantity ?? null,
          JSON.stringify(ent.metadata),
        ]
      );
      createdEntitlements.push(entRes.rows[0]);
    }

    return {
      ...createdPlan,
      entitlements: createdEntitlements,
    };
  });
}

export async function listPricingPlans(
  actorUserId: string | null,
  circleId: string,
  options?: { includeInactive?: boolean }
): Promise<PricingPlanItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const filterClause = options?.includeInactive
      ? `circle_id = $1`
      : `circle_id = $1 AND is_active = true`;

    const plansRes = await tx.query<PricingPlanItem>(
      `SELECT * FROM public.pricing_plans
       WHERE ${filterClause}
       ORDER BY amount_cents ASC, created_at ASC;`,
      [circleId]
    );

    if (plansRes.rows.length === 0) {
      return [];
    }

    const planIds = plansRes.rows.map((p) => p.id);
    const entsRes = await tx.query<PricingPlanEntitlementItem>(
      `SELECT * FROM public.pricing_plan_entitlements
       WHERE plan_id = ANY($1)
       ORDER BY created_at ASC;`,
      [planIds]
    );

    const entMap = new Map<string, PricingPlanEntitlementItem[]>();
    for (const ent of entsRes.rows) {
      const list = entMap.get(ent.plan_id) || [];
      list.push(ent);
      entMap.set(ent.plan_id, list);
    }

    return plansRes.rows.map((plan) => ({
      ...plan,
      entitlements: entMap.get(plan.id) || [],
    }));
  });
}

export async function getPricingPlan(
  actorUserId: string | null,
  circleId: string,
  planIdOrSlug: string
): Promise<PricingPlanItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      planIdOrSlug
    );
    const planRes = await tx.query<PricingPlanItem>(
      `SELECT * FROM public.pricing_plans
       WHERE circle_id = $1 AND (${isUuid ? 'id = $2' : 'slug = $2'})
       LIMIT 1;`,
      [circleId, planIdOrSlug]
    );

    const plan = planRes.rows[0];
    if (!plan) {
      throw new NotFoundError(`Pricing plan "${planIdOrSlug}" not found.`);
    }

    const entsRes = await tx.query<PricingPlanEntitlementItem>(
      `SELECT * FROM public.pricing_plan_entitlements
       WHERE plan_id = $1
       ORDER BY created_at ASC;`,
      [plan.id]
    );

    return {
      ...plan,
      entitlements: entsRes.rows,
    };
  });
}

export async function updatePricingPlan(
  actorUserId: string,
  circleId: string,
  planId: string,
  rawInput: z.input<typeof updatePricingPlanSchema>
): Promise<PricingPlanItem> {
  const input = updatePricingPlanSchema.parse(rawInput);

  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can update pricing plans.');
    }

    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [planId, circleId];
    let pIdx = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${pIdx++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${pIdx++}`);
      values.push(input.description);
    }
    if (input.amountCents !== undefined) {
      updates.push(`amount_cents = $${pIdx++}`);
      values.push(input.amountCents);
    }
    if (input.minAmountCents !== undefined) {
      updates.push(`min_amount_cents = $${pIdx++}`);
      values.push(input.minAmountCents);
    }
    if (input.suggestedAmountsCents !== undefined) {
      updates.push(`suggested_amounts_cents = $${pIdx++}`);
      values.push(input.suggestedAmountsCents);
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${pIdx++}`);
      values.push(input.isActive);
    }
    if (input.isPublic !== undefined) {
      updates.push(`is_public = $${pIdx++}`);
      values.push(input.isPublic);
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${pIdx++}`);
      values.push(JSON.stringify(input.metadata));
    }

    const planRes = await tx.query<PricingPlanItem>(
      `UPDATE public.pricing_plans
       SET ${updates.join(', ')}
       WHERE id = $1 AND circle_id = $2
       RETURNING *;`,
      values
    );

    const updated = planRes.rows[0];
    if (!updated) {
      throw new NotFoundError(`Pricing plan with id "${planId}" not found.`);
    }

    const entsRes = await tx.query<PricingPlanEntitlementItem>(
      `SELECT * FROM public.pricing_plan_entitlements
       WHERE plan_id = $1
       ORDER BY created_at ASC;`,
      [planId]
    );

    return {
      ...updated,
      entitlements: entsRes.rows,
    };
  });
}

// ============================================================================
// Invoicing & Payment Processing
// ============================================================================

export async function createInvoice(
  actorUserId: string,
  rawInput: z.input<typeof createInvoiceSchema>
): Promise<InvoiceItem> {
  const input = createInvoiceSchema.parse(rawInput);

  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, input.circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [input.circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed && actorUserId !== input.userId) {
      throw new ForbiddenError('Cannot create invoices for other users.');
    }

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = generateInvoiceNumber();

    const invRes = await tx.query<InvoiceItem>(
      `INSERT INTO public.invoices (
         id, circle_id, user_id, plan_id, invoice_number, title, description,
         status, total_cents, currency, payment_method, payment_reference,
         due_date, paid_at, notes, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *;`,
      [
        invoiceId,
        input.circleId,
        input.userId,
        input.planId ?? null,
        invoiceNumber,
        input.title,
        input.description,
        input.status,
        input.totalCents,
        input.currency.toUpperCase(),
        input.paymentMethod,
        input.paymentReference ?? null,
        input.dueDate ?? null,
        input.paidAt ?? null,
        input.notes,
        JSON.stringify(input.metadata),
      ]
    );

    return invRes.rows[0];
  });
}

/**
 * Fulfills entitlements for an invoice and plan.
 * Used internally whenever an invoice is paid (online or offline).
 */
export async function fulfillInvoiceEntitlements(
  tx: DbTransaction,
  invoice: InvoiceItem
): Promise<MemberEntitlementItem[]> {
  if (!invoice.plan_id) return [];

  const planEnts = await tx.query<PricingPlanEntitlementItem>(
    `SELECT * FROM public.pricing_plan_entitlements WHERE plan_id = $1;`,
    [invoice.plan_id]
  );

  const granted: MemberEntitlementItem[] = [];
  for (const ent of planEnts.rows) {
    const entId = crypto.randomUUID();
    const res = await tx.query<MemberEntitlementItem>(
      `INSERT INTO public.member_entitlements (
         id, circle_id, user_id, plan_id, invoice_id, target_type, target_id,
         status, granted_at, remaining_quota, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), $8, $9)
       RETURNING *;`,
      [
        entId,
        invoice.circle_id,
        invoice.user_id,
        invoice.plan_id,
        invoice.id,
        ent.target_type,
        ent.target_id,
        ent.quota_quantity,
        JSON.stringify(ent.metadata),
      ]
    );
    granted.push(res.rows[0]);

    // If entitlement is membership and user was pending/unjoined, activate membership
    if (ent.target_type === 'circle_membership') {
      await tx.query(
        `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
         VALUES ($1, $2, $3, 'member', 'active')
         ON CONFLICT (circle_id, user_id)
         DO UPDATE SET status = 'active';`,
        [crypto.randomUUID(), invoice.circle_id, invoice.user_id]
      );
    }
  }

  return granted;
}

export async function recordOfflinePayment(
  actorUserId: string,
  rawInput: z.input<typeof recordOfflinePaymentSchema>
): Promise<{ invoice: InvoiceItem; entitlementsGranted: MemberEntitlementItem[] }> {
  const input = recordOfflinePaymentSchema.parse(rawInput);

  const result = await withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, input.circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [input.circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can record offline payments.');
    }

    const invRes = await tx.query<InvoiceItem>(
      `SELECT * FROM public.invoices WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [input.invoiceId, input.circleId]
    );
    const existingInvoice = invRes.rows[0];
    if (!existingInvoice) {
      throw new NotFoundError(`Invoice with id "${input.invoiceId}" not found.`);
    }

    if (existingInvoice.status === 'paid') {
      throw new ConflictError('This invoice has already been paid.');
    }

    const paidAt = input.paidAt ? new Date(input.paidAt).toISOString() : new Date().toISOString();

    const updatedInvRes = await tx.query<InvoiceItem>(
      `UPDATE public.invoices
       SET status = 'paid',
           payment_method = $1,
           payment_reference = $2,
           paid_at = $3,
           notes = CASE WHEN $4 != '' THEN $4 ELSE notes END,
           updated_at = NOW()
       WHERE id = $5 AND circle_id = $6
       RETURNING *;`,
      [
        input.paymentMethod,
        input.paymentReference,
        paidAt,
        input.notes,
        input.invoiceId,
        input.circleId,
      ]
    );

    const paidInvoice = updatedInvRes.rows[0];

    // Fulfill entitlements
    const entitlementsGranted = await fulfillInvoiceEntitlements(tx, paidInvoice);

    // Record in treasury ledger if requested
    if (input.recordInTreasury && paidInvoice.total_cents > 0) {
      const ledgerId = crypto.randomUUID();
      await tx.query(
        `INSERT INTO public.community_treasury_ledger (
           id, circle_id, entry_type, category, amount_cents, currency,
           description, is_public_to_members, invoice_id, recorded_by, entry_date
         ) VALUES ($1, $2, 'revenue', $3, $4, $5, $6, true, $7, $8, $9);`,
        [
          ledgerId,
          input.circleId,
          input.treasuryCategory,
          paidInvoice.total_cents,
          paidInvoice.currency,
          `Payment received for ${paidInvoice.title} (Ref: ${input.paymentReference})`,
          paidInvoice.id,
          actorUserId,
          paidAt,
        ]
      );
    }

    return {
      invoice: paidInvoice,
      entitlementsGranted,
    };
  });

  // Safe non-blocking notification outside transaction
  try {
    await createNotification({
      recipientId: result.invoice.user_id,
      actorId: actorUserId,
      circleId: input.circleId,
      eventType: 'circle_announcement',
      title: 'Payment Confirmed',
      body: `Your payment for "${result.invoice.title}" has been recorded. Reference: ${input.paymentReference}.`,
      linkUrl: `/circles/${input.circleId}/finances`,
      idempotencyKey: `invoice_paid_${result.invoice.id}`,
    });
  } catch {
    // Non-blocking notification error
  }

  return result;
}

export async function listInvoices(
  actorUserId: string,
  circleId: string,
  options?: { userId?: string; status?: InvoiceStatus }
): Promise<InvoiceItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );

    const targetUserId = isStaff.rows[0]?.allowed
      ? options?.userId ?? null
      : actorUserId;

    const conditions: string[] = ['i.circle_id = $1'];
    const params: unknown[] = [circleId];
    let pIdx = 2;

    if (targetUserId) {
      conditions.push(`i.user_id = $${pIdx++}`);
      params.push(targetUserId);
    }
    if (options?.status) {
      conditions.push(`i.status = $${pIdx++}`);
      params.push(options.status);
    }

    const invoicesRes = await tx.query<
      InvoiceItem & { user_display_name: string; user_username: string; plan_name: string | null }
    >(
      `SELECT 
         i.*,
         p.display_name AS user_display_name,
         p.username AS user_username,
         pl.name AS plan_name
       FROM public.invoices i
       JOIN public.profiles p ON p.id = i.user_id
       LEFT JOIN public.pricing_plans pl ON pl.id = i.plan_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.created_at DESC;`,
      params
    );

    return invoicesRes.rows;
  });
}

export async function getInvoice(
  actorUserId: string,
  circleId: string,
  invoiceId: string
): Promise<InvoiceItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const invRes = await tx.query<
      InvoiceItem & { user_display_name: string; user_username: string; plan_name: string | null }
    >(
      `SELECT 
         i.*,
         p.display_name AS user_display_name,
         p.username AS user_username,
         pl.name AS plan_name
       FROM public.invoices i
       JOIN public.profiles p ON p.id = i.user_id
       LEFT JOIN public.pricing_plans pl ON pl.id = i.plan_id
       WHERE i.id = $1 AND i.circle_id = $2
       LIMIT 1;`,
      [invoiceId, circleId]
    );

    const inv = invRes.rows[0];
    if (!inv) {
      throw new NotFoundError(`Invoice "${invoiceId}" not found.`);
    }

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );

    if (!isStaff.rows[0]?.allowed && inv.user_id !== actorUserId) {
      throw new ForbiddenError('You do not have permission to view this invoice.');
    }

    return inv;
  });
}

// ============================================================================
// Member Entitlements & Universal Privilege Resolution
// ============================================================================

export async function grantMemberEntitlement(
  actorUserId: string,
  rawInput: z.input<typeof grantEntitlementSchema>
): Promise<MemberEntitlementItem> {
  const input = grantEntitlementSchema.parse(rawInput);

  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, input.circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [input.circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can grant entitlements.');
    }

    const entId = crypto.randomUUID();
    let expiresAt: string | null = null;
    if (input.durationDays) {
      const exp = new Date();
      exp.setDate(exp.getDate() + input.durationDays);
      expiresAt = exp.toISOString();
    }

    const res = await tx.query<MemberEntitlementItem>(
      `INSERT INTO public.member_entitlements (
         id, circle_id, user_id, plan_id, invoice_id, target_type, target_id,
         status, granted_at, expires_at, remaining_quota, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), $8, $9, $10)
       RETURNING *;`,
      [
        entId,
        input.circleId,
        input.userId,
        input.planId ?? null,
        input.invoiceId ?? null,
        input.targetType,
        input.targetId ?? null,
        expiresAt,
        input.quotaQuantity ?? null,
        JSON.stringify(input.metadata),
      ]
    );

    // If granting membership, activate membership
    if (input.targetType === 'circle_membership') {
      await tx.query(
        `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
         VALUES ($1, $2, $3, 'member', 'active')
         ON CONFLICT (circle_id, user_id)
         DO UPDATE SET status = 'active';`,
        [crypto.randomUUID(), input.circleId, input.userId]
      );
    }

    return res.rows[0];
  });
}

export async function listMemberEntitlements(
  actorUserId: string,
  circleId: string,
  userId?: string
): Promise<MemberEntitlementItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );

    const targetUserId = isStaff.rows[0]?.allowed ? userId ?? actorUserId : actorUserId;

    const res = await tx.query<MemberEntitlementItem>(
      `SELECT * FROM public.member_entitlements
       WHERE circle_id = $1 AND user_id = $2
       ORDER BY created_at DESC;`,
      [circleId, targetUserId]
    );

    return res.rows;
  });
}

/**
 * High-performance permission check used by spaces, courses, and booking gates.
 * Returns true if the user has an active entitlement or is within an active grace period.
 */
export async function checkMemberEntitlement(
  circleId: string,
  userId: string,
  targetType: EntitlementTargetType,
  targetId?: string | null
): Promise<boolean> {
  return withServiceRoleTransaction(async (tx) => {
    const query = targetId
      ? `SELECT id FROM public.member_entitlements
         WHERE circle_id = $1 AND user_id = $2 AND target_type = $3 AND target_id = $4
           AND (status = 'active' OR (status = 'grace_period' AND (grace_period_ends_at IS NULL OR grace_period_ends_at > NOW())))
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1;`
      : `SELECT id FROM public.member_entitlements
         WHERE circle_id = $1 AND user_id = $2 AND target_type = $3
           AND (status = 'active' OR (status = 'grace_period' AND (grace_period_ends_at IS NULL OR grace_period_ends_at > NOW())))
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1;`;

    const params = targetId
      ? [circleId, userId, targetType, targetId]
      : [circleId, userId, targetType];

    const res = await tx.query<{ id: string }>(query, params);
    return res.rows.length > 0;
  });
}

// ============================================================================
// Community Treasury & Financial Transparency
// ============================================================================

export async function recordTreasuryEntry(
  actorUserId: string,
  rawInput: z.input<typeof recordTreasuryEntrySchema>
): Promise<CommunityTreasuryLedgerItem> {
  const input = recordTreasuryEntrySchema.parse(rawInput);

  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, input.circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [input.circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can record treasury entries.');
    }

    const entryId = crypto.randomUUID();
    const entryDate = input.entryDate ? new Date(input.entryDate).toISOString() : new Date().toISOString();

    const res = await tx.query<CommunityTreasuryLedgerItem>(
      `INSERT INTO public.community_treasury_ledger (
         id, circle_id, entry_type, category, amount_cents, currency,
         description, is_public_to_members, invoice_id, recorded_by, entry_date, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *;`,
      [
        entryId,
        input.circleId,
        input.entryType,
        input.category,
        input.amountCents,
        input.currency.toUpperCase(),
        input.description,
        input.isPublicToMembers,
        input.invoiceId ?? null,
        actorUserId,
        entryDate,
        JSON.stringify(input.metadata),
      ]
    );

    return res.rows[0];
  });
}

export async function getTreasuryLedger(
  actorUserId: string,
  circleId: string,
  options?: { limit?: number; offset?: number }
): Promise<CommunityTreasuryLedgerItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );

    // If not staff, only fetch items marked is_public_to_members
    const visibilityFilter = isStaff.rows[0]?.allowed
      ? `t.circle_id = $1`
      : `t.circle_id = $1 AND t.is_public_to_members = true`;

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const res = await tx.query<CommunityTreasuryLedgerItem & { recorded_by_name: string }>(
      `SELECT 
         t.*,
         p.display_name AS recorded_by_name
       FROM public.community_treasury_ledger t
       JOIN public.profiles p ON p.id = t.recorded_by
       WHERE ${visibilityFilter}
       ORDER BY t.entry_date DESC, t.created_at DESC
       LIMIT $2 OFFSET $3;`,
      [circleId, limit, offset]
    );

    return res.rows;
  });
}

export async function getTreasurySummary(
  actorUserId: string,
  circleId: string
): Promise<TreasurySummary> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertFinancesCapability(tx, circleId);

    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );

    const visibilityFilter = isStaff.rows[0]?.allowed
      ? `circle_id = $1`
      : `circle_id = $1 AND is_public_to_members = true`;

    const res = await tx.query<{
      entry_type: TreasuryEntryType;
      category: TreasuryCategory;
      amount_cents: number;
      currency: string;
    }>(
      `SELECT entry_type, category, amount_cents, currency
       FROM public.community_treasury_ledger
       WHERE ${visibilityFilter};`,
      [circleId]
    );

    let totalRevenue = 0;
    let totalExpense = 0;
    const breakdown: Record<TreasuryCategory, number> = {
      dues: 0,
      maintenance: 0,
      amenities: 0,
      courses: 0,
      events: 0,
      utilities: 0,
      reserve_fund: 0,
      refunds: 0,
      other: 0,
    };

    let currency = 'USD';

    for (const row of res.rows) {
      currency = row.currency;
      const amount = Number(row.amount_cents) || 0;
      if (row.entry_type === 'revenue') {
        totalRevenue += amount;
      } else if (row.entry_type === 'expense') {
        totalExpense += amount;
      }
      breakdown[row.category] = (breakdown[row.category] || 0) + amount;
    }

    return {
      currency,
      total_revenue_cents: totalRevenue,
      total_expense_cents: totalExpense,
      net_balance_cents: totalRevenue - totalExpense,
      category_breakdown: breakdown,
    };
  });
}
