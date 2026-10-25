import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleAuditLogs, getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleCapabilities } from '@/features/capabilities/service';
import { listCircleSpaces } from '@/features/spaces/service';
import {
  listCircleInvitations,
  listCircleJoinRequests,
  listCircleMembers,
} from '@/features/memberships/service';
import { hasCirclePermission } from '@/lib/authorization/permissions';
import { CircleStudioClient } from '@/components/circles/circle-studio-client';

export const dynamic = 'force-dynamic';

export default async function CircleStudioPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const circle = await getCircleBySlugOrId(user.id, params.slug);
  if (!circle) {
    notFound();
  }

  const canManage = hasCirclePermission('circle.update_settings', circle.visibility, {
    userId: user.id,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-10 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Unauthorized — Circle Studio Restricted
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Only Circle Owners and Administrators are authorized to access Circle Studio settings.
        </p>
      </div>
    );
  }

  const [capabilities, spaces, members, joinRequests, invitations, auditLogs] = await Promise.all([
    getCircleCapabilities(user.id, circle.id),
    listCircleSpaces(user.id, circle.id, true),
    listCircleMembers(user.id, circle.id),
    listCircleJoinRequests(user.id, circle.id),
    listCircleInvitations(user.id, circle.id),
    getCircleAuditLogs(user.id, circle.id),
  ]);

  return (
    <CircleStudioClient
      circle={circle}
      capabilities={capabilities}
      spaces={spaces}
      members={members}
      joinRequests={joinRequests}
      invitations={invitations}
      auditLogs={auditLogs}
    />
  );
}
