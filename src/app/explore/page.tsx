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
  { key: 'all', label: 'All Categories' },
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
            Community Directory
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
            Explore Discoverable Circles
          </h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Browse public communities and approval-based Circles. Private Circles are hidden from
            public discovery.
          </p>
        </div>

        <Link
          href={user ? '/circles/new' : '/register'}
          className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-forest-800"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create a Circle</span>
        </Link>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm space-y-4">
        <form action="/explore" method="GET" className="flex flex-col gap-3 sm:flex-row">
          {category !== 'all' && <input type="hidden" name="category" value={category} />}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search Circles by name, purpose, or location..."
              className="w-full rounded-xl border border-sand-300 bg-sand-50/60 py-2.5 pl-10 pr-4 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
          >
            Search
          </button>
          {(search || category !== 'all') && (
            <Link
              href="/explore"
              className="inline-flex items-center justify-center rounded-xl border border-sand-300 px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-sand-100"
            >
              Reset
            </Link>
          )}
        </form>

        <div className="flex flex-wrap gap-1.5 pt-1">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-forest-700 text-white'
                    : 'bg-sand-100 text-stone-700 hover:bg-sand-200'
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
        <div className="rounded-2xl border border-sand-200 bg-white p-12 text-center">
          <Compass className="mx-auto h-10 w-10 text-stone-400" />
          <h2 className="mt-3 text-lg font-bold text-stone-900">No matching Circles found</h2>
          <p className="mt-1 text-sm text-stone-600">
            Try clearing your search filter or start a new Circle for your community.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {circles.map((circle) => {
            const isMember = circle.current_user_membership_status === 'active';
            const isPending = circle.current_user_join_request_status === 'pending';

            return (
              <div
                key={circle.id}
                className="flex flex-col justify-between rounded-2xl border border-sand-200 bg-white p-6 shadow-sm hover:border-forest-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-forest-800">
                      {circle.category.replace('_', ' ')}
                    </span>

                    {isMember ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Member ({circle.current_user_role})
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                        <Clock className="h-3 w-3" />
                        Pending Approval
                      </span>
                    ) : circle.membership_policy === 'approval' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <Lock className="h-3 w-3" />
                        Approval Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-forest-700">
                        Open to Join
                      </span>
                    )}
                  </div>

                  <Link href={`/circles/${circle.slug}`} className="group block mt-4">
                    <h2 className="text-lg font-bold text-stone-900 group-hover:text-forest-700">
                      {circle.name}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm text-stone-600 leading-relaxed">
                      {circle.description}
                    </p>
                  </Link>
                </div>

                <div className="mt-6 space-y-4 border-t border-sand-100 pt-4">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                      <Users className="h-3.5 w-3.5 text-forest-700" />
                      {circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}
                    </span>
                    {circle.location && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                        <MapPin className="h-3 w-3 text-stone-400" />
                        {circle.location}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/circles/${circle.slug}`}
                    className={`flex w-full items-center justify-center rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                      isMember
                        ? 'bg-sand-100 text-stone-800 hover:bg-sand-200'
                        : 'bg-forest-700 text-white hover:bg-forest-800'
                    }`}
                  >
                    {isMember
                      ? 'Enter Circle'
                      : isPending
                        ? 'View Request Status'
                        : circle.membership_policy === 'approval'
                          ? 'Preview & Request to Join'
                          : 'View & Join Circle'}
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
