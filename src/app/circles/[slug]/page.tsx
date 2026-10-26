import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleCapabilities, getCircleNavigation } from '@/features/capabilities/service';
import { listCirclePosts } from '@/features/discussions/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { DynamicIcon } from '@/components/ui/icon-map';
import { DiscussionsClient } from '@/components/circles/discussions-client';

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

  const capabilities = await getCircleCapabilities(user?.id ?? null, circle.id);
  const enabledCapabilities = capabilities.filter((c) => c.enabled);
  const navigation = await getCircleNavigation(user?.id ?? null, circle.id, circle.slug);

  const discussionsEnabled = navigation.enabledCapabilityKeys.includes('discussions');
  const recentPosts =
    canReadContent && discussionsEnabled
      ? await listCirclePosts(user?.id ?? null, circle.id, { limit: 10 })
      : [];

  return (
    <div className="space-y-8">
      {/* Enabled Capabilities Strip */}
      <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-zinc-900" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Configured Circle Capabilities
            </h2>
          </div>
          {(circle.current_user_role === 'owner' || circle.current_user_role === 'admin') && (
            <Link
              href={`/circles/${circle.slug}/studio`}
              className="text-xs font-semibold text-zinc-900 hover:underline"
            >
              Manage in Studio →
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {enabledCapabilities.map((cap) => (
            <div
              key={cap.capability_key}
              className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
                <DynamicIcon name={cap.definition?.navigation_config.icon} className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900">
                  {cap.definition?.name ?? cap.capability_key}
                </p>
                <p className="mt-0.5 text-[11px] text-stone-600 line-clamp-2">
                  {cap.definition?.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Content Gate for Discoverable-With-Approval Circles */}
      {!canReadContent ? (
        <section className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-stone-900">
            Member-Only Community Environment
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-stone-600">
            <strong>{circle.name}</strong> is discoverable in the directory, but its spaces,
            discussions, and member directory are restricted to approved members. Use the{' '}
            <strong>Request to Join Circle</strong> button above to apply for membership.
          </p>
        </section>
      ) : discussionsEnabled ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">Community Discussions</h2>
            <Link
              href={`/circles/${circle.slug}/discussions`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900 hover:underline"
            >
              <span>Full Discussion Feed</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <DiscussionsClient
            circle={circle}
            spaces={navigation.visibleSpaces}
            initialPosts={recentPosts}
            selectedSpaceId={null}
            currentUserId={user?.id ?? null}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-stone-200/90 bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-2 text-base font-bold text-stone-900">
            Discussions Capability Disabled
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            The Circle owner has currently disabled the Discussions module for this Circle.
            Existing discussion history is safely preserved.
          </p>
        </section>
      )}
    </div>
  );
}
