'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Check, Globe, Lock, Shield } from 'lucide-react';
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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
          Community Initialization
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
          Create a New Circle
        </h1>
        <p className="mt-1.5 text-sm text-stone-600">
          Choose a starting template to pre-configure capabilities and spaces. You can customize
          every module anytime in Circle Studio.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Template Selection */}
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-stone-900">1. Choose a Community Blueprint</h2>
          <p className="mt-1 text-xs text-stone-500">
            Templates initialize default capabilities, topical spaces, and governance rules.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((tpl) => {
              const active = selectedTemplate === tpl.key;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.key)}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                    active
                      ? 'border-forest-600 bg-forest-50/60 ring-1 ring-forest-600'
                      : 'border-sand-200 bg-sand-50/40 hover:border-sand-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-forest-700">
                        {tpl.category.replace('_', ' ')}
                      </span>
                      {active && <Check className="h-3.5 w-3.5 text-forest-700" />}
                    </div>
                    <p className="mt-1 text-sm font-bold text-stone-900">{tpl.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-stone-600">{tpl.summary}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-sand-200/80 text-[11px] text-stone-500">
                    {tpl.enabledCapabilities.length} capabilities · {tpl.suggestedSpaces.length} spaces
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Core Identity */}
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-stone-900">2. Circle Identity</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="circle-name" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
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
                className="mt-1.5 w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="circle-slug" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                URL Slug
              </label>
              <input
                id="circle-slug"
                name="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="oxford-robotics-collective"
                className="mt-1.5 w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2.5 text-sm font-mono text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="circle-category" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Category
              </label>
              <select
                id="circle-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CircleCategory)}
                className="mt-1.5 w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
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
              <label htmlFor="circle-location" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Location (Optional)
              </label>
              <input
                id="circle-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Oxford, UK or Remote"
                className="mt-1.5 w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="circle-description" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
              Purpose & Description
            </label>
            <textarea
              id="circle-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe who this Circle is for and how members participate..."
              className="mt-1.5 w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
            />
          </div>
        </section>

        {/* Step 3: Visibility & Membership Policy */}
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-stone-900">
            3. Visibility & Joining Policy
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setVisibility('public');
                setMembershipPolicy('open');
              }}
              className={`rounded-xl border p-4 text-left ${
                visibility === 'public'
                  ? 'border-forest-600 bg-forest-50/60 ring-1 ring-forest-600'
                  : 'border-sand-200 hover:border-sand-300'
              }`}
            >
              <Globe className="h-5 w-5 text-forest-700" />
              <p className="mt-2 text-sm font-bold text-stone-900">Public</p>
              <p className="mt-1 text-xs text-stone-600">
                Listed in discovery. Anyone can preview and join according to policy.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setVisibility('discoverable_approval');
                setMembershipPolicy('approval');
              }}
              className={`rounded-xl border p-4 text-left ${
                visibility === 'discoverable_approval'
                  ? 'border-forest-600 bg-forest-50/60 ring-1 ring-forest-600'
                  : 'border-sand-200 hover:border-sand-300'
              }`}
            >
              <Shield className="h-5 w-5 text-amber-700" />
              <p className="mt-2 text-sm font-bold text-stone-900">Discoverable with Approval</p>
              <p className="mt-1 text-xs text-stone-600">
                Visible in discovery, but non-members must request approval to join and access content.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setVisibility('private');
                setMembershipPolicy('invite_only');
              }}
              className={`rounded-xl border p-4 text-left ${
                visibility === 'private'
                  ? 'border-forest-600 bg-forest-50/60 ring-1 ring-forest-600'
                  : 'border-sand-200 hover:border-sand-300'
              }`}
            >
              <Lock className="h-5 w-5 text-stone-700" />
              <p className="mt-2 text-sm font-bold text-stone-900">Private</p>
              <p className="mt-1 text-xs text-stone-600">
                Hidden from public discovery. Accessible only via authorized invitations.
              </p>
            </button>
          </div>

          {visibility === 'public' && (
            <div className="pt-2">
              <label htmlFor="membership-policy" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Public Circle Joining Rule
              </label>
              <select
                id="membership-policy"
                value={membershipPolicy}
                onChange={(e) => setMembershipPolicy(e.target.value as MembershipPolicy)}
                className="mt-1.5 w-full sm:w-72 rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-2 text-sm text-stone-900"
              >
                <option value="open">Open — Anyone can join immediately</option>
                <option value="approval">Approval Required — Admins review join requests</option>
              </select>
            </div>
          )}
        </section>

        <div className="flex items-center justify-end gap-4">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-forest-800 disabled:opacity-50"
          >
            <span>{loading ? 'Initializing Circle...' : 'Create Circle'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
