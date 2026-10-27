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
  Check,
  Lock,
  Save,
  AlertCircle,
  Eye,
  Edit3,
  Copy,
  Layers,
  ChevronRight,
  Maximize2,
  Minimize2,
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
  const [expandedBlockIds, setExpandedBlockIds] = useState<Record<string, boolean>>(() => {
    // Expand the first block by default for immediate focus
    const initial: Record<string, boolean> = {};
    if (initialBlocks.length > 0) {
      initial[initialBlocks[0].id] = true;
    }
    return initial;
  });
  const [activeInsertIdx, setActiveInsertIdx] = useState<number | null>(null);

  // Lesson Metadata States
  const [learningObjectives, setLearningObjectives] = useState<string[]>(
    lesson.learning_objectives || []
  );
  const [newObjective, setNewObjective] = useState('');
  const [instructorNotes, setInstructorNotes] = useState(lesson.instructor_notes || '');
  const [isOptional, setIsOptional] = useState(Boolean(lesson.is_optional));
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function toggleBlockExpansion(id: string) {
    setExpandedBlockIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function expandAllBlocks() {
    const all: Record<string, boolean> = {};
    blocks.forEach((b) => {
      all[b.id] = true;
    });
    setExpandedBlockIds(all);
  }

  function collapseAllBlocks() {
    setExpandedBlockIds({});
  }

  function handleAddBlock(type: LessonContentBlock['type'], insertAtIdx?: number) {
    const id = `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let newBlock: LessonContentBlock;

    switch (type) {
      case 'video':
        newBlock = { id, type: 'video', url: '', title: 'Video Presentation', provider: 'youtube' };
        break;
      case 'rich_text':
        newBlock = {
          id,
          type: 'rich_text',
          markdown: '### Core Concept\n\nExplain the theory, background, and practical takeaways here...\n\n- Key takeaway 1\n- Key takeaway 2\n\n> [!TIP]\n> Pro-tip for mastering this concept.',
        };
        break;
      case 'code_sandbox':
        newBlock = {
          id,
          type: 'code_sandbox',
          language: 'typescript',
          starterCode: '// Exercise starter code\nfunction solution() {\n  // TODO: implement logic\n  return true;\n}',
          instructions: 'Complete the implementation according to the problem requirements.',
          solutionCode: '// Reference Solution\nfunction solution() {\n  return true;\n}',
        };
        break;
      case 'file_asset':
        newBlock = {
          id,
          type: 'file_asset',
          title: 'Study Guide & Notes.pdf',
          fileUrl: '',
          fileSize: '2.4 MB',
        };
        break;
      case 'quiz_checkpoint':
        newBlock = {
          id,
          type: 'quiz_checkpoint',
          question: '',
          options: ['Option 1', 'Option 2', 'Option 3'],
          correctAnswerIndex: 0,
          explanation: '',
          requiredToPass: false,
        };
        break;
      case 'discussion_prompt':
        newBlock = {
          id,
          type: 'discussion_prompt',
          prompt: 'What did you find most challenging about this topic, and how might you apply it in your own projects?',
        };
        break;
      case 'live_session':
        newBlock = {
          id,
          type: 'live_session',
          meetingUrl: '',
          scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
          timezone: 'UTC',
          hostName: 'Lead Instructor',
        };
        break;
      case 'reflection_checkpoint':
        newBlock = {
          id,
          type: 'reflection_checkpoint',
          prompt: 'Take a moment to reflect on what you learned and verify the milestones below before moving forward.',
          objectives: [
            'Understood core conceptual principles',
            'Successfully tested the code example',
            'Ready for the next lesson challenge',
          ],
        };
        break;
    }

    setBlocks((prev) => {
      const next = [...prev];
      if (typeof insertAtIdx === 'number' && insertAtIdx >= 0 && insertAtIdx <= next.length) {
        next.splice(insertAtIdx, 0, newBlock);
      } else {
        next.push(newBlock);
      }
      return next;
    });

    // Auto-expand newly added block
    setExpandedBlockIds((prev) => ({ ...prev, [id]: true }));
    setActiveInsertIdx(null);
  }

  function handleDuplicateBlock(idx: number) {
    const original = blocks[idx];
    if (!original) return;
    const cloneId = `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clone: LessonContentBlock = {
      ...JSON.parse(JSON.stringify(original)),
      id: cloneId,
    };
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setExpandedBlockIds((prev) => ({ ...prev, [cloneId]: true }));
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

  function getBlockPreviewSummary(block: LessonContentBlock): string {
    switch (block.type) {
      case 'video':
        return block.title || block.url || 'Video presentation';
      case 'rich_text': {
        const firstLine = block.markdown.split('\n').find((l) => l.trim().length > 0) || '';
        return firstLine.replace(/^#+\s*/, '') || 'Rich markdown text';
      }
      case 'code_sandbox':
        return `${block.language.toUpperCase()}: ${block.instructions || 'Code Exercise'}`;
      case 'file_asset':
        return `${block.title}${block.fileSize ? ` · ${block.fileSize}` : ''}`;
      case 'quiz_checkpoint':
        return block.question?.trim() || block.quizTitle?.trim() || 'Quick Question Checkpoint';
      case 'discussion_prompt':
        return `"${block.prompt.slice(0, 60)}..."`;
      case 'live_session':
        return `Live Session: ${new Date(block.scheduledAt).toLocaleDateString()} · ${block.hostName || 'Room'}`;
      case 'reflection_checkpoint':
        return `${block.prompt.slice(0, 50)}... (${block.objectives?.length || 0} self-checks)`;
      default:
        return 'Content block';
    }
  }

  const blockColors: Record<LessonContentBlock['type'], { bg: string; text: string; border: string }> = {
    video: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    rich_text: { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' },
    code_sandbox: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    file_asset: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    quiz_checkpoint: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
    discussion_prompt: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
    live_session: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    reflection_checkpoint: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
  };

  // Reusable inline between-block inserter
  function BetweenBlockInserter({ insertIdx }: { insertIdx: number }) {
    const isOpened = activeInsertIdx === insertIdx;

    return (
      <div className="relative py-1 group/inserter">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-stone-200/60 group-hover/inserter:bg-stone-300 transition-colors" />
          <button
            type="button"
            onClick={() => setActiveInsertIdx(isOpened ? null : insertIdx)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all shadow-2xs ${
              isOpened
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-500 border border-stone-200 hover:border-stone-400 hover:text-stone-900'
            }`}
          >
            <Plus className="h-3 w-3" />
            <span>{isOpened ? 'Close' : 'Insert Block'}</span>
          </button>
          <div className="h-px flex-1 bg-stone-200/60 group-hover/inserter:bg-stone-300 transition-colors" />
        </div>

        {isOpened && (
          <div className="mt-2.5 rounded-2xl border border-stone-200 bg-stone-50/90 p-3 shadow-md animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200/70">
              <span className="text-[11px] font-bold text-stone-700">Choose Block Type to Insert</span>
              <button
                type="button"
                onClick={() => setActiveInsertIdx(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleAddBlock('video', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white p-2 text-left hover:bg-rose-50 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <Video className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Video</p>
                  <p className="text-[10px] text-stone-500">YouTube, Loom, MP4</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddBlock('rich_text', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2 text-left hover:bg-stone-100 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-stone-200 text-stone-800">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Text</p>
                  <p className="text-[10px] text-stone-500">Rich Markdown Notes</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddBlock('code_sandbox', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white p-2 text-left hover:bg-emerald-50 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Code className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Code</p>
                  <p className="text-[10px] text-stone-500">Executable Sandbox</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddBlock('file_asset', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white p-2 text-left hover:bg-blue-50 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                  <Download className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Resource File</p>
                  <p className="text-[10px] text-stone-500">PDF, ZIP, Slides</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddBlock('quiz_checkpoint', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white p-2 text-left hover:bg-purple-50 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-800">
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Quick Quiz</p>
                  <p className="text-[10px] text-stone-500">Inline Checkpoint</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddBlock('discussion_prompt', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white p-2 text-left hover:bg-sky-50 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Discussion</p>
                  <p className="text-[10px] text-stone-500">Community Topic</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddBlock('reflection_checkpoint', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white p-2 text-left hover:bg-indigo-50 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800">
                  <Lightbulb className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Reflection</p>
                  <p className="text-[10px] text-stone-500">Milestone Check</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAddBlock('live_session', insertIdx)}
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white p-2 text-left hover:bg-amber-50 transition-colors"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                  <Radio className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Live Session</p>
                  <p className="text-[10px] text-stone-500">Cohort Workshop</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-3.5 bg-stone-50/60">
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
                <h2 className="text-sm font-bold text-stone-900 truncate max-w-md">{lesson.title}</h2>
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
                <span>Edit Canvas</span>
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
                <span>Learner View</span>
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {activeTab === 'preview' ? (
            /* Live Student View Preview Tab */
            <div className="mx-auto max-w-3xl space-y-6 py-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 flex items-center justify-between text-xs text-stone-600">
                <span className="font-semibold text-stone-800">
                  Live Student Experience Simulation
                </span>
                <span className="text-stone-500 font-mono text-[11px]">
                  {blocks.length} active content blocks
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
              {/* Collapsible Metadata Bar: Objectives & Private Notes */}
              <div className="rounded-2xl border border-stone-200/90 bg-stone-50/50 overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setShowMetadataPanel(!showMetadataPanel)}
                  className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-stone-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      className={`h-4 w-4 text-stone-500 transition-transform ${
                        showMetadataPanel ? 'rotate-90' : ''
                      }`}
                    />
                    <span className="text-xs font-bold text-stone-800">
                      Lesson Objectives & Private Instructor Settings
                    </span>
                    <span className="text-[11px] text-stone-500">
                      ({learningObjectives.length} objectives · {isOptional ? 'Optional' : 'Core'})
                    </span>
                  </div>

                  <span className="text-[11px] font-semibold text-stone-600">
                    {showMetadataPanel ? 'Hide Settings' : 'Configure'}
                  </span>
                </button>

                {showMetadataPanel && (
                  <div className="border-t border-stone-200/70 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white animate-in fade-in duration-150">
                    {/* Objectives */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Target Learning Objectives
                        </label>
                        <span className="text-[10px] font-mono text-stone-500">
                          {learningObjectives.length} configured
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
                              className="flex items-center justify-between rounded-lg bg-stone-50 border border-stone-200/70 px-2.5 py-1.5 text-xs text-stone-800"
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

                    {/* Private Notes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-amber-700" />
                          Private Instructor Notes
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
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-hidden"
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
                )}
              </div>

              {/* Block Authoring Workspace Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-2 pt-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Content Blocks ({blocks.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAllBlocks}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-900"
                  >
                    <Maximize2 className="h-3 w-3" /> Expand All
                  </button>
                  <span className="text-stone-300">·</span>
                  <button
                    type="button"
                    onClick={collapseAllBlocks}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-900"
                  >
                    <Minimize2 className="h-3 w-3" /> Collapse All
                  </button>
                </div>
              </div>

              {/* Initial Inserter before first block */}
              <BetweenBlockInserter insertIdx={0} />

              {/* Blocks List */}
              {blocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 p-8 text-center text-xs text-stone-500">
                  <Layers className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                  <p className="font-semibold text-stone-700">No content blocks yet</p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    Click &ldquo;Insert Block&rdquo; above to add your first video, text, or interactive exercise.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blocks.map((block, idx) => {
                    const color = blockColors[block.type] || blockColors.rich_text;
                    const isExpanded = expandedBlockIds[block.id] ?? false;

                    return (
                      <React.Fragment key={block.id || idx}>
                        <div
                          className={`rounded-2xl border transition-all ${
                            isExpanded
                              ? 'border-stone-300 bg-white shadow-sm ring-1 ring-stone-900/5'
                              : 'border-stone-200/90 bg-stone-50/60 hover:bg-white hover:border-stone-300'
                          }`}
                        >
                          {/* Block Card Summary Header Bar */}
                          <div
                            onClick={() => toggleBlockExpansion(block.id)}
                            className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0 ${color.bg} ${color.text} ${color.border}`}
                              >
                                {idx + 1}. {block.type.replace('_', ' ')}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-stone-900 truncate">
                                  {getBlockPreviewSummary(block)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveBlock(idx, 'up')}
                                className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20 transition-colors"
                                title="Move block up"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === blocks.length - 1}
                                onClick={() => handleMoveBlock(idx, 'down')}
                                className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20 transition-colors"
                                title="Move block down"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateBlock(idx)}
                                className="rounded p-1 text-stone-400 hover:text-stone-700 ml-1 transition-colors"
                                title="Duplicate block"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveBlock(idx)}
                                className="rounded p-1 text-stone-400 hover:text-red-500 ml-1 transition-colors"
                                title="Delete block"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleBlockExpansion(block.id)}
                                className="rounded p-1 text-stone-400 hover:text-stone-800 ml-1 transition-colors"
                                title={isExpanded ? 'Collapse block' : 'Edit block'}
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Block Type Editor Form: Expanded View */}
                          {isExpanded && (
                            <div className="border-t border-stone-100 p-4 space-y-3.5 bg-white rounded-b-2xl animate-in fade-in duration-150">
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
                                <div className="space-y-4 rounded-xl border border-purple-100 bg-purple-50/20 p-4">
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <label className="text-[11px] font-semibold text-stone-700">
                                        Question Prompt <span className="text-red-500">*</span>
                                      </label>
                                      <span className="text-[10px] text-stone-400">Inline Micro-Quiz</span>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="e.g. Which React hook is used to manage component state?"
                                      value={block.question ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setBlocks((prev) =>
                                          prev.map((b, i) =>
                                            i === idx && b.type === 'quiz_checkpoint'
                                              ? { ...b, question: val }
                                              : b
                                          )
                                        );
                                      }}
                                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[11px] font-semibold text-stone-700">
                                        Answer Choices (select circle to mark correct answer)
                                      </label>
                                      {((block.options ?? []).length < 6) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const curr =
                                              block.options && block.options.length > 0
                                                ? block.options
                                                : ['Option 1', 'Option 2'];
                                            setBlocks((prev) =>
                                              prev.map((b, i) =>
                                                i === idx && b.type === 'quiz_checkpoint'
                                                  ? { ...b, options: [...curr, `Option ${curr.length + 1}`] }
                                                  : b
                                              )
                                            );
                                          }}
                                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                                        >
                                          + Add Choice
                                        </button>
                                      )}
                                    </div>

                                    <div className="space-y-2">
                                      {(block.options && block.options.length > 0
                                        ? block.options
                                        : ['Option 1', 'Option 2', 'Option 3']
                                      ).map((opt, optIdx) => {
                                        const isCorrect = (block.correctAnswerIndex ?? 0) === optIdx;
                                        return (
                                          <div
                                            key={optIdx}
                                            className={`flex items-center gap-2 rounded-xl border p-2 transition-all ${
                                              isCorrect
                                                ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200'
                                                : 'border-stone-200 bg-white'
                                            }`}
                                          >
                                            <button
                                              type="button"
                                              title={isCorrect ? 'Correct choice' : 'Click to set as correct answer'}
                                              onClick={() => {
                                                setBlocks((prev) =>
                                                  prev.map((b, i) =>
                                                    i === idx && b.type === 'quiz_checkpoint'
                                                      ? { ...b, correctAnswerIndex: optIdx }
                                                      : b
                                                  )
                                                );
                                              }}
                                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                                                isCorrect
                                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                                  : 'border-stone-300 bg-stone-50 hover:border-stone-400'
                                              }`}
                                            >
                                              {isCorrect && <Check className="h-3 w-3 stroke-[3]" />}
                                            </button>

                                            <span className="text-[11px] font-bold text-stone-400">
                                              {String.fromCharCode(65 + optIdx)}.
                                            </span>

                                            <input
                                              type="text"
                                              value={opt}
                                              placeholder={`Choice ${optIdx + 1}`}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                const curr = [
                                                  ...(block.options && block.options.length > 0
                                                    ? block.options
                                                    : ['Option 1', 'Option 2', 'Option 3']),
                                                ];
                                                curr[optIdx] = val;
                                                setBlocks((prev) =>
                                                  prev.map((b, i) =>
                                                    i === idx && b.type === 'quiz_checkpoint'
                                                      ? { ...b, options: curr }
                                                      : b
                                                  )
                                                );
                                              }}
                                              className="flex-1 bg-transparent text-xs text-stone-900 focus:outline-hidden"
                                            />

                                            {(block.options ?? []).length > 2 && (
                                              <button
                                                type="button"
                                                title="Remove Choice"
                                                onClick={() => {
                                                  const curr = (block.options ?? []).filter((_, oIdx) => oIdx !== optIdx);
                                                  let nextCorrect = block.correctAnswerIndex ?? 0;
                                                  if (nextCorrect >= curr.length) {
                                                    nextCorrect = Math.max(0, curr.length - 1);
                                                  }
                                                  setBlocks((prev) =>
                                                    prev.map((b, i) =>
                                                      i === idx && b.type === 'quiz_checkpoint'
                                                        ? { ...b, options: curr, correctAnswerIndex: nextCorrect }
                                                        : b
                                                    )
                                                  );
                                                }}
                                                className="p-1 text-stone-400 hover:text-red-500 rounded-md transition-colors"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[11px] font-semibold text-stone-700">
                                      Explanation / Feedback (shown to student after answering)
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. useState returns a stateful value and a function to update it."
                                      value={block.explanation ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setBlocks((prev) =>
                                          prev.map((b, i) =>
                                            i === idx && b.type === 'quiz_checkpoint'
                                              ? { ...b, explanation: val }
                                              : b
                                          )
                                        );
                                      }}
                                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2 pt-1 border-t border-purple-100/60">
                                    <input
                                      type="checkbox"
                                      id={`req-${block.id}`}
                                      checked={block.requiredToPass ?? false}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setBlocks((prev) =>
                                          prev.map((b, i) =>
                                            i === idx && b.type === 'quiz_checkpoint'
                                              ? { ...b, requiredToPass: checked }
                                              : b
                                          )
                                        );
                                      }}
                                      className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                                    />
                                    <label htmlFor={`req-${block.id}`} className="text-xs text-stone-700 cursor-pointer select-none">
                                      Student must answer correctly to satisfy lesson progress
                                    </label>
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
                                      className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
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
                          )}
                        </div>

                        {/* Inserter directly after each block */}
                        <BetweenBlockInserter insertIdx={idx + 1} />
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
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
