'use client';

import React, { useState } from 'react';
import { Award, Heart, LifeBuoy, Lock, Plus, Shield } from 'lucide-react';
import {
  CommunityChallengeItem,
  FundraisingCampaignItem,
  GovernanceProposalItem,
  SupportTicketItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';

export function CommunityHubBoard({
  circleId,
  initialTab,
  initialProposals,
  initialCampaigns,
  initialChallenges,
  initialTickets,
  isMember,
  isStaff,
}: {
  circleId: string;
  initialTab: 'governance' | 'causes' | 'challenges' | 'support';
  initialProposals: GovernanceProposalItem[];
  initialCampaigns: FundraisingCampaignItem[];
  initialChallenges: CommunityChallengeItem[];
  initialTickets: SupportTicketItem[];
  isMember: boolean;
  isStaff: boolean;
}) {
  const [activeTab, setActiveTab] = useState<
    'governance' | 'causes' | 'challenges' | 'support'
  >(initialTab);
  const [proposals, setProposals] =
    useState<GovernanceProposalItem[]>(initialProposals);
  const [campaigns, setCampaigns] =
    useState<FundraisingCampaignItem[]>(initialCampaigns);
  const [challenges, setChallenges] =
    useState<CommunityChallengeItem[]>(initialChallenges);
  const [tickets, setTickets] = useState<SupportTicketItem[]>(initialTickets);
  const [error, setError] = useState<string | null>(null);

  // Proposal form
  const [propTitle, setPropTitle] = useState('');
  const [propBody, setPropBody] = useState('');

  // Campaign form
  const [campTitle, setCampTitle] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campGoal, setCampGoal] = useState('1000');

  // Challenge form
  const [chalTitle, setChalTitle] = useState('');
  const [chalDesc, setChalDesc] = useState('');
  const [chalBadge, setChalBadge] = useState('Community Builder');

  // Ticket form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPrivate, setTicketPrivate] = useState(true);

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_proposal',
          title: propTitle,
          body: propBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit proposal.');
      setProposals((prev) => [data.proposal, ...prev]);
      setPropTitle('');
      setPropBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit proposal.');
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_campaign',
          title: campTitle,
          description: campDesc,
          goalAmount: Number(campGoal),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to launch campaign.');
      setCampaigns((prev) => [data.campaign, ...prev]);
      setCampTitle('');
      setCampDesc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch campaign.');
    }
  }

  async function handlePledge(campaignId: string) {
    const amountStr = window.prompt('Enter pledge amount intention (e.g. 50.00):', '25.00');
    if (!amountStr || Number(amountStr) <= 0) return;
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_pledge',
          campaignId,
          amount: Number(amountStr),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record pledge.');
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                pledged_total: (c.pledged_total ?? 0) + Number(amountStr),
                pledge_count: (c.pledge_count ?? 0) + 1,
              }
            : c
        )
      );
      alert('Pledge intention recorded. Thank you for supporting the community!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to record pledge.');
    }
  }

  async function handleCreateChallenge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_challenge',
          title: chalTitle,
          description: chalDesc,
          rewardBadgeName: chalBadge,
          rewardPoints: 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create challenge.');
      setChallenges((prev) => [data.challenge, ...prev]);
      setChalTitle('');
      setChalDesc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create challenge.');
    }
  }

  async function handleSubmitChallenge(challengeId: string) {
    const notes = window.prompt('Enter proof or submission notes for this challenge:');
    if (!notes) return;
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_challenge',
          challengeId,
          submissionNotes: notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit entry.');
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId ? { ...c, viewer_submission: data.submission } : c
        )
      );
      alert('Challenge entry submitted for organizer review.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit entry.');
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_ticket',
          subject: ticketSubject,
          description: ticketDesc,
          isPrivate: ticketPrivate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create support ticket.');
      setTickets((prev) => [data.ticket, ...prev]);
      setTicketSubject('');
      setTicketDesc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create ticket.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Linear Sub-Navigation */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            Community Hub
          </h2>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Democratic proposals, fundraising pledge tracking, milestone challenges, and private support desk.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
          {[
            { key: 'governance', label: 'Governance & Proposals', icon: Shield, count: proposals.length },
            { key: 'causes', label: 'Causes & Pledges', icon: Heart, count: campaigns.length },
            { key: 'challenges', label: 'Challenges', icon: Award, count: challenges.length },
            { key: 'support', label: 'Help Desk', icon: LifeBuoy, count: tickets.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab.key as 'governance' | 'causes' | 'challenges' | 'support'
                  )
                }
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'bg-black text-white shadow-xs font-semibold'
                    : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  active ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Governance Tab */}
      {activeTab === 'governance' && (
        <div className="space-y-4">
          {isMember && (
            <form
              onSubmit={handleCreateProposal}
              className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-premium space-y-3"
            >
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                Submit Governance Proposal
              </h3>
              <input
                required
                value={propTitle}
                onChange={(e) => setPropTitle(e.target.value)}
                placeholder="Proposal title (e.g., Adopt Open Hardware Equipment Charter)"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
              <textarea
                required
                rows={2}
                value={propBody}
                onChange={(e) => setPropBody(e.target.value)}
                placeholder="Rationale, scope, and expected budget impact..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
              <div className="flex justify-end">
                <Button size="xs" type="submit">
                  <Plus className="h-3 w-3" />
                  <span>Submit Proposal</span>
                </Button>
              </div>
            </form>
          )}

          {proposals.map((p) => (
            <div
              key={p.id}
              className="group rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-forest-800 border border-forest-200/60">
                  {p.status.replace('_', ' ')}
                </span>
                <span className="text-[11px] font-mono text-stone-400">
                  By {p.proposer?.display_name || 'Member'}
                </span>
              </div>
              <h4 className="text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                {p.title}
              </h4>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                {p.body}
              </p>
              {p.decision_rationale && (
                <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-700 border border-stone-200/60">
                  <strong className="font-semibold text-stone-900">Committee Rationale:</strong>{' '}
                  {p.decision_rationale}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Causes & Pledges Tab */}
      {activeTab === 'causes' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-xs text-stone-600 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-900" />
            <span>
              <strong>Non-Custodial Pledge Tracking:</strong> Pledges record intentions to fund causes. Payment gateway settlement is out of scope.
            </span>
          </div>

          {isStaff && (
            <form
              onSubmit={handleCreateCampaign}
              className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-premium space-y-3"
            >
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                Launch Fundraising Campaign
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  placeholder="Campaign Title"
                  className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
                <input
                  type="number"
                  required
                  min={10}
                  value={campGoal}
                  onChange={(e) => setCampGoal(e.target.value)}
                  placeholder="Goal Amount (e.g. 1500)"
                  className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
              </div>
              <textarea
                required
                rows={2}
                value={campDesc}
                onChange={(e) => setCampDesc(e.target.value)}
                placeholder="Describe how community pledges will be allocated..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
              <div className="flex justify-end">
                <Button size="xs" type="submit">
                  <Plus className="h-3 w-3" />
                  <span>Launch Campaign</span>
                </Button>
              </div>
            </form>
          )}

          {campaigns.map((c) => {
            const ratio = Math.min(
              100,
              Math.round(((c.pledged_total ?? 0) / (c.goal_amount || 1)) * 100)
            );
            return (
              <div
                key={c.id}
                className="group rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                      {c.title}
                    </h4>
                    <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                      {c.description}
                    </p>
                  </div>
                  {isMember && c.status === 'active' && (
                    <Button size="xs" onClick={() => handlePledge(c.id)}>
                      Record Pledge
                    </Button>
                  )}
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs font-mono text-stone-500">
                    <span>
                      {c.currency} {(c.pledged_total ?? 0).toFixed(2)} pledged ({c.pledge_count ?? 0} backers)
                    </span>
                    <span>
                      {ratio}% of {c.currency} {c.goal_amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black rounded-full transition-all"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Challenges & Rewards Tab */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {isStaff && (
            <form
              onSubmit={handleCreateChallenge}
              className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-premium space-y-3"
            >
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                Create Community Challenge
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  required
                  value={chalTitle}
                  onChange={(e) => setChalTitle(e.target.value)}
                  placeholder="e.g. Host 3 Open-Source Workshops"
                  className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
                <input
                  required
                  value={chalBadge}
                  onChange={(e) => setChalBadge(e.target.value)}
                  placeholder="Reward Badge (e.g. Master Mentor)"
                  className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
              </div>
              <textarea
                required
                rows={2}
                value={chalDesc}
                onChange={(e) => setChalDesc(e.target.value)}
                placeholder="Challenge goals and completion criteria..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
              <div className="flex justify-end">
                <Button size="xs" type="submit">
                  <Plus className="h-3 w-3" />
                  <span>Create Challenge</span>
                </Button>
              </div>
            </form>
          )}

          {challenges.map((ch) => (
            <div
              key={ch.id}
              className="group rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900 border border-amber-200/70">
                    Badge: {ch.reward_badge_name} · {ch.reward_points} pts
                  </span>
                  <h4 className="mt-2 text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                    {ch.title}
                  </h4>
                  <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                    {ch.description}
                  </p>
                </div>
                {isMember && (
                  <div>
                    {ch.viewer_submission ? (
                      <span className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-900 border border-zinc-200">
                        Entry: {ch.viewer_submission.status}
                      </span>
                    ) : (
                      <Button size="xs" onClick={() => handleSubmitChallenge(ch.id)}>
                        Submit Entry
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Support / Help Desk Tab */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          {isMember && (
            <form
              onSubmit={handleCreateTicket}
              className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-premium space-y-3"
            >
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                Open Support Request
              </h3>
              <input
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief subject of your question or issue..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
              <textarea
                required
                rows={2}
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
                placeholder="Details of your request..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ticketPrivate}
                    onChange={(e) => setTicketPrivate(e.target.checked)}
                    className="rounded border-stone-300 text-forest-700 focus:ring-forest-600"
                  />
                  <span>Private ticket (visible only to you and Circle staff)</span>
                </label>
                <Button size="xs" type="submit">
                  Submit Request
                </Button>
              </div>
            </form>
          )}

          {tickets.map((t) => (
            <div
              key={t.id}
              className="group rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-forest-800 border border-forest-200/60">
                    {t.status.replace('_', ' ')}
                  </span>
                  {t.is_private && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-400">
                      <Lock className="h-3 w-3" /> Private
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-stone-400">
                  Priority: {t.priority}
                </span>
              </div>
              <h4 className="text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                {t.subject}
              </h4>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                {t.description}
              </p>
              {t.resolution_notes && (
                <div className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-900 border border-zinc-200">
                  <strong>Staff Resolution:</strong> {t.resolution_notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
