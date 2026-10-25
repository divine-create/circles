import { NextRequest, NextResponse } from 'next/server';
import { signOutUser } from '@/features/auth/service';
import { extractRequestSessionToken, handleApiError } from '@/lib/auth/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const token = extractRequestSessionToken(req);
    await signOutUser(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
