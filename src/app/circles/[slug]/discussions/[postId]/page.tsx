import React from 'react';
import { notFound } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getPostWithComments } from '@/features/discussions/service';
import { PostDetailClient } from '@/components/circles/post-detail-client';

export const dynamic = 'force-dynamic';

export default async function PostDetailPage({
  params,
}: {
  params: { slug: string; postId: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  try {
    const { post, comments } = await getPostWithComments(
      user?.id ?? null,
      circle.id,
      params.postId
    );
    return (
      <PostDetailClient
        circle={circle}
        initialPost={post}
        initialComments={comments}
        currentUserId={user?.id ?? null}
      />
    );
  } catch {
    notFound();
  }
}
