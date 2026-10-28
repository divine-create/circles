'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  CheckSquare,
  Compass,
  CreditCard,
  GraduationCap,
  HelpCircle,
  Layers,
  LayoutGrid,
  MessageSquare,
  PlusCircle,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sliders,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { Circle } from '@/types/domain';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Current Circle' | 'Quick Navigation' | 'Matching Communities';
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Extract circle slug from URL if inside a circle route
  const circleSlug = useMemo(() => {
    if (!pathname) return null;
    const match = pathname.match(/^\/circles\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    // exclude static subroutes
    if (match[1] === 'new') return null;
    return match[1];
  }, [pathname]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      const isSlash =
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) &&
        !(e.target as HTMLElement)?.isContentEditable;

      if (isK || isSlash) {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        handleClose();
      }
    }

    function handleCustomOpen() {
      setOpen(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, [open, handleClose]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search for circles
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/circles?search=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.circles || []);
        }
      } catch {
        // Ignore search failures
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Build combined item list
  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];
    const q = query.toLowerCase().trim();

    // 1. Current Circle Scope (if inside a circle)
    if (circleSlug) {
      const circleActions: { title: string; subtitle: string; path: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { title: 'Feed & Discussions', subtitle: 'View discussion feed and posts', path: `/circles/${circleSlug}`, icon: MessageSquare },
        { title: 'Spaces & Channels', subtitle: 'Browse topical discussion spaces', path: `/circles/${circleSlug}/spaces`, icon: LayoutGrid },
        { title: 'Events & Calendar', subtitle: 'Upcoming gatherings, RSVPs, and meetups', path: `/circles/${circleSlug}/events`, icon: Calendar },
        { title: 'Academy & Courses', subtitle: 'Modules, lesson authoring, and student quizzes', path: `/circles/${circleSlug}/courses`, icon: GraduationCap },
        { title: 'Marketplace & Services', subtitle: 'Product listings, appointments, and rentals', path: `/circles/${circleSlug}/marketplace`, icon: ShoppingBag },
        { title: 'Members Directory', subtitle: 'Active community roster and profiles', path: `/circles/${circleSlug}/members`, icon: Users },
        { title: 'Polls & Proposals', subtitle: 'Community votes and decision logs', path: `/circles/${circleSlug}/polls`, icon: Vote },
        { title: 'Collaborative Projects', subtitle: 'Kanban tasks and milestone roadmaps', path: `/circles/${circleSlug}/projects`, icon: CheckSquare },
        { title: 'Learning Resources', subtitle: 'Shared links, study guides, and bookmarks', path: `/circles/${circleSlug}/resources`, icon: BookOpen },
        { title: 'Community Hub & Causes', subtitle: 'Governance proposals and fundraising drives', path: `/circles/${circleSlug}/community`, icon: HelpCircle },
        { title: 'Finances & Dues', subtitle: 'Treasury ledger, plans, and invoices', path: `/circles/${circleSlug}/finances`, icon: CreditCard },
        { title: 'Circle Studio Settings', subtitle: 'Manage capabilities, spaces, and policies', path: `/circles/${circleSlug}/studio`, icon: Sliders },
      ];

      circleActions.forEach((item) => {
        if (!q || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)) {
          list.push({
            id: `circle-${item.path}`,
            title: item.title,
            subtitle: item.subtitle,
            category: 'Current Circle',
            icon: item.icon,
            action: () => {
              router.push(item.path);
              handleClose();
            },
          });
        }
      });
    }

    // 2. Global Platform Navigation
    const globalNav: { title: string; subtitle: string; path: string; icon: React.ComponentType<{ className?: string }> }[] = [
      { title: 'Explore Communities', subtitle: 'Discover active public Circles', path: '/explore', icon: Compass },
      { title: 'My Circles', subtitle: 'View your memberships and owned spaces', path: '/circles', icon: Layers },
      { title: 'Create New Circle', subtitle: 'Provision a community from verified templates', path: '/circles/new', icon: PlusCircle },
      { title: 'Moderation Queue', subtitle: 'Review flagged content and member reports', path: '/moderation', icon: ShieldAlert },
      { title: 'Profile & Privacy Settings', subtitle: 'Manage account visibility and bio', path: '/settings', icon: Settings },
    ];

    globalNav.forEach((item) => {
      if (!q || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)) {
        list.push({
          id: `global-${item.path}`,
          title: item.title,
          subtitle: item.subtitle,
          category: 'Quick Navigation',
          icon: item.icon,
          action: () => {
            router.push(item.path);
            handleClose();
          },
        });
      }
    });

    // 3. Search Results for Circles
    searchResults.forEach((c) => {
      list.push({
        id: `search-circle-${c.id}`,
        title: c.name,
        subtitle: `${c.category} · /circles/${c.slug}`,
        category: 'Matching Communities',
        icon: Compass,
        action: () => {
          router.push(`/circles/${c.slug}`);
          handleClose();
        },
      });
    });

    return list;
  }, [circleSlug, query, searchResults, router, handleClose]);

  // Reset selectedIndex if bounds change
  useEffect(() => {
    setSelectedIndex((prev) => (prev >= items.length ? Math.max(0, items.length - 1) : prev));
  }, [items.length]);

  // Keyboard navigation inside list
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < items.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : items.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Universal Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5 bg-stone-50/50">
          <Search className="h-5 w-5 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              circleSlug
                ? `Search this Circle, actions, or jump anywhere...`
                : `Search Circles, actions, or jump to...`
            }
            className="w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-stone-400 hover:text-stone-600 rounded-md p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-stone-500 shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 divide-y divide-stone-100 scrollbar-thin"
        >
          {loading && (
            <div className="py-6 text-center text-xs text-stone-400">
              Searching communities...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="py-8 text-center text-xs text-stone-400">
              No results found for &ldquo;{query}&rdquo;.
            </div>
          )}

          {!loading &&
            items.length > 0 &&
            (() => {
              // Group items by category
              let currentCategory = '';
              return items.map((item, idx) => {
                const showHeader = item.category !== currentCategory;
                if (showHeader) currentCategory = item.category;
                const isSelected = selectedIndex === idx;
                const Icon = item.icon;

                return (
                  <React.Fragment key={item.id}>
                    {showHeader && (
                      <div className="px-3 pt-3 pb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                        {item.category}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-800 hover:bg-stone-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-white' : 'text-stone-900'
                            }`}
                          >
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div
                              className={`text-[10px] truncate ${
                                isSelected ? 'text-stone-300' : 'text-stone-500'
                              }`}
                            >
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <kbd className="hidden sm:inline-block rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-mono text-white shrink-0">
                          ↵ Enter
                        </kbd>
                      )}
                    </button>
                  </React.Fragment>
                );
              });
            })()}
        </div>

        {/* Footer Shortcut Guide */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/70 px-4 py-2.5 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-stone-200 bg-white px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-stone-200 bg-white px-1 py-0.5 font-mono text-[9px]">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="font-mono text-[10px] text-stone-400">Universal Palette</span>
        </div>
      </div>
    </div>
  );
}
