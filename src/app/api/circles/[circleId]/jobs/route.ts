import { NextRequest, NextResponse } from 'next/server';
import {
  createJobOpportunity,
  listJobApplications,
  listJobOpportunities,
  reviewJobApplication,
  submitJobApplication,
  updateJobOpportunity,
} from '@/features/jobs/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const opportunityType = searchParams.get('opportunityType') || undefined;
    const workMode = searchParams.get('workMode') || undefined;
    const search = searchParams.get('search') || undefined;

    const opportunities = await listJobOpportunities(user?.id ?? null, params.circleId, {
      opportunityType,
      workMode,
      search,
    });

    const applications = user
      ? await listJobApplications(user.id, params.circleId)
      : [];

    return NextResponse.json({ opportunities, applications });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();

    if (body.action === 'apply') {
      if (!body.opportunityId) throw new ValidationError('opportunityId is required.');
      const application = await submitJobApplication(
        user.id,
        params.circleId,
        String(body.opportunityId),
        {
          coverNote: body.coverNote,
          resumeUrl: body.resumeUrl,
          portfolioUrl: body.portfolioUrl,
        }
      );
      return NextResponse.json({ application }, { status: 201 });
    }

    const opportunity = await createJobOpportunity(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ opportunity }, { status: 201 });
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

    if (body.action === 'review_application') {
      if (!body.applicationId) throw new ValidationError('applicationId is required.');
      const application = await reviewJobApplication(
        user.id,
        params.circleId,
        String(body.applicationId),
        {
          status: body.status,
          reviewerNote: body.reviewerNote,
        }
      );
      return NextResponse.json({ application });
    }

    if (!body.opportunityId) throw new ValidationError('opportunityId is required.');
    const opportunity = await updateJobOpportunity(
      user.id,
      params.circleId,
      String(body.opportunityId),
      body
    );
    return NextResponse.json({ opportunity });
  } catch (error) {
    return handleApiError(error);
  }
}
