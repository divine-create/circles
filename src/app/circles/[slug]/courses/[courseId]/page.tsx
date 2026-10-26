import React from 'react';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCourseWithCurriculum } from '@/features/courses/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CoursePlayer } from '@/components/courses/course-player';
import { CourseItem } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleCourseDetailPage({
  params,
}: {
  params: { slug: string; courseId: string };
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
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Course</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to access structured lessons in this course.
        </p>
      </div>
    );
  }

  let course: CourseItem;
  try {
    course = await getCourseWithCurriculum(
      user?.id ?? null,
      circle.id,
      params.courseId
    );
  } catch {
    notFound();
  }

  const isMember = circle.current_user_membership_status === 'active';
  const isStaff =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator';

  return (
    <CoursePlayer
      circleId={circle.id}
      circleSlug={circle.slug}
      initialCourse={course}
      isMember={isMember}
      isStaff={isStaff}
    />
  );
}
