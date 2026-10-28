'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  Home,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { Circle, CircleNavigationItem, CircleSpace } from '@/types/domain';
import { DynamicIcon } from '@/components/ui/icon-map';

export interface CircleCollapsibleLayoutProps {
  circle: Circle;
  navigation: {
    enabledCapabilityKeys: string[];
    visibleSpaces: CircleSpace[];
    navigationItems: CircleNavigationItem[];
  };
  isStaff: boolean;
  children: React.ReactNode;
}

// Facebook-style vibrant visual themes for community capabilities
const CAPABILITY_VISUAL_MAP: Record<
  string,
  { bg: string; iconBg: string; text: string; subtitle: string }
> = {
  discussions: {
    bg: 'bg-indigo-50/70 hover:bg-indigo-50 border-indigo-100',
    iconBg: 'bg-indigo-600 text-white',
    text: 'text-indigo-950',
    subtitle: 'Conversations & posts',
  },
  marketplace: {
    bg: 'bg-emerald-50/70 hover:bg-emerald-50 border-emerald-100',
    iconBg: 'bg-emerald-600 text-white',
    text: 'text-emerald-950',
    subtitle: 'Goods, rent & services',
  },
  events: {
    bg: 'bg-sky-50/70 hover:bg-sky-50 border-sky-100',
    iconBg: 'bg-sky-600 text-white',
    text: 'text-sky-950',
    subtitle: 'Meetups & gatherings',
  },
  polls: {
    bg: 'bg-amber-50/70 hover:bg-amber-50 border-amber-100',
    iconBg: 'bg-amber-600 text-white',
    text: 'text-amber-950',
    subtitle: 'Votes & community decisions',
  },
  resources: {
    bg: 'bg-teal-50/70 hover:bg-teal-50 border-teal-100',
    iconBg: 'bg-teal-600 text-white',
    text: 'text-teal-950',
    subtitle: 'Shared files & guides',
  },
  courses: {
    bg: 'bg-violet-50/70 hover:bg-violet-50 border-violet-100',
    iconBg: 'bg-violet-600 text-white',
    text: 'text-violet-950',
    subtitle: 'Structured learning modules',
  },
  jobs: {
    bg: 'bg-purple-50/70 hover:bg-purple-50 border-purple-100',
    iconBg: 'bg-purple-600 text-white',
    text: 'text-purple-950',
    subtitle: 'Opportunities & gigs',
  },
  housing: {
    bg: 'bg-cyan-50/70 hover:bg-cyan-50 border-cyan-100',
    iconBg: 'bg-cyan-600 text-white',
    text: 'text-cyan-950',
    subtitle: 'Sublets, rooms & rentals',
  },
  governance: {
    bg: 'bg-slate-100/70 hover:bg-slate-100 border-slate-200',
    iconBg: 'bg-slate-700 text-white',
    text: 'text-slate-950',
    subtitle: 'Proposals & committees',
  },
  projects: {
    bg: 'bg-blue-50/70 hover:bg-blue-50 border-blue-100',
    iconBg: 'bg-blue-600 text-white',
    text: 'text-blue-950',
    subtitle: 'Collaborative initiatives',
  },
  challenges: {
    bg: 'bg-orange-50/70 hover:bg-orange-50 border-orange-100',
    iconBg: 'bg-orange-500 text-white',
    text: 'text-orange-950',
    subtitle: 'Bounties, points & badges',
  },
  fundraising: {
    bg: 'bg-rose-50/70 hover:bg-rose-50 border-rose-100',
    iconBg: 'bg-rose-600 text-white',
    text: 'text-rose-950',
    subtitle: 'Donations & community funds',
  },
  finances: {
    bg: 'bg-emerald-50/70 hover:bg-emerald-50 border-emerald-100',
    iconBg: 'bg-emerald-700 text-white',
    text: 'text-emerald-950',
    subtitle: 'Ledger, dues & payouts',
  },
  members: {
    bg: 'bg-stone-100/70 hover:bg-stone-100 border-stone-200',
    iconBg: 'bg-stone-800 text-white',
    text: 'text-stone-950',
    subtitle: 'Member directory & teams',
  },
  spaces: {
    bg: 'bg-stone-100/70 hover:bg-stone-100 border-stone-200',
    iconBg: 'bg-stone-700 text-white',
    text: 'text-stone-950',
    subtitle: 'Subgroups & channels',
  },
};

const DEFAULT_CAPABILITY_VISUAL = {
  bg: 'bg-stone-50/80 hover:bg-stone-100 border-stone-200',
  iconBg: 'bg-stone-800 text-white',
  text: 'text-stone-900',
  subtitle: 'Community feature',
};

export function CircleCollapsibleLayout({
  circle,
  navigation,
  isStaff,
  children,
}: CircleCollapsibleLayoutProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Load user preference for sidebar collapse on desktop
  useEffect(() => {
    try {
      const saved = localStorage.getItem('circles_sidebar_collapsed_v1');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // Ignore localStorage read errors in private browsing
    }
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  function handleToggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('circles_sidebar_collapsed_v1', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  // Find currently active item for mobile header label
  const activeNavItem = useMemo(() => {
    const matched = navigation.navigationItems.find((item) => {
      if (item.href === `/circles/${circle.slug}`) {
        return pathname === item.href;
      }
      return pathname.startsWith(item.href);
    });
    return matched ?? navigation.navigationItems[0];
  }, [pathname, navigation.navigationItems, circle.slug]);

  const isStudioActive = pathname.startsWith(`/circles/${circle.slug}/studio`);

  // Extract key communication and secondary tool for the bottom dock
  const communicationItem = useMemo(() => {
    return (
      navigation.navigationItems.find(
        (item) => item.href.includes('/discussions') || item.href.includes('/spaces')
      ) ?? null
    );
  }, [navigation.navigationItems]);

  const secondaryFeaturedItem = useMemo(() => {
    return (
      navigation.navigationItems.find(
        (item) =>
          item.href.includes('/marketplace') ||
          item.href.includes('/events') ||
          item.href.includes('/courses') ||
          item.href.includes('/polls')
      ) ?? null
    );
  }, [navigation.navigationItems]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* ======================================================== */}
      {/* 1. MOBILE TOP STICKY TAB STRIP (< lg)                    */}
      {/* ======================================================== */}
      <div className="lg:hidden mb-4 space-y-2">
        {/* Dynamic Horizontal Segmented Quick Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
          {navigation.navigationItems.map((item) => {
            const isActive =
              item.href === `/circles/${circle.slug}`
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'border border-stone-200/90 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <DynamicIcon
                  name={item.icon}
                  className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-stone-500'}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isStaff && (
            <Link
              href={`/circles/${circle.slug}/studio`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                isStudioActive
                  ? 'bg-emerald-900 text-white shadow-xs'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Studio</span>
            </Link>
          )}

          {/* Full Navigation Trigger Pill */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-stone-200/90 bg-stone-100/80 px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-200 transition-colors shrink-0"
          >
            <Menu className="h-3.5 w-3.5 text-stone-700" />
            <span>Navigation</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. FACEBOOK-STYLE 2-COLUMN NAVIGATION SHEET (< lg)       */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet / Side Drawer Container */}
          <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250 ease-out">
            {/* Header: Circle Avatar & Title */}
            <div className="flex items-center justify-between border-b border-stone-200 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-base font-bold text-white shadow-xs">
                  {circle.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 truncate max-w-[200px]">
                    {circle.name}
                  </h3>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-800">
                    {isStudioActive ? 'Studio' : activeNavItem?.label ?? 'Overview'} · Navigation
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content: 2-Column Shortcut Card Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div>
                <p className="mb-2.5 px-1 text-[11px] font-mono font-bold uppercase tracking-wider text-stone-400">
                  Navigation & Shortcuts
                </p>

                {/* 2-Column Card Grid (Facebook Style) */}
                <div className="grid grid-cols-2 gap-2.5">
                  {navigation.navigationItems.map((item) => {
                    const isActive =
                      item.href === `/circles/${circle.slug}`
                        ? pathname === item.href
                        : pathname.startsWith(item.href);

                    // Infer capability key from href or ID
                    const capKey = item.href.split('/').pop() || 'overview';
                    const visual =
                      CAPABILITY_VISUAL_MAP[capKey] || DEFAULT_CAPABILITY_VISUAL;

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`group flex flex-col justify-between rounded-2xl border p-3 transition-all ${
                          isActive
                            ? 'border-stone-900 bg-stone-900 text-white shadow-sm ring-2 ring-stone-900/10'
                            : `${visual.bg} hover:border-stone-300`
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-2xs ${
                              isActive ? 'bg-white/20 text-white' : visual.iconBg
                            }`}
                          >
                            <DynamicIcon name={item.icon} className="h-4 w-4" />
                          </div>
                          <ChevronRight
                            className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 ${
                              isActive ? 'text-white/60' : 'text-stone-400'
                            }`}
                          />
                        </div>
                        <div>
                          <span
                            className={`block text-xs font-bold truncate ${
                              isActive ? 'text-white' : visual.text
                            }`}
                          >
                            {item.label}
                          </span>
                          <span
                            className={`block text-[10px] mt-0.5 line-clamp-1 ${
                              isActive ? 'text-white/70' : 'text-stone-500'
                            }`}
                          >
                            {visual.subtitle}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Spaces Subgroup Section (if spaces enabled) */}
              {navigation.enabledCapabilityKeys.includes('spaces') &&
                navigation.visibleSpaces.length > 0 && (
                  <div className="border-t border-stone-100 pt-4">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-400">
                        Discussion Spaces
                      </p>
                      <Link
                        href={`/circles/${circle.slug}/spaces`}
                        onClick={() => setMobileDrawerOpen(false)}
                        className="text-[11px] font-mono font-semibold text-emerald-800 hover:underline uppercase"
                      >
                        All ({navigation.visibleSpaces.length})
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {navigation.visibleSpaces.map((sp) => {
                        const isSpaceActive = pathname.includes(`spaceId=${sp.id}`);
                        return (
                          <Link
                            key={sp.id}
                            href={`/circles/${circle.slug}/discussions?spaceId=${sp.id}`}
                            onClick={() => setMobileDrawerOpen(false)}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                              isSpaceActive
                                ? 'bg-stone-900 text-white font-semibold'
                                : 'text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 truncate">
                              <DynamicIcon
                                name={sp.icon}
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  isSpaceActive ? 'text-white' : 'text-stone-500'
                                }`}
                              />
                              <span className="truncate">{sp.name}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            {/* Studio / Admin Footer */}
            {isStaff && (
              <div className="border-t border-stone-200 p-4 bg-stone-50">
                <Link
                  href={`/circles/${circle.slug}/studio`}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center justify-between rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    <span>Circle Studio (Management)</span>
                  </span>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PERSISTENT MOBILE BOTTOM DOCK (< lg)                  */}
      {/* ======================================================== */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-stone-200/90 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      >
        {/* 1. Feed / Overview */}
        <Link
          href={`/circles/${circle.slug}`}
          className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] font-semibold transition-colors ${
            pathname === `/circles/${circle.slug}`
              ? 'text-stone-950 font-bold'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Home className="h-4 w-4 mb-0.5" />
          <span>Feed</span>
        </Link>

        {/* 2. Primary Communication Tool (e.g. Discussions) */}
        {communicationItem && (
          <Link
            href={communicationItem.href}
            className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] font-semibold transition-colors ${
              pathname.startsWith(communicationItem.href)
                ? 'text-stone-950 font-bold'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <DynamicIcon name={communicationItem.icon} className="h-4 w-4 mb-0.5" />
            <span>{communicationItem.label}</span>
          </Link>
        )}

        {/* 3. Secondary Key Active Tool (Marketplace / Events / Courses / Polls) */}
        {secondaryFeaturedItem && (
          <Link
            href={secondaryFeaturedItem.href}
            className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] font-semibold transition-colors ${
              pathname.startsWith(secondaryFeaturedItem.href)
                ? 'text-stone-950 font-bold'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <DynamicIcon name={secondaryFeaturedItem.icon} className="h-4 w-4 mb-0.5" />
            <span>{secondaryFeaturedItem.label}</span>
          </Link>
        )}

        {/* 4. Global Notifications */}
        <Link
          href="/notifications"
          className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] font-semibold transition-colors ${
            pathname === '/notifications'
              ? 'text-stone-950 font-bold'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Bell className="h-4 w-4 mb-0.5" />
          <span>Alerts</span>
        </Link>

        {/* 5. Full Navigation Sheet Trigger */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 text-[10px] font-semibold transition-colors ${
            mobileDrawerOpen
              ? 'text-stone-950 font-bold'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Menu className="h-4 w-4 mb-0.5" />
          <span>Navigation</span>
        </button>
      </nav>

      {/* ======================================================== */}
      {/* 4. DESKTOP COLLAPSIBLE SIDEBAR + MAIN CONTENT (lg+)      */}
      {/* ======================================================== */}
      <div className="flex items-start gap-8 pb-16 lg:pb-0">
        {/* DESKTOP SIDEBAR */}
        <aside
          aria-label="Circle Navigation"
          className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          <div className="sticky top-20 rounded-2xl border border-stone-200/80 bg-white p-2.5 shadow-xs space-y-4">
            {/* Header & Collapse/Expand Toggle */}
            <div className="flex items-center justify-between px-2 py-1">
              {!isCollapsed && (
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                  Navigation
                </p>
              )}
              <button
                type="button"
                onClick={handleToggleCollapse}
                className={`inline-flex items-center justify-center rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors ${
                  isCollapsed ? 'w-full' : 'ml-auto'
                }`}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? (
                  <PanelLeft className="h-4 w-4 text-stone-600" />
                ) : (
                  <PanelLeftClose className="h-4 w-4 text-stone-500" />
                )}
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {navigation.navigationItems.map((item) => {
                const isActive =
                  item.href === `/circles/${circle.slug}`
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isCollapsed
                        ? 'h-10 w-10 justify-center mx-auto'
                        : 'gap-2.5 px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-stone-900 text-white font-semibold shadow-xs'
                        : 'text-stone-600 hover:bg-stone-100/80 hover:text-stone-900'
                    }`}
                  >
                    <DynamicIcon
                      name={item.icon}
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-stone-500 group-hover:text-stone-900'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}

                    {/* Tooltip for collapsed view */}
                    {isCollapsed && (
                      <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white shadow-md whitespace-nowrap group-hover:block">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Spaces Sub-navigation (if capability enabled) */}
            {navigation.enabledCapabilityKeys.includes('spaces') &&
              navigation.visibleSpaces.length > 0 && (
                <div className="pt-2 border-t border-stone-100 space-y-1">
                  {!isCollapsed ? (
                    <>
                      <div className="flex items-center justify-between px-2.5 py-1">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                          Spaces
                        </p>
                        <Link
                          href={`/circles/${circle.slug}/spaces`}
                          className="text-[10px] font-mono font-semibold text-emerald-800 hover:underline uppercase"
                        >
                          All ({navigation.visibleSpaces.length})
                        </Link>
                      </div>
                      <div className="space-y-0.5">
                        {navigation.visibleSpaces.map((sp) => {
                          const isSpaceActive = pathname.includes(`spaceId=${sp.id}`);
                          return (
                            <Link
                              key={sp.id}
                              href={`/circles/${circle.slug}/discussions?spaceId=${sp.id}`}
                              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                isSpaceActive
                                  ? 'bg-stone-100 text-stone-900 font-semibold'
                                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                              }`}
                            >
                              <DynamicIcon
                                name={sp.icon}
                                className="h-3.5 w-3.5 text-stone-500 shrink-0"
                              />
                              <span className="truncate">{sp.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-center pt-1">
                      <Link
                        href={`/circles/${circle.slug}/spaces`}
                        title={`Spaces (${navigation.visibleSpaces.length})`}
                        className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                      >
                        <Menu className="h-4 w-4" />
                        <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white shadow-md whitespace-nowrap group-hover:block">
                          Spaces ({navigation.visibleSpaces.length})
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}

            {/* Circle Studio Shortcut */}
            {isStaff && (
              <div className="pt-2 border-t border-stone-100">
                <Link
                  href={`/circles/${circle.slug}/studio`}
                  title={isCollapsed ? 'Circle Studio' : undefined}
                  className={`group relative flex items-center rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isCollapsed
                      ? 'h-10 w-10 justify-center mx-auto bg-stone-100 text-stone-900 hover:bg-stone-200'
                      : 'gap-2.5 px-3 py-2 bg-stone-100 text-stone-900 hover:bg-stone-200'
                  }`}
                >
                  <Sliders className="h-4 w-4 text-stone-900 shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span>Circle Studio</span>
                      <Sparkles className="h-3.5 w-3.5 ml-auto text-emerald-700" />
                    </>
                  )}
                  {isCollapsed && (
                    <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white shadow-md whitespace-nowrap group-hover:block">
                      Circle Studio
                    </div>
                  )}
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* PRIMARY CONTENT COLUMN */}
        <main className="flex-1 min-w-0 transition-all duration-300">
          {children}
        </main>
      </div>
    </div>
  );
}
