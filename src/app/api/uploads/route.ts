import { NextRequest, NextResponse } from 'next/server';
import { createMediaUpload } from '@/features/uploads/service';
import {
  checkDistributedRateLimit,
  handleApiError,
  resolveApiUser,
} from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const allowed = await checkDistributedRateLimit(`upload:${user.id}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many file uploads. Please wait before uploading again.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await req.json();
    const upload = await createMediaUpload(user.id, body);
    return NextResponse.json({ upload }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
