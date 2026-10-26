import React from 'react';
import { notFound } from 'next/navigation';
import { BookOpen, Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { listLearningResources } from '@/features/resources/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { ResourcesBoard } from '@/components/circles/resources-board';
import { LearningResourceItem } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleResourcesPage({
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Resources</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to access learning modules and shared resources.
        </p>
      </div>
    );
  }

  let resources: LearningResourceItem[] = [];
  try {
    resources = await listLearningResources(user?.id ?? null, circle.id);
  } catch {
    return (
      <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center shadow-sm">
        <BookOpen className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Resources & Publishing Capabilities Disabled
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Enable Learning Resources, Shared Resources, or Media Publishing in Circle Studio.
        </p>
      </div>
    );
  }

  const isMember = circle.current_user_membership_status === 'active';

  return (
    <ResourcesBoard
      circleId={circle.id}
      initialResources={resources}
      isMember={isMember}
    />
  );
}
