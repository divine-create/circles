'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Plus,
  Lock,
  CheckCircle2,
  ChevronRight,
  Award,
  AlertCircle,
  Play,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CourseItem, LearningPathItem } from '@/types/domain';

interface LearningPathsViewProps {
  circleId: string;
  circleSlug: string;
  isMember: boolean;
  isStaff: boolean;
  availableCourses: CourseItem[];
}

export function LearningPathsView({
  circleId,
  circleSlug,
  isMember,
  isStaff,
  availableCourses,
}: LearningPathsViewProps) {
  const [paths, setPaths] = useState<LearningPathItem[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<LearningPathItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states for creating a learning path
  const [showCreatePath, setShowCreatePath] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [certificateTitle, setCertificateTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal states for adding course to path
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [targetCourseId, setTargetCourseId] = useState('');
  const [prereqCourseId, setPrereqCourseId] = useState('');
  const [isAddingCourse, setIsAddingCourse] = useState(false);

  // Fetch all learning paths
  useEffect(() => {
    let isMounted = true;
    async function loadPaths() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/circles/${circleId}/courses?mode=learning_paths`);
        const data = await res.json();
        if (res.ok && isMounted) {
          const list: LearningPathItem[] = data.paths || [];
          setPaths(list);
          if (list.length > 0 && !selectedPathId) {
            setSelectedPathId(list[0].id);
          }
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load paths.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadPaths();
    return () => {
      isMounted = false;
    };
  }, [circleId, selectedPathId]);

  // Fetch detailed path with courses when selectedPathId changes
  useEffect(() => {
    if (!selectedPathId) return;
    let isMounted = true;
    async function loadPathDetail() {
      try {
        const res = await fetch(
          `/api/circles/${circleId}/courses?mode=learning_path&pathId=${selectedPathId}`
        );
        const data = await res.json();
        if (res.ok && isMounted && data.path) {
          setSelectedPath(data.path);
        }
      } catch {
        // silent fail
      }
    }
    loadPathDetail();
    return () => {
      isMounted = false;
    };
  }, [circleId, selectedPathId]);

  async function handleCreatePath(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    const cleanSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_learning_path',
          title: title.trim(),
          slug: cleanSlug,
          description: description.trim(),
          certificateTitle: certificateTitle.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create learning path.');

      setPaths((prev) => [data.path, ...prev]);
      setSelectedPathId(data.path.id);
      setTitle('');
      setSlug('');
      setIsSlugManual(false);
      setDescription('');
      setCertificateTitle('');
      setShowCreatePath(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create learning path.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleAddCourseToPath(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPathId || !targetCourseId) return;
    setIsAddingCourse(true);
    setError(null);

    try {
      const currentCount = selectedPath?.courses?.length || 0;
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_path_course',
          learningPathId: selectedPathId,
          courseId: targetCourseId,
          stepOrder: currentCount + 1,
          isRequired: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add course to program.');

      // Also add prerequisite if selected
      if (prereqCourseId && prereqCourseId !== targetCourseId) {
        await fetch(`/api/circles/${circleId}/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_prerequisite',
            courseId: targetCourseId,
            prerequisiteCourseId: prereqCourseId,
            minPassingScore: 70,
          }),
        });
      }

      // Reload path
      const detailRes = await fetch(
        `/api/circles/${circleId}/courses?mode=learning_path&pathId=${selectedPathId}`
      );
      const detailData = await detailRes.json();
      if (detailRes.ok && detailData.path) {
        setSelectedPath(detailData.path);
      }

      setTargetCourseId('');
      setPrereqCourseId('');
      setShowAddCourse(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add course to path.');
    } finally {
      setIsAddingCourse(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              Learning Paths & Programmes
            </h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-900 border border-stone-200">
              {paths.length} {paths.length === 1 ? 'PATH' : 'PATHS'}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Structured step-by-step tracks connecting beginner foundations to advanced capstone mastery.
          </p>
        </div>

        {(isStaff || isMember) && (
          <Button
            onClick={() => {
              setTitle('');
              setSlug('');
              setIsSlugManual(false);
              setShowCreatePath(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Learning Path
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-xs text-stone-400">
          Loading learning paths and programs...
        </div>
      ) : paths.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-12 text-center">
          <Compass className="mx-auto h-9 w-9 text-stone-400" />
          <h3 className="mt-3 text-sm font-semibold text-stone-900">No learning paths yet</h3>
          <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
            Design a structured curriculum sequence combining foundational courses, practical exercises, and capstone certifications.
          </p>
          {(isStaff || isMember) && (
            <Button
              onClick={() => {
                setTitle('');
                setSlug('');
                setIsSlugManual(false);
                setShowCreatePath(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 bg-black text-white text-xs px-3 py-1.5 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              Create First Learning Path
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Path Selector List */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 px-1">
              Select Programme Track
            </h3>

            {paths.map((p) => {
              const isSelected = p.id === selectedPathId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPathId(p.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-stone-900 bg-white shadow-sm ring-1 ring-stone-900/10'
                      : 'border-stone-200/80 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-stone-700 uppercase">
                      Track
                    </span>
                    {p.status === 'published' ? (
                      <span className="text-[10px] text-emerald-700 font-medium">Published</span>
                    ) : (
                      <span className="text-[10px] text-amber-700 font-medium">Draft</span>
                    )}
                  </div>

                  <h4 className="mt-2 text-sm font-bold text-stone-900">{p.title}</h4>
                  <p className="mt-1 text-xs text-stone-500 line-clamp-2">{p.description}</p>

                  <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-[11px] text-stone-500">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {p.courses_count ?? p.courses?.length ?? 0} courses
                    </span>
                    <span className="text-stone-900 font-semibold flex items-center gap-0.5">
                      Explore <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Path Detail & Sequenced Curriculum */}
          <div className="lg:col-span-8">
            {selectedPath ? (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-stone-500 uppercase tracking-wider">
                      Structured Program Syllabus
                    </span>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-stone-900">
                      {selectedPath.title}
                    </h2>
                    <p className="mt-1.5 text-xs text-stone-600 leading-relaxed max-w-xl">
                      {selectedPath.description || 'Follow this step-by-step sequence to achieve comprehensive proficiency.'}
                    </p>
                  </div>

                  {selectedPath.certificate_title && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 shrink-0">
                      <div className="rounded-xl bg-amber-200/60 p-2 text-amber-900">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                          Graduation Award
                        </p>
                        <p className="text-xs font-semibold text-amber-950">
                          {selectedPath.certificate_title}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Path Progress Header */}
                <div className="flex items-center justify-between rounded-xl bg-stone-50 p-4 border border-stone-200/70">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-black text-white p-2">
                      <Compass className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900">Track Progress</p>
                      <p className="text-[11px] text-stone-500">
                        {selectedPath.completed_courses_count ?? 0} of{' '}
                        {selectedPath.courses?.length ?? 0} courses completed
                      </p>
                    </div>
                  </div>

                  {(isStaff || isMember) && (
                    <Button
                      onClick={() => setShowAddCourse(true)}
                      variant="outline"
                      className="rounded-xl text-xs flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Course to Track
                    </Button>
                  )}
                </div>

                {/* Sequenced Course Steps */}
                <div className="space-y-4">
                  {!selectedPath.courses || selectedPath.courses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
                      No courses have been added to this learning path yet.
                      {(isStaff || isMember) && (
                        <button
                          onClick={() => setShowAddCourse(true)}
                          className="mt-2 block w-full text-center text-black font-semibold hover:underline"
                        >
                          + Add First Course to Track
                        </button>
                      )}
                    </div>
                  ) : (
                    selectedPath.courses.map((step, idx) => {
                      const course = step.course;
                      const isCompleted = Boolean(step.is_completed);
                      const isLocked = Boolean(step.is_locked);

                      return (
                        <div
                          key={step.id || idx}
                          className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border p-5 transition-all ${
                            isCompleted
                              ? 'border-emerald-200 bg-emerald-50/20'
                              : isLocked
                              ? 'border-stone-200 bg-stone-50/50 opacity-80'
                              : 'border-stone-200 bg-white hover:border-stone-300 shadow-2xs'
                          }`}
                        >
                          {/* Step Number & Course Info */}
                          <div className="flex items-start gap-4">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-mono font-bold ${
                                isCompleted
                                  ? 'bg-emerald-600 text-white'
                                  : isLocked
                                  ? 'bg-stone-200 text-stone-600'
                                  : 'bg-black text-white'
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase text-stone-600">
                                  Step {step.sort_order}
                                </span>

                                {isLocked && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 border border-amber-200">
                                    <Lock className="h-2.5 w-2.5" />
                                    Prerequisite Locked
                                  </span>
                                )}

                                {isCompleted && (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-900 border border-emerald-200">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Completed
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm font-bold text-stone-900">
                                {course?.title || `Course ID: ${step.course_id}`}
                              </h4>

                              {course?.description && (
                                <p className="text-xs text-stone-500 line-clamp-1">
                                  {course.description}
                                </p>
                              )}

                              {/* Why is this locked callout */}
                              {isLocked && step.lock_reason && (
                                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200/80 p-2 text-[11px] text-amber-900 flex items-center gap-1.5">
                                  <Lock className="h-3 w-3 shrink-0 text-amber-700" />
                                  <span>
                                    <strong>Why is this locked?</strong> {step.lock_reason}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            {isLocked ? (
                              <button
                                disabled
                                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-500 cursor-not-allowed"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                Locked
                              </button>
                            ) : (
                              <Link
                                href={`/circles/${circleSlug}/courses/${step.course_id}`}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors shadow-2xs"
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                {isCompleted ? 'Review Course' : 'Start Step'}
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-xs text-stone-400">
                Select a learning path from the left to view the curriculum sequence.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Learning Path Modal */}
      {showCreatePath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Create Learning Path</h3>
            <p className="mt-1 text-xs text-stone-500">
              Set up a multi-course structured track with graduation requirements.
            </p>

            <form onSubmit={handleCreatePath} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Program Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full-Stack Engineering Bootcamp"
                  value={title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTitle(val);
                    if (!isSlugManual) {
                      setSlug(
                        val
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-+/g, '')
                      );
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">URL Slug</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. fullstack-bootcamp"
                  value={slug}
                  onChange={(e) => {
                    const sanitized = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '-')
                      .replace(/-+/g, '-');
                    setSlug(sanitized);
                    setIsSlugManual(Boolean(sanitized.trim()));
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 font-mono focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Description</label>
                <textarea
                  rows={3}
                  placeholder="Overview of the learning objectives and career competencies achieved..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Graduation Certificate Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Certified Full-Stack Developer"
                  value={certificateTitle}
                  onChange={(e) => setCertificateTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreatePath(false)}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-black text-white text-xs px-4"
                >
                  {isCreating ? 'Creating...' : 'Create Program'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Course to Path Modal */}
      {showAddCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Add Course to Track</h3>
            <p className="mt-1 text-xs text-stone-500">
              Sequence a course into &quot;{selectedPath?.title}&quot; with optional prerequisites.
            </p>

            <form onSubmit={handleAddCourseToPath} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Select Course</label>
                <select
                  required
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                >
                  <option value="">-- Choose a course --</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Prerequisite Requirement (Optional)
                </label>
                <select
                  value={prereqCourseId}
                  onChange={(e) => setPrereqCourseId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                >
                  <option value="">-- None (Available immediately) --</option>
                  {availableCourses
                    .filter((c) => c.id !== targetCourseId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Must complete: {c.title}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-[11px] text-stone-500">
                  Students will see a clear &quot;Why is this locked?&quot; explanation until completed.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddCourse(false)}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingCourse || !targetCourseId}
                  className="rounded-lg bg-black text-white text-xs px-4"
                >
                  {isAddingCourse ? 'Adding...' : 'Add to Track'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
