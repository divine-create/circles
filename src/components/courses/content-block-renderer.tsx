'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  Code,
  Copy,
  Check,
  MessageSquare,
  Video,
  Award,
  HelpCircle,
  ExternalLink,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode,
  CheckCircle2,
  Terminal,
  Info,
  AlertTriangle,
  Lightbulb,
  X,
} from 'lucide-react';
import { LessonContentBlock } from '@/types/domain';
import { Button } from '@/components/ui/button';

interface ContentBlockRendererProps {
  blocks: LessonContentBlock[];
  circleSlug: string;
  isStaff?: boolean;
  onLaunchQuiz?: (quizId: string) => void;
}

// Lightweight, safe markdown formatter for rich text blocks
function formatInlineMarkdown(text: string): React.ReactNode {
  // Split on code, bold, italic
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={key++}
          className="rounded-md bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-900 border border-stone-200/80"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-bold text-stone-900">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(
        <em key={key++} className="italic text-stone-700">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Plain text up to next token
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return <>{parts}</>;
}

export function ContentBlockRenderer({
  blocks,
  circleSlug,
  isStaff: _isStaff = false,
  onLaunchQuiz,
}: ContentBlockRendererProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [checkedObjectives, setCheckedObjectives] = useState<Record<string, boolean>>({});
  const [inlineQuizAnswers, setInlineQuizAnswers] = useState<
    Record<string, { selectedIndex: number | null; isSubmitted: boolean }>
  >({});

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSolution = (id: string) => {
    setRevealedSolutions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleObjective = (key: string) => {
    setCheckedObjectives((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  function getEmbedUrl(url: string): string | null {
    if (!url) return null;
    const ytMatch = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    const vimeoMatch = url.match(
      /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/
    );
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

    return null;
  }

  function isDirectVideoFile(url: string): boolean {
    if (!url) return false;
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  }

  function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
  }

  if (!blocks || blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 p-8 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-stone-400 mb-2" />
        <p className="text-xs font-medium text-stone-600">No content blocks configured for this lesson.</p>
        <p className="mt-0.5 text-[11px] text-stone-400">Instructors can add rich text, videos, code, and quizzes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'video': {
            const embed = getEmbedUrl(block.url);
            const isDirectVideo = isDirectVideoFile(block.url);

            return (
              <div
                key={block.id || idx}
                className="group overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-900 shadow-sm transition-all hover:border-stone-300"
              >
                {/* Video Header Bar if Title exists */}
                {block.title && (
                  <div className="flex items-center justify-between border-b border-stone-800 bg-stone-950/80 px-4 py-2.5 text-xs text-stone-300">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/10 text-rose-400">
                        <Video className="h-3 w-3" />
                      </span>
                      <span className="font-semibold text-stone-200">{block.title}</span>
                    </div>
                    {block.durationSec && (
                      <span className="font-mono text-[10px] text-stone-400">
                        {Math.floor(block.durationSec / 60)}:
                        {(block.durationSec % 60).toString().padStart(2, '0')} min
                      </span>
                    )}
                  </div>
                )}

                {embed ? (
                  <div className="relative w-full aspect-video bg-black">
                    <iframe
                      src={embed}
                      title={block.title || 'Lesson Video'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  </div>
                ) : isDirectVideo ? (
                  <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                    <video
                      src={block.url}
                      controls
                      className="h-full w-full object-contain"
                      preload="metadata"
                    >
                      Your browser does not support HTML5 video playback.
                    </video>
                  </div>
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center bg-gradient-to-b from-stone-900 to-black p-6 text-center text-white">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-800/80 text-rose-400 border border-stone-700/60 mb-3 shadow-inner">
                      <Video className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-100">{block.title || 'External Video Stream'}</h4>
                    <p className="mt-1 max-w-sm text-xs text-stone-400">
                      This lesson contains an external video player resource.
                    </p>
                    <a
                      href={block.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-stone-100 transition-colors shadow-xs"
                    >
                      <span>Open Video in New Tab</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          }

          case 'rich_text': {
            const paragraphs = block.markdown.split(/\n\n+/);

            return (
              <div
                key={block.id || idx}
                className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs text-stone-800 space-y-4 leading-relaxed"
              >
                {paragraphs.map((p, pIdx) => {
                  const trimmed = p.trim();

                  // Horizontal rule
                  if (trimmed === '---' || trimmed === '***') {
                    return <hr key={pIdx} className="my-4 border-stone-200" />;
                  }

                  // H1
                  if (trimmed.startsWith('# ')) {
                    return (
                      <h2
                        key={pIdx}
                        className="text-xl font-bold tracking-tight text-stone-900 border-b border-stone-100 pb-2.5 pt-1"
                      >
                        {formatInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
                      </h2>
                    );
                  }

                  // H2
                  if (trimmed.startsWith('## ')) {
                    return (
                      <h3 key={pIdx} className="text-lg font-bold text-stone-900 pt-2">
                        {formatInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
                      </h3>
                    );
                  }

                  // H3
                  if (trimmed.startsWith('### ')) {
                    return (
                      <h4 key={pIdx} className="text-sm font-bold text-stone-900 uppercase tracking-wide text-emerald-900 pt-1">
                        {formatInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
                      </h4>
                    );
                  }

                  // Callout: Note / Tip / Warning
                  if (trimmed.startsWith('> [!NOTE]') || trimmed.startsWith('> [!TIP]')) {
                    const content = trimmed.replace(/^>\s*\[!(NOTE|TIP)\]\s*/i, '');
                    return (
                      <div
                        key={pIdx}
                        className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950"
                      >
                        <Lightbulb className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
                        <div>{formatInlineMarkdown(content)}</div>
                      </div>
                    );
                  }

                  if (trimmed.startsWith('> [!WARNING]') || trimmed.startsWith('> [!IMPORTANT]')) {
                    const content = trimmed.replace(/^>\s*\[!(WARNING|IMPORTANT)\]\s*/i, '');
                    return (
                      <div
                        key={pIdx}
                        className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                        <div>{formatInlineMarkdown(content)}</div>
                      </div>
                    );
                  }

                  // Blockquote
                  if (trimmed.startsWith('> ')) {
                    const quote = trimmed.replace(/^>\s*/, '');
                    return (
                      <blockquote
                        key={pIdx}
                        className="border-l-4 border-emerald-700 bg-stone-50/70 py-2.5 px-4 rounded-r-xl text-xs text-stone-700 italic"
                      >
                        {formatInlineMarkdown(quote)}
                      </blockquote>
                    );
                  }

                  // Unordered list
                  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    const items = trimmed.split('\n').filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '));
                    return (
                      <ul key={pIdx} className="space-y-1.5 pl-1 text-xs text-stone-700">
                        {items.map((item, iIdx) => (
                          <li key={iIdx} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-700" />
                            <span>{formatInlineMarkdown(item.replace(/^[-*]\s+/, ''))}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  // Numbered list
                  if (/^\d+\.\s+/.test(trimmed)) {
                    const items = trimmed.split('\n').filter((l) => /^\d+\.\s+/.test(l.trim()));
                    return (
                      <ol key={pIdx} className="space-y-1.5 pl-1 text-xs text-stone-700">
                        {items.map((item, iIdx) => {
                          const numMatch = item.match(/^(\d+)\.\s+/);
                          const num = numMatch ? numMatch[1] : `${iIdx + 1}`;
                          return (
                            <li key={iIdx} className="flex items-start gap-2.5">
                              <span className="font-mono text-[10px] font-bold text-stone-500 mt-0.5">
                                {num}.
                              </span>
                              <span>{formatInlineMarkdown(item.replace(/^\d+\.\s+/, ''))}</span>
                            </li>
                          );
                        })}
                      </ol>
                    );
                  }

                  // Standard paragraph
                  return (
                    <p key={pIdx} className="text-xs text-stone-700 leading-relaxed">
                      {formatInlineMarkdown(trimmed)}
                    </p>
                  );
                })}
              </div>
            );
          }

          case 'code_sandbox': {
            const hasCopied = copiedId === block.id;
            const isSolutionOpen = revealedSolutions[block.id] || false;

            return (
              <div
                key={block.id || idx}
                className="overflow-hidden rounded-2xl border border-stone-800 bg-[#0e1117] shadow-sm text-stone-100"
              >
                {/* Terminal Mac-style Header */}
                <div className="flex items-center justify-between border-b border-stone-800 bg-[#161b22] px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {/* Window Controls */}
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-stone-300">
                      <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="uppercase tracking-wider">{block.language || 'typescript'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(block.id, block.starterCode)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-[11px] font-medium text-stone-300 hover:bg-stone-700 hover:text-white transition-colors"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Instructions bubble if present */}
                {block.instructions && (
                  <div className="border-b border-stone-800/80 bg-stone-900/60 px-4 py-3 flex items-start gap-2.5 text-xs text-stone-300">
                    <Info className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <p className="leading-relaxed">{block.instructions}</p>
                  </div>
                )}

                {/* Code Body */}
                <div className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-emerald-300">
                  <pre className="selection:bg-emerald-800 selection:text-white">{block.starterCode}</pre>
                </div>

                {/* Solution Drawer */}
                {block.solutionCode && (
                  <div className="border-t border-stone-800 bg-[#161b22]/50 p-3">
                    <button
                      type="button"
                      onClick={() => toggleSolution(block.id)}
                      className="flex items-center justify-between w-full text-left text-xs font-semibold text-stone-300 hover:text-white transition-colors px-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <Code className="h-3.5 w-3.5 text-amber-400" />
                        {isSolutionOpen ? 'Hide Reference Solution' : 'Reveal Reference Solution & Walkthrough'}
                      </span>
                      {isSolutionOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                      )}
                    </button>

                    {isSolutionOpen && (
                      <div className="mt-3 overflow-x-auto rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 font-mono text-xs leading-relaxed text-amber-200">
                        <pre className="selection:bg-amber-800 selection:text-white">{block.solutionCode}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          case 'file_asset': {
            const ext = getFileExtension(block.title || block.fileUrl);

            return (
              <div
                key={block.id || idx}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs transition-all hover:border-stone-300"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700 border border-stone-200/80 group-hover:bg-emerald-50 group-hover:text-emerald-800 group-hover:border-emerald-200 transition-colors">
                    {ext === 'PY' || ext === 'TS' || ext === 'JS' ? (
                      <FileCode className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{block.title}</h4>
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-stone-600">
                        {ext}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      {block.mimeType || 'Downloadable Course Material'}{' '}
                      {block.fileSize && `· ${block.fileSize}`}
                    </p>
                  </div>
                </div>

                <a
                  href={block.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Resource</span>
                </a>
              </div>
            );
          }

          case 'reflection_checkpoint': {
            const objectives = block.objectives || [];
            const total = objectives.length;
            const completedCount = objectives.filter(
              (_, oIdx) => checkedObjectives[`${block.id}-${oIdx}`]
            ).length;
            const percent = total > 0 ? Math.round((completedCount / total) * 100) : 100;
            const allDone = total > 0 && completedCount === total;

            return (
              <div
                key={block.id || idx}
                className={`rounded-2xl border p-5 shadow-xs transition-all space-y-4 ${
                  allDone
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-stone-200/90 bg-white'
                }`}
              >
                {/* Header with Progress Bar */}
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                      <Award className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                      Key Learning Objectives & Self-Check
                    </span>
                  </div>

                  {total > 0 && (
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-[10px] font-bold text-stone-700">
                      {completedCount}/{total} Completed ({percent}%)
                    </span>
                  )}
                </div>

                {/* Reflection Prompt */}
                <p className="text-xs text-stone-700 leading-relaxed font-medium">
                  {block.prompt}
                </p>

                {/* Mini Progress Bar */}
                {total > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}

                {/* Milestone Checkboxes */}
                {total > 0 && (
                  <div className="space-y-2 pt-1">
                    {objectives.map((obj, oIdx) => {
                      const key = `${block.id}-${oIdx}`;
                      const isDone = checkedObjectives[key] || false;
                      return (
                        <label
                          key={oIdx}
                          className={`flex items-start gap-3 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${
                            isDone
                              ? 'border-emerald-200 bg-emerald-50/50 text-stone-500'
                              : 'border-stone-100 bg-stone-50/50 text-stone-800 hover:border-stone-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleObjective(key)}
                            className="mt-0.5 rounded border-stone-300 text-emerald-700 focus:ring-0"
                          />
                          <span className={isDone ? 'line-through text-stone-400' : 'font-medium'}>
                            {obj}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {allDone && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-100/60 p-3 text-xs text-emerald-900 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span className="font-semibold">
                      Awesome! You have completed all learning objectives for this lesson.
                    </span>
                  </div>
                )}
              </div>
            );
          }

          case 'quiz_checkpoint': {
            const hasInlineQuestion = Boolean(block.question || (block.options && block.options.length > 0));

            if (!hasInlineQuestion) {
              return (
                <div
                  key={block.id || idx}
                  className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-stone-50 p-6 shadow-xs transition-all hover:border-emerald-300"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-800 text-white shadow-xs">
                          <HelpCircle className="h-3 w-3" />
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                          Knowledge Assessment Checkpoint
                        </span>
                        {block.requiredToPass && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-200">
                            Required
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-stone-900">
                        {block.quizTitle || 'Knowledge Check Quiz'}
                      </h4>
                      {block.passingScore && (
                        <p className="text-xs text-stone-600">
                          Passing threshold required to certify: <strong>{block.passingScore}%</strong>
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => onLaunchQuiz?.(block.quizId || '')}
                      className="rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 px-5 shrink-0 shadow-xs"
                    >
                      Start Assessment
                    </Button>
                  </div>
                </div>
              );
            }

            // Inline Micro-Quiz / Quick Knowledge Check
            const blockId = block.id || `quiz-${idx}`;
            const state = inlineQuizAnswers[blockId] || { selectedIndex: null, isSubmitted: false };
            const isAnswered = state.selectedIndex !== null;
            const isCorrect = isAnswered && state.selectedIndex === (block.correctAnswerIndex ?? 0);
            const options =
              block.options && block.options.length > 0 ? block.options : ['Option 1', 'Option 2'];

            return (
              <div
                key={blockId}
                className="overflow-hidden rounded-2xl border border-purple-200/80 bg-white p-6 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-purple-800">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                      Quick Knowledge Check
                    </span>
                    {block.requiredToPass && (
                      <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
                        Required
                      </span>
                    )}
                  </div>
                  {isAnswered && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold ${
                        isCorrect ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Correct!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <span>Try again</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-stone-900">
                  {block.question || 'Knowledge Check Question'}
                </p>

                {/* Choices list */}
                <div className="space-y-2">
                  {options.map((opt, optIdx) => {
                    const isSelected = state.selectedIndex === optIdx;
                    let optionStyle =
                      'border-stone-200 bg-stone-50/50 hover:bg-stone-100/80 hover:border-stone-300 text-stone-800';

                    if (isAnswered) {
                      if (isSelected) {
                        optionStyle = isCorrect
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-400 font-medium'
                          : 'border-red-400 bg-red-50 text-red-900 ring-1 ring-red-300';
                      } else if (state.isSubmitted && optIdx === (block.correctAnswerIndex ?? 0)) {
                        optionStyle = 'border-emerald-400 bg-emerald-50/60 text-emerald-900';
                      } else {
                        optionStyle = 'border-stone-100 bg-stone-50/30 text-stone-400 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          setInlineQuizAnswers((prev) => ({
                            ...prev,
                            [blockId]: {
                              selectedIndex: optIdx,
                              isSubmitted: true,
                            },
                          }));
                        }}
                        className={`w-full flex items-center justify-between rounded-xl border p-3 text-left text-xs transition-all ${optionStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              isSelected
                                ? isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-red-600 text-white'
                                : 'bg-stone-200/70 text-stone-700'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{opt}</span>
                        </div>

                        {isSelected && isCorrect && (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                        {isSelected && !isCorrect && (
                          <X className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation / Feedback */}
                {isAnswered && (
                  <div
                    className={`rounded-xl border p-3.5 text-xs transition-all ${
                      isCorrect
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                        : 'border-amber-200 bg-amber-50/70 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <Sparkles className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5" />
                      ) : (
                        <Info className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="font-bold">
                          {isCorrect ? 'Well done!' : 'Not quite right.'}
                        </p>
                        {block.explanation ? (
                          <p className="text-stone-700">{block.explanation}</p>
                        ) : !isCorrect ? (
                          <p className="text-stone-700">Click another option to try again.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          case 'discussion_prompt': {
            return (
              <div
                key={block.id || idx}
                className="rounded-2xl border border-stone-200/90 bg-stone-50/60 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-stone-900 text-white">
                      <MessageSquare className="h-3 w-3" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                      Community Discussion Topic
                    </span>
                  </div>
                  <span className="rounded bg-stone-200/70 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                    Peer Feedback
                  </span>
                </div>

                <div className="rounded-xl border border-stone-200/80 bg-white p-3.5">
                  <p className="text-xs text-stone-800 leading-relaxed italic">
                    &ldquo;{block.prompt}&rdquo;
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <Link
                    href={`/circles/${circleSlug}/discussions`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition-colors shadow-xs"
                  >
                    <span>Discuss in Community Feed</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          }

          case 'live_session': {
            const dateStr = new Date(block.scheduledAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div
                key={block.id || idx}
                className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-sky-50/40 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-700 text-white">
                      <Video className="h-3 w-3" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-950">
                      Synchronized Cohort Workshop
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-900 border border-blue-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Live Session
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-stone-700">
                  <Calendar className="h-4 w-4 text-blue-700 shrink-0" />
                  <span>
                    Scheduled: <strong className="text-stone-900">{dateStr}</strong>
                    {block.timezone && ` (${block.timezone})`}
                    {block.hostName && ` · Hosted by ${block.hostName}`}
                  </span>
                </div>

                <a
                  href={block.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors shadow-xs"
                >
                  <span>Join Live Video Room</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
