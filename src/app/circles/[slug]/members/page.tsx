import React from 'react';
import { notFound } from 'next/navigation';
import { Lock, Shield, Users } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { isCapabilityEnabledForCircle } from '@/features/capabilities/service';
import { listCircleMembers } from '@/features/memberships/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';

export const dynamic = 'force-dynamic';

export default async function CircleMembersPage({
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Directory</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to view its member directory.
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
      <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center shadow-sm">
        <Users className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Member Directory Capability Disabled
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          The Member Directory capability is currently disabled for this Circle.
        </p>
      </div>
    );
  }

  const members = await listCircleMembers(user?.id ?? null, circle.id);
  const activeMembers = members.filter((m) => m.status === 'active');

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900">
          Member Directory ({activeMembers.length})
        </h2>
        <p className="text-xs text-stone-600">
          Active members and leadership roles in {circle.name}.
        </p>
      </div>

      <div className="divide-y divide-sand-100">
        {activeMembers.map((m) => (
          <div
            key={m.id}
            className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">
                {(m.profile?.display_name || 'M').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-stone-900">
                    {m.profile?.display_name}
                  </p>
                  <span className="text-xs text-stone-500">@{m.profile?.username}</span>
                </div>
                {m.profile?.bio && (
                  <p className="mt-0.5 text-xs text-stone-600">{m.profile.bio}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  m.role === 'owner'
                    ? 'bg-forest-700 text-white'
                    : m.role === 'admin'
                      ? 'bg-forest-100 text-forest-800'
                      : m.role === 'moderator'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-sand-100 text-stone-700'
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
