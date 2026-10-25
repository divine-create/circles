import { NextResponse } from 'next/server';
import { signOutUser } from '@/features/auth/service';
import { handleApiError } from '@/lib/auth/api-helpers';

export async function POST() {
  try {
    await signOutUser();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
