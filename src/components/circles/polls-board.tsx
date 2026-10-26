'use client';

import React, { useState } from 'react';
import { BarChart2, CheckCircle2, Lock, Plus } from 'lucide-react';
import { CirclePollItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export function PollsBoard({
  circleId,
  initialPolls,
  isMember,
}: {
  circleId: string;
  initialPolls: CirclePollItem[];
  isMember: boolean;
}) {
  const [polls, setPolls] = useState<CirclePollItem[]>(initialPolls);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [resultsVisibility, setResultsVisibility] = useState<
    'always' | 'after_vote' | 'after_close'
  >('always');
  const [optionLines, setOptionLines] = useState('Approve Proposal\nRequest Revisions\nAbstain');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const options = optionLines
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/circles/${circleId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          description,
          allowMultiple,
          resultsVisibility,
          options,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create poll.');
      }
      setPolls((prev) => [data.poll, ...prev]);
      setQuestion('');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create poll.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(pollId: string, optionId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          pollId,
          optionIds: [optionId],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to record vote.');
      }
      setPolls((prev) => prev.map((p) => (p.id === pollId ? data.poll : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cast vote.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Polls & Decisions</h2>
            <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-forest-800 border border-forest-200/60">
              {polls.length} POLLS
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Formal member voting with trigger-backed duplicate protection and decision records.
          </p>
        </div>
        {isMember && (
          <Button
            size="sm"
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showCreate ? 'Cancel' : 'Launch Poll'}</span>
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreatePoll}
          className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-premium space-y-4"
        >
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Create New Member Poll
            </h3>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Poll Question *
            </label>
            <input
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Should we host our next hackathon in person or hybrid?"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Context & Decision Criteria
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, budget constraints, or timing context..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Results Visibility
              </label>
              <select
                value={resultsVisibility}
                onChange={(e) =>
                  setResultsVisibility(
                    e.target.value as 'always' | 'after_vote' | 'after_close'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              >
                <option value="always">Always Visible (Real-time)</option>
                <option value="after_vote">Visible Only After Member Votes</option>
                <option value="after_close">Visible Only After Poll Closes</option>
              </select>
            </div>
            <div className="flex items-center pt-6">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  className="rounded border-stone-300 text-forest-700 focus:ring-forest-600"
                />
                <span>Allow selecting multiple choices</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Poll Options (One per line, minimum 2) *
            </label>
            <textarea
              rows={3}
              required
              value={optionLines}
              onChange={(e) => setOptionLines(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 font-mono text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Publishing...' : 'Launch Poll'}
            </Button>
          </div>
        </form>
      )}

      {polls.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <BarChart2 className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">No Polls Created Yet</h3>
          <p className="mt-1 text-xs text-stone-500">
            Launch a poll to gather structured input and reach community consensus.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <div
              key={poll.id}
              className="group rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-forest-800 border border-forest-200/60">
                    {poll.status} · {poll.allow_multiple ? 'MULTI' : 'SINGLE'}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">
                    Visibility: {poll.results_visibility.replace('_', ' ')}
                  </span>
                </div>
                {poll.decision_summary && (
                  <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[10px] font-mono font-bold text-white border border-zinc-900">
                    DECISION RECORDED
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                  {poll.question}
                </h3>
                {poll.description && (
                  <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                    {poll.description}
                  </p>
                )}
              </div>

              {/* Linear-Style Option Buttons with Percentage Progress Fill */}
              <div className="space-y-2">
                {poll.options.map((opt) => {
                  const percentage = opt.percentage ?? 0;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!isMember || poll.status !== 'open' || opt.viewer_voted}
                      onClick={() => handleVote(poll.id, opt.id)}
                      className={`relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all ${
                        opt.viewer_voted
                          ? 'border-forest-600 bg-forest-50/50 shadow-xs'
                          : 'border-stone-200/90 bg-stone-50/40 hover:border-forest-400 hover:bg-stone-50'
                      }`}
                    >
                      {/* Sub-surface progress fill */}
                      {poll.results_visible_to_viewer && (
                        <div
                          className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                            opt.viewer_voted ? 'bg-zinc-900/15' : 'bg-stone-200/40'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      )}

                      <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm font-medium text-stone-900">
                        <span className="inline-flex items-center gap-2 font-medium">
                          {opt.viewer_voted && (
                            <CheckCircle2 className="h-4 w-4 text-black shrink-0" />
                          )}
                          <span>{opt.label}</span>
                        </span>
                        {poll.results_visible_to_viewer ? (
                          <span className="text-[11px] font-mono font-semibold text-stone-600 ml-2">
                            {opt.vote_count ?? 0} votes ({percentage}%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Hidden until voted
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {poll.decision_summary && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-3.5 text-xs text-zinc-900">
                  <span className="font-mono font-bold uppercase tracking-wider text-[10px] text-zinc-900 block mb-0.5">
                    Official Decision Record
                  </span>
                  {poll.decision_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
