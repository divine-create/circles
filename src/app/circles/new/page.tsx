'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Check, Globe, Lock, PlusCircle, Shield } from 'lucide-react';
import { CIRCLE_TEMPLATES } from '@/features/templates/registry';
import { CircleCategory, CircleVisibility, MembershipPolicy } from '@/types/domain';

export default function CreateCirclePage() {
  const router = useRouter();
  const templates = Object.values(CIRCLE_TEMPLATES);

  const [selectedTemplate, setSelectedTemplate] = useState<string>('university');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CircleCategory>('university');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<CircleVisibility>('public');
  const [membershipPolicy, setMembershipPolicy] = useState<MembershipPolicy>('open');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSelectTemplate(key: string) {
    setSelectedTemplate(key);
    const tpl = CIRCLE_TEMPLATES[key];
    if (tpl) {
      setCategory(tpl.category);
      setVisibility(tpl.defaultVisibility);
      setMembershipPolicy(tpl.defaultMembershipPolicy);
      if (!description) {
        setDescription(tpl.summary);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug.trim() || undefined,
          description,
          category,
          location: location.trim() || null,
          visibility,
          membershipPolicy,
          templateKey: selectedTemplate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to create Circle.');
        return;
      }
      router.push(`/circles/${data.circle.slug}`);
      router.refresh();
    } catch {
      setError('Network error while creating Circle.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="border-b border-stone-200/80 pb-6">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-900">
          <PlusCircle className="h-3.5 w-3.5" />
          <span>New Community Setup</span>
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
          Create a New Circle
        </h1>
        <p className="mt-1.5 text-sm text-stone-600 max-w-2xl">
          Choose a blueprint to auto-configure spaces and capabilities. You can fully customize
          and toggle every module later in Circle Studio.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Template Selection */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
              1
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Select a Blueprint
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((tpl) => {
              const active = selectedTemplate === tpl.key;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.key)}
                  className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-black bg-stone-50 shadow-xs ring-1 ring-black'
                      : 'border-stone-200 bg-stone-50/40 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-900">
                        {tpl.category.replace('_', ' ')}
                      </span>
                      {active && <Check className="h-3.5 w-3.5 text-black" />}
                    </div>
                    <p className="mt-2 text-sm font-bold text-stone-900">{tpl.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-stone-500 leading-relaxed font-normal">
                      {tpl.summary}
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-stone-200/60 text-[10px] font-mono text-stone-400">
                    {tpl.enabledCapabilities.length} modules · {tpl.suggestedSpaces.length} spaces
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Core Identity */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
              2
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Circle Identity
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="circle-name" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Circle Name *
              </label>
              <input
                id="circle-name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                      .slice(0, 50)
                  );
                }}
                placeholder="e.g. Oxford Robotics & Hardware Collective"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>

            <div>
              <label htmlFor="circle-slug" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Custom URL Slug
              </label>
              <input
                id="circle-slug"
                name="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="oxford-robotics-collective"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="circle-category" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Category
              </label>
              <select
                id="circle-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CircleCategory)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              >
                <option value="university">University</option>
                <option value="neighbourhood">Neighbourhood</option>
                <option value="professional">Professional Network</option>
                <option value="creator">Creator Community</option>
                <option value="learning">Learning Community</option>
                <option value="sports">Sports Club</option>
                <option value="project">Project Team</option>
                <option value="local_business">Local Business</option>
                <option value="general">General Community</option>
              </select>
            </div>

            <div>
              <label htmlFor="circle-location" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Location (Optional)
              </label>
              <input
                id="circle-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Oxford, UK or Worldwide / Remote"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="circle-description" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Purpose & Description
            </label>
            <textarea
              id="circle-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe who this Circle is for and how members collaborate..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
            />
          </div>
        </section>

        {/* Step 3: Visibility & Membership Policy */}
        <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
              3
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Visibility & Access Rules
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setVisibility('public');
                setMembershipPolicy('open');
              }}
              className={`rounded-xl border p-4 text-left transition-all ${
                visibility === 'public'
                  ? 'border-black bg-stone-50 shadow-xs ring-1 ring-black'
                  : 'border-stone-200 bg-stone-50/40 hover:border-stone-300'
              }`}
            >
              <Globe className="h-5 w-5 text-stone-900" />
              <p className="mt-2 text-sm font-bold text-stone-900">Public Community</p>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Listed in discovery. Anyone can preview and join based on your policy.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setVisibility('discoverable_approval');
                setMembershipPolicy('approval');
              }}
              className={`rounded-xl border p-4 text-left transition-all ${
                visibility === 'discoverable_approval'
                  ? 'border-black bg-stone-50 shadow-xs ring-1 ring-black'
                  : 'border-stone-200 bg-stone-50/40 hover:border-stone-300'
              }`}
            >
              <Shield className="h-5 w-5 text-stone-900" />
              <p className="mt-2 text-sm font-bold text-stone-900">Discoverable · Approval</p>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Visible in directory, but new members must submit a join request to participate.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setVisibility('private');
                setMembershipPolicy('invite_only');
              }}
              className={`rounded-xl border p-4 text-left transition-all ${
                visibility === 'private'
                  ? 'border-black bg-stone-50 shadow-xs ring-1 ring-black'
                  : 'border-stone-200 bg-stone-50/40 hover:border-stone-300'
              }`}
            >
              <Lock className="h-5 w-5 text-stone-700" />
              <p className="mt-2 text-sm font-bold text-stone-900">Private Community</p>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Hidden from discovery. Accessible only through direct invitations.
              </p>
            </button>
          </div>

          {visibility === 'public' && (
            <div className="pt-2">
              <label htmlFor="membership-policy" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Join Request Rule
              </label>
              <select
                id="membership-policy"
                value={membershipPolicy}
                onChange={(e) => setMembershipPolicy(e.target.value as MembershipPolicy)}
                className="mt-1.5 w-full sm:w-72 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              >
                <option value="open">Open — Anyone can join immediately</option>
                <option value="approval">Approval Required — Staff approves join requests</option>
              </select>
            </div>
          )}
        </section>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_3px_rgba(0,0,0,0.15)] hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <span>{loading ? 'Bootstrapping Circle...' : 'Create Community'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
