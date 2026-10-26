import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCircleCapabilities, updateCircleCapability } from '@/features/capabilities/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const capabilities = await getCircleCapabilities(user?.id ?? null, params.circleId);
    return NextResponse.json({ capabilities });
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

    const body = await req.json();
    const capability = await updateCircleCapability(
      user.id,
      params.circleId,
      body.capabilityKey,
      Boolean(body.enabled),
      body.settings
    );
    try {
      revalidatePath('/', 'layout');
    } catch {
      // Ignore in non-standard request contexts
    }
    return NextResponse.json({ capability });
  } catch (error) {
    return handleApiError(error);
  }
}
