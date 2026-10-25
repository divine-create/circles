import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/features/auth/service';
import { checkRateLimit, handleApiError } from '@/lib/auth/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!checkRateLimit(`login:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many sign-in attempts.' }, { status: 429 });
    }

    const body = await req.json();
    const { user, sessionToken } = await authenticateUser(body);
    return NextResponse.json({ user, sessionToken }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
