import { NextRequest, NextResponse } from 'next/server';
import { verifyCircleApiKey } from '@/features/finances/integrations';
import { fulfillInvoiceEntitlements } from '@/features/finances/service';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { handleApiError } from '@/lib/auth/api-helpers';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { InvoiceItem, MemberEntitlementItem, UserProfile } from '@/types/domain';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing Bearer API token.');
    }
    const token = authHeader.slice(7).trim();

    // Verify external API key
    const verified = await verifyCircleApiKey(token, 'finances.inbound_webhooks');

    // Anti-IDOR: Check that API key belongs to the targeted Circle
    if (verified.circleId !== params.circleId) {
      throw new ForbiddenError('API Key is not authorized for this Circle.');
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // 1. External ERP Payment Notification (e.g. resident paid dues via Yardi or resident portal)
    if (action === 'reconcile_external_payment') {
      const { invoiceId, externalReference, notes, category } = body;
      if (!invoiceId) throw new ValidationError('invoiceId is required.');

      const result = await withServiceRoleTransaction(async (tx) => {
        const invRes = await tx.query<InvoiceItem>(
          `SELECT * FROM public.invoices WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
          [invoiceId, params.circleId]
        );
        const invoice = invRes.rows[0];
        if (!invoice) throw new NotFoundError('Invoice not found.');

        const updatedInvRes = await tx.query<InvoiceItem>(
          `UPDATE public.invoices
           SET status = 'paid',
               payment_method = 'external_erp',
               payment_reference = $1,
               paid_at = NOW(),
               notes = CASE WHEN $2 != '' THEN $2 ELSE notes END,
               updated_at = NOW()
           WHERE id = $3
           RETURNING *;`,
          [externalReference || 'EXTERNAL_ERP', notes || 'Synced from external ERP', invoiceId]
        );
        const paidInvoice = updatedInvRes.rows[0];

        // Fulfill entitlements
        const entitlementsGranted = await fulfillInvoiceEntitlements(tx, paidInvoice);

        // Record in treasury ledger
        if (paidInvoice.total_cents > 0) {
          await tx.query(
            `INSERT INTO public.community_treasury_ledger (
               id, circle_id, entry_type, category, amount_cents, currency,
               description, is_public_to_members, invoice_id, recorded_by, entry_date
             ) VALUES ($1, $2, 'revenue', $3, $4, $5, $6, true, $7, $8, NOW());`,
            [
              crypto.randomUUID(),
              params.circleId,
              category || 'dues',
              paidInvoice.total_cents,
              paidInvoice.currency,
              `External ERP sync: ${paidInvoice.title} (Ref: ${externalReference})`,
              paidInvoice.id,
              paidInvoice.user_id,
            ]
          );
        }

        return {
          invoice: paidInvoice,
          entitlementsGranted,
        };
      });

      return NextResponse.json(result, { status: 200 });
    }

    // 2. Grant External Entitlement (e.g. property manager adds new resident or student directly)
    if (action === 'grant_external_entitlement') {
      const { userEmail, userId, targetType, targetId, durationDays, quotaQuantity } = body;
      if (!targetType) throw new ValidationError('targetType is required.');
      if (!userId && !userEmail) throw new ValidationError('userId or userEmail is required.');

      const result = await withServiceRoleTransaction(async (tx) => {
        let resolvedUserId = userId;
        if (!resolvedUserId && userEmail) {
          const userRes = await tx.query<UserProfile>(
            `SELECT id FROM public.profiles WHERE email = $1 LIMIT 1;`,
            [userEmail.toLowerCase()]
          );
          if (!userRes.rows[0]) {
            throw new NotFoundError(`User with email "${userEmail}" not registered in Circles.`);
          }
          resolvedUserId = userRes.rows[0].id;
        }

        let expiresAt: string | null = null;
        if (durationDays) {
          const exp = new Date();
          exp.setDate(exp.getDate() + durationDays);
          expiresAt = exp.toISOString();
        }

        const entId = crypto.randomUUID();
        const res = await tx.query<MemberEntitlementItem>(
          `INSERT INTO public.member_entitlements (
             id, circle_id, user_id, target_type, target_id,
             status, granted_at, expires_at, remaining_quota, metadata
           ) VALUES ($1, $2, $3, $4, $5, 'active', NOW(), $6, $7, $8)
           RETURNING *;`,
          [
            entId,
            params.circleId,
            resolvedUserId,
            targetType,
            targetId || null,
            expiresAt,
            quotaQuantity || null,
            JSON.stringify({ source: 'external_erp_webhook' }),
          ]
        );

        if (targetType === 'circle_membership') {
          await tx.query(
            `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
             VALUES ($1, $2, $3, 'member', 'active')
             ON CONFLICT (circle_id, user_id)
             DO UPDATE SET status = 'active';`,
            [crypto.randomUUID(), params.circleId, resolvedUserId]
          );
        }

        return res.rows[0];
      });

      return NextResponse.json({ entitlement: result }, { status: 201 });
    }

    // 3. Revoke External Entitlement (e.g. lease termination or membership cancellation)
    if (action === 'revoke_external_entitlement') {
      const { entitlementId, userId, targetType, targetId } = body;

      const updated = await withServiceRoleTransaction(async (tx) => {
        let query = `UPDATE public.member_entitlements SET status = 'revoked', updated_at = NOW() WHERE circle_id = $1`;
        const paramsArray: unknown[] = [params.circleId];
        let pIdx = 2;

        if (entitlementId) {
          query += ` AND id = $${pIdx++}`;
          paramsArray.push(entitlementId);
        } else if (userId && targetType) {
          query += ` AND user_id = $${pIdx++} AND target_type = $${pIdx++}`;
          paramsArray.push(userId, targetType);
          if (targetId) {
            query += ` AND target_id = $${pIdx++}`;
            paramsArray.push(targetId);
          }
        } else {
          throw new ValidationError('Must provide entitlementId or (userId + targetType).');
        }

        query += ` RETURNING *;`;
        const res = await tx.query<MemberEntitlementItem>(query, paramsArray);
        return res.rows;
      });

      return NextResponse.json({ revoked: updated }, { status: 200 });
    }

    throw new ValidationError(`Unknown integration action: "${action}"`);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
