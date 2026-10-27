'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Video,
  FileText,
  Code,
  Download,
  HelpCircle,
  MessageSquare,
  Radio,
  Lightbulb,
  CheckCircle2,
  Lock,
  Save,
  AlertCircle,
  Eye,
  Edit3,
  Copy,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CourseLessonItem, LessonContentBlock } from '@/types/domain';
import { ContentBlockRenderer } from './content-block-renderer';

interface LessonBlockBuilderProps {
  circleId: string;
  courseId: string;
  lesson: CourseLessonItem;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedLesson: CourseLessonItem) => void;
}

export function LessonBlockBuilder({
  circleId,
  courseId,
  lesson,
  isOpen,
  onClose,
  onSaveSuccess,
}: LessonBlockBuilderProps) {
  // Initialize blocks from lesson or synthesize legacy fallback
  const initialBlocks: LessonContentBlock[] =
    lesson.content_blocks && lesson.content_blocks.length > 0
      ? JSON.parse(JSON.stringify(lesson.content_blocks))
      : [
          ...(lesson.video_url
            ? [
                {
                  id: 'blk-video-init',
                  type: 'video' as const,
                  title: 'Video Lesson',
                  url: lesson.video_url,
                  provider: 'youtube' as const,
                },
              ]
            : []),
          ...(lesson.content_body
            ? [
                {
                  id: 'blk-text-init',
                  type: 'rich_text' as const,
                  markdown: lesson.content_body,
                },
              ]
            : []),
          ...(lesson.attachment_url
            ? [
                {
                  id: 'blk-file-init',
                  type: 'file_asset' as const,
                  title: lesson.attachment_name || 'Downloadable Material',
                  fileUrl: lesson.attachment_url,
                  fileSize: 'Attachment',
                },
              ]
            : []),
        ];

  const [blocks, setBlocks] = useState<LessonContentBlock[]>(initialBlocks);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [learningObjectives, setLearningObjectives] = useState<string[]>(
    lesson.learning_objectives || []
  );
  const [newObjective, setNewObjective] = useState('');
  const [instructorNotes, setInstructorNotes] = useState(lesson.instructor_notes || '');
  const [isOptional, setIsOptional] = useState(Boolean(lesson.is_optional));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleAddBlock(type: LessonContentBlock['type']) {
    const id = `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    switch (type) {
      case 'video':
        setBlocks((prev) => [
          ...prev,
          { id, type: 'video', url: '', title: 'Video Presentation', provider: 'youtube' },
        ]);
        break;
      case 'rich_text':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'rich_text',
            markdown: '### Core Concept\n\nExplain the theory, background, and practical takeaways here...\n\n- Key takeaway 1\n- Key takeaway 2\n\n> [!TIP]\n> Pro-tip for mastering this concept.',
          },
        ]);
        break;
      case 'code_sandbox':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'code_sandbox',
            language: 'typescript',
            starterCode: '// Exercise starter code\nfunction solution() {\n  // TODO: implement logic\n  return true;\n}',
            instructions: 'Complete the implementation according to the problem requirements.',
            solutionCode: '// Reference Solution\nfunction solution() {\n  return true;\n}',
          },
        ]);
        break;
      case 'file_asset':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'file_asset',
            title: 'Study Guide & Notes.pdf',
            fileUrl: '',
            fileSize: '2.4 MB',
          },
        ]);
        break;
      case 'quiz_checkpoint':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'quiz_checkpoint',
            quizId: '',
            quizTitle: 'Knowledge Checkpoint',
            passingScore: 80,
            requiredToPass: true,
          },
        ]);
        break;
      case 'discussion_prompt':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'discussion_prompt',
            prompt: 'What did you find most challenging about this topic, and how might you apply it in your own projects?',
          },
        ]);
        break;
      case 'live_session':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'live_session',
            meetingUrl: '',
            scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
            timezone: 'UTC',
            hostName: 'Lead Instructor',
          },
        ]);
        break;
      case 'reflection_checkpoint':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'reflection_checkpoint',
            prompt: 'Take a moment to reflect on what you learned and verify the milestones below before moving forward.',
            objectives: [
              'Understood core conceptual principles',
              'Successfully tested the code example',
              'Ready for the next lesson challenge',
            ],
          },
        ]);
        break;
    }
  }

  function handleDuplicateBlock(idx: number) {
    const original = blocks[idx];
    if (!original) return;
    const clone: LessonContentBlock = {
      ...JSON.parse(JSON.stringify(original)),
      id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }

  function handleRemoveBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleMoveBlock(idx: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;

    setBlocks((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  }

  function handleAddObjective() {
    if (!newObjective.trim()) return;
    setLearningObjectives((prev) => [...prev, newObjective.trim()]);
    setNewObjective('');
  }

  function handleRemoveObjective(idx: number) {
    setLearningObjectives((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(publish = true) {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lesson_blocks',
          courseId,
          lessonId: lesson.id,
          contentBlocks: blocks,
          instructorNotes,
          learningObjectives,
          isOptional,
          publishNow: publish,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update lesson content.');

      onSaveSuccess(data.lesson);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lesson blocks.');
    } finally {
      setIsSaving(false);
    }
  }

  const blockColors: Record<LessonContentBlock['type'], { bg: string; text: string; border: string }> = {
    video: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    rich_text: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-200' },
    code_sandbox: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    file_asset: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    quiz_checkpoint: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
    discussion_prompt: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
    live_session: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    reflection_checkpoint: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-3.5 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-900 text-white shadow-xs">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-stone-200/80 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-800">
                  Lesson Builder
                </span>
                <span className="text-xs text-stone-400">/</span>
                <h2 className="text-sm font-bold text-stone-900">{lesson.title}</h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Switcher: Edit vs Learner Preview */}
            <div className="flex items-center rounded-xl bg-stone-200/70 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  activeTab === 'edit'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Blocks</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  activeTab === 'preview'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Learner Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {activeTab === 'preview' ? (
            /* Live Student View Preview Tab */
            <div className="mx-auto max-w-3xl space-y-6 py-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 flex items-center justify-between text-xs text-stone-600">
                <span className="font-semibold text-stone-800">
                  Student Experience Simulation
                </span>
                <span className="text-stone-500 font-mono text-[11px]">
                  {blocks.length} active blocks
                </span>
              </div>

              <ContentBlockRenderer
                blocks={blocks}
                circleSlug=""
                isStaff={true}
              />
            </div>
          ) : (
            /* Edit Workspace Tab */
            <>
              {/* Top Options: Learning Objectives & Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Learning Objectives */}
                <div className="rounded-2xl border border-stone-200/90 bg-stone-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Target Learning Objectives
                    </label>
                    <span className="text-[10px] font-mono text-stone-500">
                      {learningObjectives.length} added
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Master asynchronous data fetching in Next.js"
                      value={newObjective}
                      onChange={(e) => setNewObjective(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddObjective();
                        }
                      }}
                      className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    />
                    <Button
                      type="button"
                      onClick={handleAddObjective}
                      className="rounded-xl bg-stone-900 px-3 py-1.5 text-xs text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {learningObjectives.length > 0 && (
                    <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {learningObjectives.map((obj, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-white border border-stone-200/70 px-2.5 py-1.5 text-xs text-stone-800"
                        >
                          <span className="truncate mr-2">• {obj}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveObjective(i)}
                            className="text-stone-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Instructor Private Notes */}
                <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-amber-700" />
                      Instructor Private Notes
                    </label>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-amber-900">
                      Hidden from students
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Private reminders, roadmap notes, solution rubrics, or common student pitfalls..."
                    value={instructorNotes}
                    onChange={(e) => setInstructorNotes(e.target.value)}
                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-amber-700 focus:outline-hidden"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="optionalLessonCheck"
                      checked={isOptional}
                      onChange={(e) => setIsOptional(e.target.checked)}
                      className="rounded border-stone-300"
                    />
                    <label htmlFor="optionalLessonCheck" className="text-xs text-stone-700 font-medium">
                      Mark as optional enrichment (does not block 100% course completion)
                    </label>
                  </div>
                </div>
              </div>

              {/* Block Authoring Workspace */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Lesson Content Blocks ({blocks.length})
                  </h3>

                  {/* Add Block Palette Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAddBlock('video')}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 transition-colors shadow-2xs"
                    >
                      <Video className="h-3 w-3" /> + Video
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlock('rich_text')}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-800 hover:bg-stone-200 transition-colors shadow-2xs"
                    >
                      <FileText className="h-3 w-3" /> + Text
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlock('code_sandbox')}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                    >
                      <Code className="h-3 w-3" /> + Code
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlock('file_asset')}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 transition-colors shadow-2xs"
                    >
                      <Download className="h-3 w-3" /> + File
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlock('quiz_checkpoint')}
                      className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-800 hover:bg-purple-100 transition-colors shadow-2xs"
                    >
                      <HelpCircle className="h-3 w-3" /> + Quiz
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlock('discussion_prompt')}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 transition-colors shadow-2xs"
                    >
                      <MessageSquare className="h-3 w-3" /> + Discussion
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlock('live_session')}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                    >
                      <Radio className="h-3 w-3" /> + Live
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlock('reflection_checkpoint')}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors shadow-2xs"
                    >
                      <Lightbulb className="h-3 w-3" /> + Reflection
                    </button>
                  </div>
                </div>

                {/* Blocks List */}
                {blocks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 p-8 text-center text-xs text-stone-500">
                    No blocks added yet. Click any button above to add rich blocks to your lesson.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {blocks.map((block, idx) => {
                      const color = blockColors[block.type] || blockColors.rich_text;

                      return (
                        <div
                          key={block.id || idx}
                          className="rounded-2xl border border-stone-200 bg-white p-4.5 shadow-2xs space-y-3.5 transition-all hover:border-stone-300"
                        >
                          {/* Block Card Header */}
                          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${color.bg} ${color.text} ${color.border}`}
                              >
                                {idx + 1}. {block.type.replace('_', ' ')}
                              </span>
                              <span className="font-bold text-xs text-stone-900">
                                {block.type === 'video'
                                  ? block.title || 'Video'
                                  : block.type === 'file_asset'
                                  ? block.title
                                  : block.type === 'code_sandbox'
                                  ? `Code Sandbox (${block.language})`
                                  : block.type.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveBlock(idx, 'up')}
                                className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30"
                                title="Move block up"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === blocks.length - 1}
                                onClick={() => handleMoveBlock(idx, 'down')}
                                className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30"
                                title="Move block down"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateBlock(idx)}
                                className="rounded p-1 text-stone-400 hover:text-stone-700 ml-1"
                                title="Duplicate block"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveBlock(idx)}
                                className="rounded p-1 text-stone-400 hover:text-red-500 ml-1"
                                title="Delete block"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Block Type Editor Forms */}
                          {block.type === 'video' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="sm:col-span-2 space-y-1">
                                <label className="text-[11px] font-semibold text-stone-700">Video URL</label>
                                <input
                                  type="url"
                                  placeholder="YouTube, Vimeo, Loom, or direct .mp4/.webm URL"
                                  value={block.url}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) => (i === idx && b.type === 'video' ? { ...b, url: val } : b))
                                    );
                                  }}
                                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-stone-700">Title / Label</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Course Introduction"
                                  value={block.title || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) => (i === idx && b.type === 'video' ? { ...b, title: val } : b))
                                    );
                                  }}
                                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          )}

                          {block.type === 'rich_text' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Markdown Body
                                </label>
                                <span className="text-[10px] text-stone-400 font-mono">
                                  Headers (#, ##), Bold (**), Code (`), Quotes (&gt;)
                                </span>
                              </div>
                              <textarea
                                rows={6}
                                placeholder="Write clear lesson documentation, bullet points, callouts, and explanations..."
                                value={block.markdown}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBlocks((prev) =>
                                    prev.map((b, i) => (i === idx && b.type === 'rich_text' ? { ...b, markdown: val } : b))
                                  );
                                }}
                                className="w-full font-mono rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                              />
                            </div>
                          )}

                          {block.type === 'code_sandbox' && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[11px] font-semibold text-stone-700">Programming Language</label>
                                  <select
                                    value={block.language}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBlocks((prev) =>
                                        prev.map((b, i) =>
                                          i === idx && b.type === 'code_sandbox' ? { ...b, language: val } : b
                                        )
                                      );
                                    }}
                                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                  >
                                    <option value="typescript">TypeScript</option>
                                    <option value="javascript">JavaScript</option>
                                    <option value="python">Python</option>
                                    <option value="sql">SQL</option>
                                    <option value="html">HTML</option>
                                    <option value="css">CSS</option>
                                    <option value="rust">Rust</option>
                                    <option value="go">Go</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[11px] font-semibold text-stone-700">
                                    Exercise Objective Prompt
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Implement the binary search algorithm"
                                    value={block.instructions || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBlocks((prev) =>
                                        prev.map((b, i) =>
                                          i === idx && b.type === 'code_sandbox'
                                            ? { ...b, instructions: val }
                                            : b
                                        )
                                      );
                                    }}
                                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Starter Template Code
                                </label>
                                <textarea
                                  rows={4}
                                  value={block.starterCode}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'code_sandbox' ? { ...b, starterCode: val } : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full font-mono rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Reference Solution (Optional, revealed for student self-checks)
                                </label>
                                <textarea
                                  rows={3}
                                  value={block.solutionCode || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'code_sandbox' ? { ...b, solutionCode: val } : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full font-mono rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          )}

                          {block.type === 'file_asset' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">File Name</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Architecture-Diagram.pdf"
                                  value={block.title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'file_asset' ? { ...b, title: val } : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">Download URL</label>
                                <input
                                  type="text"
                                  placeholder="https://..."
                                  value={block.fileUrl}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'file_asset' ? { ...b, fileUrl: val } : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          )}

                          {block.type === 'quiz_checkpoint' && (
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Quiz ID / UUID
                                </label>
                                <input
                                  type="text"
                                  placeholder="Paste Quiz UUID"
                                  value={block.quizId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'quiz_checkpoint' ? { ...b, quizId: val } : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Min Passing %
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={Number(block.passingScore ?? 80)}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'quiz_checkpoint'
                                          ? { ...b, passingScore: val }
                                          : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          )}

                          {block.type === 'discussion_prompt' && (
                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold text-stone-700">
                                Community Discussion Prompt
                              </label>
                              <textarea
                                rows={2}
                                value={block.prompt}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBlocks((prev) =>
                                    prev.map((b, i) =>
                                      i === idx && b.type === 'discussion_prompt' ? { ...b, prompt: val } : b
                                    )
                                  );
                                }}
                                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                              />
                            </div>
                          )}

                          {block.type === 'live_session' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Meeting Room URL (Zoom / Meet)
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://zoom.us/j/..."
                                  value={block.meetingUrl}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'live_session' ? { ...b, meetingUrl: val } : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Scheduled Time (UTC)
                                </label>
                                <input
                                  type="datetime-local"
                                  value={
                                    block.scheduledAt
                                      ? new Date(block.scheduledAt).toISOString().slice(0, 16)
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value ? new Date(e.target.value).toISOString() : '';
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'live_session'
                                          ? { ...b, scheduledAt: val }
                                          : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          )}

                          {block.type === 'reflection_checkpoint' && (
                            <div className="space-y-3">
                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Reflective Guiding Prompt
                                </label>
                                <input
                                  type="text"
                                  value={block.prompt}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'reflection_checkpoint'
                                          ? { ...b, prompt: val }
                                          : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-semibold text-stone-700">
                                  Self-Check Milestones (Comma or newline separated)
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="Milestone 1, Milestone 2, Milestone 3"
                                  value={(block.objectives || []).join('\n')}
                                  onChange={(e) => {
                                    const lines = e.target.value
                                      .split('\n')
                                      .map((s) => s.trim())
                                      .filter(Boolean);
                                    setBlocks((prev) =>
                                      prev.map((b, i) =>
                                        i === idx && b.type === 'reflection_checkpoint'
                                          ? { ...b, objectives: lines }
                                          : b
                                      )
                                    );
                                  }}
                                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden font-mono"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => handleSave(false)}
              className="rounded-xl text-xs flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Save as Draft
            </Button>

            <Button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(true)}
              className="rounded-xl bg-black px-4 text-xs font-semibold text-white hover:bg-stone-800 flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? 'Publishing...' : 'Publish Blocks'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
