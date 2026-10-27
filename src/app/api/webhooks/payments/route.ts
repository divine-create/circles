import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProcessor } from '@/lib/payments/adapter';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { fulfillInvoiceEntitlements } from '@/features/finances/service';
import { dispatchFinancialWebhookEvent } from '@/features/finances/integrations';
import { InvoiceItem } from '@/types/domain';
import { logger } from '@/lib/logging';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('stripe-signature') ||
      req.headers.get('x-payment-signature') ||
      req.headers.get('x-signature') ||
      '';

    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_local_dev';
    const processor = getPaymentProcessor();

    const verification = await processor.verifyWebhookSignature(rawBody, signature, secret);

    if (!verification.isValid) {
      logger.warn('Payment webhook signature verification failed', {
        provider: processor.name,
      });
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const { eventType, invoiceId, paymentReference } = verification;

    if (
      eventType === 'checkout.session.completed' ||
      eventType === 'invoice.payment_succeeded' ||
      eventType === 'payment_intent.succeeded'
    ) {
      if (!invoiceId) {
        return NextResponse.json({ received: true, note: 'No invoice attached' });
      }

      await withServiceRoleTransaction(async (tx) => {
        const invRes = await tx.query<InvoiceItem>(
          `SELECT * FROM public.invoices WHERE id = $1 LIMIT 1;`,
          [invoiceId]
        );
        const invoice = invRes.rows[0];
        if (!invoice || invoice.status === 'paid') {
          return;
        }

        // Update invoice to paid
        const updatedInvRes = await tx.query<InvoiceItem>(
          `UPDATE public.invoices
           SET status = 'paid',
               payment_method = 'stripe',
               payment_reference = $1,
               paid_at = NOW(),
               updated_at = NOW()
           WHERE id = $2
           RETURNING *;`,
          [paymentReference || `STRIPE_${Date.now()}`, invoiceId]
        );
        const paidInvoice = updatedInvRes.rows[0];

        // Automatically fulfill and activate plan entitlements
        const granted = await fulfillInvoiceEntitlements(tx, paidInvoice);

        // Record revenue entry in community treasury ledger
        if (paidInvoice.total_cents > 0) {
          await tx.query(
            `INSERT INTO public.community_treasury_ledger (
               id, circle_id, entry_type, category, amount_cents, currency,
               description, is_public_to_members, invoice_id, recorded_by, entry_date
             ) VALUES ($1, $2, 'revenue', 'dues', $3, $4, $5, true, $6, $7, NOW());`,
            [
              crypto.randomUUID(),
              paidInvoice.circle_id,
              paidInvoice.total_cents,
              paidInvoice.currency,
              `Online checkout payment for ${paidInvoice.title} (Ref: ${paymentReference})`,
              paidInvoice.id,
              paidInvoice.user_id,
            ]
          );
        }

        // Dispatch outbound webhook event to external systems (QuickBooks, Xero, ERP)
        dispatchFinancialWebhookEvent(paidInvoice.circle_id, 'invoice.paid', {
          invoice: paidInvoice,
          entitlementsCount: granted.length,
          paymentReference,
        }).catch((e) => logger.error('Outbound webhook dispatch error', { error: e }));
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    logger.error('Error handling payment webhook', { error: err });
    return NextResponse.json({ error: 'Internal webhook error' }, { status: 500 });
  }
}
