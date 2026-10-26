import { NextRequest, NextResponse } from 'next/server';
import {
  listModerationReports,
  moderateContent,
  reportContent,
} from '@/features/moderation/service';
import {
  checkRateLimit,
  handleApiError,
  resolveApiUser,
} from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(req.url);
    const circleId = searchParams.get('circleId') || undefined;
    const reports = await listModerationReports(user.id, circleId);
    return NextResponse.json({ reports });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    if (!checkRateLimit(`report:${user.id}`, 15, 60_000)) {
      return NextResponse.json(
        { error: 'Too many content reports submitted. Please wait before submitting more.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const report = await reportContent(user.id, body);
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    await moderateContent(user.id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
