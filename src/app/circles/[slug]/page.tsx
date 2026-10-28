import React from 'react';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleNavigation } from '@/features/capabilities/service';
import { getCircleActivityStream } from '@/features/circles/activity-stream';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CircleOnboardingChecklist } from '@/components/circles/onboarding-checklist';
import { CommunityActivityStream } from '@/components/circles/community-activity-stream';

export const dynamic = 'force-dynamic';

export default async function CircleOverviewPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const canReadContent = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  const navigation = await getCircleNavigation(user?.id ?? null, circle.id, circle.slug);

  // Fetch unified activity stream (posts, marketplace/housing items, events, polls)
  const streamData = canReadContent
    ? await getCircleActivityStream(
        user?.id ?? null,
        circle.id,
        navigation.enabledCapabilityKeys
      )
    : {
        items: [],
        upcomingEvents: [],
        featuredListings: [],
        counts: { posts: 0, listings: 0, events: 0, polls: 0, all: 0 },
      };

  const isMember = circle.current_user_membership_status === 'active';

  return (
    <div className="space-y-8">
      {/* New Member & Admin Onboarding Flow */}
      {canReadContent && (
        <CircleOnboardingChecklist
          circle={circle}
          currentUser={user}
          hasPosts={streamData.counts.posts > 0}
          enabledCapabilityKeys={navigation.enabledCapabilityKeys}
        />
      )}

      {/* Main Unified Activity Stream vs Gate */}
      {!canReadContent ? (
        <section className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-stone-900">
            Member-Only Community Environment
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-stone-600">
            <strong>{circle.name}</strong> is discoverable in the directory, but its stream,
            discussions, and marketplace are restricted to approved members. Use the{' '}
            <strong>Request to Join Circle</strong> button above to apply for membership.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          <CommunityActivityStream
            circle={circle}
            initialItems={streamData.items}
            upcomingEvents={streamData.upcomingEvents}
            featuredListings={streamData.featuredListings}
            enabledCapabilityKeys={navigation.enabledCapabilityKeys}
            currentUserId={user?.id ?? null}
            isMember={isMember}
          />
        </section>
      )}
    </div>
  );
}
