import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import { joinPublicCircle } from '@/features/memberships/service';
import {
  createInvoice,
  createPricingPlan,
  checkMemberEntitlement,
} from '@/features/finances/service';
import {
  createCircleApiKey,
  createCircleWebhook,
  listCircleWebhooks,
} from '@/features/finances/integrations';
import { POST as paymentWebhookRoute } from '@/app/api/webhooks/payments/route';
import { POST as erpInboundWebhookRoute } from '@/app/api/circles/[circleId]/finances/webhooks/route';
import { runDatabaseMigrations } from '@/lib/db/postgres';

function makeRequest(
  url: string,
  method: string,
  body?: unknown,
  headersMap: Record<string, string> = {}
): NextRequest {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000',
    'Host': 'localhost:3000',
    ...headersMap,
  });
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Phase 3: Financial Webhooks, Payment Adapters & ERP Integrations Suite', () => {
  beforeAll(async () => {
    await runDatabaseMigrations();
  });

  it('1. Verifies Stripe/Platform Inbound Webhooks: fulfills entitlements and logs revenue', async () => {
    const { user: owner } = await registerUser({
      email: `stripe-owner-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `stripeowner_${Date.now()}`,
      displayName: 'Stripe Circle Owner',
    });

    const { user: student } = await registerUser({
      email: `stripe-student-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `stripestudent_${Date.now()}`,
      displayName: 'Student Learner',
    });

    const circle = await createCircle(owner.id, {
      name: `AI Academy Online ${Date.now()}`,
      slug: `ai-academy-${Date.now()}`,
      description: 'Online academy with automated Stripe payments',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await updateCircleCapability(owner.id, circle.id, 'payments_finances', true);
    await joinPublicCircle(student.id, circle.id);

    // Create course access plan
    const coursePlan = await createPricingPlan(owner.id, {
      circleId: circle.id,
      slug: 'deep-learning-tuition',
      name: 'Deep Learning Mastery Course Access',
      billingType: 'one_time',
      amountCents: 49900, // $499.00
      currency: 'USD',
      entitlements: [
        {
          targetType: 'course_access',
          targetId: 'course-dl-mastery-uuid',
        },
      ],
    });

    // Check entitlement before webhook -> false
    const hasAccessBefore = await checkMemberEntitlement(
      circle.id,
      student.id,
      'course_access',
      'course-dl-mastery-uuid'
    );
    expect(hasAccessBefore).toBe(false);

    // Issue invoice
    const invoice = await createInvoice(owner.id, {
      circleId: circle.id,
      userId: student.id,
      planId: coursePlan.id,
      title: 'Tuition: Deep Learning Mastery',
      totalCents: 49900,
      currency: 'USD',
      paymentMethod: 'stripe',
      status: 'open',
    });

    // Construct mock Stripe Webhook payload
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_local_dev';
    const payload = JSON.stringify({
      id: 'evt_stripe_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_mock_session_id',
          payment_intent: 'pi_3MtwBwLkdIwHu7ix28q3t8A',
          amount_total: 49900,
          currency: 'usd',
          metadata: {
            circleId: circle.id,
            invoiceId: invoice.id,
          },
        },
      },
    });

    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Deliver webhook to /api/webhooks/payments
    const webhookReq = makeRequest(
      'http://localhost:3000/api/webhooks/payments',
      'POST',
      JSON.parse(payload),
      {
        'x-payment-signature': signature,
      }
    );

    const res = await paymentWebhookRoute(webhookReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);

    // Verify entitlement is now activated!
    const hasAccessAfter = await checkMemberEntitlement(
      circle.id,
      student.id,
      'course_access',
      'course-dl-mastery-uuid'
    );
    expect(hasAccessAfter).toBe(true);
  });

  it('2. Enforces External Integration API Keys & ERP Inbound Webhooks (Yardi/AppFolio sync)', async () => {
    const { user: owner } = await registerUser({
      email: `erp-owner-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `erpowner_${Date.now()}`,
      displayName: 'HOA President',
    });

    const { user: resident } = await registerUser({
      email: `resident-tenant-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `resident_tenant_${Date.now()}`,
      displayName: 'Robert Tenant',
    });

    const circle = await createCircle(owner.id, {
      name: `Emerald Palms Condominiums ${Date.now()}`,
      slug: `emerald-palms-${Date.now()}`,
      description: 'Condo association integrating with Yardi Voyager ERP',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await updateCircleCapability(owner.id, circle.id, 'payments_finances', true);
    await joinPublicCircle(resident.id, circle.id);

    // 1. Owner generates an integration API Key for the external property ERP
    const apiKeyResult = await createCircleApiKey(owner.id, circle.id, {
      name: 'Yardi Property Sync Service',
      permissions: ['finances.inbound_webhooks', 'entitlements.grant'],
    });

    expect(apiKeyResult.plainToken).toMatch(/^cir_live_[a-f0-9]{48}$/);
    const erpApiToken = apiKeyResult.plainToken!;

    // 2. Reject unauthenticated or invalid token requests
    const unauthRes = await erpInboundWebhookRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances/webhooks`,
        'POST',
        { action: 'grant_external_entitlement' },
        {}
      ),
      { params: { circleId: circle.id } }
    );
    expect(unauthRes.status).toBe(401);

    // 3. External ERP notifies Circles that resident paid rent & HOA maintenance dues on tenant portal
    const erpInvoice = await createInvoice(owner.id, {
      circleId: circle.id,
      userId: resident.id,
      title: 'October HOA Dues (Synced from Yardi)',
      totalCents: 32000, // $320.00
      currency: 'USD',
      status: 'open',
    });

    const erpPaymentRes = await erpInboundWebhookRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances/webhooks`,
        'POST',
        {
          action: 'reconcile_external_payment',
          invoiceId: erpInvoice.id,
          externalReference: 'YARDI-TX-9988221',
          notes: 'Auto-reconciled from Yardi Voyager rent batch',
          category: 'dues',
        },
        { Authorization: `Bearer ${erpApiToken}` }
      ),
      { params: { circleId: circle.id } }
    );

    expect(erpPaymentRes.status).toBe(200);
    const erpPayData = await erpPaymentRes.json();
    expect(erpPayData.invoice.status).toBe('paid');
    expect(erpPayData.invoice.payment_method).toBe('external_erp');
    expect(erpPayData.invoice.payment_reference).toBe('YARDI-TX-9988221');

    // 4. External ERP directly grants a pool & fitness facility pass
    const grantRes = await erpInboundWebhookRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances/webhooks`,
        'POST',
        {
          action: 'grant_external_entitlement',
          userId: resident.id,
          targetType: 'space_access',
          targetId: 'residents-fitness-gym-uuid',
          durationDays: 365,
        },
        { Authorization: `Bearer ${erpApiToken}` }
      ),
      { params: { circleId: circle.id } }
    );

    expect(grantRes.status).toBe(201);
    const grantData = await grantRes.json();
    expect(grantData.entitlement.target_id).toBe('residents-fitness-gym-uuid');

    // Verify privilege is active
    const hasGymAccess = await checkMemberEntitlement(
      circle.id,
      resident.id,
      'space_access',
      'residents-fitness-gym-uuid'
    );
    expect(hasGymAccess).toBe(true);

    // 5. External ERP revokes access upon lease expiration
    const revokeRes = await erpInboundWebhookRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances/webhooks`,
        'POST',
        {
          action: 'revoke_external_entitlement',
          userId: resident.id,
          targetType: 'space_access',
          targetId: 'residents-fitness-gym-uuid',
        },
        { Authorization: `Bearer ${erpApiToken}` }
      ),
      { params: { circleId: circle.id } }
    );

    expect(revokeRes.status).toBe(200);

    // Verify privilege is revoked
    const hasGymAccessAfterRevoke = await checkMemberEntitlement(
      circle.id,
      resident.id,
      'space_access',
      'residents-fitness-gym-uuid'
    );
    expect(hasGymAccessAfterRevoke).toBe(false);
  });

  it('3. Configures Outbound Webhook subscriptions for QuickBooks/Xero accounting sync', async () => {
    const { user: owner } = await registerUser({
      email: `sync-owner-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `syncowner_${Date.now()}`,
      displayName: 'Sync Owner',
    });

    const circle = await createCircle(owner.id, {
      name: `Accounting Webhooks Circle ${Date.now()}`,
      slug: `acct-webhooks-${Date.now()}`,
      description: 'Circle with accounting webhooks',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    // Create outbound webhook subscription
    const webhook = await createCircleWebhook(owner.id, circle.id, {
      url: 'https://accounting-sync.example.com/webhooks/circles',
      description: 'QuickBooks sync endpoint for paid invoices and treasury reconciliation',
      events: ['invoice.paid', 'entitlement.granted', 'treasury.entry_created'],
    });

    expect(webhook.url).toBe('https://accounting-sync.example.com/webhooks/circles');
    expect(webhook.secret).toMatch(/^whsec_[a-f0-9]{48}$/);
    expect(webhook.is_active).toBe(true);

    // List webhooks
    const list = await listCircleWebhooks(owner.id, circle.id);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(webhook.id);
  });
});
