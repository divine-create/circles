'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Image as ImageIcon,
  Clock,
  Lock,
  Shield,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { CourseItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

interface CourseSettingsModalProps {
  circleId: string;
  course: CourseItem;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedCourse: CourseItem) => void;
}

export function CourseSettingsModal({
  circleId,
  course,
  isOpen,
  onClose,
  onSaved,
}: CourseSettingsModalProps) {
  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [description, setDescription] = useState(course.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url || '');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'all_levels'
  >(course.difficulty_level || 'all_levels');
  const [durationHours, setDurationHours] = useState(
    course.estimated_duration_hours ? String(course.estimated_duration_hours) : '2.5'
  );
  const [accessRule, setAccessRule] = useState<
    'open' | 'members_only' | 'min_level' | 'staff_only'
  >(course.access_rule || 'open');
  const [minLevelRequired, setMinLevelRequired] = useState(
    course.min_level_required ?? 2
  );
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    course.status || 'published'
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when course prop updates
  useEffect(() => {
    setTitle(course.title);
    setSlug(course.slug);
    setIsSlugManual(false);
    setDescription(course.description || '');
    setThumbnailUrl(course.thumbnail_url || '');
    setDifficulty(course.difficulty_level || 'all_levels');
    setDurationHours(
      course.estimated_duration_hours ? String(course.estimated_duration_hours) : '2.5'
    );
    setAccessRule(course.access_rule || 'open');
    setMinLevelRequired(course.min_level_required ?? 2);
    setStatus(course.status || 'published');
    setError(null);
  }, [course]);

  if (!isOpen) return null;

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isSlugManual) {
      const autoSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/g, '');
      setSlug(autoSlug);
    }
  };

  const handleSlugChange = (newSlug: string) => {
    setIsSlugManual(true);
    setSlug(
      newSlug
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+/g, '')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanSlug = slug.trim().replace(/-+$/g, '');

    if (!cleanTitle || cleanTitle.length < 3) {
      setError('Course title must be at least 3 characters long.');
      return;
    }

    if (!cleanSlug || cleanSlug.length < 2) {
      setError('Course slug must be at least 2 characters long.');
      return;
    }

    const parsedDuration = parseFloat(durationHours);
    if (isNaN(parsedDuration) || parsedDuration < 0) {
      setError('Please provide a valid estimated duration in hours.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: cleanTitle,
        slug: cleanSlug,
        description: description.trim(),
        thumbnailUrl: thumbnailUrl.trim() || null,
        difficultyLevel: difficulty,
        estimatedDurationHours: parsedDuration,
        accessRule,
        minLevelRequired: accessRule === 'min_level' ? Number(minLevelRequired) : 1,
        status,
      };

      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update course settings.');
      }

      onSaved(data.course);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-settings-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-800">
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <h3 id="course-settings-title" className="text-base font-bold text-stone-900">
                Edit Course Settings
              </h3>
              <p className="text-xs text-stone-500">
                Configure curriculum title, slug, thumbnail, access rules, and status.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-stone-800">
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Fullstack Web Architecture"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800">
                URL Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="fullstack-web-architecture"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs font-mono text-stone-900 focus:border-stone-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-stone-800">Overview Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will learners achieve in this curriculum? Include syllabus goals, target audience, and outcomes..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden resize-y"
            />
          </div>

          {/* Thumbnail Image URL */}
          <div>
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-stone-500" />
              <span>Cover Image / Thumbnail URL</span>
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://images.unsplash.com/... or direct image link"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
            />
            {thumbnailUrl && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-stone-400">Preview:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  className="h-10 w-16 object-cover rounded-lg border border-stone-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Difficulty & Estimated Hours & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-stone-800">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(
                    e.target.value as 'beginner' | 'intermediate' | 'advanced' | 'all_levels'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              >
                <option value="all_levels">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1">
                <Clock className="h-3 w-3 text-stone-500" />
                <span>Est. Hours</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="1000"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800">Publication Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'draft' | 'published' | 'archived')
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              >
                <option value="published">Published (Visible)</option>
                <option value="draft">Draft (Staff Only)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Access Rule & Gating */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-stone-600" />
              <span>Enrollment & Access Rules</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={accessRule}
                  onChange={(e) =>
                    setAccessRule(
                      e.target.value as 'open' | 'members_only' | 'min_level' | 'staff_only'
                    )
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                >
                  <option value="open">Open (Anyone in circle can view)</option>
                  <option value="members_only">Members Only (Requires circle membership)</option>
                  <option value="min_level">Level Gated (Requires minimum community XP level)</option>
                  <option value="staff_only">Staff Only (Private testing & review)</option>
                </select>
              </div>

              {accessRule === 'min_level' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-700 whitespace-nowrap">
                    Min Level:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={minLevelRequired}
                    onChange={(e) => setMinLevelRequired(parseInt(e.target.value, 10) || 1)}
                    className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-stone-500 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    XP Gated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-stone-900 px-5 text-xs font-semibold text-white hover:bg-black transition-colors shadow-xs"
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  Save Course Changes
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
