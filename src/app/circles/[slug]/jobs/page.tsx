import React from 'react';
import { notFound } from 'next/navigation';
import { Briefcase, Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { listJobApplications, listJobOpportunities } from '@/features/jobs/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { JobsBoard } from '@/components/circles/jobs-board';
import { JobApplicationItem, JobOpportunityItem } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleJobsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const canRead = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  if (!canRead) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
        <Lock className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Opportunities</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to view and apply to career and collaboration opportunities.
        </p>
      </div>
    );
  }

  let opportunities: JobOpportunityItem[] = [];
  let applications: JobApplicationItem[] = [];
  try {
    opportunities = await listJobOpportunities(user?.id ?? null, circle.id);
    if (user && circle.current_user_membership_status === 'active') {
      applications = await listJobApplications(user.id, circle.id);
    }
  } catch {
    return (
      <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center shadow-sm">
        <Briefcase className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Jobs & Opportunities Capability Disabled
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Enable Jobs & Opportunities in Circle Studio to activate this board.
        </p>
      </div>
    );
  }

  const isMember = circle.current_user_membership_status === 'active';

  return (
    <JobsBoard
      circleId={circle.id}
      initialOpportunities={opportunities}
      initialApplications={applications}
      isMember={isMember}
    />
  );
}
