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
} from 'lucide-react';
import { LessonContentBlock } from '@/types/domain';
import { Button } from '@/components/ui/button';

interface ContentBlockRendererProps {
  blocks: LessonContentBlock[];
  circleSlug: string;
  onLaunchQuiz?: (quizId: string) => void;
}

export function ContentBlockRenderer({
  blocks,
  circleSlug,
  onLaunchQuiz,
}: ContentBlockRendererProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [checkedObjectives, setCheckedObjectives] = useState<Record<string, boolean>>({});

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

    return url;
  }

  if (!blocks || blocks.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-stone-500 italic">
        No content blocks added to this lesson yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        switch (block.type) {
          case 'video': {
            const embed = getEmbedUrl(block.url);
            return (
              <div key={block.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-black shadow-xs">
                {embed ? (
                  <div className="relative w-full aspect-video">
                    <iframe
                      src={embed}
                      title={block.title || 'Lesson Video'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center p-6 text-center text-white">
                    <div>
                      <Video className="mx-auto h-8 w-8 text-stone-500 mb-2" />
                      <p className="text-xs text-stone-400">Custom Video Source</p>
                      <a
                        href={block.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                      >
                        Watch External Video <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          case 'rich_text': {
            return (
              <div
                key={block.id}
                className="prose prose-stone max-w-none rounded-2xl border border-stone-100 bg-white p-6 shadow-xs text-sm text-stone-800 leading-relaxed space-y-3"
              >
                {block.markdown.split('\n\n').map((paragraph, pIdx) => {
                  if (paragraph.startsWith('# ')) {
                    return (
                      <h2 key={pIdx} className="text-lg font-bold text-stone-900 border-b border-stone-100 pb-2">
                        {paragraph.replace('# ', '')}
                      </h2>
                    );
                  }
                  if (paragraph.startsWith('## ')) {
                    return (
                      <h3 key={pIdx} className="text-base font-bold text-stone-900">
                        {paragraph.replace('## ', '')}
                      </h3>
                    );
                  }
                  if (paragraph.startsWith('- ')) {
                    const items = paragraph.split('\n').map((i) => i.replace(/^- /, ''));
                    return (
                      <ul key={pIdx} className="list-disc pl-5 space-y-1 text-stone-700">
                        {items.map((item, iIdx) => (
                          <li key={iIdx}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  return <p key={pIdx}>{paragraph}</p>;
                })}
              </div>
            );
          }

          case 'code_sandbox': {
            const hasCopied = copiedId === block.id;
            const isSolutionOpen = revealedSolutions[block.id] || false;
            return (
              <div key={block.id} className="rounded-2xl border border-stone-800 bg-stone-950 p-5 shadow-xs text-white space-y-3">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-emerald-400" />
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-stone-300">
                      {block.language || 'Code Exercise'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(block.id, block.starterCode)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1 text-[11px] font-medium text-stone-300 hover:bg-stone-800 transition-colors"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                {block.instructions && (
                  <p className="text-xs text-stone-400 font-sans leading-relaxed">
                    {block.instructions}
                  </p>
                )}

                <div className="overflow-x-auto rounded-xl bg-black/60 p-4 font-mono text-xs leading-relaxed text-emerald-300">
                  <pre>{block.starterCode}</pre>
                </div>

                {block.solutionCode && (
                  <div className="pt-2 border-t border-stone-800">
                    <button
                      type="button"
                      onClick={() => toggleSolution(block.id)}
                      className="text-xs text-stone-400 hover:text-white underline font-medium"
                    >
                      {isSolutionOpen ? 'Hide Solution' : 'Reveal Solution & Discussion'}
                    </button>
                    {isSolutionOpen && (
                      <div className="mt-3 overflow-x-auto rounded-xl bg-emerald-950/30 border border-emerald-900/40 p-4 font-mono text-xs leading-relaxed text-emerald-200 animate-in fade-in duration-200">
                        <pre>{block.solutionCode}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          case 'file_asset': {
            return (
              <div
                key={block.id}
                className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">{block.title}</h4>
                    <p className="text-[11px] text-stone-500">
                      {block.mimeType || 'Downloadable resource'} {block.fileSize && `· ${block.fileSize}`}
                    </p>
                  </div>
                </div>
                <a
                  href={block.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition-colors shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </div>
            );
          }

          case 'discussion_prompt': {
            return (
              <div
                key={block.id}
                className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center gap-2 text-stone-900">
                  <MessageSquare className="h-4 w-4 text-emerald-800" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Community Discussion Prompt
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed italic">
                  &ldquo;{block.prompt}&rdquo;
                </p>
                <Link
                  href={`/circles/${circleSlug}/discussions`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
                >
                  <span>Share thoughts in community</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            );
          }

          case 'live_session': {
            return (
              <div
                key={block.id}
                className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-blue-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                      Live Workshop / Office Hours
                    </span>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-900">
                    Live Session
                  </span>
                </div>
                <p className="text-xs text-stone-700">
                  Scheduled for:{' '}
                  <strong className="text-stone-900">
                    {new Date(block.scheduledAt).toLocaleString()}
                  </strong>{' '}
                  {block.timezone && `(${block.timezone})`}
                  {block.hostName && ` · Hosted by ${block.hostName}`}
                </p>
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

          case 'reflection_checkpoint': {
            return (
              <div
                key={block.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-900">
                    Key Learning Objectives & Reflection
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed">{block.prompt}</p>

                {block.objectives && block.objectives.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                      Self-check milestones:
                    </p>
                    <div className="space-y-1.5">
                      {block.objectives.map((obj, oIdx) => {
                        const key = `${block.id}-${oIdx}`;
                        const isDone = checkedObjectives[key] || false;
                        return (
                          <label
                            key={oIdx}
                            className="flex items-center gap-2.5 text-xs text-stone-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => toggleObjective(key)}
                              className="rounded border-stone-300 text-stone-900 focus:ring-0"
                            />
                            <span className={isDone ? 'line-through text-stone-400' : ''}>{obj}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          case 'quiz_checkpoint': {
            return (
              <div
                key={block.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-emerald-800" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Assessment Checkpoint
                    </span>
                    {block.requiredToPass && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                        Required to Unlock Next Lesson
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {block.quizTitle || 'Knowledge Check Quiz'}
                  </h4>
                  {block.passingScore && (
                    <p className="text-xs text-stone-600">
                      Passing grade required: <strong>{block.passingScore}%</strong>
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => onLaunchQuiz?.(block.quizId)}
                  className="rounded-xl bg-emerald-900 text-white text-xs font-semibold hover:bg-emerald-950 px-5 shrink-0"
                >
                  Start Assessment
                </Button>
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
