import { NextRequest, NextResponse } from 'next/server';
import {
  createInvoice,
  createPricingPlan,
  getTreasuryLedger,
  getTreasurySummary,
  grantMemberEntitlement,
  listInvoices,
  listMemberEntitlements,
  listPricingPlans,
  recordOfflinePayment,
  recordTreasuryEntry,
  updatePricingPlan,
} from '@/features/finances/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';
import { InvoiceStatus } from '@/types/domain';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'plans';

    if (mode === 'plans') {
      const includeInactive = searchParams.get('includeInactive') === 'true';
      const plans = await listPricingPlans(user?.id ?? null, params.circleId, {
        includeInactive,
      });
      return NextResponse.json({ plans });
    }

    if (mode === 'invoices') {
      if (!user) throw new UnauthorizedError();
      const status = searchParams.get('status') as InvoiceStatus | null;
      const targetUserId = searchParams.get('userId') || undefined;
      const invoices = await listInvoices(user.id, params.circleId, {
        userId: targetUserId,
        status: status || undefined,
      });
      return NextResponse.json({ invoices });
    }

    if (mode === 'entitlements') {
      if (!user) throw new UnauthorizedError();
      const targetUserId = searchParams.get('userId') || undefined;
      const entitlements = await listMemberEntitlements(user.id, params.circleId, targetUserId);
      return NextResponse.json({ entitlements });
    }

    if (mode === 'treasury_ledger') {
      if (!user) throw new UnauthorizedError();
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      const ledger = await getTreasuryLedger(user.id, params.circleId, { limit, offset });
      return NextResponse.json({ ledger });
    }

    if (mode === 'treasury_summary') {
      if (!user) throw new UnauthorizedError();
      const summary = await getTreasurySummary(user.id, params.circleId);
      return NextResponse.json({ summary });
    }

    throw new ValidationError(`Unknown mode: "${mode}"`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'create_plan') {
      const plan = await createPricingPlan(user.id, {
        ...body.plan,
        circleId: params.circleId,
      });
      return NextResponse.json({ plan }, { status: 201 });
    }

    if (action === 'create_invoice') {
      const invoice = await createInvoice(user.id, {
        ...body.invoice,
        circleId: params.circleId,
      });
      return NextResponse.json({ invoice }, { status: 201 });
    }

    if (action === 'reconcile_offline_payment') {
      const result = await recordOfflinePayment(user.id, {
        ...body.payment,
        circleId: params.circleId,
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (action === 'record_treasury_entry') {
      const entry = await recordTreasuryEntry(user.id, {
        ...body.entry,
        circleId: params.circleId,
      });
      return NextResponse.json({ entry }, { status: 201 });
    }

    if (action === 'grant_entitlement') {
      const entitlement = await grantMemberEntitlement(user.id, {
        ...body.entitlement,
        circleId: params.circleId,
      });
      return NextResponse.json({ entitlement }, { status: 201 });
    }

    throw new ValidationError(`Unknown action: "${action}"`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'update_plan') {
      if (!body.planId) {
        throw new ValidationError('planId is required for update_plan.');
      }
      const plan = await updatePricingPlan(
        user.id,
        params.circleId,
        body.planId,
        body.updates || {}
      );
      return NextResponse.json({ plan });
    }

    throw new ValidationError(`Unknown action: "${action}"`);
  } catch (error) {
    return handleApiError(error);
  }
}
