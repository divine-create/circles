import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  Compass,
  Lock,
  MapPin,
  PlusCircle,
  Search,
  Users,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { discoverCircles } from '@/features/circles/service';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'university', label: 'University' },
  { key: 'neighbourhood', label: 'Neighbourhood' },
  { key: 'professional', label: 'Professional' },
  { key: 'creator', label: 'Creator' },
  { key: 'learning', label: 'Learning' },
  { key: 'sports', label: 'Sports' },
  { key: 'project', label: 'Projects' },
  { key: 'local_business', label: 'Local Business' },
];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string };
}) {
  const user = await getAuthenticatedUser();
  const search = searchParams.search || '';
  const category = searchParams.category || 'all';

  const circles = await discoverCircles(user?.id ?? null, {
    search,
    category,
    limit: 36,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-stone-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-forest-700">
            <Compass className="h-3.5 w-3.5" />
            <span>Community Directory</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Explore Circles
          </h1>
          <p className="mt-1.5 text-sm text-stone-600 max-w-2xl">
            Discover public and approval-based communities. Filter by category, location, or purpose.
          </p>
        </div>

        <Link
          href={user ? '/circles/new' : '/register'}
          className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.15)] hover:bg-zinc-800 transition-all active:scale-[0.98]"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Start a Circle</span>
        </Link>
      </div>

      {/* Linear-Style Search & Category Filter Bar */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3.5">
        <form action="/explore" method="GET" className="flex flex-col gap-2.5 sm:flex-row">
          {category !== 'all' && <input type="hidden" name="category" value={category} />}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search by community name, description, or city..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-2.5 pl-10 pr-4 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20 transition-all"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-black px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-xs"
          >
            Search
          </button>
          {(search || category !== 'all') && (
            <Link
              href="/explore"
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 px-4 py-2.5 text-xs sm:text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Reset
            </Link>
          )}
        </form>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-stone-100">
          {CATEGORIES.map((cat) => {
            const active = category === cat.key;
            const href =
              cat.key === 'all'
                ? search
                  ? `/explore?search=${encodeURIComponent(search)}`
                  : '/explore'
                : `/explore?category=${cat.key}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
            return (
              <Link
                key={cat.key}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'bg-black text-white shadow-xs font-semibold'
                    : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Results Grid */}
      {circles.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <Compass className="mx-auto h-9 w-9 text-stone-400" />
          <h2 className="mt-3 text-base font-bold text-stone-900">No matching Circles found</h2>
          <p className="mt-1 text-xs text-stone-500">
            Try adjusting your search criteria or create a new Circle.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {circles.map((circle) => {
            const isMember = circle.current_user_membership_status === 'active';
            const isPending = circle.current_user_join_request_status === 'pending';

            return (
              <div
                key={circle.id}
                className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-[11px] font-medium capitalize text-forest-800 border border-forest-200/60">
                      {circle.category.replace('_', ' ')}
                    </span>

                    {isMember ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold text-white border border-zinc-900">
                        <CheckCircle2 className="h-3 w-3" />
                        {circle.current_user_role}
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/80">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    ) : circle.membership_policy === 'approval' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50/60 px-2 py-0.5 rounded-full border border-amber-200/60">
                        <Lock className="h-3 w-3" />
                        Approval Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                        Open
                      </span>
                    )}
                  </div>

                  <Link href={`/circles/${circle.slug}`} className="block mt-4">
                    <h2 className="text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                      {circle.name}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-xs text-stone-600 leading-relaxed">
                      {circle.description}
                    </p>
                  </Link>
                </div>

                <div className="mt-6 space-y-3.5 border-t border-stone-100 pt-4">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                      <Users className="h-3.5 w-3.5 text-forest-700" />
                      {circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}
                    </span>
                    {circle.location && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[150px] text-stone-400 text-[11px]">
                        <MapPin className="h-3 w-3 text-stone-400" />
                        {circle.location}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/circles/${circle.slug}`}
                    className={`flex w-full items-center justify-center rounded-xl py-2 text-xs font-semibold transition-all ${
                      isMember
                        ? 'bg-stone-100 text-stone-800 hover:bg-stone-200/80'
                        : 'bg-black text-white hover:bg-zinc-800 shadow-xs'
                    }`}
                  >
                    {isMember
                      ? 'Enter Circle'
                      : isPending
                        ? 'Check Request Status'
                        : circle.membership_policy === 'approval'
                          ? 'Request Access'
                          : 'Join Circle'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
