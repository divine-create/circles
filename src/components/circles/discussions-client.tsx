'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bookmark,
  Flag,
  Heart,
  MessageSquare,
  Pin,
  Trash2,
  Send,
  X,
  Lock,
  Type,
  CornerDownRight,
  Globe,
  Settings,
} from 'lucide-react';
import { Circle, CircleSpace, PostItem, CommentItem } from '@/types/domain';
import { DynamicIcon } from '@/components/ui/icon-map';
import { Button } from '@/components/ui/button';

interface DiscussionsClientProps {
  circle: Circle;
  spaces: CircleSpace[];
  initialPosts: PostItem[];
  selectedSpaceId: string | null;
  currentUserId: string | null;
}

function formatDiscordTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
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
  const [messageText, setMessageText] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Thread Drawer State
  const [activeThreadPost, setActiveThreadPost] = useState<PostItem | null>(null);
  const [threadComments, setThreadComments] = useState<CommentItem[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadReplyText, setThreadReplyText] = useState('');
  const [submittingThreadReply, setSubmittingThreadReply] = useState(false);

  // Moderation / Reporting State
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<
    'spam' | 'harassment' | 'misinformation' | 'rule_violation' | 'other'
  >('rule_violation');
  const [reportDetails, setReportDetails] = useState('');
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  // Filters
  const [savedFilterOnly, setSavedFilterOnly] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const isActiveMember = circle.current_user_membership_status === 'active';
  const canModerate =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator';

  // Active space
  const activeSpace = useMemo(() => {
    if (!selectedSpaceId) return null;
    return spaces.find((s) => s.id === selectedSpaceId) || null;
  }, [spaces, selectedSpaceId]);

  // Chronological stream (oldest to newest, latest at bottom)
  const visiblePosts = useMemo(() => {
    const list = savedFilterOnly ? posts.filter((p) => p.viewer_has_saved) : posts;
    return [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [posts, savedFilterOnly]);

  // Sync posts when initialPosts changes
  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  // Auto-scroll to bottom on space change or when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedSpaceId, visiblePosts.length]);

  // Load thread comments when activeThreadPost changes
  useEffect(() => {
    if (!activeThreadPost) {
      setThreadComments([]);
      return;
    }

    let isMounted = true;
    setLoadingThread(true);

    fetch(`/api/circles/${circle.id}/posts/${activeThreadPost.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setThreadComments(data.comments || []);
          setTimeout(() => {
            threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingThread(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeThreadPost, circle.id]);

  // Send message in the active space
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanBody = messageText.trim();
    if (!cleanBody || submitting) return;

    setError(null);
    setSubmitting(true);

    // Auto-generate title if not manually provided
    const cleanTitle =
      postTitle.trim() ||
      cleanBody.slice(0, 60).split('\n')[0] ||
      'Discussion Message';

    // Optimistic post insertion
    const optimisticId = `opt-${Date.now()}`;
    const optimisticPost: PostItem = {
      id: optimisticId,
      circle_id: circle.id,
      space_id: selectedSpaceId,
      author_id: currentUserId || 'me',
      title: cleanTitle,
      body: cleanBody,
      status: 'published',
      is_pinned: false,
      comment_count: 0,
      reaction_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: currentUserId || 'me',
        username: 'you',
        display_name: 'You',
        avatar_url: null,
      },
      space: activeSpace
        ? {
            id: activeSpace.id,
            name: activeSpace.name,
            slug: activeSpace.slug,
            icon: activeSpace.icon,
          }
        : null,
      viewer_has_liked: false,
      viewer_has_saved: false,
    };

    setPosts((prev) => [...prev, optimisticPost]);
    setMessageText('');
    setPostTitle('');
    setShowTitleInput(false);

    try {
      const res = await fetch(`/api/circles/${circle.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          body: cleanBody,
          spaceId: selectedSpaceId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message.');
      }

      // Replace optimistic post with real server item
      setPosts((prev) =>
        prev.map((p) => (p.id === optimisticId ? data.post || p : p))
      );
    } catch (err) {
      // Revert optimistic insert
      setPosts((prev) => prev.filter((p) => p.id !== optimisticId));
      setError(err instanceof Error ? err.message : 'Error sending message.');
      setMessageText(cleanBody);
    } finally {
      setSubmitting(false);
    }
  }

  // Send reply in the active thread drawer
  async function handleSendThreadReply(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeThreadPost) return;

    const cleanReply = threadReplyText.trim();
    if (!cleanReply || submittingThreadReply) return;

    setSubmittingThreadReply(true);

    const optimisticComment: CommentItem = {
      id: `opt-comment-${Date.now()}`,
      post_id: activeThreadPost.id,
      circle_id: circle.id,
      author_id: currentUserId || 'me',
      body: cleanReply,
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: currentUserId || 'me',
        username: 'you',
        display_name: 'You',
        avatar_url: null,
      },
    };

    setThreadComments((prev) => [...prev, optimisticComment]);
    setThreadReplyText('');

    // Increment comment count in parent post
    setPosts((prev) =>
      prev.map((p) =>
        p.id === activeThreadPost.id
          ? { ...p, comment_count: (p.comment_count || 0) + 1 }
          : p
      )
    );

    try {
      const res = await fetch(`/api/circles/${circle.id}/posts/${activeThreadPost.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          body: cleanReply,
        }),
      });

      const data = await res.json();
      if (res.ok && data.comment) {
        setThreadComments((prev) =>
          prev.map((c) => (c.id === optimisticComment.id ? data.comment : c))
        );
      }
    } catch {
      // Revert if error
      setThreadComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setThreadReplyText(cleanReply);
    } finally {
      setSubmittingThreadReply(false);
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }

  // Toggle Like
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

  // Toggle Bookmark
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

  // Delete message
  async function handleDeletePost(postId: string) {
    if (!confirm('Delete this message from the space?')) return;
    const res = await fetch(`/api/circles/${circle.id}/posts/${postId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (activeThreadPost?.id === postId) {
        setActiveThreadPost(null);
      }
    }
  }

  // Submit Report
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
      setReportFeedback('Report submitted to circle moderators.');
      setTimeout(() => setReportFeedback(null), 4000);
    }
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-140px)] min-h-[580px] max-h-[880px] rounded-3xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
      {/* Toast Feedback */}
      {reportFeedback && (
        <div className="absolute top-3 right-4 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-900 shadow-lg animate-in fade-in">
          {reportFeedback}
        </div>
      )}

      {/* Main Container: Spaces Sidebar + Message Stream + Thread Drawer */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ======================================================== */}
        {/* 1. SPACES SIDEBAR (Left Column)                         */}
        {/* ======================================================== */}
        <aside className="hidden md:flex w-64 flex-col border-r border-stone-100 bg-stone-50/70 p-3 select-none">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1.5 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Spaces
            </span>
            <span className="rounded-full bg-stone-200/70 px-1.5 py-0.2 text-[10px] font-mono font-bold text-stone-700">
              {spaces.length}
            </span>
          </div>

          {/* Spaces Navigation */}
          <div className="flex-1 space-y-1 overflow-y-auto">
            {/* All Discussions Option */}
            <Link
              href={`/circles/${circle.slug}/discussions`}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs transition-all ${
                !selectedSpaceId && !savedFilterOnly
                  ? 'bg-stone-900 text-white font-semibold shadow-xs'
                  : 'text-stone-700 hover:bg-stone-200/60 hover:text-stone-900'
              }`}
            >
              <Globe className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">All Discussions</span>
            </Link>

            {/* Space Items */}
            {spaces.map((sp) => {
              const isActive = selectedSpaceId === sp.id && !savedFilterOnly;
              return (
                <Link
                  key={sp.id}
                  href={`/circles/${circle.slug}/discussions?spaceId=${sp.id}`}
                  className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs transition-all ${
                    isActive
                      ? 'bg-stone-900 text-white font-semibold shadow-xs'
                      : 'text-stone-700 hover:bg-stone-200/60 hover:text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {sp.icon ? (
                      <DynamicIcon name={sp.icon} className="h-3.5 w-3.5 opacity-70 shrink-0" />
                    ) : (
                      <span className="opacity-60 text-stone-500 group-hover:text-stone-700 font-bold">
                        #
                      </span>
                    )}
                    <span className="truncate">{sp.name}</span>
                  </div>

                  {sp.posting_policy !== 'members' && (
                    <span
                      title={`Posting restricted to ${sp.posting_policy}`}
                      className="opacity-50 group-hover:opacity-100"
                    >
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Saved Items Filter */}
            {currentUserId && (
              <div className="pt-2 border-t border-stone-200/60 mt-2">
                <button
                  type="button"
                  onClick={() => setSavedFilterOnly((v) => !v)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs transition-all ${
                    savedFilterOnly
                      ? 'bg-stone-900 text-white font-semibold shadow-xs'
                      : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
                  }`}
                >
                  <Bookmark className="h-4 w-4 shrink-0 opacity-70" />
                  <span>Saved Messages</span>
                </button>
              </div>
            )}
          </div>

          {/* Manage Spaces shortcut for staff */}
          {canModerate && (
            <div className="pt-2 border-t border-stone-200/60">
              <Link
                href={`/circles/${circle.slug}/studio?tab=spaces`}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Manage Spaces</span>
              </Link>
            </div>
          )}
        </aside>

        {/* ======================================================== */}
        {/* 2. CHAT STREAM & COMPOSER (Center Column)               */}
        {/* ======================================================== */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Top Space Header */}
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-6 bg-white z-10 shrink-0">
            <div className="flex items-center gap-2.5 truncate">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-800 font-mono font-bold text-sm">
                #
              </span>
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-stone-900 truncate">
                    {activeSpace ? activeSpace.name : 'all-discussions'}
                  </h2>
                  {activeSpace && activeSpace.posting_policy !== 'members' && (
                    <span className="rounded bg-stone-100 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase text-stone-600">
                      {activeSpace.posting_policy} Only
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-400 truncate max-w-sm sm:max-w-md">
                  {activeSpace?.description || 'Open discussions across all Circle spaces'}
                </p>
              </div>
            </div>

            {/* Mobile Spaces Dropdown */}
            <div className="md:hidden flex items-center gap-2">
              <select
                value={selectedSpaceId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  router.push(
                    val
                      ? `/circles/${circle.slug}/discussions?spaceId=${val}`
                      : `/circles/${circle.slug}/discussions`
                  );
                }}
                className="rounded-xl border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-800 font-medium"
              >
                <option value=""># All Spaces</option>
                {spaces.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    # {sp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stream Messages Container */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-3">
            {visiblePosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-stone-400 space-y-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-stone-800">
                  {savedFilterOnly ? 'No saved messages' : 'No messages in this space yet'}
                </h3>
                <p className="text-xs text-stone-500 max-w-xs">
                  {savedFilterOnly
                    ? 'Bookmark messages to find them here quickly.'
                    : isActiveMember
                    ? 'Be the first to say hello and start the conversation below!'
                    : 'Join this Circle to participate in discussions.'}
                </p>
              </div>
            ) : (
              visiblePosts.map((post, idx) => {
                const prevPost = idx > 0 ? visiblePosts[idx - 1] : null;

                // Date separator logic
                const currentDate = new Date(post.created_at).toDateString();
                const prevDate = prevPost
                  ? new Date(prevPost.created_at).toDateString()
                  : null;
                const showDateSeparator = currentDate !== prevDate;

                // Chaining logic: same author, within 5 minutes, same day
                const isSameAuthor = prevPost && prevPost.author_id === post.author_id;
                const isWithin5Min =
                  prevPost &&
                  new Date(post.created_at).getTime() -
                    new Date(prevPost.created_at).getTime() <
                    300000;
                const isChained = isSameAuthor && isWithin5Min && !showDateSeparator;

                const canDelete =
                  currentUserId === post.author_id || canModerate;
                const isStaffAuthor =
                  post.author_id === circle.owner_id;

                return (
                  <React.Fragment key={post.id}>
                    {/* Date Separator Pill */}
                    {showDateSeparator && (
                      <div className="relative my-4 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-stone-100" />
                        </div>
                        <span className="relative rounded-full border border-stone-200/80 bg-white px-3 py-0.5 text-[10px] font-bold text-stone-500 shadow-2xs">
                          {formatDateSeparator(post.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Discord-style Message Row */}
                    <div
                      className={`group relative flex items-start gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-stone-50/80 ${
                        isChained ? 'pt-0.5' : 'pt-2'
                      }`}
                    >
                      {/* Left: Avatar or Gutter Time */}
                      {!isChained ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-800 font-bold text-xs border border-stone-200/70 select-none overflow-hidden">
                          {post.author?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.author.avatar_url}
                              alt={post.author.display_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (post.author?.display_name || 'M')
                              .slice(0, 1)
                              .toUpperCase()
                          )}
                        </div>
                      ) : (
                        <div className="w-9 shrink-0 text-right pr-1 select-none">
                          <span className="hidden group-hover:inline text-[9px] font-mono text-stone-400">
                            {new Date(post.created_at).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}

                      {/* Right: Message Content */}
                      <div className="flex-1 min-w-0">
                        {!isChained && (
                          <div className="flex items-center gap-2 flex-wrap leading-tight">
                            <span className="text-xs font-bold text-stone-900">
                              {post.author?.display_name || 'Circle Member'}
                            </span>

                            {isStaffAuthor && (
                              <span className="rounded bg-emerald-100 text-emerald-900 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-mono font-bold">
                                Staff
                              </span>
                            )}

                            <span className="text-[11px] text-stone-400 font-mono">
                              @{post.author?.username || 'member'}
                            </span>

                            <span className="text-[11px] text-stone-400">
                              {formatDiscordTimestamp(post.created_at)}
                            </span>

                            {post.is_pinned && (
                              <span className="flex items-center gap-1 rounded bg-stone-900 px-1.5 py-0.2 text-[9px] font-mono font-bold text-white">
                                <Pin className="h-2.5 w-2.5" />
                                PINNED
                              </span>
                            )}

                            {!selectedSpaceId && post.space && (
                              <span className="rounded bg-stone-100 text-stone-600 px-1.5 py-0.2 text-[10px] font-mono">
                                #{post.space.name}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Title (rendered only if explicitly distinct from body) */}
                        {post.title &&
                          !post.body.startsWith(post.title) &&
                          post.title !== 'Discussion Message' && (
                            <h4 className="mt-1 text-xs font-bold text-stone-900">
                              {post.title}
                            </h4>
                          )}

                        {/* Body */}
                        <div className="mt-0.5 text-xs text-stone-800 whitespace-pre-wrap leading-relaxed select-text font-normal">
                          {post.body}
                        </div>

                        {/* Thread Replies Button */}
                        {(post.comment_count > 0 || activeThreadPost?.id === post.id) && (
                          <button
                            type="button"
                            onClick={() => setActiveThreadPost(post)}
                            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-stone-200/80 bg-stone-50 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-2xs"
                          >
                            <CornerDownRight className="h-3 w-3 text-stone-500" />
                            <span>
                              {post.comment_count}{' '}
                              {post.comment_count === 1 ? 'reply' : 'replies'}
                            </span>
                            <span className="text-stone-400">· View thread</span>
                          </button>
                        )}
                      </div>

                      {/* Floating Discord-Style Hover Action Bar */}
                      <div className="absolute right-3 -top-3 hidden group-hover:flex items-center rounded-xl border border-stone-200 bg-white shadow-sm p-0.5 gap-0.5 z-20">
                        {/* Like */}
                        <button
                          type="button"
                          onClick={() => handleToggleLike(post.id)}
                          title="Like"
                          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] ${
                            post.viewer_has_liked
                              ? 'text-red-600 bg-red-50'
                              : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                          }`}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 ${
                              post.viewer_has_liked ? 'fill-current' : ''
                            }`}
                          />
                          {post.reaction_count > 0 && (
                            <span className="font-mono text-[10px] font-bold">
                              {post.reaction_count}
                            </span>
                          )}
                        </button>

                        {/* Reply in Thread */}
                        <button
                          type="button"
                          onClick={() => setActiveThreadPost(post)}
                          title="Reply in Thread"
                          className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors flex items-center gap-1"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold">Reply</span>
                        </button>

                        {/* Bookmark */}
                        <button
                          type="button"
                          onClick={() => handleToggleSave(post.id)}
                          title={post.viewer_has_saved ? 'Remove Bookmark' : 'Bookmark'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            post.viewer_has_saved
                              ? 'text-stone-900 bg-stone-100'
                              : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                          }`}
                        >
                          <Bookmark
                            className={`h-3.5 w-3.5 ${
                              post.viewer_has_saved ? 'fill-current' : ''
                            }`}
                          />
                        </button>

                        {/* Delete */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            title="Delete Message"
                            className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Report */}
                        {currentUserId && currentUserId !== post.author_id && (
                          <button
                            type="button"
                            onClick={() => setReportingPostId(post.id)}
                            title="Report to Moderators"
                            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-amber-700 transition-colors"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Sticky Message Composer */}
          <div className="border-t border-stone-100 bg-white p-3 sm:p-4 shrink-0">
            {error && (
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {isActiveMember ? (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {/* Optional Title input for announcements */}
                {showTitleInput && (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="Title or Topic (optional)..."
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowTitleInput(false);
                        setPostTitle('');
                      }}
                      className="p-1 text-stone-400 hover:text-stone-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50/60 p-1.5 focus-within:border-stone-900 focus-within:bg-white transition-all shadow-2xs">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Message #${activeSpace ? activeSpace.name : 'all-discussions'}...`}
                    className="flex-1 max-h-32 min-h-[36px] resize-none bg-transparent px-3 py-2 text-xs text-stone-900 leading-relaxed placeholder:text-stone-400 focus:outline-hidden font-sans"
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-1 pr-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowTitleInput((v) => !v)}
                      title={showTitleInput ? 'Hide Title' : 'Add Formal Title / Topic'}
                      className={`p-1.5 rounded-lg transition-colors ${
                        showTitleInput
                          ? 'bg-stone-200 text-stone-900'
                          : 'text-stone-400 hover:bg-stone-100 hover:text-stone-700'
                      }`}
                    >
                      <Type className="h-4 w-4" />
                    </button>

                    <Button
                      type="submit"
                      disabled={!messageText.trim() || submitting}
                      className="h-8 w-8 rounded-xl p-0 bg-stone-900 text-white hover:bg-black disabled:opacity-30 transition-all shadow-xs"
                      aria-label="Send message"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1 text-[10px] text-stone-400">
                  <span>
                    Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline
                  </span>
                  <span>Markdown formatting supported</span>
                </div>
              </form>
            ) : (
              <div className="rounded-xl border border-dashed border-stone-200 p-3 text-center text-xs text-stone-500">
                Join this Circle to participate in #{activeSpace ? activeSpace.name : 'discussions'}.
              </div>
            )}
          </div>
        </main>

        {/* ======================================================== */}
        {/* 3. DISCORD THREAD DRAWER (Slide-over Right Column)       */}
        {/* ======================================================== */}
        {activeThreadPost && (
          <aside className="w-full sm:w-96 lg:w-[380px] flex flex-col border-l border-stone-200/90 bg-white z-30 shrink-0 animate-in slide-in-from-right-4 duration-150">
            {/* Thread Header */}
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 bg-stone-50/50">
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-4 w-4 text-stone-600 shrink-0" />
                <div className="truncate">
                  <h3 className="text-xs font-bold text-stone-900 truncate">Thread</h3>
                  <p className="text-[10px] text-stone-400 truncate">
                    Started by @{activeThreadPost.author?.username || 'member'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveThreadPost(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                aria-label="Close thread"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Thread Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Root Post Card */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-stone-800 text-[10px] font-bold">
                    {(activeThreadPost.author?.display_name || 'M').slice(0, 1)}
                  </span>
                  <span className="text-xs font-bold text-stone-900">
                    {activeThreadPost.author?.display_name}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {formatDiscordTimestamp(activeThreadPost.created_at)}
                  </span>
                </div>
                {activeThreadPost.title && (
                  <h4 className="text-xs font-bold text-stone-900">
                    {activeThreadPost.title}
                  </h4>
                )}
                <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
                  {activeThreadPost.body}
                </p>
              </div>

              {/* Replies Divider */}
              <div className="flex items-center gap-2 my-3 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                <div className="flex-1 border-t border-stone-100" />
                <span>
                  {threadComments.length}{' '}
                  {threadComments.length === 1 ? 'Reply' : 'Replies'}
                </span>
                <div className="flex-1 border-t border-stone-100" />
              </div>

              {/* Comments Stream */}
              {loadingThread ? (
                <div className="text-center py-6 text-xs text-stone-400">
                  Loading replies...
                </div>
              ) : threadComments.length === 0 ? (
                <div className="text-center py-6 text-xs text-stone-400">
                  No replies in this thread yet. Be the first to answer!
                </div>
              ) : (
                threadComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex items-start gap-2.5 rounded-xl p-2 hover:bg-stone-50/70 transition-colors"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-800 text-[10px] font-bold border border-stone-200">
                      {(comment.author?.display_name || 'M').slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 leading-tight">
                        <span className="text-xs font-bold text-stone-900">
                          {comment.author?.display_name || 'Member'}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {formatDiscordTimestamp(comment.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Bottom Thread Input */}
            <div className="border-t border-stone-100 bg-white p-3 shrink-0">
              {isActiveMember ? (
                <form onSubmit={handleSendThreadReply} className="space-y-1">
                  <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-1 focus-within:border-stone-900 focus-within:bg-white transition-all">
                    <input
                      type="text"
                      required
                      value={threadReplyText}
                      onChange={(e) => setThreadReplyText(e.target.value)}
                      placeholder={`Reply to thread...`}
                      className="flex-1 bg-transparent px-3 py-1.5 text-xs text-stone-900 focus:outline-hidden"
                    />
                    <Button
                      type="submit"
                      disabled={!threadReplyText.trim() || submittingThreadReply}
                      className="h-7 w-7 rounded-lg p-0 bg-stone-900 text-white hover:bg-black disabled:opacity-30 transition-all"
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-center text-[11px] text-stone-400">
                  Join Circle to reply in threads.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Moderation Report Modal */}
      {reportingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Report Message to Moderators
              </h4>
              <button
                type="button"
                onClick={() => setReportingPostId(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800"
                >
                  <option value="rule_violation">Community Rule Violation</option>
                  <option value="spam">Spam or Unsolicited Promotion</option>
                  <option value="harassment">Harassment or Abuse</option>
                  <option value="misinformation">Misinformation</option>
                  <option value="other">Other Concern</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700">Context</label>
                <input
                  type="text"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Additional context for moderators..."
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setReportingPostId(null)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 shadow-xs"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
