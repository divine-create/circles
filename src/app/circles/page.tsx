import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Compass,
  Layers,
  Lock,
  PlusCircle,
  Sliders,
  Users,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { listMyCircles } from '@/features/circles/service';

export const dynamic = 'force-dynamic';

export default async function MyCirclesPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const circles = await listMyCircles(user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-stone-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-900">
            <Layers className="h-3.5 w-3.5" />
            <span>Active Memberships</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            My Circles
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Communities you own, moderate, or participate in across the platform.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-all shadow-xs"
          >
            <Compass className="h-4 w-4 text-stone-400" />
            <span>Explore More</span>
          </Link>
          <Link
            href="/circles/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_3px_rgba(0,0,0,0.15)] hover:bg-zinc-800 transition-all active:scale-[0.98]"
          >
            <PlusCircle className="h-4 w-4 text-stone-300" />
            <span>Create Circle</span>
          </Link>
        </div>
      </div>

      {circles.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <Layers className="mx-auto h-9 w-9 text-stone-400" />
          <h2 className="mt-3 text-base font-bold text-stone-900">You haven&apos;t joined any Circles yet</h2>
          <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
            Browse public communities in the directory or launch a new Circle tailored to your team.
          </p>
          <div className="mt-6 flex justify-center gap-2.5">
            <Link
              href="/explore"
              className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Explore Directory
            </Link>
            <Link
              href="/circles/new"
              className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs"
            >
              Start a Circle
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {circles.map((circle) => {
            const isStaff =
              circle.current_user_role === 'owner' || circle.current_user_role === 'admin';

            return (
              <div
                key={circle.id}
                className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs hover:border-black/30 hover:shadow-premium-hover transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-mono font-medium capitalize text-stone-800 border border-stone-200">
                      {circle.category.replace('_', ' ')}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                        circle.current_user_role === 'owner'
                          ? 'bg-zinc-950 text-white border-zinc-900'
                          : circle.current_user_role === 'admin'
                            ? 'bg-stone-800 text-white border-stone-700'
                            : 'bg-stone-100 text-stone-700 border-stone-200/80'
                      }`}
                    >
                      {circle.current_user_role}
                    </span>
                  </div>

                  <Link href={`/circles/${circle.slug}`} className="block mt-4">
                    <h2 className="text-base font-bold text-stone-900 group-hover:text-black transition-colors">
                      {circle.name}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-xs text-stone-600 leading-relaxed font-normal">
                      {circle.description}
                    </p>
                  </Link>
                </div>

                <div className="mt-6 space-y-3.5 border-t border-stone-100 pt-4">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                      <Users className="h-3.5 w-3.5 text-stone-900" />
                      {circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}
                    </span>
                    <span className="text-[11px] font-medium text-stone-400 capitalize">
                      {circle.visibility === 'private' && (
                        <Lock className="inline h-3 w-3 mr-1 text-stone-400" />
                      )}
                      {circle.visibility.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/circles/${circle.slug}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-black py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-all active:scale-[0.98]"
                    >
                      <span>Open Community</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    {isStaff && (
                      <Link
                        href={`/circles/${circle.slug}/studio`}
                        className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50/80 px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                        title="Configure in Circle Studio"
                      >
                        <Sliders className="h-3.5 w-3.5 text-stone-700" />
                        <span>Studio</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
