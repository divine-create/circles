import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Globe, Lock, MapPin, Shield, Sliders, Users } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleNavigation } from '@/features/capabilities/service';
import { CircleMembershipActions } from '@/components/circles/circle-membership-actions';
import { DynamicIcon } from '@/components/ui/icon-map';

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
    <div className="min-h-[calc(100vh-4rem)] bg-sand-50">
      {/* Circle Banner & Identity Header */}
      <div className="border-b border-sand-200 bg-white">
        <div className="h-24 bg-gradient-to-r from-forest-900 via-forest-800 to-forest-700" />
        <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <div className="-mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex items-end gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-forest-700 text-2xl font-bold text-white shadow-md">
                {circle.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-forest-800">
                    {circle.category.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
                    {circle.visibility === 'private' ? (
                      <>
                        <Lock className="h-3 w-3 text-stone-600" />
                        Private Circle
                      </>
                    ) : circle.visibility === 'discoverable_approval' ? (
                      <>
                        <Shield className="h-3 w-3 text-amber-600" />
                        Discoverable · Approval Required
                      </>
                    ) : (
                      <>
                        <Globe className="h-3 w-3 text-forest-600" />
                        Public Circle
                      </>
                    )}
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
                  {circle.name}
                </h1>
              </div>
            </div>

            <CircleMembershipActions
              circle={circle}
              isAuthenticated={Boolean(user)}
            />
          </div>

          <p className="mt-4 max-w-3xl text-sm text-stone-600 leading-relaxed">
            {circle.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
              <Users className="h-3.5 w-3.5 text-forest-700" />
              {circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}
            </span>
            {circle.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-stone-400" />
                {circle.location}
              </span>
            )}
            <span>
              Enabled modules:{' '}
              <strong className="font-semibold text-stone-700">
                {navigation.enabledCapabilityKeys.length}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Content + Capability Navigation Sidebar */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Navigation Column */}
          <aside className="lg:col-span-3 space-y-6">
            <nav
              aria-label="Circle Navigation"
              className="rounded-2xl border border-sand-200 bg-white p-3 shadow-sm space-y-1"
            >
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Circle Navigation
              </p>
              {navigation.navigationItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-stone-700 hover:bg-forest-50 hover:text-forest-800 transition-colors"
                >
                  <DynamicIcon name={item.icon} className="h-4 w-4 text-forest-700" />
                  <span>{item.label}</span>
                </Link>
              ))}

              {isStaff && (
                <Link
                  href={`/circles/${circle.slug}/studio`}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-forest-800 bg-forest-50/70 hover:bg-forest-100/80 transition-colors mt-2 border-t border-sand-100 pt-2.5"
                >
                  <Sliders className="h-4 w-4 text-forest-700" />
                  <span>Circle Studio</span>
                </Link>
              )}
            </nav>

            {/* Spaces Sub-navigation (Only shown if 'spaces' capability is enabled) */}
            {navigation.enabledCapabilityKeys.includes('spaces') &&
              navigation.visibleSpaces.length > 0 && (
                <div className="rounded-2xl border border-sand-200 bg-white p-3 shadow-sm space-y-1">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      Spaces
                    </p>
                    <Link
                      href={`/circles/${circle.slug}/spaces`}
                      className="text-[11px] font-semibold text-forest-700 hover:underline"
                    >
                      All
                    </Link>
                  </div>
                  {navigation.visibleSpaces.map((sp) => (
                    <Link
                      key={sp.id}
                      href={`/circles/${circle.slug}/discussions?spaceId=${sp.id}`}
                      className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-sand-100"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <DynamicIcon name={sp.icon} className="h-3.5 w-3.5 text-forest-700 shrink-0" />
                        <span className="truncate">{sp.name}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
          </aside>

          {/* Right Primary Content Column */}
          <div className="lg:col-span-9">{children}</div>
        </div>
      </div>
    </div>
  );
}
