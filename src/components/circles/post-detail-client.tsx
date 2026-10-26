'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Heart, MessageSquare, Send } from 'lucide-react';
import { Circle, CommentItem, PostItem } from '@/types/domain';

interface PostDetailClientProps {
  circle: Circle;
  initialPost: PostItem;
  initialComments: CommentItem[];
  currentUserId: string | null;
}

export function PostDetailClient({
  circle,
  initialPost,
  initialComments,
  currentUserId,
}: PostDetailClientProps) {
  const router = useRouter();
  const [post, setPost] = useState<PostItem>(initialPost);
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActiveMember = circle.current_user_membership_status === 'active';

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/posts/${post.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          body: commentBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not post comment.');
        return;
      }
      setCommentBody('');
      // Refresh post & comments
      const detailRes = await fetch(`/api/circles/${circle.id}/posts/${post.id}`);
      if (detailRes.ok) {
        const fresh = await detailRes.json();
        setPost(fresh.post);
        setComments(fresh.comments);
      }
      router.refresh();
    } catch {
      setError('Network error while posting comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleLike() {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    const res = await fetch(`/api/circles/${circle.id}/posts/${post.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'react', reactionType: 'like' }),
    });
    if (res.ok) {
      const data = await res.json();
      setPost((prev) => ({
        ...prev,
        viewer_has_liked: data.active,
        reaction_count: data.reactionCount,
      }));
    }
  }

  async function handleToggleSave() {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    const res = await fetch(`/api/circles/${circle.id}/posts/${post.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save' }),
    });
    if (res.ok) {
      const data = await res.json();
      setPost((prev) => ({ ...prev, viewer_has_saved: data.saved }));
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/circles/${circle.slug}/discussions`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-black"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Discussions</span>
      </Link>

      <article className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 text-xs text-stone-500">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 font-bold text-stone-900">
            {(post.author?.display_name || 'M').slice(0, 1).toUpperCase()}
          </span>
          <span className="font-semibold text-stone-900">{post.author?.display_name}</span>
          <span>@{post.author?.username}</span>
          <span>·</span>
          <span>{new Date(post.created_at).toLocaleString()}</span>
        </div>

        <h1 className="mt-4 text-2xl font-bold text-stone-900">{post.title}</h1>
        <div className="mt-4 whitespace-pre-line text-sm text-stone-800 leading-relaxed">
          {post.body}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-xs">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={!isActiveMember}
              className={`inline-flex items-center gap-1.5 font-medium ${
                post.viewer_has_liked ? 'text-stone-900 font-semibold' : 'text-stone-600'
              }`}
            >
              <Heart
                className={`h-4 w-4 ${post.viewer_has_liked ? 'fill-black text-stone-900' : ''}`}
              />
              <span>{post.reaction_count} likes</span>
            </button>
            <span className="inline-flex items-center gap-1.5 text-stone-600">
              <MessageSquare className="h-4 w-4" />
              <span>{comments.length} comments</span>
            </span>
          </div>

          {currentUserId && (
            <button
              type="button"
              onClick={handleToggleSave}
              className="inline-flex items-center gap-1 text-stone-600 hover:text-black"
            >
              <Bookmark
                className={`h-4 w-4 ${post.viewer_has_saved ? 'fill-black text-stone-900' : ''}`}
              />
              <span>{post.viewer_has_saved ? 'Saved' : 'Save Post'}</span>
            </button>
          )}
        </div>
      </article>

      {/* Comments Section */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-stone-900">
          Comments ({comments.length})
        </h2>

        {isActiveMember ? (
          <form onSubmit={handleAddComment} className="space-y-3">
            {error && (
              <p className="text-xs font-medium text-red-700">{error}</p>
            )}
            <textarea
              rows={3}
              required
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a thoughtful reply..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{submitting ? 'Posting...' : 'Post Comment'}</span>
              </button>
            </div>
          </form>
        ) : (
          <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
            Join this Circle as an active member to reply to this thread.
          </p>
        )}

        <div className="divide-y divide-stone-100">
          {comments.map((comment) => (
            <div key={comment.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="font-semibold text-stone-900">
                  {comment.author?.display_name ?? 'Member'}
                </span>
                <span>@{comment.author?.username ?? 'member'}</span>
                <span>·</span>
                <span>{new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-line text-sm text-stone-800">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
