import React from 'react';
import { notFound } from 'next/navigation';
import { Globe, Lock, MapPin, Shield, Users } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleNavigation } from '@/features/capabilities/service';
import { CircleMembershipActions } from '@/components/circles/circle-membership-actions';
import { CircleCollapsibleLayout } from '@/components/circles/circle-collapsible-layout';

export const dynamic = 'force-dynamic';

export default async function CircleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);

  if (!circle) {
    notFound();
  }

  const navigation = await getCircleNavigation(user?.id ?? null, circle.id, circle.slug);
  const isStaff =
    circle.current_user_role === 'owner' || circle.current_user_role === 'admin';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#FAF9F6]">
      {/* Circle Banner & Identity Header */}
      <div className="border-b border-stone-200/80 bg-white shadow-xs">
        {/* Ambient Gradient Header Mesh */}
        <div className="h-28 bg-gradient-to-r from-black via-zinc-900 to-zinc-950 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-dark opacity-20" />
          <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/[0.04] blur-2xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="-mt-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex items-end gap-4">
              {/* Refined Circle Monogram */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white bg-black text-2xl font-bold text-white shadow-md">
                {circle.name.slice(0, 1).toUpperCase()}
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 border-2 border-white" />
              </div>

              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-stone-800 border border-stone-200">
                    {circle.category.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500">
                    {circle.visibility === 'private' ? (
                      <>
                        <Lock className="h-3 w-3 text-stone-600" />
                        Private
                      </>
                    ) : circle.visibility === 'discoverable_approval' ? (
                      <>
                        <Shield className="h-3 w-3 text-stone-600" />
                        Approval Required
                      </>
                    ) : (
                      <>
                        <Globe className="h-3 w-3 text-stone-700" />
                        Public Community
                      </>
                    )}
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                  {circle.name}
                </h1>
              </div>
            </div>

            <CircleMembershipActions
              circle={circle}
              isAuthenticated={Boolean(user)}
            />
          </div>

          <p className="mt-3.5 max-w-3xl text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
            {circle.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-stone-500 border-t border-stone-100 pt-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
              <Users className="h-3.5 w-3.5 text-stone-900" />
              {circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}
            </span>
            {circle.location && (
              <span className="inline-flex items-center gap-1 text-stone-500">
                <MapPin className="h-3.5 w-3.5 text-stone-400" />
                {circle.location}
              </span>
            )}
            <span className="text-stone-400">
              Enabled modules:{' '}
              <strong className="font-semibold text-stone-700">
                {navigation.enabledCapabilityKeys.length}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Main Content & Capability Navigation */}
      <CircleCollapsibleLayout
        circle={circle}
        navigation={navigation}
        isStaff={isStaff}
      >
        {children}
      </CircleCollapsibleLayout>
    </div>
  );
}
