'use client';

import React, { useState } from 'react';
import { BookOpen, Bookmark, ExternalLink, Plus } from 'lucide-react';
import { LearningResourceItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export function ResourcesBoard({
  circleId,
  initialResources,
  isMember,
}: {
  circleId: string;
  initialResources: LearningResourceItem[];
  isMember: boolean;
}) {
  const [resources, setResources] = useState<LearningResourceItem[]>(initialResources);
  const [showCreate, setShowCreate] = useState(false);
  const [capabilityKey, setCapabilityKey] = useState<
    'learning_resources' | 'shared_resources' | 'media_publishing'
  >('learning_resources');
  const [category, setCategory] = useState('guide');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState<
    'beginner' | 'intermediate' | 'advanced' | ''
  >('intermediate');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateResource(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityKey,
          category,
          title,
          summary,
          contentBody,
          externalUrl: externalUrl || null,
          difficultyLevel: difficultyLevel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish resource.');
      setResources((prev) => [data.resource, ...prev]);
      setTitle('');
      setSummary('');
      setContentBody('');
      setExternalUrl('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create resource.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBookmark(resourceId: string) {
    try {
      const res = await fetch(`/api/circles/${circleId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_bookmark',
          resourceId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResources((prev) =>
          prev.map((r) =>
            r.id === resourceId ? { ...r, viewer_has_bookmarked: data.bookmarked } : r
          )
        );
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Knowledge & Learning Resources</h2>
            <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-forest-800 border border-forest-200/60">
              {resources.length} GUIDES
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Study guides, reading materials, reference documentation, and bookmarks.
          </p>
        </div>
        {isMember && (
          <Button
            size="sm"
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showCreate ? 'Cancel' : 'Publish Resource'}</span>
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateResource}
          className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-premium space-y-4"
        >
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Publish New Resource
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Module Type
              </label>
              <select
                value={capabilityKey}
                onChange={(e) =>
                  setCapabilityKey(
                    e.target.value as
                      | 'learning_resources'
                      | 'shared_resources'
                      | 'media_publishing'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              >
                <option value="learning_resources">Learning & Guide</option>
                <option value="shared_resources">Shared Document / Asset</option>
                <option value="media_publishing">Media Publication</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Category
              </label>
              <input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. guide, cheatsheet, paper..."
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Difficulty
              </label>
              <select
                value={difficultyLevel}
                onChange={(e) =>
                  setDifficultyLevel(
                    e.target.value as 'beginner' | 'intermediate' | 'advanced' | ''
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              >
                <option value="">General</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Title *
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Consensus Algorithms Guide"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Summary
            </label>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief overview of key learnings..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Content Body
            </label>
            <textarea
              rows={4}
              value={contentBody}
              onChange={(e) => setContentBody(e.target.value)}
              placeholder="Full content, notes, instructions..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              External Reference URL (Optional)
            </label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://example.org/spec.pdf"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Publishing...' : 'Publish Resource'}
            </Button>
          </div>
        </form>
      )}

      {resources.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <BookOpen className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">No Resources Published</h3>
          <p className="mt-1 text-xs text-stone-500">
            Share learning modules, reference links, or newsletters with your community.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {resources.map((res) => (
            <div
              key={res.id}
              className="group rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-forest-800 border border-forest-200/60">
                      {res.category}
                    </span>
                    {res.difficulty_level && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600 border border-stone-200/60 uppercase">
                        {res.difficulty_level}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                    {res.title}
                  </h3>
                  {res.summary && (
                    <p className="mt-1 text-xs sm:text-sm text-stone-500 font-normal">
                      {res.summary}
                    </p>
                  )}
                </div>

                {isMember && (
                  <Button
                    size="xs"
                    variant={res.viewer_has_bookmarked ? 'secondary' : 'outline'}
                    onClick={() => handleBookmark(res.id)}
                  >
                    <Bookmark className="h-3 w-3" />
                    <span>{res.viewer_has_bookmarked ? 'Saved' : 'Bookmark'}</span>
                  </Button>
                )}
              </div>

              {res.content_body && (
                <div className="text-xs sm:text-sm text-stone-700 whitespace-pre-line bg-stone-50/50 rounded-xl p-3.5 border border-stone-100">
                  {res.content_body}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-400">
                <span>By {res.author?.display_name || 'Member'}</span>
                {res.external_url && (
                  <a
                    href={res.external_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-black hover:underline"
                  >
                    <span>External Resource</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
