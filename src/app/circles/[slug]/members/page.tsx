import React from 'react';
import { notFound } from 'next/navigation';
import { Lock, Search, Shield, Users } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { isCapabilityEnabledForCircle } from '@/features/capabilities/service';
import { listCircleMembers } from '@/features/memberships/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';

export const dynamic = 'force-dynamic';

export default async function CircleMembersPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { search?: string; role?: string };
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
      <div className="rounded-2xl border border-amber-200/80 bg-white p-12 text-center shadow-xs">
        <Lock className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-base font-bold text-stone-900">Members-Only Directory</h2>
        <p className="mt-1 text-xs text-stone-500">
          Join this Circle to view its member directory and leadership team.
        </p>
      </div>
    );
  }

  const directoryEnabled = await isCapabilityEnabledForCircle(
    user?.id ?? null,
    circle.id,
    'member_directory'
  );

  if (!directoryEnabled) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
        <Users className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-base font-bold text-stone-900">
          Member Directory Disabled
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          The Member Directory capability is currently disabled in Circle Studio.
        </p>
      </div>
    );
  }

  const searchQuery = searchParams?.search ?? '';
  const roleFilter =
    searchParams?.role === 'owner' ||
    searchParams?.role === 'admin' ||
    searchParams?.role === 'moderator' ||
    searchParams?.role === 'member'
      ? searchParams.role
      : 'all';

  const members = await listCircleMembers(user?.id ?? null, circle.id, {
    search: searchQuery,
    role: roleFilter,
  });
  const activeMembers = members.filter((m) => m.status === 'active');

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-stone-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">
              Member Directory
            </h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-800 border border-stone-200">
              {activeMembers.length} MEMBERS
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Active community members and leadership team in {circle.name}.
          </p>
        </div>

        <form method="GET" className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Filter members..."
              className="rounded-xl border border-stone-200 bg-stone-50/70 py-1.5 pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <select
            name="role"
            defaultValue={roleFilter}
            className="rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-1.5 text-xs text-stone-700 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owners</option>
            <option value="admin">Admins</option>
            <option value="moderator">Moderators</option>
            <option value="member">Members</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="divide-y divide-stone-100">
        {activeMembers.map((m) => (
          <div
            key={m.id}
            className="group flex flex-col justify-between gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center hover:bg-stone-50/50 rounded-xl px-2 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white shadow-xs">
                {(m.profile?.display_name || 'M').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-stone-900 group-hover:text-black transition-colors">
                    {m.profile?.display_name}
                  </p>
                  <span className="text-[11px] font-mono text-stone-400">@{m.profile?.username}</span>
                </div>
                {m.profile?.bio && (
                  <p className="text-xs text-stone-500 font-normal line-clamp-1">{m.profile.bio}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                  m.role === 'owner'
                    ? 'bg-zinc-950 text-white border-zinc-900'
                    : m.role === 'admin'
                      ? 'bg-zinc-800 text-white border-zinc-700'
                      : m.role === 'moderator'
                        ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                        : 'bg-stone-100 text-stone-600 border-stone-200/60'
                }`}
              >
                {m.role !== 'member' && <Shield className="h-3 w-3" />}
                {m.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
