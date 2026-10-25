'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bookmark,
  Flag,
  Heart,
  MessageSquare,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import { Circle, CircleSpace, PostItem } from '@/types/domain';
import { DynamicIcon } from '@/components/ui/icon-map';

interface DiscussionsClientProps {
  circle: Circle;
  spaces: CircleSpace[];
  initialPosts: PostItem[];
  selectedSpaceId: string | null;
  currentUserId: string | null;
}

export function DiscussionsClient({
  circle,
  spaces,
  initialPosts,
  selectedSpaceId,
  currentUserId,
}: DiscussionsClientProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [spaceId, setSpaceId] = useState<string>(selectedSpaceId || spaces[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<'spam' | 'harassment' | 'misinformation' | 'rule_violation' | 'other'>('rule_violation');
  const [reportDetails, setReportDetails] = useState('');
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [savedFilterOnly, setSavedFilterOnly] = useState(false);

  const visiblePosts = savedFilterOnly ? posts.filter((p) => p.viewer_has_saved) : posts;

  const isActiveMember = circle.current_user_membership_status === 'active';
  const canModerate =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator';

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/circles/${circle.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          spaceId: spaceId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to publish post.');
        return;
      }
      setTitle('');
      setBody('');
      setShowComposer(false);
      router.refresh();
      // Fetch fresh list
      const listRes = await fetch(
        `/api/circles/${circle.id}/posts${selectedSpaceId ? `?spaceId=${selectedSpaceId}` : ''}`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        setPosts(listData.posts || []);
      }
    } catch {
      setError('Network error while publishing post.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleLike(postId: string) {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    const res = await fetch(`/api/circles/${circle.id}/posts/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'react', reactionType: 'like' }),
    });
    if (res.ok) {
      const data = await res.json();
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, viewer_has_liked: data.active, reaction_count: data.reactionCount }
            : p
        )
      );
    }
  }

  async function handleToggleSave(postId: string) {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    const res = await fetch(`/api/circles/${circle.id}/posts/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save' }),
    });
    if (res.ok) {
      const data = await res.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, viewer_has_saved: data.saved } : p))
      );
    }
  }

  async function handleDeletePost(postId: string) {
    if (!confirm('Remove this post from the discussion feed?')) return;
    const res = await fetch(`/api/circles/${circle.id}/posts/${postId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      router.refresh();
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportingPostId) return;
    const res = await fetch('/api/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circleId: circle.id,
        targetType: 'post',
        targetPostId: reportingPostId,
        reason: reportReason,
        details: reportDetails,
      }),
    });
    if (res.ok) {
      setReportingPostId(null);
      setReportDetails('');
      setReportFeedback('Report submitted to Circle moderators.');
      setTimeout(() => setReportFeedback(null), 4000);
    }
  }

  return (
    <div className="space-y-6">
      {/* Space Filter & New Post Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/circles/${circle.slug}/discussions`}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              !selectedSpaceId
                ? 'bg-forest-700 text-white'
                : 'bg-sand-100 text-stone-700 hover:bg-sand-200'
            }`}
          >
            All Spaces
          </Link>
          {spaces.map((sp) => (
            <Link
              key={sp.id}
              href={`/circles/${circle.slug}/discussions?spaceId=${sp.id}`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedSpaceId === sp.id
                  ? 'bg-forest-700 text-white'
                  : 'bg-sand-100 text-stone-700 hover:bg-sand-200'
              }`}
            >
              <DynamicIcon name={sp.icon} className="h-3 w-3" />
              <span>{sp.name}</span>
            </Link>
          ))}
          {currentUserId && (
            <button
              type="button"
              onClick={() => setSavedFilterOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                savedFilterOnly
                  ? 'bg-forest-800 text-white'
                  : 'bg-sand-100 text-stone-700 hover:bg-sand-200'
              }`}
            >
              <Bookmark className="h-3 w-3" />
              <span>Saved Only</span>
            </button>
          )}
        </div>

        {isActiveMember && (
          <button
            type="button"
            onClick={() => setShowComposer(!showComposer)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-forest-800 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Discussion Post</span>
          </button>
        )}
      </div>

      {reportFeedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
          {reportFeedback}
        </div>
      )}

      {/* Post Composer */}
      {showComposer && isActiveMember && (
        <form
          onSubmit={handleCreatePost}
          className="rounded-2xl border border-forest-600/30 bg-white p-6 shadow-md space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">Publish a Post to {circle.name}</h3>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {spaces.length > 0 && (
            <div>
              <label htmlFor="post-space" className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                Target Space
              </label>
              <select
                id="post-space"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="mt-1 w-full sm:w-64 rounded-xl border border-sand-300 bg-sand-50 px-3 py-2 text-xs text-stone-900"
              >
                <option value="">General Circle Feed</option>
                {spaces.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.posting_policy})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="post-title" className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
              Post Title *
            </label>
            <input
              id="post-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Write a clear, descriptive title..."
              className="mt-1 w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="post-body" className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
              Content *
            </label>
            <textarea
              id="post-body"
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share context, questions, or updates with the Circle..."
              className="mt-1 w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="rounded-xl border border-sand-300 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-sand-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-forest-700 px-5 py-2 text-xs font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </form>
      )}

      {/* Report Modal */}
      {reportingPostId && (
        <form
          onSubmit={handleSubmitReport}
          className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Report Content to Moderators
            </h4>
            <button
              type="button"
              onClick={() => setReportingPostId(null)}
              className="text-xs text-stone-600 hover:underline"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-stone-800"
            >
              <option value="rule_violation">Community Rule Violation</option>
              <option value="spam">Spam or Unsolicited Promotion</option>
              <option value="harassment">Harassment or Abuse</option>
              <option value="misinformation">Misinformation</option>
              <option value="other">Other Concern</option>
            </select>
            <input
              type="text"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Additional context for moderators..."
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-stone-800"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-amber-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
            >
              Submit Report
            </button>
          </div>
        </form>
      )}

      {/* Feed List */}
      {visiblePosts.length === 0 ? (
        <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center">
          <MessageSquare className="mx-auto h-9 w-9 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">
            {savedFilterOnly ? 'No saved posts in this view' : 'No discussions in this view yet'}
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            {savedFilterOnly
              ? 'Bookmark discussions to revisit them quickly here.'
              : isActiveMember
                ? 'Start the first discussion thread using the button above.'
                : 'Join this Circle to participate in discussions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => {
            const canDelete = currentUserId === post.author_id || canModerate;

            return (
              <article
                key={post.id}
                className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm transition-all hover:border-sand-300"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-forest-100 text-[11px] font-bold text-forest-800">
                      {(post.author?.display_name || 'M').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-semibold text-stone-800">
                      {post.author?.display_name ?? 'Circle Member'}
                    </span>
                    <span>@{post.author?.username ?? 'member'}</span>
                    <span>·</span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    {post.space && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sand-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                        <DynamicIcon name={post.space.icon} className="h-3 w-3 text-forest-700" />
                        {post.space.name}
                      </span>
                    )}
                    {post.is_pinned && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-800">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentUserId && (
                      <button
                        type="button"
                        onClick={() => setReportingPostId(post.id)}
                        className="rounded p-1 text-stone-400 hover:bg-sand-100 hover:text-amber-700"
                        title="Report post"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-700"
                        title="Remove post"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <Link
                  href={`/circles/${circle.slug}/discussions/${post.id}`}
                  className="group block mt-3"
                >
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-forest-700">
                    {post.title}
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm text-stone-700 leading-relaxed line-clamp-4">
                    {post.body}
                  </p>
                </Link>

                <div className="mt-5 flex items-center justify-between border-t border-sand-100 pt-3.5 text-xs text-stone-600">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      disabled={!isActiveMember}
                      className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                        post.viewer_has_liked
                          ? 'text-forest-700 font-semibold'
                          : 'text-stone-600 hover:text-stone-900'
                      } disabled:opacity-50`}
                    >
                      <Heart
                        className={`h-4 w-4 ${post.viewer_has_liked ? 'fill-forest-700 text-forest-700' : ''}`}
                      />
                      <span>{post.reaction_count}</span>
                    </button>

                    <Link
                      href={`/circles/${circle.slug}/discussions/${post.id}`}
                      className="inline-flex items-center gap-1.5 font-medium text-stone-600 hover:text-forest-700"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>
                        {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
                      </span>
                    </Link>
                  </div>

                  {currentUserId && (
                    <button
                      type="button"
                      onClick={() => handleToggleSave(post.id)}
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        post.viewer_has_saved ? 'text-forest-700 font-semibold' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <Bookmark
                        className={`h-3.5 w-3.5 ${post.viewer_has_saved ? 'fill-forest-700 text-forest-700' : ''}`}
                      />
                      <span>{post.viewer_has_saved ? 'Saved' : 'Save'}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
