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
  AlertCircle,
  X,
  Eye,
  Copy,
  Sparkles,
  HelpCircle,
  Layers,
} from 'lucide-react';
import {
  CourseItem,
  CourseLessonItem,
  LessonCommentItem,
  AssignmentSubmissionItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ContentBlockRenderer } from './content-block-renderer';
import { QuizRunner } from './quiz-runner';
import { LessonBlockBuilder } from './lesson-block-builder';

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

  // Student Preview Mode state for instructors
  const [previewAsStudent, setPreviewAsStudent] = useState(false);
  const effectiveIsStaff = isStaff && !previewAsStudent;

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

  // Active sub-tab under player: blocks/notes, assignment, discussion
  const [activeTab, setActiveTab] = useState<'notes' | 'assignment' | 'discussion'>('notes');

  // Interactive Quiz Runner modal
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  // Lesson Content Blocks Builder Modal
  const [showBlockBuilder, setShowBlockBuilder] = useState(false);

  // Pre-Publish Course Validation Modal
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationIssues, setValidationIssues] = useState<
    { severity: 'error' | 'warning'; message: string; entity: string }[]
  >([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

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
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  function showToast(message: string, type: 'error' | 'success' = 'error') {
    setToast({ message, type });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

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
      showToast('Homework submitted successfully!', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit homework.');
    } finally {
      setSubmittingHomework(false);
    }
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeLesson) return;
    setModalError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_assignment',
          courseId: course.id,
          lessonId: activeLesson.id,
          title: assignTitle.trim(),
          promptBody: assignPrompt.trim(),
          dueDate: assignDueDate ? new Date(assignDueDate).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Failed to create assignment.';
        setModalError(msg);
        showToast(msg, 'error');
        return;
      }

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
      setModalError(null);
      setShowAddAssignment(false);
      showToast('Assignment created successfully!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create assignment.';
      setModalError(msg);
      showToast(msg, 'error');
    }
  }

  async function handleAddModule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setModalError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_module',
          courseId: course.id,
          title: moduleTitle.trim(),
          description: moduleDesc.trim(),
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
      if (!res.ok) {
        const msg = data.error || 'Failed to add module.';
        setModalError(msg);
        showToast(msg, 'error');
        return;
      }

      setCourse((prev) => ({
        ...prev,
        modules: [...(prev.modules || []), { ...data.module, lessons: [] }],
      }));
      setModuleTitle('');
      setModuleDesc('');
      setDripType('instant');
      setDripDays('7');
      setDripDate('');
      setModalError(null);
      setShowAddModule(false);
      showToast(`Module "${data.module.title}" created successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create module.';
      setModalError(msg);
      showToast(msg, 'error');
    }
  }

  async function handleAddLesson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setModalError(null);

    const rawSlug = lessonSlug.trim() || lessonTitle.trim();
    const cleanSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
      const msg = 'Slug must consist of lowercase letters, numbers, and dashes (e.g. dev-setup).';
      setModalError(msg);
      showToast(msg, 'error');
      return;
    }

    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_lesson',
          courseId: course.id,
          moduleId: targetModuleId,
          title: lessonTitle.trim(),
          slug: cleanSlug,
          videoUrl: lessonVideo.trim() || null,
          durationMinutes: parseInt(lessonDuration, 10) || 0,
          contentBody: lessonContent,
          attachmentUrl: lessonAttachmentUrl.trim() || null,
          attachmentName: lessonAttachmentName.trim() || null,
          isLiveSession,
          sortOrder: allLessons.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Failed to add lesson.';
        setModalError(msg);
        showToast(msg, 'error');
        return;
      }

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
      setModalError(null);
      setShowAddLesson(false);
      showToast(`Lesson "${data.lesson.title}" created successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create lesson.';
      setModalError(msg);
      showToast(msg, 'error');
    }
  }

  async function handleDuplicateLesson(lessonId: string, moduleId: string) {
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'duplicate_lesson',
          lessonId,
          targetModuleId: moduleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to duplicate lesson.');

      setCourse((prev) => ({
        ...prev,
        modules: prev.modules?.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: [...m.lessons, { ...data.lesson, is_completed: false }] }
            : m
        ),
      }));
      showToast('Lesson duplicated successfully!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to duplicate lesson.', 'error');
    }
  }

  async function handleValidateCourse() {
    setIsValidating(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate_course',
          courseId: course.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation request failed.');

      setValidationIssues(data.validation?.issues || []);
      setShowValidationModal(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to validate course.', 'error');
    } finally {
      setIsValidating(false);
    }
  }

  async function handlePublishCourse() {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish_version',
          courseId: course.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish course version.');

      setCourse((prev) => ({
        ...prev,
        published_version: data.course.published_version,
      }));
      setShowValidationModal(false);
      showToast(`Course published as Version ${data.course.published_version}!`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish course.', 'error');
    } finally {
      setIsPublishing(false);
    }
  }

  function handleLessonSaved(updatedLesson: CourseLessonItem) {
    setCourse((prev) => ({
      ...prev,
      modules: prev.modules?.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l)),
      })),
    }));
    showToast('Lesson content blocks updated successfully!', 'success');
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
  const isActiveModuleLocked = Boolean(activeModule?.is_locked) && !effectiveIsStaff;
  const isLessonPrereqLocked = Boolean(activeLesson?.is_locked) && !effectiveIsStaff;

  if (course.viewer_can_access === false && !effectiveIsStaff) {
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
      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 text-xs shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-top-3 duration-200 ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50/95 text-emerald-950 font-medium'
              : 'border-red-200 bg-red-50/95 text-red-950 font-medium'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-stone-400 hover:text-stone-700 p-0.5"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Student Preview Mode Banner for Instructors */}
      {previewAsStudent && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-700" />
            <span>
              <strong>Student Preview Mode Active:</strong> You are experiencing this curriculum exactly as an enrolled student. Admin controls and draft features are hidden.
            </span>
          </div>
          <button
            onClick={() => setPreviewAsStudent(false)}
            className="font-bold underline hover:text-amber-950 ml-2"
          >
            Exit Preview
          </button>
        </div>
      )}

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
            {isStaff && (
              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono text-stone-600">
                v{course.published_version || 1}
              </span>
            )}
          </div>

          <h2 className="mt-1 text-lg font-bold text-stone-900 tracking-tight">
            {activeLesson?.title || course.title}
          </h2>
        </div>

        {/* Progress Bar & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-xs font-medium">
              <span className="text-stone-500">Progress</span>
              <span className="font-mono font-bold text-stone-900">{progressPercent}%</span>
            </div>
            <div className="mt-1 h-2 w-32 overflow-hidden rounded-full bg-stone-100 border border-stone-200/60">
              <div
                className="h-full bg-black transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Instructor Controls */}
          {isStaff && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPreviewAsStudent(!previewAsStudent)}
                className={`rounded-xl text-xs flex items-center gap-1 ${
                  previewAsStudent ? 'bg-amber-100 text-amber-900 border-amber-300' : ''
                }`}
                title="Preview course as a learner"
              >
                <Eye className="h-3.5 w-3.5" />
                {previewAsStudent ? 'Exit Preview' : 'Student View'}
              </Button>

              {!previewAsStudent && (
                <>
                  <Button
                    onClick={handleValidateCourse}
                    disabled={isValidating}
                    variant="outline"
                    className="rounded-xl text-xs flex items-center gap-1 text-stone-700"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-stone-500" />
                    {isValidating ? 'Validating...' : 'Pre-check'}
                  </Button>

                  <Button
                    onClick={() => setShowAddModule(true)}
                    variant="outline"
                    className="rounded-xl text-xs"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Module
                  </Button>
                </>
              )}
            </div>
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
              {effectiveIsStaff && (
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
                const isModuleLocked = Boolean(module.is_locked) && !effectiveIsStaff;
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
                      {effectiveIsStaff && (
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
                        const isLessonLocked = Boolean(lesson.is_locked) && !effectiveIsStaff;

                        if (isModuleLocked || isLessonLocked) {
                          return (
                            <div
                              key={lesson.id}
                              onClick={() => {
                                // Allow clicking to inspect the "Why is this locked?" reason
                                setActiveLessonId(lesson.id);
                              }}
                              className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs border select-none cursor-pointer transition-all ${
                                isActive
                                  ? 'bg-amber-50/70 border-amber-300 text-amber-900 font-medium'
                                  : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100/60'
                              }`}
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
                              {lesson.is_optional && (
                                <span
                                  className={`rounded px-1 py-0.2 text-[9px] font-mono uppercase ${
                                    isActive
                                      ? 'bg-stone-800 text-stone-300'
                                      : 'bg-stone-200 text-stone-600'
                                  }`}
                                >
                                  Opt
                                </span>
                              )}
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              {effectiveIsStaff && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateLesson(lesson.id, module.id);
                                  }}
                                  title="Duplicate lesson"
                                  className={`rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                                    isActive ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-stone-900'
                                  }`}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              )}

                              {lesson.duration_minutes > 0 && (
                                <span
                                  className={`text-[10px] font-mono ${
                                    isActive ? 'text-stone-300' : 'text-stone-400'
                                  }`}
                                >
                                  {lesson.duration_minutes}m
                                </span>
                              )}

                              {isMember && !previewAsStudent && (
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
          ) : isLessonPrereqLocked ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-10 text-center shadow-xs space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 border border-amber-200">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Lesson Prerequisite Locked</h3>
                <p className="mt-1.5 text-xs text-amber-900 font-medium max-w-md mx-auto">
                  {activeLesson.lock_reason || 'You must complete earlier curriculum lessons or assessments before unlocking this lesson.'}
                </p>
              </div>

              {prevLesson && (
                <div className="pt-2">
                  <Button
                    onClick={() => setActiveLessonId(prevLesson.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white"
                  >
                    Go to Previous Lesson
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ) : activeLesson ? (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-6">
              {/* Top Lesson Title & Action Bar */}
              <div className="flex flex-col justify-between gap-4 border-b border-stone-100 pb-5 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-stone-900">
                      {activeLesson.title}
                    </h1>
                    {activeLesson.is_optional && (
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600">
                        Optional
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
                    {activeLesson.duration_minutes > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-stone-400" />
                        {activeLesson.duration_minutes} minutes
                      </span>
                    )}
                    {activeLesson.quiz?.id && (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
                        Graded Quiz Included
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Instructor Edit Blocks Button */}
                  {effectiveIsStaff && (
                    <Button
                      onClick={() => setShowBlockBuilder(true)}
                      variant="outline"
                      className="rounded-xl text-xs flex items-center gap-1.5 text-stone-800 hover:border-black"
                    >
                      <Layers className="h-3.5 w-3.5 text-stone-500" />
                      Edit Content Blocks
                    </Button>
                  )}

                  {/* Launch Quiz Button if lesson has associated quiz */}
                  {activeLesson.quiz?.id && (
                    <Button
                      onClick={() => setActiveQuizId(activeLesson.quiz?.id || null)}
                      className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs flex items-center gap-1.5"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Take Lesson Quiz
                    </Button>
                  )}

                  {effectiveIsStaff && !activeLesson.assignment && (
                    <Button
                      onClick={() => setShowAddAssignment(true)}
                      variant="outline"
                      className="rounded-xl text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Homework
                    </Button>
                  )}

                  {isMember && !previewAsStudent && (
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

              {/* Instructor Private Notes Callout (Staff only, hidden from student preview) */}
              {effectiveIsStaff && activeLesson.instructor_notes && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-amber-700" />
                      Instructor Private Note
                    </span>
                    <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-900">
                      Private (Students cannot see this)
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                    {activeLesson.instructor_notes}
                  </p>
                </div>
              )}

              {/* Flexible Lesson Content Blocks (Phase 1) */}
              {activeLesson.content_blocks && activeLesson.content_blocks.length > 0 ? (
                <div className="space-y-6">
                  <ContentBlockRenderer
                    blocks={activeLesson.content_blocks}
                    circleSlug={circleSlug}
                    onLaunchQuiz={(quizId) => setActiveQuizId(quizId)}
                  />
                </div>
              ) : (
                /* Legacy fallback renderer when no blocks configured */
                <div className="space-y-6">
                  {activeLesson.is_live_session ? (
                    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-stone-200 bg-stone-900 p-8 text-center text-white">
                      <Calendar className="h-10 w-10 text-stone-400" />
                      <h4 className="mt-3 text-sm font-semibold tracking-wide">
                        Live Workshop / Synchronized Cohort Session
                      </h4>
                      <p className="mt-1 max-w-sm text-xs text-stone-400">
                        This lesson is a scheduled live interactive workshop. Join via the meeting link below.
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
                </div>
              )}

              {/* Interactivity Sub-Tabs: Notes | Homework | Q&A Discussion */}
              <div className="flex items-center gap-4 border-b border-stone-100 pt-2">
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
                      {effectiveIsStaff && (
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

                  {isMember && !previewAsStudent ? (
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

      {/* Quiz Runner Modal */}
      {activeQuizId && (
        <QuizRunner
          circleId={circleId}
          quizId={activeQuizId}
          onClose={() => setActiveQuizId(null)}
          onCompleted={(attempt) => {
            showToast(
              `Quiz submitted! Score: ${attempt.score_percent}% (${attempt.is_passed ? 'PASSED' : 'NEEDS RETAKE'})`,
              attempt.is_passed ? 'success' : 'error'
            );
          }}
        />
      )}

      {/* Lesson Content Block Builder Drawer/Modal */}
      {showBlockBuilder && activeLesson && (
        <LessonBlockBuilder
          circleId={circleId}
          courseId={course.id}
          lesson={activeLesson}
          isOpen={showBlockBuilder}
          onClose={() => setShowBlockBuilder(false)}
          onSaveSuccess={handleLessonSaved}
        />
      )}

      {/* Pre-Publish Course Validation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-stone-700" />
                <h3 className="text-base font-bold text-stone-900">Course Pre-Publish Validation</h3>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {validationIssues.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>All validation checks passed! This course is ready to be published or updated.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {validationIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                        issue.severity === 'error'
                          ? 'border-red-200 bg-red-50 text-red-950'
                          : 'border-amber-200 bg-amber-50 text-amber-950'
                      }`}
                    >
                      <AlertCircle
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'
                        }`}
                      />
                      <div>
                        <span className="font-bold uppercase text-[10px]">[{issue.entity}]</span>
                        <p className="mt-0.5">{issue.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-3">
              <span className="text-xs text-stone-500">
                Current Version: <strong>v{course.published_version || 1}</strong>
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowValidationModal(false)}
                  className="rounded-lg text-xs"
                >
                  Close
                </Button>
                <Button
                  onClick={handlePublishCourse}
                  disabled={
                    isPublishing ||
                    validationIssues.some((issue) => issue.severity === 'error')
                  }
                  className="rounded-lg bg-black text-white text-xs px-4"
                >
                  {isPublishing ? 'Publishing...' : 'Publish Version'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Assignment Prompt Modal */}
      {showAddAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900">Add Homework Assignment</h3>
            <p className="mt-1 text-xs text-stone-500">
              Create an assignment prompt and submission requirements for this lesson.
            </p>

            {modalError && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Unable to Save Assignment</p>
                  <p className="mt-0.5 text-red-700">{modalError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

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

            {modalError && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Unable to Save Module</p>
                  <p className="mt-0.5 text-red-700">{modalError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

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

            {modalError && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Unable to Save Lesson</p>
                  <p className="mt-0.5 text-red-700">{modalError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError(null)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleAddLesson} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Lesson Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Setting up the Development Environment"
                  value={lessonTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLessonTitle(val);
                    const autoSlug = val
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '');
                    if (!lessonSlug || lessonSlug === autoSlug || lessonSlug.startsWith(autoSlug.slice(0, -1))) {
                      setLessonSlug(autoSlug);
                    }
                    setModalError(null);
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-stone-700">URL Slug</label>
                    <span className="text-[10px] text-stone-500 font-mono">lowercase & dashes</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. dev-setup"
                    value={lessonSlug}
                    onChange={(e) => {
                      const sanitized = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '-')
                        .replace(/-+/g, '-');
                      setLessonSlug(sanitized);
                      setModalError(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 font-mono focus:border-stone-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] text-stone-500">
                    Lowercase letters, numbers, and dashes only
                  </p>
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
