import React from 'react';
import { notFound } from 'next/navigation';
import { FolderKanban, Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { listCircleProjects } from '@/features/resources/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { ProjectsBoard } from '@/components/circles/projects-board';
import { CircleProjectItem } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleProjectsPage({
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Projects</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to collaborate on projects and track milestones.
        </p>
      </div>
    );
  }

  let projects: CircleProjectItem[] = [];
  try {
    projects = await listCircleProjects(user?.id ?? null, circle.id);
  } catch {
    return (
      <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center shadow-sm">
        <FolderKanban className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Projects & Collaboration Capability Disabled
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Enable Projects & Collaboration in Circle Studio to coordinate team tasks.
        </p>
      </div>
    );
  }

  const isMember = circle.current_user_membership_status === 'active';

  return (
    <ProjectsBoard
      circleId={circle.id}
      initialProjects={projects}
      isMember={isMember}
    />
  );
}
