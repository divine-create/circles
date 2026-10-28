'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Layers,
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

  // Prevent background scroll when mobile drawer is active
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ======================================================== */}
      {/* MOBILE SCREEN NAVIGATION STRIP (< lg)                    */}
      {/* ======================================================== */}
      <div className="lg:hidden mb-6 space-y-2.5">
        {/* Active Module Indicator & Full Drawer Trigger */}
        <div className="flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-900 shrink-0">
              <DynamicIcon
                name={isStudioActive ? 'sliders' : activeNavItem?.icon}
                className="h-4 w-4 text-emerald-900"
              />
            </div>
            <div className="truncate">
              <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                Current View
              </span>
              <span className="text-sm font-bold text-stone-900 truncate block">
                {isStudioActive ? 'Circle Studio' : activeNavItem?.label ?? 'Overview'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-xs hover:bg-stone-100 transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-stone-600" />
            <span>Modules ({navigation.navigationItems.length})</span>
            <ChevronDown className="h-3 w-3 text-stone-400" />
          </button>
        </div>

        {/* Horizontal Scrollable Quick-Pill Bar for Top Modules */}
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
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? 'bg-stone-900 text-white font-semibold shadow-xs'
                    : 'border border-stone-200/80 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
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
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE OFF-CANVAS DRAWER SHEET (< lg)                     */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-stone-950/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Slide-in */}
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-250 ease-out">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-sm font-bold text-white shadow-xs">
                  {circle.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 truncate max-w-[170px]">
                    {circle.name}
                  </h3>
                  <span className="text-[10px] font-mono text-stone-500 uppercase">
                    Navigation & Modules
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Navigation List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <p className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                  Community Modules
                </p>
                <div className="mt-1 space-y-0.5">
                  {navigation.navigationItems.map((item) => {
                    const isActive =
                      item.href === `/circles/${circle.slug}`
                        ? pathname === item.href
                        : pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-stone-900 text-white font-semibold'
                            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <DynamicIcon
                          name={item.icon}
                          className={`h-4 w-4 ${isActive ? 'text-white' : 'text-stone-500'}`}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Spaces section */}
              {navigation.enabledCapabilityKeys.includes('spaces') &&
                navigation.visibleSpaces.length > 0 && (
                  <div className="border-t border-stone-100 pt-3">
                    <div className="flex items-center justify-between px-3 py-1">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                        Discussion Spaces
                      </p>
                      <Link
                        href={`/circles/${circle.slug}/spaces`}
                        onClick={() => setMobileDrawerOpen(false)}
                        className="text-[10px] font-mono font-semibold text-emerald-800 hover:underline uppercase"
                      >
                        All ({navigation.visibleSpaces.length})
                      </Link>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {navigation.visibleSpaces.map((sp) => (
                        <Link
                          key={sp.id}
                          href={`/circles/${circle.slug}/discussions?spaceId=${sp.id}`}
                          onClick={() => setMobileDrawerOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 truncate"
                        >
                          <DynamicIcon
                            name={sp.icon}
                            className="h-3.5 w-3.5 text-stone-500 shrink-0"
                          />
                          <span className="truncate">{sp.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Studio Footer */}
            {isStaff && (
              <div className="border-t border-stone-200 p-3 bg-stone-50">
                <Link
                  href={`/circles/${circle.slug}/studio`}
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center justify-between rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    <span>Circle Studio</span>
                  </span>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DESKTOP COLLAPSIBLE SIDEBAR + MAIN CONTENT (lg+)         */}
      {/* ======================================================== */}
      <div className="flex items-start gap-8">
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

            {/* Module Navigation Links */}
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