import { NextRequest, NextResponse } from 'next/server';
import { createCircle, discoverCircles } from '@/features/circles/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;

    const circles = await discoverCircles(user?.id ?? null, { search, category });
    return NextResponse.json({ circles });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const circle = await createCircle(user.id, body);
    return NextResponse.json({ circle }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
