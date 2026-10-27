import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import { joinPublicCircle } from '@/features/memberships/service';
import { GET as financesGetRoute, POST as financesPostRoute, PATCH as financesPatchRoute } from '@/app/api/circles/[circleId]/finances/route';
import { runDatabaseMigrations } from '@/lib/db/postgres';

function makeRequest(url: string, method: string, body?: unknown, token?: string): NextRequest {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000',
    'Host': 'localhost:3000',
  });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Phase 2: Financial API Route Handlers & Studio Operations Suite', () => {
  beforeAll(async () => {
    await runDatabaseMigrations();
  });

  it('1. Rejects unauthenticated requests and non-admin plan mutations over HTTP API', async () => {
    const { user: owner, sessionToken: ownerToken } = await registerUser({
      email: `api-fin-owner-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `apifinowner_${Date.now()}`,
      displayName: 'API Finance Owner',
    });

    const { user: member, sessionToken: memberToken } = await registerUser({
      email: `api-fin-member-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `apifinmember_${Date.now()}`,
      displayName: 'API Finance Member',
    });

    const circle = await createCircle(owner.id, {
      name: `Finances API Circle ${Date.now()}`,
      slug: `fin-api-${Date.now()}`,
      description: 'Circle with financial APIs',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await updateCircleCapability(owner.id, circle.id, 'payments_finances', true);
    await joinPublicCircle(member.id, circle.id);

    // Unauthenticated POST -> 401
    const unauthRes = await financesPostRoute(
      makeRequest(`http://localhost:3000/api/circles/${circle.id}/finances`, 'POST', {
        action: 'create_plan',
        plan: {
          slug: 'unauth-plan',
          name: 'Unauth Plan',
          billingType: 'recurring',
          amountCents: 1000,
        },
      }),
      { params: { circleId: circle.id } }
    );
    expect(unauthRes.status).toBe(401);

    // Member (non-admin) trying to create plan -> 403
    const memberRes = await financesPostRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances`,
        'POST',
        {
          action: 'create_plan',
          plan: {
            slug: 'member-forbidden-plan',
            name: 'Member Forbidden Plan',
            billingType: 'recurring',
            amountCents: 1000,
          },
        },
        memberToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(memberRes.status).toBe(403);

    // Owner creates plan via HTTP API -> 201
    const createPlanRes = await financesPostRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances`,
        'POST',
        {
          action: 'create_plan',
          plan: {
            slug: 'annual-association-pass',
            name: 'Annual Professional Pass',
            description: 'Annual member dues for association voting rights and private council access',
            billingType: 'recurring',
            amountCents: 25000, // $250.00
            currency: 'USD',
            intervalUnit: 'year',
            intervalCount: 1,
            entitlements: [
              {
                targetType: 'circle_membership',
                metadata: { tier: 'pro_fellow' },
              },
            ],
          },
        },
        ownerToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(createPlanRes.status).toBe(201);
    const planData = await createPlanRes.json();
    expect(planData.plan.slug).toBe('annual-association-pass');

    // List plans via GET
    const listPlansRes = await financesGetRoute(
      makeRequest(`http://localhost:3000/api/circles/${circle.id}/finances?mode=plans`, 'GET'),
      { params: { circleId: circle.id } }
    );
    expect(listPlansRes.status).toBe(200);
    const listData = await listPlansRes.json();
    expect(listData.plans.length).toBeGreaterThanOrEqual(1);

    // Update plan via PATCH
    const patchPlanRes = await financesPatchRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances`,
        'PATCH',
        {
          action: 'update_plan',
          planId: planData.plan.id,
          updates: {
            name: 'Annual Professional Pass (2026/2027)',
            amountCents: 27500,
          },
        },
        ownerToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(patchPlanRes.status).toBe(200);
    const patchedData = await patchPlanRes.json();
    expect(patchedData.plan.name).toBe('Annual Professional Pass (2026/2027)');
    expect(patchedData.plan.amount_cents).toBe(27500);
  });

  it('2. Executes complete end-to-end invoicing, offline reconciliation, and treasury ledger via HTTP APIs', async () => {
    const { user: owner, sessionToken: ownerToken } = await registerUser({
      email: `api-treasurer-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `apicfo_${Date.now()}`,
      displayName: 'Treasurer Admin',
    });

    const { user: member, sessionToken: memberToken } = await registerUser({
      email: `api-resident-payer-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `apipayer_${Date.now()}`,
      displayName: 'Alice Resident',
    });

    const circle = await createCircle(owner.id, {
      name: `Grand View Heights Estate ${Date.now()}`,
      slug: `grand-view-${Date.now()}`,
      description: 'Residential community with treasury reporting',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await updateCircleCapability(owner.id, circle.id, 'payments_finances', true);
    await joinPublicCircle(member.id, circle.id);

    // 1. Issue an Invoice via API
    const invoiceRes = await financesPostRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances`,
        'POST',
        {
          action: 'create_invoice',
          invoice: {
            userId: member.id,
            title: 'Q4 Estate Infrastructure Assessment',
            totalCents: 15000, // $150.00
            currency: 'USD',
            paymentMethod: 'bank_transfer',
            status: 'open',
          },
        },
        ownerToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(invoiceRes.status).toBe(201);
    const invoiceData = await invoiceRes.json();
    const invoiceId = invoiceData.invoice.id;

    // 2. Member views their invoices
    const memberInvoicesRes = await financesGetRoute(
      makeRequest(`http://localhost:3000/api/circles/${circle.id}/finances?mode=invoices`, 'GET', undefined, memberToken),
      { params: { circleId: circle.id } }
    );
    expect(memberInvoicesRes.status).toBe(200);
    const memberInvData = await memberInvoicesRes.json();
    expect(memberInvData.invoices.length).toBe(1);
    expect(memberInvData.invoices[0].id).toBe(invoiceId);

    // 3. Admin reconciles offline bank transfer payment
    const reconcileRes = await financesPostRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances`,
        'POST',
        {
          action: 'reconcile_offline_payment',
          payment: {
            invoiceId,
            paymentMethod: 'bank_transfer',
            paymentReference: 'WIRE-GV-882299',
            notes: 'Verified against Bank of America statement',
            recordInTreasury: true,
            treasuryCategory: 'dues',
          },
        },
        ownerToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(reconcileRes.status).toBe(200);
    const reconciledData = await reconcileRes.json();
    expect(reconciledData.invoice.status).toBe('paid');
    expect(reconciledData.invoice.payment_reference).toBe('WIRE-GV-882299');

    // 4. Admin logs an expense in Community Treasury via API
    const expenseRes = await financesPostRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/finances`,
        'POST',
        {
          action: 'record_treasury_entry',
          entry: {
            entryType: 'expense',
            category: 'maintenance',
            amountCents: 8500, // $85.00
            currency: 'USD',
            description: 'Replacement street lamp fixtures at East Gate',
            isPublicToMembers: true,
          },
        },
        ownerToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(expenseRes.status).toBe(201);

    // 5. Query Treasury Ledger and Summary via GET API
    const ledgerRes = await financesGetRoute(
      makeRequest(`http://localhost:3000/api/circles/${circle.id}/finances?mode=treasury_ledger`, 'GET', undefined, memberToken),
      { params: { circleId: circle.id } }
    );
    expect(ledgerRes.status).toBe(200);
    const ledgerData = await ledgerRes.json();
    expect(ledgerData.ledger.length).toBeGreaterThanOrEqual(2); // dues revenue + maintenance expense

    const summaryRes = await financesGetRoute(
      makeRequest(`http://localhost:3000/api/circles/${circle.id}/finances?mode=treasury_summary`, 'GET', undefined, memberToken),
      { params: { circleId: circle.id } }
    );
    expect(summaryRes.status).toBe(200);
    const summaryData = await summaryRes.json();
    expect(summaryData.summary.total_revenue_cents).toBe(15000);
    expect(summaryData.summary.total_expense_cents).toBe(8500);
    expect(summaryData.summary.net_balance_cents).toBe(6500);
  });
});
