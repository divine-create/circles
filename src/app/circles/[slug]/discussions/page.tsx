import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, Sliders } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleNavigation, isCapabilityEnabledForCircle } from '@/features/capabilities/service';
import { listCirclePosts } from '@/features/discussions/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { DiscussionsClient } from '@/components/circles/discussions-client';

export const dynamic = 'force-dynamic';

export default async function CircleDiscussionsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { spaceId?: string };
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Discussions</h2>
        <p className="mt-1 text-sm text-stone-600">
          You must be an active member of {circle.name} to read or post in discussions.
        </p>
      </div>
    );
  }

  const discussionsEnabled = await isCapabilityEnabledForCircle(
    user?.id ?? null,
    circle.id,
    'discussions'
  );

  if (!discussionsEnabled) {
    return (
      <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center shadow-sm">
        <Sliders className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Discussions Capability is Disabled
        </h2>
        <p className="mt-1 text-sm text-stone-600 max-w-md mx-auto">
          The Discussions module is currently turned off for this Circle. Existing posts and
          comments are preserved and will reappear if re-enabled in Circle Studio.
        </p>
        {(circle.current_user_role === 'owner' || circle.current_user_role === 'admin') && (
          <Link
            href={`/circles/${circle.slug}/studio`}
            className="mt-4 inline-block rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Open Circle Studio
          </Link>
        )}
      </div>
    );
  }

  const navigation = await getCircleNavigation(user?.id ?? null, circle.id, circle.slug);
  const selectedSpaceId = searchParams.spaceId || null;
  const posts = await listCirclePosts(user?.id ?? null, circle.id, {
    spaceId: selectedSpaceId,
  });

  return (
    <DiscussionsClient
      circle={circle}
      spaces={navigation.visibleSpaces}
      initialPosts={posts}
      selectedSpaceId={selectedSpaceId}
      currentUserId={user?.id ?? null}
    />
  );
}
