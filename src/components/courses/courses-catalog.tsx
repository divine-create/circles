'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Plus,
  Play,
  Clock,
  BookOpen,
  Search,
  Trophy,
  Lock,
  Shield,
  X,
} from 'lucide-react';
import { CourseItem, LeaderboardEntry, MemberXpSummary } from '@/types/domain';
import { Button } from '@/components/ui/button';

export function CoursesCatalog({
  circleId,
  circleSlug,
  initialCourses,
  isMember,
  isStaff,
}: {
  circleId: string;
  circleSlug: string;
  initialCourses: CourseItem[];
  isMember: boolean;
  isStaff: boolean;
}) {
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

  // Gamification state
  const [xpSummary, setXpSummary] = useState<MemberXpSummary | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'all_levels'
  >('all_levels');
  const [durationHours, setDurationHours] = useState('2.5');
  const [accessRule, setAccessRule] = useState<
    'open' | 'members_only' | 'min_level' | 'staff_only'
  >('open');
  const [minLevelRequired, setMinLevelRequired] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMember) return;
    async function loadXp() {
      try {
        const res = await fetch(`/api/circles/${circleId}/courses?mode=xp_summary`);
        const data = await res.json();
        if (res.ok && data.summary) {
          setXpSummary(data.summary);
        }
      } catch {
        // silent fail
      }
    }
    loadXp();
  }, [circleId, isMember]);

  async function fetchLeaderboard() {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses?mode=leaderboard`);
      const data = await res.json();
      if (res.ok && data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    } catch {
      // silent fail
    } finally {
      setLoadingLeaderboard(false);
    }
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      );
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          description,
          difficultyLevel: difficulty,
          estimatedDurationHours: parseFloat(durationHours) || 0,
          accessRule,
          minLevelRequired: accessRule === 'min_level' ? Number(minLevelRequired) : 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create course.');

      setCourses((prev) => [data.course, ...prev]);
      setTitle('');
      setSlug('');
      setDescription('');
      setAccessRule('open');
      setMinLevelRequired(2);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create course.');
    } finally {
      setLoading(false);
    }
  }

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchesDiff =
      difficultyFilter === 'all' || c.difficulty_level === difficultyFilter;
    return matchesSearch && matchesDiff;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">Courses & Curriculum</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-900 border border-stone-200">
              {courses.length} {courses.length === 1 ? 'COURSE' : 'COURSES'}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Step-by-step video courses, curriculum modules, and verified student progress tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {xpSummary && (
            <div className="flex items-center gap-3 rounded-xl border border-stone-200/90 bg-stone-50/80 px-3 py-1.5 shadow-2xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white font-bold text-xs">
                L{xpSummary.current_level}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900">
                  <span>Level {xpSummary.current_level}</span>
                  <span className="text-[10px] text-stone-500 font-mono">({xpSummary.total_xp} XP)</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full bg-black transition-all duration-300"
                      style={{ width: `${xpSummary.level_progress_percentage}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-stone-400">
                    {xpSummary.level_progress_percentage}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLeaderboard(true);
                  fetchLeaderboard();
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                title="View Community Leaderboard"
              >
                <Trophy className="h-3 w-3 text-stone-500" />
                <span>Ranks</span>
              </button>
            </div>
          )}

          <Link
            href={`/circles/${circleSlug}/resources`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5 text-stone-500" />
            Guides & Docs
          </Link>

          {(isStaff || isMember) && (
            <Button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Course
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setDifficultyFilter(level)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                difficultyFilter === level
                  ? 'bg-black text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {level === 'all' ? 'All Levels' : level}
            </button>
          ))}
        </div>
      </div>

      {/* Course Cards Grid */}
      {filteredCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-12 text-center">
          <GraduationCap className="mx-auto h-9 w-9 text-stone-400" />
          <h3 className="mt-3 text-sm font-semibold text-stone-900">No courses found</h3>
          <p className="mt-1 text-xs text-stone-500">
            {search
              ? 'Try modifying your search or filter criteria.'
              : 'Start your academy by publishing your first structured course.'}
          </p>
          {(isStaff || isMember) && (
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 bg-black text-white text-xs px-3 py-1.5 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Course
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const hasStarted = (course.completed_lessons_count ?? 0) > 0;
            const progress = course.progress_percentage ?? 0;
            const totalLessons = course.total_lessons_count ?? 0;
            const isLevelLocked =
              course.access_rule === 'min_level' &&
              !isStaff &&
              Boolean(
                xpSummary &&
                  xpSummary.current_level < (course.min_level_required || 1)
              );

            return (
              <div
                key={course.id}
                className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-stone-400/80 hover:shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-stone-700 border border-stone-200/60">
                        {course.difficulty_level?.replace('_', ' ') || 'All Levels'}
                      </span>
                      {course.access_rule === 'min_level' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-700 border border-stone-200/60">
                          <Lock className="h-2.5 w-2.5" />
                          Lvl {course.min_level_required}+
                        </span>
                      )}
                      {course.access_rule === 'staff_only' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-800 border border-amber-200">
                          <Shield className="h-2.5 w-2.5" />
                          Staff
                        </span>
                      )}
                    </div>
                    {course.estimated_duration_hours > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-stone-500">
                        <Clock className="h-3 w-3 text-stone-400" />
                        {course.estimated_duration_hours}h
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-base font-bold text-stone-900 group-hover:text-black line-clamp-1">
                    {course.title}
                  </h3>

                  <p className="mt-1.5 text-xs text-stone-500 line-clamp-2 leading-relaxed">
                    {course.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-5 border-t border-stone-100 pt-4">
                  {/* Progress bar if student has progress */}
                  {hasStarted ? (
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center justify-between text-[11px] font-medium">
                        <span className="text-stone-500">
                          {course.completed_lessons_count} of {totalLessons} lessons completed
                        </span>
                        <span className="font-mono text-stone-900 font-bold">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full bg-black transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-3">
                      <BookOpen className="h-3.5 w-3.5 text-stone-400" />
                      <span>{totalLessons} lessons in curriculum</span>
                    </div>
                  )}

                  {isLevelLocked ? (
                    <Link
                      href={`/circles/${circleSlug}/courses/${course.id}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                    >
                      <Lock className="h-3.5 w-3.5 text-stone-400" />
                      <span>Locked (Requires Level {course.min_level_required})</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/circles/${circleSlug}/courses/${course.id}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-black transition-colors"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      {hasStarted ? 'Continue Learning' : 'Start Course'}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Course Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Create New Course</h3>
            <p className="mt-1 text-xs text-stone-500">
              Set up the course title, slug, and overview. You can add video lessons and modules right after.
            </p>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full-Stack Web Development Masterclass"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">URL Slug</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. web-dev-masterclass"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 font-mono focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(
                        e.target.value as
                          | 'all_levels'
                          | 'beginner'
                          | 'intermediate'
                          | 'advanced'
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  >
                    <option value="all_levels">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Est. Duration (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Access Gating</label>
                  <select
                    value={accessRule}
                    onChange={(e) =>
                      setAccessRule(
                        e.target.value as 'open' | 'members_only' | 'min_level' | 'staff_only'
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  >
                    <option value="open">Open (All Visitors)</option>
                    <option value="members_only">Members Only</option>
                    <option value="min_level">Minimum Community Level</option>
                    <option value="staff_only">Staff Only</option>
                  </select>
                </div>

                {accessRule === 'min_level' ? (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Required Level
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={minLevelRequired}
                      onChange={(e) => setMinLevelRequired(parseInt(e.target.value, 10) || 1)}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    />
                  </div>
                ) : (
                  <div className="flex items-center text-[11px] text-stone-400 pt-5">
                    No level requirement
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Overview / Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe what students will learn in this course..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-black text-white text-xs px-4"
                >
                  {loading ? 'Creating...' : 'Create Course'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-stone-900">Student Leaderboard</h3>
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-stone-500">
              Top students ranked by earned XP through lesson completions, assignments, and contributions.
            </p>

            <div className="mt-4 max-h-80 overflow-y-auto divide-y divide-stone-100">
              {loadingLeaderboard ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Loading rankings...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  No students on the leaderboard yet. Complete a lesson to earn XP!
                </div>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center justify-between py-2.5 px-1"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold font-mono text-stone-500">
                        {entry.rank === 1
                          ? '🥇'
                          : entry.rank === 2
                          ? '🥈'
                          : entry.rank === 3
                          ? '🥉'
                          : `#${entry.rank}`}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-stone-900">
                            {entry.display_name}
                          </span>
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[9px] font-mono font-bold text-stone-700 border border-stone-200">
                            Lvl {entry.current_level}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono">
                          @{entry.username}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-stone-900">
                        {entry.total_xp}
                      </span>
                      <span className="ml-1 text-[10px] text-stone-400">XP</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-stone-100 pt-3 text-right">
              <Button
                variant="outline"
                onClick={() => setShowLeaderboard(false)}
                className="rounded-lg text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
