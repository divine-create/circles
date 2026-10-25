import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Layers,
  Lock,
  ShieldCheck,
  Sliders,
  Users,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { discoverCircles } from '@/features/circles/service';
import { getAllCircleTemplates } from '@/features/templates/registry';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  const featuredCircles = await discoverCircles(user?.id ?? null, { limit: 6 });
  const templates = getAllCircleTemplates();

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="border-b border-sand-200 bg-gradient-to-b from-forest-950 via-forest-900 to-forest-800 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-forest-600 bg-forest-800/70 px-3.5 py-1 text-xs font-medium text-forest-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Configurable Community Architecture
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1]">
              One shared platform. Many types of communities.
            </h1>
            <p className="text-lg text-forest-100/90 leading-relaxed max-w-2xl">
              A Circle is more than a group chat. It is a configurable digital environment where
              universities, neighbourhood associations, professional guilds, and project teams
              enable the exact capabilities, spaces, and governance their members need.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href={user ? '/circles/new' : '/register'}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-forest-900 shadow-sm hover:bg-sand-100 transition-colors"
              >
                <span>{user ? 'Launch a New Circle' : 'Get Started — Create a Circle'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-xl border border-forest-500 bg-forest-800/50 px-6 py-3.5 text-sm font-semibold text-white hover:bg-forest-700/60 transition-colors"
              >
                <Compass className="h-4 w-4" />
                <span>Explore Public Circles</span>
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-forest-700/70 pt-8 text-sm text-forest-100">
            <div className="flex items-start gap-3">
              <Sliders className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Modular Capability Registry</p>
                <p className="text-forest-200 text-xs mt-1">
                  Enable discussions, spaces, directories, events, or learning cohorts with
                  dependency validation and non-destructive archival.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Row-Level Security Isolation</p>
                <p className="text-forest-200 text-xs mt-1">
                  Every Circle enforces strict visibility, join policies, and role-based permissions
                  backed by PostgreSQL constraints.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Layers className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Multi-Circle Participation</p>
                <p className="text-forest-200 text-xs mt-1">
                  Own a startup Circle, moderate your university society, and participate in your
                  local neighbourhood association from one account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Discoverable Circles */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Live Communities
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
              Discover Active Circles
            </h2>
          </div>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-800"
          >
            <span>Browse all discoverable Circles</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {featuredCircles.map((circle) => (
            <Link
              key={circle.id}
              href={`/circles/${circle.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-sand-200 bg-white p-6 shadow-sm transition-all hover:border-forest-500/50 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-medium capitalize text-forest-800">
                    {circle.category.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
                    {circle.visibility === 'discoverable_approval' ? (
                      <>
                        <Lock className="h-3 w-3 text-amber-600" />
                        Approval Required
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-forest-600" />
                        Public Circle
                      </>
                    )}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-stone-900 group-hover:text-forest-700">
                  {circle.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm text-stone-600 leading-relaxed">
                  {circle.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-sand-100 pt-4 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                  <Users className="h-3.5 w-3.5 text-forest-700" />
                  {circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}
                </span>
                {circle.location && <span>{circle.location}</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Circle Templates Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-sand-200 bg-white p-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Purpose-Built Blueprints
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
              Start with a Versioned Circle Template
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Every template initializes real PostgreSQL capabilities, topical spaces, and
              recommended membership policies—and remains 100% customizable in Circle Studio.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((tpl) => (
              <div
                key={tpl.key}
                className="flex flex-col justify-between rounded-xl border border-sand-200 bg-sand-50/70 p-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                      {tpl.category.replace('_', ' ')}
                    </span>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-stone-500 border border-sand-200">
                      v{tpl.version}
                    </span>
                  </div>
                  <h3 className="mt-2 font-bold text-stone-900 text-sm">{tpl.name}</h3>
                  <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">{tpl.summary}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-sand-200/80 flex flex-wrap gap-1">
                  {tpl.enabledCapabilities.slice(0, 4).map((cap) => (
                    <span
                      key={cap}
                      className="rounded bg-white px-2 py-0.5 text-[10px] font-medium text-stone-600 border border-sand-200"
                    >
                      {cap.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
