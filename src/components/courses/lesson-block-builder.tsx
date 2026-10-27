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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CourseLessonItem, LessonContentBlock } from '@/types/domain';

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
          { id, type: 'video', url: '', title: 'Video Presentation', provider: 'custom' },
        ]);
        break;
      case 'rich_text':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'rich_text',
            markdown: '### Overview\nWrite your concepts, explanations, and instructions here...',
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
            starterCode: '// Write your code solution here\nfunction solution() {\n  return true;\n}',
            instructions: 'Complete the exercise according to requirements.',
            solutionCode: 'function solution() {\n  return true;\n}',
          },
        ]);
        break;
      case 'file_asset':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'file_asset',
            title: 'Cheatsheet & Resources',
            fileUrl: '',
            fileSize: '1.2 MB',
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
            prompt: 'Share your perspective with fellow classmates:',
            spaceSlug: 'general',
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
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            hostName: 'Instructor',
          },
        ]);
        break;
      case 'reflection_checkpoint':
        setBlocks((prev) => [
          ...prev,
          {
            id,
            type: 'reflection_checkpoint',
            prompt: 'How will you apply the principles learned in this lesson?',
            objectives: [],
          },
        ]);
        break;
    }
  }

  function handleRemoveBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleMoveBlock(idx: number, direction: 'up' | 'down') {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === blocks.length - 1) return;

    setBlocks((prev) => {
      const next = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-800">
                Lesson Content Builder
              </span>
              <span className="text-xs text-stone-400">/</span>
              <h2 className="text-sm font-bold text-stone-900">{lesson.title}</h2>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              Combine video, rich markdown, interactive sandboxes, quizzes, and private instructor notes.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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
                  placeholder="e.g. Understand React reconciliation & virtual DOM"
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
                placeholder="Private reminders, curriculum roadmap notes, answer keys, or common student misconceptions..."
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
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Lesson Content Blocks ({blocks.length})
              </h3>

              {/* Add Block Palette Dropdown / Bar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-stone-400 mr-1">Add Block:</span>
                <button
                  type="button"
                  onClick={() => handleAddBlock('video')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Video className="h-3 w-3 text-stone-500" /> Video
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('rich_text')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <FileText className="h-3 w-3 text-stone-500" /> Text
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('code_sandbox')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Code className="h-3 w-3 text-stone-500" /> Code
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('file_asset')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Download className="h-3 w-3 text-stone-500" /> File
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('quiz_checkpoint')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <HelpCircle className="h-3 w-3 text-stone-500" /> Quiz
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('discussion_prompt')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <MessageSquare className="h-3 w-3 text-stone-500" /> Discussion
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('live_session')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Radio className="h-3 w-3 text-stone-500" /> Live
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBlock('reflection_checkpoint')}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
                >
                  <Lightbulb className="h-3 w-3 text-stone-500" /> Reflection
                </button>
              </div>
            </div>

            {/* Blocks List */}
            {blocks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
                No blocks added yet. Click on any block type above to construct your lesson content.
              </div>
            ) : (
              <div className="space-y-4">
                {blocks.map((block, idx) => (
                  <div
                    key={block.id || idx}
                    className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs space-y-3"
                  >
                    {/* Block Card Header */}
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase text-stone-600">
                          {idx + 1}. {block.type.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-xs text-stone-900">
                          {block.type === 'video'
                            ? block.title || 'Video'
                            : block.type === 'file_asset'
                            ? block.title
                            : block.type === 'code_sandbox'
                            ? `Code (${block.language})`
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
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === blocks.length - 1}
                          onClick={() => handleMoveBlock(idx, 'down')}
                          className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30"
                          title="Move block down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBlock(idx)}
                          className="rounded p-1 text-stone-400 hover:text-red-500 ml-1"
                          title="Remove block"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Block Type Editor Forms */}
                    {block.type === 'video' && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-stone-700">Video Embed URL</label>
                        <input
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=... or Loom / Vimeo"
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
                    )}

                    {block.type === 'rich_text' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-stone-700">
                            Markdown Content
                          </label>
                          <span className="text-[10px] text-stone-400 font-mono">Supports GitHub Markdown</span>
                        </div>
                        <textarea
                          rows={6}
                          placeholder="Write rich lesson material with headings, lists, bold notes, and links..."
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
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-stone-700">Language</label>
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
                              className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-2 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                            >
                              <option value="typescript">TypeScript</option>
                              <option value="javascript">JavaScript</option>
                              <option value="python">Python</option>
                              <option value="sql">SQL</option>
                              <option value="html">HTML</option>
                              <option value="css">CSS</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-stone-700">
                              Instructions Prompt
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Implement the binary search function"
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
                            Instructor Solution Code (Optional, for student self-check)
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
                            Quiz ID or Assessment Link
                          </label>
                          <input
                            type="text"
                            placeholder="Paste Quiz UUID or identifier"
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
                          Discussion Question / Topic
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
                            Meeting Link (Zoom / Meet / Teams)
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
                            Scheduled Date & Time (UTC)
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
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-stone-700">
                          Reflective Question Prompt
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
                          className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-6 py-4">
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
              className="rounded-xl bg-black px-4 text-xs font-semibold text-white hover:bg-stone-800 flex items-center gap-1.5"
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
