import React from 'react';
import { notFound } from 'next/navigation';
import { GraduationCap, Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { listCourses } from '@/features/courses/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CoursesCatalog } from '@/components/courses/courses-catalog';
import { CourseItem } from '@/types/domain';
import { CapabilityDisabledError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export default async function CircleCoursesPage({
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
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-xs">
        <Lock className="mx-auto h-8 w-8 text-stone-600" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Courses</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to access structured video courses and curriculum modules.
        </p>
      </div>
    );
  }

  let courses: CourseItem[] = [];
  try {
    courses = await listCourses(user?.id ?? null, circle.id);
  } catch (err) {
    if (err instanceof CapabilityDisabledError) {
      return (
        <div className="rounded-2xl border border-stone-200/90 bg-white p-10 text-center shadow-xs">
          <GraduationCap className="mx-auto h-8 w-8 text-stone-400" />
          <h2 className="mt-3 text-lg font-bold text-stone-900">Courses Capability Disabled</h2>
          <p className="mt-1 text-sm text-stone-600">
            Enable Courses & Learning in Circle Studio to offer courses to your community.
          </p>
        </div>
      );
    }
    console.error('Failed to list courses:', err);
    throw err;
  }

  const isMember = circle.current_user_membership_status === 'active';
  const isStaff =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator';

  return (
    <CoursesCatalog
      circleId={circle.id}
      circleSlug={circle.slug}
      initialCourses={JSON.parse(JSON.stringify(courses))}
      isMember={isMember}
      isStaff={isStaff}
    />
  );
}
