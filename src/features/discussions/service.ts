import crypto from 'crypto';
import { withRlsTransaction } from '@/lib/db/postgres';
import { createCommentSchema, createPostSchema, updatePostSchema } from '@/lib/validation';
import {
  CircleRole,
  CircleVisibility,
  CommentItem,
  MembershipStatus,
  PostItem,
} from '@/types/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCirclePermission, canModifyUserContent } from '@/lib/authorization/permissions';
import { requireEnabledCapability } from '@/features/capabilities/service';
import { createNotification } from '@/features/notifications/service';

export interface ListPostsOptions {
  spaceId?: string | null;
  limit?: number;
  offset?: number;
}

export async function listCirclePosts(
  actorUserId: string | null,
  circleId: string,
  options: ListPostsOptions = {}
): Promise<PostItem[]> {
  await requireEnabledCapability(actorUserId, circleId, 'discussions');

  const spaceId = options.spaceId ?? null;
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      PostItem & {
        author_username: string;
        author_display_name: string;
        author_avatar_url: string | null;
        space_name: string | null;
        space_slug: string | null;
        space_icon: string | null;
        viewer_has_liked: boolean;
        viewer_has_saved: boolean;
      }
    >(
      `SELECT p.*,
         u.username AS author_username,
         u.display_name AS author_display_name,
         u.avatar_url AS author_avatar_url,
         s.name AS space_name,
         s.slug AS space_slug,
         s.icon AS space_icon,
         EXISTS (
           SELECT 1 FROM public.reactions r
           WHERE r.post_id = p.id AND r.user_id = $2::uuid
         ) AS viewer_has_liked,
         EXISTS (
           SELECT 1 FROM public.saved_items si
           WHERE si.post_id = p.id AND si.user_id = $2::uuid
         ) AS viewer_has_saved
       FROM public.posts p
       JOIN public.profiles u ON u.id = p.author_id
       LEFT JOIN public.circle_spaces s ON s.id = p.space_id
       WHERE p.circle_id = $1
         AND p.status = 'published'
         AND ($3::uuid IS NULL OR p.space_id = $3::uuid)
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT $4 OFFSET $5;`,
      [circleId, actorUserId, spaceId, limit, offset]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      space_id: r.space_id,
      author_id: r.author_id,
      title: r.title,
      body: r.body,
      status: r.status,
      is_pinned: r.is_pinned,
      comment_count: r.comment_count,
      reaction_count: r.reaction_count,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: {
        id: r.author_id,
        username: r.author_username,
        display_name: r.author_display_name,
        avatar_url: r.author_avatar_url,
      },
      space: r.space_id
        ? {
            id: r.space_id,
            name: r.space_name ?? 'Space',
            slug: r.space_slug ?? 'general',
            icon: r.space_icon ?? 'message-square',
          }
        : null,
      viewer_has_liked: Boolean(r.viewer_has_liked),
      viewer_has_saved: Boolean(r.viewer_has_saved),
    }));
  });
}

export async function getPostWithComments(
  actorUserId: string | null,
  circleId: string,
  postId: string
): Promise<{ post: PostItem; comments: CommentItem[] }> {
  await requireEnabledCapability(actorUserId, circleId, 'discussions');

  return withRlsTransaction(actorUserId, async (tx) => {
    const postRes = await tx.query<
      PostItem & {
        author_username: string;
        author_display_name: string;
        author_avatar_url: string | null;
        space_name: string | null;
        space_slug: string | null;
        space_icon: string | null;
        viewer_has_liked: boolean;
        viewer_has_saved: boolean;
      }
    >(
      `SELECT p.*,
         u.username AS author_username,
         u.display_name AS author_display_name,
         u.avatar_url AS author_avatar_url,
         s.name AS space_name,
         s.slug AS space_slug,
         s.icon AS space_icon,
         EXISTS (
           SELECT 1 FROM public.reactions r
           WHERE r.post_id = p.id AND r.user_id = $3::uuid
         ) AS viewer_has_liked,
         EXISTS (
           SELECT 1 FROM public.saved_items si
           WHERE si.post_id = p.id AND si.user_id = $3::uuid
         ) AS viewer_has_saved
       FROM public.posts p
       JOIN public.profiles u ON u.id = p.author_id
       LEFT JOIN public.circle_spaces s ON s.id = p.space_id
       WHERE p.id = $1 AND p.circle_id = $2 AND p.status = 'published'
       LIMIT 1;`,
      [postId, circleId, actorUserId]
    );

    const row = postRes.rows[0];
    if (!row) {
      throw new NotFoundError('Post not found or inaccessible.');
    }

    const commentsRes = await tx.query<
      CommentItem & {
        author_username: string;
        author_display_name: string;
        author_avatar_url: string | null;
      }
    >(
      `SELECT c.*,
         u.username AS author_username,
         u.display_name AS author_display_name,
         u.avatar_url AS author_avatar_url
       FROM public.comments c
       JOIN public.profiles u ON u.id = c.author_id
       WHERE c.post_id = $1 AND c.circle_id = $2 AND c.status = 'published'
       ORDER BY c.created_at ASC;`,
      [postId, circleId]
    );

    const post: PostItem = {
      id: row.id,
      circle_id: row.circle_id,
      space_id: row.space_id,
      author_id: row.author_id,
      title: row.title,
      body: row.body,
      status: row.status,
      is_pinned: row.is_pinned,
      comment_count: row.comment_count,
      reaction_count: row.reaction_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        id: row.author_id,
        username: row.author_username,
        display_name: row.author_display_name,
        avatar_url: row.author_avatar_url,
      },
      space: row.space_id
        ? {
            id: row.space_id,
            name: row.space_name ?? 'Space',
            slug: row.space_slug ?? 'general',
            icon: row.space_icon ?? 'message-square',
          }
        : null,
      viewer_has_liked: Boolean(row.viewer_has_liked),
      viewer_has_saved: Boolean(row.viewer_has_saved),
    };

    const comments: CommentItem[] = commentsRes.rows.map((c) => ({
      id: c.id,
      post_id: c.post_id,
      circle_id: c.circle_id,
      author_id: c.author_id,
      body: c.body,
      status: c.status,
      created_at: c.created_at,
      updated_at: c.updated_at,
      author: {
        id: c.author_id,
        username: c.author_username,
        display_name: c.author_display_name,
        avatar_url: c.author_avatar_url,
      },
    }));

    return { post, comments };
  });
}

export async function createPost(actorUserId: string, input: unknown): Promise<PostItem> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid post content.');
  }

  const { circleId, spaceId, title, body } = parsed.data;
  await requireEnabledCapability(actorUserId, circleId, 'discussions');

  return withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];

    assertCirclePermission(
      'discussions.post',
      circle.visibility,
      {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      },
      'Only active Circle members can create posts.'
    );

    if (spaceId) {
      const spaceRes = await tx.query<{
        id: string;
        circle_id: string;
        is_archived: boolean;
        posting_policy: 'members' | 'moderators' | 'admins';
      }>(`SELECT id, circle_id, is_archived, posting_policy FROM public.circle_spaces WHERE id = $1 LIMIT 1;`, [
        spaceId,
      ]);
      const space = spaceRes.rows[0];
      if (!space || space.circle_id !== circleId) {
        throw new ForbiddenError('The selected space does not belong to this Circle.');
      }
      if (space.is_archived) {
        throw new ValidationError('Cannot create a post in an archived space.');
      }
      if (
        space.posting_policy === 'moderators' &&
        !['owner', 'admin', 'moderator'].includes(membership?.role ?? '')
      ) {
        throw new ForbiddenError('Only moderators and administrators can post in this space.');
      }
      if (space.posting_policy === 'admins' && !['owner', 'admin'].includes(membership?.role ?? '')) {
        throw new ForbiddenError('Only administrators can post in this space.');
      }
    }

    const postId = crypto.randomUUID();
    const inserted = await tx.query<PostItem>(
      `INSERT INTO public.posts (id, circle_id, space_id, author_id, title, body, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'published')
       RETURNING *;`,
      [postId, circleId, spaceId ?? null, actorUserId, title, body]
    );

    const post = inserted.rows[0];
    if (!post) {
      throw new ForbiddenError('Unable to create post.');
    }
    return post;
  });
}

export async function updatePost(
  actorUserId: string,
  circleId: string,
  postId: string,
  input: unknown
): Promise<PostItem> {
  await requireEnabledCapability(actorUserId, circleId, 'discussions');

  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid post update.');
  }

  return withRlsTransaction(actorUserId, async (tx) => {
    const postRes = await tx.query<PostItem>(
      `SELECT * FROM public.posts WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [postId, circleId]
    );
    const existing = postRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Post not found in this Circle.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];

    if (
      !canModifyUserContent(existing.author_id, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You can only edit your own posts unless you are a moderator.');
    }

    const updated = await tx.query<PostItem>(
      `UPDATE public.posts
       SET title = $1,
           body = $2,
           is_pinned = $3,
           updated_at = NOW()
       WHERE id = $4 AND circle_id = $5
       RETURNING *;`,
      [
        parsed.data.title ?? existing.title,
        parsed.data.body ?? existing.body,
        parsed.data.isPinned !== undefined ? parsed.data.isPinned : existing.is_pinned,
        postId,
        circleId,
      ]
    );

    if (!updated.rows[0]) {
      throw new ForbiddenError('Unable to update post.');
    }

    return updated.rows[0];
  });
}

export async function deletePost(
  actorUserId: string,
  circleId: string,
  postId: string
): Promise<void> {
  await withRlsTransaction(actorUserId, async (tx) => {
    const postRes = await tx.query<PostItem>(
      `SELECT * FROM public.posts WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [postId, circleId]
    );
    const existing = postRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Post not found in this Circle.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];

    if (
      !canModifyUserContent(existing.author_id, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to delete this post.');
    }

    await tx.query(
      `UPDATE public.posts
       SET status = 'removed', updated_at = NOW()
       WHERE id = $1 AND circle_id = $2;`,
      [postId, circleId]
    );
  });
}

export async function createComment(actorUserId: string, input: unknown): Promise<CommentItem> {
  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid comment.');
  }

  const { circleId, postId, body } = parsed.data;
  await requireEnabledCapability(actorUserId, circleId, 'discussions');

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ slug: string; name: string; visibility: CircleVisibility }>(
      `SELECT slug, name, visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];

    assertCirclePermission(
      'discussions.comment',
      circle.visibility,
      {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      },
      'Only active Circle members can comment on posts.'
    );

    const postRes = await tx.query<{ id: string; circle_id: string; author_id: string; title: string }>(
      `SELECT id, circle_id, author_id, title FROM public.posts
       WHERE id = $1 AND circle_id = $2 AND status = 'published' LIMIT 1;`,
      [postId, circleId]
    );
    const post = postRes.rows[0];
    if (!post) {
      throw new NotFoundError('Target post not found in this Circle.');
    }

    const commentId = crypto.randomUUID();
    const inserted = await tx.query<CommentItem>(
      `INSERT INTO public.comments (id, post_id, circle_id, author_id, body, status)
       VALUES ($1, $2, $3, $4, $5, 'published')
       RETURNING *;`,
      [commentId, postId, circleId, actorUserId, body]
    );

    return { comment: inserted.rows[0], post, circle };
  });

  if (outcome.post.author_id !== actorUserId) {
    await createNotification({
      recipientId: outcome.post.author_id,
      actorId: actorUserId,
      circleId,
      eventType: 'new_comment',
      title: `New reply on "${outcome.post.title}"`,
      body: body.slice(0, 160),
      linkUrl: `/circles/${outcome.circle.slug}/discussions/${postId}`,
      idempotencyKey: `comment-${outcome.comment.id}`,
    });
  }

  return outcome.comment;
}

export async function toggleReaction(
  actorUserId: string,
  circleId: string,
  postId: string,
  reactionType: 'like' | 'helpful' | 'celebrate' | 'insightful' = 'like'
): Promise<{ active: boolean; reactionCount: number }> {
  await requireEnabledCapability(actorUserId, circleId, 'discussions');

  return withRlsTransaction(actorUserId, async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM public.reactions
       WHERE post_id = $1 AND circle_id = $2 AND user_id = $3 AND reaction_type = $4 LIMIT 1;`,
      [postId, circleId, actorUserId, reactionType]
    );

    let active = false;
    if (existing.rows[0]) {
      await tx.query(`DELETE FROM public.reactions WHERE id = $1;`, [existing.rows[0].id]);
      active = false;
    } else {
      await tx.query(
        `INSERT INTO public.reactions (id, circle_id, post_id, user_id, reaction_type)
         VALUES ($1, $2, $3, $4, $5);`,
        [crypto.randomUUID(), circleId, postId, actorUserId, reactionType]
      );
      active = true;
    }

    const countRes = await tx.query<{ reaction_count: number }>(
      `SELECT reaction_count FROM public.posts WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [postId, circleId]
    );

    return {
      active,
      reactionCount: countRes.rows[0]?.reaction_count ?? 0,
    };
  });
}

export async function saveItem(
  actorUserId: string,
  circleId: string,
  postId: string
): Promise<{ saved: boolean }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM public.saved_items
       WHERE user_id = $1 AND post_id = $2 AND circle_id = $3 LIMIT 1;`,
      [actorUserId, postId, circleId]
    );

    if (existing.rows[0]) {
      await tx.query(`DELETE FROM public.saved_items WHERE id = $1;`, [existing.rows[0].id]);
      return { saved: false };
    } else {
      await tx.query(
        `INSERT INTO public.saved_items (id, user_id, circle_id, post_id)
         VALUES ($1, $2, $3, $4);`,
        [crypto.randomUUID(), actorUserId, circleId, postId]
      );
      return { saved: true };
    }
  });
}
