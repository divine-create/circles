import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordRecovery, resetPasswordWithToken } from '@/features/auth/service';
import { checkRateLimit, handleApiError } from '@/lib/auth/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!checkRateLimit(`recover:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many password recovery attempts.' }, { status: 429 });
    }

    const body = await req.json();
    if (body.action === 'reset') {
      await resetPasswordWithToken(body.token || '', body.newPassword || '');
      return NextResponse.json({ success: true });
    }

    const result = await requestPasswordRecovery(body.email || '');
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
