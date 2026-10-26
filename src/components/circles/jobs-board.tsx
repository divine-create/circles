'use client';

import React, { useState } from 'react';
import { Briefcase, Building2, CheckCircle2, Lock, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { JobApplicationItem, JobOpportunityItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export function JobsBoard({
  circleId,
  initialOpportunities,
  initialApplications,
  isMember,
}: {
  circleId: string;
  initialOpportunities: JobOpportunityItem[];
  initialApplications: JobApplicationItem[];
  isMember: boolean;
}) {
  const [opportunities, setOpportunities] =
    useState<JobOpportunityItem[]>(initialOpportunities);
  const [applications, setApplications] =
    useState<JobApplicationItem[]>(initialApplications);
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [opportunityType, setOpportunityType] = useState<
    'full_time' | 'part_time' | 'internship' | 'freelance' | 'volunteer' | 'collaboration'
  >('full_time');
  const [workMode, setWorkMode] = useState<'remote' | 'on_site' | 'hybrid'>('remote');
  const [location, setLocation] = useState('');
  const [compensationText, setCompensationText] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          organizationName,
          opportunityType,
          workMode,
          location: location || null,
          compensationText: compensationText || null,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post opportunity.');
      setOpportunities((prev) => [data.opportunity, ...prev]);
      setTitle('');
      setOrganizationName('');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post opportunity.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(opportunityId: string) {
    const coverNote = window.prompt(
      'Enter your application cover note (visible privately only to the opportunity poster and Circle admins):'
    );
    if (!coverNote || coverNote.trim().length < 5) return;
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          opportunityId,
          coverNote: coverNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit application.');
      setApplications((prev) => [data.application, ...prev]);
      setOpportunities((prev) =>
        prev.map((j) =>
          j.id === opportunityId ? { ...j, viewer_application_status: 'submitted' } : j
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit application.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Jobs & Opportunities</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-900 border border-stone-200">
              {opportunities.length} ROLES
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Positions, internships, and project partnerships with strict PostgreSQL RLS candidate privacy.
          </p>
        </div>
        {isMember && (
          <Button
            size="sm"
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showCreate ? 'Cancel' : 'Post Opportunity'}</span>
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
          onSubmit={handleCreateJob}
          className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-premium space-y-4"
        >
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Post an Opportunity
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Job / Project Title *
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Hiring Organization
              </label>
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. AI Research Collective Ltd"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Opportunity Type & Mode
              </label>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={opportunityType}
                  onChange={(e) =>
                    setOpportunityType(
                      e.target.value as
                        | 'full_time'
                        | 'part_time'
                        | 'internship'
                        | 'freelance'
                        | 'volunteer'
                        | 'collaboration'
                    )
                  }
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="full_time">Full-Time</option>
                  <option value="part_time">Part-Time</option>
                  <option value="internship">Internship</option>
                  <option value="freelance">Freelance</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="collaboration">Collaboration</option>
                </select>
                <select
                  value={workMode}
                  onChange={(e) =>
                    setWorkMode(e.target.value as 'remote' | 'on_site' | 'hybrid')
                  }
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on_site">On-Site</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Location & Compensation
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Edinburgh or Remote"
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                />
                <input
                  value={compensationText}
                  onChange={(e) => setCompensationText(e.target.value)}
                  placeholder="£70k–£85k or Paid"
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Description & Requirements *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Responsibilities, experience needed, application steps..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Publishing...' : 'Publish Opportunity'}
            </Button>
          </div>
        </form>
      )}

      {opportunities.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <Briefcase className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">No Opportunities Posted</h3>
          <p className="mt-1 text-xs text-stone-500">
            Post an opening, freelance gig, or project collaboration for members.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((job) => (
            <div
              key={job.id}
              className="group rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs hover:border-black/30 hover:shadow-premium-hover transition-all duration-200 space-y-4"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-900 border border-stone-200">
                      {job.opportunity_type.replace('_', ' ')}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600 border border-stone-200/60">
                      {job.work_mode.replace('_', ' ')}
                    </span>
                    {job.compensation_text && (
                      <span className="text-xs font-mono font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                        {job.compensation_text}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-base font-bold text-stone-900 group-hover:text-black transition-colors">
                    {job.title}
                  </h3>
                  {job.organization_name && (
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 mt-0.5">
                      <Building2 className="h-3.5 w-3.5 text-stone-400" />
                      <span>{job.organization_name}</span>
                    </p>
                  )}
                  <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                    {job.description}
                  </p>
                </div>

                {isMember && job.status === 'open' && (
                  <div className="shrink-0">
                    {job.viewer_application_status ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white border border-zinc-900">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Applied</span>
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleApply(job.id)}>
                        Apply Privately
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-stone-100 pt-3 text-xs text-stone-400">
                <span>Posted by {job.poster?.display_name || 'Member'}</span>
                {job.location && (
                  <span className="inline-flex items-center gap-1 text-stone-400">
                    <MapPin className="h-3 w-3" />
                    {job.location}
                  </span>
                )}
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-zinc-700">
                  <ShieldCheck className="h-3 w-3" />
                  RLS Protected
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {applications.length > 0 && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
              Applications ({applications.length})
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-400">
              <Lock className="h-3 w-3 text-stone-400" />
              Private Candidate Records
            </span>
          </div>
          <div className="divide-y divide-stone-100 text-xs">
            {applications.map((app) => (
              <div key={app.id} className="py-2.5 flex justify-between gap-4">
                <div>
                  <p className="font-semibold text-stone-900">
                    {app.opportunity_title || 'Opportunity'} — Candidate:{' '}
                    {app.applicant?.display_name || 'Member'}
                  </p>
                  <p className="mt-0.5 text-stone-500 font-normal">{app.cover_note}</p>
                </div>
                <span className="self-start rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-stone-900">
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
