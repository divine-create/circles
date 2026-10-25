import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/features/auth/service';
import { checkRateLimit, handleApiError } from '@/lib/auth/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!checkRateLimit(`register:${ip}`, 15, 60_000)) {
      return NextResponse.json({ error: 'Too many registration attempts.' }, { status: 429 });
    }

    const body = await req.json();
    const { user, sessionToken } = await registerUser(body);
    return NextResponse.json({ user, sessionToken }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
