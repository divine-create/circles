import React from 'react';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import {
  listCommunityChallenges,
  listFundraisingCampaigns,
  listGovernanceProposals,
  listSupportTickets,
} from '@/features/governance/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CommunityHubBoard } from '@/components/circles/community-hub-board';
import {
  CommunityChallengeItem,
  FundraisingCampaignItem,
  GovernanceProposalItem,
  SupportTicketItem,
} from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleCommunityHubPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { tab?: string };
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Community Hub</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to view governance proposals, causes, challenges, and support.
        </p>
      </div>
    );
  }

  let proposals: GovernanceProposalItem[] = [];
  let campaigns: FundraisingCampaignItem[] = [];
  let challenges: CommunityChallengeItem[] = [];
  let tickets: SupportTicketItem[] = [];

  try {
    proposals = await listGovernanceProposals(user?.id ?? null, circle.id);
  } catch {
    proposals = [];
  }
  try {
    campaigns = await listFundraisingCampaigns(user?.id ?? null, circle.id);
  } catch {
    campaigns = [];
  }
  try {
    const chData = await listCommunityChallenges(user?.id ?? null, circle.id);
    challenges = chData.challenges;
  } catch {
    challenges = [];
  }
  if (user) {
    try {
      tickets = await listSupportTickets(user.id, circle.id);
    } catch {
      tickets = [];
    }
  }

  const tabParam = searchParams?.tab;
  const initialTab =
    tabParam === 'causes' || tabParam === 'challenges' || tabParam === 'support'
      ? tabParam
      : 'governance';

  const isMember = circle.current_user_membership_status === 'active';
  const isStaff =
    isMember &&
    (circle.current_user_role === 'owner' ||
      circle.current_user_role === 'admin' ||
      circle.current_user_role === 'moderator');

  return (
    <CommunityHubBoard
      circleId={circle.id}
      initialTab={initialTab}
      initialProposals={proposals}
      initialCampaigns={campaigns}
      initialChallenges={challenges}
      initialTickets={tickets}
      isMember={isMember}
      isStaff={isStaff}
    />
  );
}
