'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { CourseItem, CourseLessonItem } from '@/types/domain';
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

  // Flatten lessons to calculate next/prev easily
  const allLessons: CourseLessonItem[] = [];
  course.modules?.forEach((m) => {
    m.lessons.forEach((l) => allLessons.push(l));
  });

  // Default active lesson: first uncompleted lesson, or the very first lesson
  const firstUncompleted = allLessons.find((l) => !l.is_completed);
  const [activeLessonId, setActiveLessonId] = useState<string>(
    firstUncompleted ? firstUncompleted.id : allLessons[0]?.id || ''
  );

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  const activeIndex = allLessons.findIndex((l) => l.id === activeLesson?.id);
  const prevLesson = activeIndex > 0 ? allLessons[activeIndex - 1] : null;
  const nextLesson = activeIndex < allLessons.length - 1 ? allLessons[activeIndex + 1] : null;

  // Modals for instructors
  const [showAddModule, setShowAddModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDesc, setModuleDesc] = useState('');

  const [showAddLesson, setShowAddLesson] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string>('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSlug, setLessonSlug] = useState('');
  const [lessonVideo, setLessonVideo] = useState('');
  const [lessonDuration, setLessonDuration] = useState('15');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonAttachmentUrl, setLessonAttachmentUrl] = useState('');
  const [lessonAttachmentName, setLessonAttachmentName] = useState('');

  const [savingProgress, setSavingProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate overall student progress
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => l.is_completed).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

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

      // Update local state
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

      // Auto-advance if marking as complete and next lesson exists
      if (!currentCompleted && nextLesson) {
        setActiveLessonId(nextLesson.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress.');
    } finally {
      setSavingProgress(false);
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
      setShowAddLesson(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create lesson.');
    }
  }

  function getEmbedUrl(url: string | null): string | null {
    if (!url) return null;
    // YouTube
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    // Loom
    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/);
    if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

    return url;
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

          {(!course.modules || course.modules.length === 0) ? (
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
              {course.modules.map((module, mIdx) => (
                <div key={module.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">
                      Module {mIdx + 1}: {module.title}
                    </span>
                    {(isStaff || isMember) && (
                      <button
                        onClick={() => {
                          setTargetModuleId(module.id);
                          setShowAddLesson(true);
                        }}
                        className="text-[11px] font-medium text-stone-500 hover:text-black flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" /> Lesson
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {module.lessons.map((lesson) => {
                      const isActive = lesson.id === activeLesson?.id;
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
                            onClick={() => setActiveLessonId(lesson.id)}
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
                                onClick={() => handleToggleComplete(lesson.id, Boolean(lesson.is_completed))}
                                disabled={savingProgress}
                                title={lesson.is_completed ? 'Mark incomplete' : 'Mark complete'}
                                className="transition-transform active:scale-90"
                              >
                                {lesson.is_completed ? (
                                  <CheckCircle2
                                    className={`h-4 w-4 ${
                                      isActive ? 'text-white fill-white text-stone-900' : 'text-stone-900'
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
              ))}
            </div>
          )}
        </div>

        {/* Right Lesson Player Pane */}
        <div className="lg:col-span-8 space-y-6">
          {activeLesson ? (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-6">
              {/* Video Player Container */}
              {activeLesson.video_url ? (
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
                    Review the lesson notes and attachments below.
                  </p>
                </div>
              )}

              {/* Lesson Title & Completion Action */}
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

              {/* Lesson Content Body */}
              {activeLesson.content_body && (
                <div className="prose prose-stone max-w-none text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-normal">
                  {activeLesson.content_body}
                </div>
              )}

              {/* Downloadable Attachment Box */}
              {activeLesson.attachment_url && (
                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-stone-200/80 p-2 text-stone-700">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-900">
                        {activeLesson.attachment_name || 'Lesson Downloadable Asset'}
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

              {/* Prev / Next Lesson Navigation Buttons */}
              <div className="flex items-center justify-between border-t border-stone-100 pt-5">
                {prevLesson ? (
                  <Button
                    onClick={() => setActiveLessonId(prevLesson.id)}
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
                    onClick={() => setActiveLessonId(nextLesson.id)}
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
              Add video link, study notes, and downloadable assets.
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
                  Video URL (YouTube, Vimeo, Loom, or MP4)
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={lessonVideo}
                  onChange={(e) => setLessonVideo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                />
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
