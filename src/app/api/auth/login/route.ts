import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, signOutUser } from '@/features/auth/service';
import {
  assertCsrfProtection,
  checkDistributedRateLimit,
  extractRequestSessionToken,
  handleApiError,
} from '@/lib/auth/api-helpers';

export async function POST(req: NextRequest) {
  try {
    assertCsrfProtection(req);
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!(await checkDistributedRateLimit(`login:${ip}`, 20, 60_000))) {
      return NextResponse.json({ error: 'Too many sign-in attempts.' }, { status: 429 });
    }

    const priorToken = extractRequestSessionToken(req);
    if (priorToken) {
      await signOutUser(priorToken);
    }

    const body = await req.json();
    const { user, sessionToken } = await authenticateUser(body);
    return NextResponse.json({ user, sessionToken }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
