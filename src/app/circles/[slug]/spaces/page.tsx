import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, LayoutGrid, Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { isCapabilityEnabledForCircle } from '@/features/capabilities/service';
import { listCircleSpaces } from '@/features/spaces/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { DynamicIcon } from '@/components/ui/icon-map';

export const dynamic = 'force-dynamic';

export default async function CircleSpacesPage({
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Spaces</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to view and participate in its spaces.
        </p>
      </div>
    );
  }

  const spacesEnabled = await isCapabilityEnabledForCircle(user?.id ?? null, circle.id, 'spaces');
  if (!spacesEnabled) {
    return (
      <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center shadow-sm">
        <LayoutGrid className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Spaces Capability is Disabled</h2>
        <p className="mt-1 text-sm text-stone-600">
          The Spaces & Subgroups capability is currently turned off for this Circle.
        </p>
      </div>
    );
  }

  const spaces = await listCircleSpaces(user?.id ?? null, circle.id, false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Spaces & Channels</h2>
          <p className="text-xs text-stone-600">
            Topical spaces organized by community capabilities and posting permissions.
          </p>
        </div>

        {(circle.current_user_role === 'owner' || circle.current_user_role === 'admin') && (
          <Link
            href={`/circles/${circle.slug}/studio`}
            className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Manage Spaces in Studio
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {spaces.map((sp) => (
          <Link
            key={sp.id}
            href={`/circles/${circle.slug}/discussions?spaceId=${sp.id}`}
            className="group flex flex-col justify-between rounded-2xl border border-sand-200 bg-white p-5 shadow-sm hover:border-forest-600/40"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                    <DynamicIcon name={sp.icon} className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 group-hover:text-forest-700">
                      {sp.name}
                    </h3>
                    <span className="text-[11px] text-stone-500">
                      Posting: {sp.posting_policy}
                    </span>
                  </div>
                </div>
                {sp.capability_key && (
                  <span className="rounded bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                    {sp.capability_key.replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-stone-600 leading-relaxed">{sp.description}</p>
            </div>

            <div className="mt-4 flex items-center justify-end text-xs font-semibold text-forest-700">
              <span className="inline-flex items-center gap-1">
                Open Space <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
