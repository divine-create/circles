'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Play,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  ExternalLink,
  MessageSquare,
  Send,
  Calendar,
  CheckCircle,
  Lock,
} from 'lucide-react';
import {
  CourseItem,
  CourseLessonItem,
  LessonCommentItem,
  AssignmentSubmissionItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';

export function CoursePlayer({
  circleId,
  circleSlug,
  initialCourse,
  isMember,
  isStaff,
}: {
  circleId: string;
  circleSlug: string;
  initialCourse: CourseItem;
  isMember: boolean;
  isStaff: boolean;
}) {
  const [course, setCourse] = useState<CourseItem>(initialCourse);

  // Flatten lessons
  const allLessons: CourseLessonItem[] = [];
  course.modules?.forEach((m) => {
    m.lessons.forEach((l) => allLessons.push(l));
  });

  const firstUncompleted = allLessons.find((l) => !l.is_completed);
  const [activeLessonId, setActiveLessonId] = useState<string>(
    firstUncompleted ? firstUncompleted.id : allLessons[0]?.id || ''
  );

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  const activeIndex = allLessons.findIndex((l) => l.id === activeLesson?.id);
  const prevLesson = activeIndex > 0 ? allLessons[activeIndex - 1] : null;
  const nextLesson = activeIndex < allLessons.length - 1 ? allLessons[activeIndex + 1] : null;

  // Active sub-tab under player: notes, assignment, discussion
  const [activeTab, setActiveTab] = useState<'notes' | 'assignment' | 'discussion'>('notes');

  // Comments state
  const [comments, setComments] = useState<LessonCommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Homework submission state
  const [submissionBody, setSubmissionBody] = useState('');
  const [submissionAttachment, setSubmissionAttachment] = useState('');
  const [submittingHomework, setSubmittingHomework] = useState(false);

  // Instructor assignment modal
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignPrompt, setAssignPrompt] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');

  // Modals for instructor curriculum building
  const [showAddModule, setShowAddModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDesc, setModuleDesc] = useState('');
  const [dripType, setDripType] = useState<'instant' | 'relative_days' | 'calendar_date'>('instant');
  const [dripDays, setDripDays] = useState('7');
  const [dripDate, setDripDate] = useState('');

  const [showAddLesson, setShowAddLesson] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string>('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSlug, setLessonSlug] = useState('');
  const [lessonVideo, setLessonVideo] = useState('');
  const [lessonDuration, setLessonDuration] = useState('15');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonAttachmentUrl, setLessonAttachmentUrl] = useState('');
  const [lessonAttachmentName, setLessonAttachmentName] = useState('');
  const [isLiveSession, setIsLiveSession] = useState(false);

  const [savingProgress, setSavingProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => l.is_completed).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Fetch comments when active lesson changes
  useEffect(() => {
    if (!activeLesson?.id) return;
    let isMounted = true;
    async function loadComments() {
      try {
        const res = await fetch(
          `/api/circles/${circleId}/courses?mode=comments&courseId=${course.id}&lessonId=${activeLesson?.id}`
        );
        const data = await res.json();
        if (res.ok && isMounted) {
          setComments(data.comments || []);
        }
      } catch {
        // silent fail
      }
    }
    loadComments();
    return () => {
      isMounted = false;
    };
  }, [circleId, course.id, activeLesson?.id]);

  async function handleToggleComplete(lessonId: string, currentCompleted: boolean) {
    if (!isMember) return;
    setSavingProgress(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          completed: !currentCompleted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update progress.');

      setCourse((prev) => {
        if (!prev.modules) return prev;
        const newModules = prev.modules.map((mod) => ({
          ...mod,
          lessons: mod.lessons.map((l) =>
            l.id === lessonId ? { ...l, is_completed: !currentCompleted } : l
          ),
        }));
        return {
          ...prev,
          modules: newModules,
          completed_lessons_count: data.progress.completed_lessons,
          progress_percentage: data.progress.progress_percentage,
        };
      });

      if (!currentCompleted && nextLesson) {
        setActiveLessonId(nextLesson.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress.');
    } finally {
      setSavingProgress(false);
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !activeLesson) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_comment',
          courseId: course.id,
          lessonId: activeLesson.id,
          body: newComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post comment.');
      setComments((prev) => [...prev, data.comment]);
      setNewComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setPostingComment(false);
    }
  }

  async function handleSubmitHomework(e: React.FormEvent) {
    e.preventDefault();
    if (!activeLesson?.assignment) return;
    setSubmittingHomework(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_assignment',
          courseId: course.id,
          lessonId: activeLesson.id,
          assignmentId: activeLesson.assignment.id,
          submissionBody,
          attachmentUrl: submissionAttachment || null,
          status: 'submitted',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit homework.');

      // Update local assignment submission state
      setCourse((prev) => ({
        ...prev,
        modules: prev.modules?.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) =>
            l.id === activeLesson.id
              ? {
                  ...l,
                  assignment: l.assignment
                    ? { ...l.assignment, user_submission: data.submission }
                    : null,
                }
              : l
          ),
        })),
      }));
      setSubmissionBody('');
      setSubmissionAttachment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit homework.');
    } finally {
      setSubmittingHomework(false);
    }
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeLesson) return;
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_assignment',
          courseId: course.id,
          lessonId: activeLesson.id,
          title: assignTitle,
          promptBody: assignPrompt,
          dueDate: assignDueDate ? new Date(assignDueDate).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create assignment.');

      setCourse((prev) => ({
        ...prev,
        modules: prev.modules?.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) =>
            l.id === activeLesson.id ? { ...l, assignment: data.assignment } : l
          ),
        })),
      }));
      setAssignTitle('');
      setAssignPrompt('');
      setAssignDueDate('');
      setShowAddAssignment(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create assignment.');
    }
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_module',
          courseId: course.id,
          title: moduleTitle,
          description: moduleDesc,
          sortOrder: (course.modules?.length || 0) + 1,
          dripType,
          dripDaysAfterEnrollment:
            dripType === 'relative_days' ? parseInt(dripDays, 10) || 0 : 0,
          dripUnlockDate:
            dripType === 'calendar_date' && dripDate
              ? new Date(dripDate).toISOString()
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add module.');

      setCourse((prev) => ({
        ...prev,
        modules: [...(prev.modules || []), { ...data.module, lessons: [] }],
      }));
      setModuleTitle('');
      setModuleDesc('');
      setDripType('instant');
      setDripDays('7');
      setDripDate('');
      setShowAddModule(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create module.');
    }
  }

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_lesson',
          courseId: course.id,
          moduleId: targetModuleId,
          title: lessonTitle,
          slug: lessonSlug,
          videoUrl: lessonVideo || null,
          durationMinutes: parseInt(lessonDuration, 10) || 0,
          contentBody: lessonContent,
          attachmentUrl: lessonAttachmentUrl || null,
          attachmentName: lessonAttachmentName || null,
          isLiveSession,
          sortOrder: allLessons.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add lesson.');

      setCourse((prev) => ({
        ...prev,
        modules: prev.modules?.map((m) =>
          m.id === targetModuleId
            ? { ...m, lessons: [...m.lessons, { ...data.lesson, is_completed: false }] }
            : m
        ),
      }));

      if (!activeLessonId) {
        setActiveLessonId(data.lesson.id);
      }

      setLessonTitle('');
      setLessonSlug('');
      setLessonVideo('');
      setLessonContent('');
      setLessonAttachmentUrl('');
      setLessonAttachmentName('');
      setIsLiveSession(false);
      setShowAddLesson(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create lesson.');
    }
  }

  function getEmbedUrl(url: string | null): string | null {
    if (!url) return null;
    const ytMatch = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    const vimeoMatch = url.match(
      /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/
    );
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/);
    if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

    return url;
  }

  const currentSubmission: AssignmentSubmissionItem | null | undefined =
    activeLesson?.assignment?.user_submission;

  const activeModule = course.modules?.find((m) =>
    m.lessons.some((l) => l.id === activeLesson?.id)
  );
  const isActiveModuleLocked = Boolean(activeModule?.is_locked) && !isStaff;

  if (course.viewer_can_access === false && !isStaff) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs">
          <Link
            href={`/circles/${circleSlug}/courses`}
            className="hover:text-stone-900 text-xs text-stone-500 font-medium transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Courses
          </Link>
        </div>

        <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-900 border border-stone-200">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-stone-900">Community Level Gated</h2>
          <p className="mt-2 text-xs text-stone-600 leading-relaxed">
            This course requires <strong>Community Level {course.min_level_required}</strong> to access.
            Your current level is <strong>Level {course.viewer_level ?? 1}</strong>.
          </p>

          <div className="mt-6 rounded-xl border border-stone-200/80 bg-stone-50 p-4 text-left">
            <h4 className="text-xs font-bold text-stone-900">How to earn XP and level up:</h4>
            <ul className="mt-2 space-y-1.5 text-xs text-stone-600">
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-black">+10 XP</span> Complete lessons in beginner courses
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-black">+25 XP</span> Submit homework assignments
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-black">+50 XP</span> Receive approved homework reviews
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-black">+5 XP</span> Ask and answer questions in lesson discussions
              </li>
            </ul>
          </div>

          <div className="mt-6">
            <Link
              href={`/circles/${circleSlug}/courses`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-medium text-white hover:bg-stone-800 transition-colors shadow-xs"
            >
              Explore Open Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Progress Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
            <Link
              href={`/circles/${circleSlug}/courses`}
              className="hover:text-stone-900 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All Courses
            </Link>
            <span>/</span>
            <span className="text-stone-900 font-bold truncate max-w-xs">{course.title}</span>
          </div>

          <h2 className="mt-1 text-lg font-bold text-stone-900 tracking-tight">
            {activeLesson?.title || course.title}
          </h2>
        </div>

        {/* Progress Bar & Actions */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-xs font-medium">
              <span className="text-stone-500">Course Progress</span>
              <span className="font-mono font-bold text-stone-900">{progressPercent}%</span>
            </div>
            <div className="mt-1 h-2 w-36 overflow-hidden rounded-full bg-stone-100 border border-stone-200/60">
              <div
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {(isStaff || isMember) && (
            <Button
              onClick={() => setShowAddModule(true)}
              variant="outline"
              className="rounded-lg text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Module
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Main LMS Layout: Left Sidebar Curriculum, Right Player Pane */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Curriculum Sidebar */}
        <div className="lg:col-span-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Curriculum Syllabus
            </h3>
            <span className="text-[11px] font-mono text-stone-500">
              {completedLessons}/{totalLessons} DONE
            </span>
          </div>

          {!course.modules || course.modules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
              No modules in this course yet.
              {(isStaff || isMember) && (
                <button
                  onClick={() => setShowAddModule(true)}
                  className="mt-2 block w-full text-center text-black font-semibold hover:underline"
                >
                  + Add First Module
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {course.modules.map((module, mIdx) => {
                const isModuleLocked = Boolean(module.is_locked) && !isStaff;
                return (
                  <div key={module.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate mr-2">
                        <span className="text-xs font-bold text-stone-900 truncate">
                          Module {mIdx + 1}: {module.title}
                        </span>
                        {module.is_locked && (
                          <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono text-stone-600 border border-stone-200 shrink-0">
                            <Lock className="h-2.5 w-2.5" />
                            {module.unlocks_at
                              ? `Unlocks ${new Date(module.unlocks_at).toLocaleDateString()}`
                              : 'Drip Locked'}
                          </span>
                        )}
                      </div>
                      {(isStaff || isMember) && (
                        <button
                          onClick={() => {
                            setTargetModuleId(module.id);
                            setShowAddLesson(true);
                          }}
                          className="text-[11px] font-medium text-stone-500 hover:text-black flex items-center gap-0.5 shrink-0"
                        >
                          <Plus className="h-3 w-3" /> Lesson
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {module.lessons.map((lesson) => {
                        const isActive = lesson.id === activeLesson?.id;

                        if (isModuleLocked) {
                          return (
                            <div
                              key={lesson.id}
                              className="flex items-center justify-between rounded-xl px-3 py-2 text-xs bg-stone-50 text-stone-400 border border-stone-100 select-none cursor-not-allowed"
                            >
                              <div className="flex items-center gap-2.5 truncate mr-2">
                                <Lock className="h-3 w-3 shrink-0 text-stone-400" />
                                <span className="truncate">{lesson.title}</span>
                              </div>
                              <span className="text-[10px] font-mono text-stone-400">Locked</span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={lesson.id}
                            className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                              isActive
                                ? 'bg-stone-900 text-white font-medium shadow-xs'
                                : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            <button
                              onClick={() => {
                                setActiveLessonId(lesson.id);
                                setActiveTab('notes');
                              }}
                              className="flex items-center gap-2.5 text-left flex-1 truncate mr-2"
                            >
                              <Play
                                className={`h-3 w-3 shrink-0 ${
                                  isActive ? 'text-white fill-current' : 'text-stone-400'
                                }`}
                              />
                              <span className="truncate">{lesson.title}</span>
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              {lesson.duration_minutes > 0 && (
                                <span
                                  className={`text-[10px] font-mono ${
                                    isActive ? 'text-stone-300' : 'text-stone-400'
                                  }`}
                                >
                                  {lesson.duration_minutes}m
                                </span>
                              )}

                              {isMember && (
                                <button
                                  onClick={() =>
                                    handleToggleComplete(lesson.id, Boolean(lesson.is_completed))
                                  }
                                  disabled={savingProgress}
                                  title={lesson.is_completed ? 'Mark incomplete' : 'Mark complete'}
                                  className="transition-transform active:scale-90"
                                >
                                  {lesson.is_completed ? (
                                    <CheckCircle2
                                      className={`h-4 w-4 ${
                                        isActive
                                          ? 'text-white fill-white text-stone-900'
                                          : 'text-stone-900'
                                      }`}
                                    />
                                  ) : (
                                    <Circle
                                      className={`h-4 w-4 ${
                                        isActive ? 'text-stone-400' : 'text-stone-300'
                                      }`}
                                    />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Lesson Player Pane */}
        <div className="lg:col-span-8 space-y-6">
          {isActiveModuleLocked ? (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-800 border border-stone-200">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-stone-900">Module Drip Locked</h3>
              <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
                {activeModule?.unlocks_at
                  ? `This module content unlocks on ${new Date(activeModule.unlocks_at).toLocaleDateString()}. Complete other lessons in the meantime!`
                  : 'This module is scheduled to release on a future drip schedule date.'}
              </p>
            </div>
          ) : activeLesson ? (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-6">
              {/* Video Player or Live Session Banner */}
              {activeLesson.is_live_session ? (
                <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-stone-200 bg-stone-900 p-8 text-center text-white">
                  <Calendar className="h-10 w-10 text-stone-400" />
                  <h4 className="mt-3 text-sm font-semibold tracking-wide">
                    Live Workshop / Synchronized Cohort Session
                  </h4>
                  <p className="mt-1 max-w-sm text-xs text-stone-400">
                    This lesson is a scheduled live interactive workshop. Join via the meeting link below or watch the recording archive once concluded.
                  </p>
                  {activeLesson.video_url && (
                    <a
                      href={activeLesson.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-stone-100"
                    >
                      Join Meeting Link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ) : activeLesson.video_url ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-md">
                  <iframe
                    src={getEmbedUrl(activeLesson.video_url) || ''}
                    title={activeLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-stone-200 bg-stone-50 p-8 text-center">
                  <FileText className="h-10 w-10 text-stone-400" />
                  <h4 className="mt-3 text-sm font-semibold text-stone-800">
                    Text-Based Lesson & Study Notes
                  </h4>
                  <p className="mt-1 max-w-sm text-xs text-stone-500">
                    Review the lesson notes, complete assignments, and participate in discussion below.
                  </p>
                </div>
              )}

              {/* Lesson Title & Top Actions */}
              <div className="flex flex-col justify-between gap-4 border-b border-stone-100 pb-5 sm:flex-row sm:items-center">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-stone-900">
                    {activeLesson.title}
                  </h1>
                  {activeLesson.duration_minutes > 0 && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                      <Clock className="h-3.5 w-3.5 text-stone-400" />
                      {activeLesson.duration_minutes} minutes
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {(isStaff || isMember) && !activeLesson.assignment && (
                    <Button
                      onClick={() => setShowAddAssignment(true)}
                      variant="outline"
                      className="rounded-xl text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Homework
                    </Button>
                  )}

                  {isMember && (
                    <Button
                      onClick={() =>
                        handleToggleComplete(activeLesson.id, Boolean(activeLesson.is_completed))
                      }
                      disabled={savingProgress}
                      className={`inline-flex items-center gap-2 rounded-xl text-xs font-semibold px-4 py-2 transition-all ${
                        activeLesson.is_completed
                          ? 'bg-stone-100 text-stone-800 hover:bg-stone-200 border border-stone-200'
                          : 'bg-black text-white hover:bg-stone-800'
                      }`}
                    >
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          activeLesson.is_completed ? 'text-black fill-current' : ''
                        }`}
                      />
                      {activeLesson.is_completed ? 'Completed' : 'Mark as Complete'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Interactivity Sub-Tabs: Notes | Homework | Q&A Discussion */}
              <div className="flex items-center gap-4 border-b border-stone-100">
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === 'notes'
                      ? 'border-black text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Notes & Resources
                </button>

                <button
                  onClick={() => setActiveTab('assignment')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'assignment'
                      ? 'border-black text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <span>Homework & Assignment</span>
                  {activeLesson.assignment && (
                    <span className="rounded-full bg-stone-100 px-1.5 py-0.2 text-[10px] font-mono text-stone-700">
                      1
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('discussion')}
                  className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'discussion'
                      ? 'border-black text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Discussion ({comments.length})</span>
                </button>
              </div>

              {/* Tab 1: Notes & Downloadable Assets */}
              {activeTab === 'notes' && (
                <div className="space-y-6">
                  {activeLesson.content_body && (
                    <div className="prose prose-stone max-w-none text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-normal">
                      {activeLesson.content_body}
                    </div>
                  )}

                  {activeLesson.attachment_url && (
                    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-stone-200/80 p-2 text-stone-700">
                          <Download className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-stone-900">
                            {activeLesson.attachment_name || 'Downloadable Lesson Resource'}
                          </p>
                          <p className="text-[11px] text-stone-500 font-mono truncate max-w-xs sm:max-w-md">
                            {activeLesson.attachment_url}
                          </p>
                        </div>
                      </div>

                      <a
                        href={activeLesson.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-white border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100 transition-colors shadow-xs"
                      >
                        Download
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Homework & Assignment Submissions */}
              {activeTab === 'assignment' && (
                <div className="space-y-6">
                  {activeLesson.assignment ? (
                    <div className="space-y-5">
                      {/* Assignment Prompt Box */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-stone-900">
                            {activeLesson.assignment.title}
                          </h3>
                          {activeLesson.assignment.due_date && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-stone-500">
                              <Calendar className="h-3 w-3" />
                              Due: {new Date(activeLesson.assignment.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
                          {activeLesson.assignment.prompt_body}
                        </p>
                      </div>

                      {/* Current Student Submission Status */}
                      {currentSubmission ? (
                        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                              Your Submission
                            </h4>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                                currentSubmission.status === 'approved'
                                  ? 'bg-stone-900 text-white'
                                  : currentSubmission.status === 'needs_revision'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-800'
                              }`}
                            >
                              {currentSubmission.status.replace('_', ' ')}
                            </span>
                          </div>

                          <p className="text-xs text-stone-700 whitespace-pre-wrap">
                            {currentSubmission.submission_body}
                          </p>

                          {currentSubmission.attachment_url && (
                            <div className="text-[11px] font-mono text-stone-600">
                              Attached:{' '}
                              <a
                                href={currentSubmission.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-black"
                              >
                                {currentSubmission.attachment_name || currentSubmission.attachment_url}
                              </a>
                            </div>
                          )}

                          {currentSubmission.instructor_feedback && (
                            <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs space-y-1">
                              <p className="font-bold text-stone-900 flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5 text-stone-700" />
                                Instructor Review & Feedback
                                {currentSubmission.grade_score !== null && (
                                  <span className="font-mono text-stone-600">
                                    ({currentSubmission.grade_score}/100)
                                  </span>
                                )}
                              </p>
                              <p className="text-stone-600">{currentSubmission.instructor_feedback}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitHomework} className="rounded-xl border border-stone-200 bg-white p-5 space-y-3.5">
                          <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                            Submit Your Work
                          </h4>
                          <p className="text-xs text-stone-500">
                            Upload your solution, repository link, or write your notes for the instructor.
                          </p>

                          <div>
                            <textarea
                              required
                              rows={4}
                              placeholder="Describe your submission, insights, and key takeaways..."
                              value={submissionBody}
                              onChange={(e) => setSubmissionBody(e.target.value)}
                              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-stone-700">
                              Attachment / Project URL (e.g. GitHub link, Figma URL, or Google Drive)
                            </label>
                            <input
                              type="url"
                              placeholder="https://github.com/..."
                              value={submissionAttachment}
                              onChange={(e) => setSubmissionAttachment(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                            />
                          </div>

                          <div className="flex justify-end pt-2">
                            <Button
                              type="submit"
                              disabled={submittingHomework}
                              className="rounded-lg bg-black text-white text-xs px-4"
                            >
                              {submittingHomework ? 'Submitting...' : 'Submit Homework'}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
                      No assignment prompt has been assigned for this lesson.
                      {(isStaff || isMember) && (
                        <button
                          onClick={() => setShowAddAssignment(true)}
                          className="mt-2 block w-full text-center text-black font-semibold hover:underline"
                        >
                          + Create Lesson Assignment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Contextual Lesson Q&A Discussion */}
              {activeTab === 'discussion' && (
                <div className="space-y-6">
                  {/* Comments Timeline */}
                  {comments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
                      No questions or comments yet. Be the first to start the discussion!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-900">
                              {comment.author?.display_name || 'Member'}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed">
                            {comment.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment Composer */}
                  {isMember ? (
                    <form onSubmit={handlePostComment} className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Ask a question or leave a comment on this lesson..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                      />
                      <Button
                        type="submit"
                        disabled={postingComment}
                        className="rounded-xl bg-black text-white text-xs px-3.5 flex items-center gap-1"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Post
                      </Button>
                    </form>
                  ) : (
                    <p className="text-center text-xs text-stone-500">
                      Join this Circle to participate in lesson discussions.
                    </p>
                  )}
                </div>
              )}

              {/* Prev / Next Lesson Navigation Buttons */}
              <div className="flex items-center justify-between border-t border-stone-100 pt-5">
                {prevLesson ? (
                  <Button
                    onClick={() => {
                      setActiveLessonId(prevLesson.id);
                      setActiveTab('notes');
                    }}
                    variant="outline"
                    className="inline-flex items-center gap-1.5 rounded-xl text-xs text-stone-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous Lesson
                  </Button>
                ) : (
                  <div />
                )}

                {nextLesson && (
                  <Button
                    onClick={() => {
                      setActiveLessonId(nextLesson.id);
                      setActiveTab('notes');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-black text-white text-xs hover:bg-stone-800"
                  >
                    Next Lesson
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-12 text-center text-xs text-stone-500">
              Select or add a lesson from the curriculum sidebar to start learning.
            </div>
          )}
        </div>
      </div>

      {/* Add Assignment Prompt Modal */}
      {showAddAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Add Homework Assignment</h3>
            <p className="mt-1 text-xs text-stone-500">
              Create an assignment prompt and submission requirements for this lesson.
            </p>

            <form onSubmit={handleCreateAssignment} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Build and Submit Your First Database Schema"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Instructions & Prompt
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the task, expected deliverables, and evaluation criteria..."
                  value={assignPrompt}
                  onChange={(e) => setAssignPrompt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddAssignment(false)}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg bg-black text-white text-xs px-4">
                  Create Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Module Modal */}
      {showAddModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Add Curriculum Module</h3>
            <p className="mt-1 text-xs text-stone-500">
              Create a section to group related video lessons and study materials.
            </p>

            <form onSubmit={handleAddModule} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Module Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Week 1: Foundations & Architecture"
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief overview of what this module covers..."
                  value={moduleDesc}
                  onChange={(e) => setModuleDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Drip Pacing Schedule</label>
                <select
                  value={dripType}
                  onChange={(e) =>
                    setDripType(
                      e.target.value as 'instant' | 'relative_days' | 'calendar_date'
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                >
                  <option value="instant">Instant Access (Available Immediately)</option>
                  <option value="relative_days">Days After Enrollment</option>
                  <option value="calendar_date">Specific Calendar Date</option>
                </select>
              </div>

              {dripType === 'relative_days' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Unlock Days After Enrollment
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={dripDays}
                    onChange={(e) => setDripDays(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>
              )}

              {dripType === 'calendar_date' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Unlock Calendar Date
                  </label>
                  <input
                    type="date"
                    value={dripDate}
                    onChange={(e) => setDripDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModule(false)}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg bg-black text-white text-xs px-4">
                  Add Module
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {showAddLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-stone-900">Add Lesson</h3>
            <p className="mt-1 text-xs text-stone-500">
              Add video link, study notes, live session toggle, and downloadable assets.
            </p>

            <form onSubmit={handleAddLesson} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Lesson Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Setting up the Development Environment"
                  value={lessonTitle}
                  onChange={(e) => {
                    setLessonTitle(e.target.value);
                    if (!lessonSlug) {
                      setLessonSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, '')
                      );
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">URL Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. dev-setup"
                    value={lessonSlug}
                    onChange={(e) => setLessonSlug(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 font-mono focus:border-stone-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Est. Duration (mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Video URL (YouTube, Vimeo, Loom, or Zoom/Meet Link)
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={lessonVideo}
                  onChange={(e) => setLessonVideo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isLiveSessionCheck"
                  checked={isLiveSession}
                  onChange={(e) => setIsLiveSession(e.target.checked)}
                  className="rounded border-stone-300"
                />
                <label htmlFor="isLiveSessionCheck" className="text-xs text-stone-700 font-medium">
                  This lesson is a scheduled Live Interactive Workshop / Office Hours session
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Lesson Notes & Instructions
                </label>
                <textarea
                  rows={4}
                  placeholder="Write Markdown lesson notes, summary, code snippets..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Attachment Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Starter Code.zip"
                    value={lessonAttachmentName}
                    onChange={(e) => setLessonAttachmentName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Attachment Download URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={lessonAttachmentUrl}
                    onChange={(e) => setLessonAttachmentUrl(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddLesson(false)}
                  className="rounded-lg text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg bg-black text-white text-xs px-4">
                  Save Lesson
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
