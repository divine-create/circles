import React from 'react';
import { notFound } from 'next/navigation';
import { BarChart2, Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { listCirclePolls } from '@/features/polls/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { PollsBoard } from '@/components/circles/polls-board';
import { CirclePollItem } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CirclePollsPage({
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Polls</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to view and vote in community polls.
        </p>
      </div>
    );
  }

  let polls: CirclePollItem[] = [];
  try {
    polls = await listCirclePolls(user?.id ?? null, circle.id);
  } catch {
    return (
      <div className="rounded-2xl border border-stone-200/90 bg-white p-10 text-center shadow-xs">
        <BarChart2 className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Polls Capability Disabled</h2>
        <p className="mt-1 text-sm text-stone-600">
          Enable Polls & Decisions in Circle Studio to run structured community votes.
        </p>
      </div>
    );
  }

  const isMember = circle.current_user_membership_status === 'active';

  return <PollsBoard circleId={circle.id} initialPolls={polls} isMember={isMember} />;
}
