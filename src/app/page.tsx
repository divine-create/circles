import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Compass,
  Lock,
  MessageSquare,
  Sliders,
  Users,
  Vote,
  Zap,
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
    <div className="space-y-24 pb-24">
      {/* Linear/Stripe Styled Radiant Hero */}
      <section className="relative overflow-hidden border-b border-black/[0.08] bg-black text-white">
        {/* Ambient Glow & Grid Pattern */}
        <div className="absolute inset-0 bg-grid-dark opacity-35" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-transparent blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-28 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.08] bg-gradient-to-b from-white via-stone-100 to-stone-400 bg-clip-text text-transparent">
              One shared platform. <br className="hidden sm:inline" />
              Many types of communities.
            </h1>

            <p className="text-base sm:text-lg text-stone-300/90 leading-relaxed max-w-2xl font-normal">
              A configurable digital home for universities, creator collectives, professional guilds,
              and neighbourhoods. Enable the exact spaces, voting, marketplace, and governance your members need.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
              <Link
                href={user ? '/circles/new' : '/register'}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_25px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,1)] hover:bg-stone-100 transition-all active:scale-[0.98]"
              >
                <span>{user ? 'Launch a Circle' : 'Start Your Community'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.08] hover:border-white/25 transition-all backdrop-blur-sm"
              >
                <Compass className="h-4 w-4 text-stone-300" />
                <span>Explore Directory</span>
              </Link>
            </div>
          </div>

          {/* Linear-Style Product Showcase Mockup */}
          <div className="mt-16 relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-zinc-950/80 p-2 sm:p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="rounded-xl border border-white/5 bg-[#09090b] overflow-hidden">
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/60 px-4 py-2.5 text-xs text-stone-400">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                    <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-stone-400">
                    circles.community/edinburgh-computing-society
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-stone-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  <span>342 Online</span>
                </div>
              </div>

              {/* Showcase Body Preview */}
              <div className="grid grid-cols-1 md:grid-cols-12 p-5 gap-5">
                {/* Space Sidebar Preview */}
                <div className="hidden md:block md:col-span-3 space-y-1.5 text-xs border-r border-white/[0.06] pr-4">
                  <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-stone-500 px-2">
                    Spaces & Channels
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-white/10 text-white px-2.5 py-1.5 font-medium border border-white/15">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span># general-chat</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg text-stone-400 hover:text-white px-2.5 py-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    <span># ai-showcases</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg text-stone-400 hover:text-white px-2.5 py-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span># hackathons</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg text-stone-400 hover:text-white px-2.5 py-1.5">
                    <Vote className="h-3.5 w-3.5" />
                    <span># governance-polls</span>
                  </div>
                </div>

                {/* Central Feed Preview */}
                <div className="md:col-span-6 space-y-3">
                  <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-white border border-white/10">
                          LC
                        </span>
                        <span className="font-semibold text-stone-200">Liam Chen</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-stone-300 border border-white/15">
                          OWNER
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-500 font-mono">12m ago</span>
                    </div>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Excited to announce our Winter Hackathon! Spaces for AI agents, robotics, and
                      modular systems are now open. RSVP below!
                    </p>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-stone-300" />
                        <div>
                          <p className="font-semibold text-white text-[11px]">Winter Hackathon 2026</p>
                          <p className="text-[10px] text-stone-400">Sat, Nov 14 · Main Hall & Discord</p>
                        </div>
                      </div>
                      <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-stone-200 border border-white/20">
                        48 / 60 RSVPs
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interactive Poll / Activity Preview */}
                <div className="hidden md:block md:col-span-3 space-y-3">
                  <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-stone-300 flex items-center gap-1.5">
                        <Vote className="h-3.5 w-3.5 text-stone-300" />
                        Active Poll
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">2h left</span>
                    </div>
                    <p className="text-[11px] text-stone-400">Should we sponsor next term&apos;s open source compute grant?</p>
                    <div className="space-y-1.5">
                      <div className="relative overflow-hidden rounded-md border border-white/20 bg-white/[0.05] p-1.5 text-[10px] text-stone-200">
                        <div className="absolute inset-y-0 left-0 bg-white/20 w-[78%]" />
                        <span className="relative z-10 flex justify-between font-medium">
                          <span>Yes, allocate £1,500</span>
                          <span>78%</span>
                        </span>
                      </div>
                      <div className="relative overflow-hidden rounded-md border border-white/[0.06] bg-black/30 p-1.5 text-[10px] text-stone-300">
                        <div className="absolute inset-y-0 left-0 bg-white/10 w-[22%]" />
                        <span className="relative z-10 flex justify-between">
                          <span>Review next quarter</span>
                          <span>22%</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Scale & Security Metrics */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 text-center divide-y md:divide-y-0 md:divide-x divide-stone-100">
            <div className="px-4 py-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">99.99%</p>
              <p className="mt-1 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Uptime & Reliability
              </p>
            </div>
            <div className="px-4 py-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">22</p>
              <p className="mt-1 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Modular Capabilities
              </p>
            </div>
            <div className="px-4 py-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">Sub-ms</p>
              <p className="mt-1 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Response Latency
              </p>
            </div>
            <div className="px-4 py-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">Bank-Grade</p>
              <p className="mt-1 text-xs font-medium text-stone-500 uppercase tracking-wider">
                Multi-Tenant Isolation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Discoverable Circles */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-900">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              <span>Public Directory</span>
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
              Featured Communities
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Explore active communities with configured spaces, discussions, and events.
            </p>
          </div>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:text-black bg-stone-100 hover:bg-stone-200/80 px-3.5 py-2 rounded-xl transition-all"
          >
            <span>View All Communities</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {featuredCircles.map((circle) => (
            <Link
              key={circle.id}
              href={`/circles/${circle.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs transition-all duration-200 hover:border-black/30 hover:shadow-premium-hover"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-stone-800 border border-stone-200">
                    {circle.category.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500">
                    {circle.visibility === 'discoverable_approval' ? (
                      <>
                        <Lock className="h-3 w-3 text-stone-500" />
                        Approval Required
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-stone-700" />
                        Public
                      </>
                    )}
                  </span>
                </div>

                <h3 className="mt-4 text-base font-bold text-stone-900 group-hover:text-black transition-colors">
                  {circle.name}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs text-stone-600 leading-relaxed">
                  {circle.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                  <Users className="h-3.5 w-3.5 text-stone-900" />
                  {circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}
                </span>
                {circle.location ? (
                  <span className="text-stone-400 text-[11px]">{circle.location}</span>
                ) : (
                  <span className="text-stone-900 font-mono text-[11px]">Active Now</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Circle Blueprints / Templates Showcase */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-stone-200/80 bg-gradient-to-b from-white to-stone-50/50 p-8 sm:p-12 shadow-xs">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-800">
              <Sliders className="h-3.5 w-3.5" />
              <span>Modular Blueprints</span>
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
              Configured for Every Community Type
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Each template bootstraps a specialized community configuration with pre-selected
              modules, spaces, and role permissions.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((tpl) => (
              <div
                key={tpl.key}
                className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs hover:border-black/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
                      {tpl.category.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">
                      v{tpl.version}
                    </span>
                  </div>
                  <h3 className="mt-3 font-bold text-stone-900 text-sm">{tpl.name}</h3>
                  <p className="mt-1.5 text-xs text-stone-500 leading-relaxed line-clamp-3">{tpl.summary}</p>
                </div>
                <div className="mt-5 pt-3.5 border-t border-stone-100 flex flex-wrap gap-1">
                  {tpl.enabledCapabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="rounded-md bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600 border border-stone-200/60"
                    >
                      {cap.replace('_', ' ')}
                    </span>
                  ))}
                  {tpl.enabledCapabilities.length > 3 && (
                    <span className="rounded-md bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-400">
                      +{tpl.enabledCapabilities.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stripe-style SaaS Call to Action Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black px-8 py-16 sm:px-16 text-center text-white shadow-2xl">
          <div className="absolute inset-0 bg-grid-dark opacity-25" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Ready to create your community?
            </h2>
            <p className="text-sm sm:text-base text-stone-300">
              Start with an existing blueprint, configure spaces and capabilities, and invite your
              members in under 2 minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={user ? '/circles/new' : '/register'}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg hover:bg-stone-100 transition-all active:scale-[0.98]"
              >
                <span>Launch Your Circle</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                <span>Browse All Circles</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
