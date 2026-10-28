'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Compass,
  Layers,
  LogOut,
  Menu,
  PlusCircle,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { UserProfile } from '@/types/domain';

interface NavbarClientProps {
  user: UserProfile | null;
  unreadCount: number;
}

export function NavbarClient({ user, unreadCount }: NavbarClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const navLinks = [
    { href: '/explore', label: 'Explore', icon: Compass },
    ...(user
      ? [
          { href: '/circles', label: 'My Circles', icon: Layers },
          { href: '/circles/new', label: 'Create', icon: PlusCircle },
          { href: '/moderation', label: 'Moderation', icon: ShieldAlert },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_4px_rgba(0,0,0,0.2)]">
              <span className="h-3 w-3 rounded-full border-2 border-white/80" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-zinc-950 group-hover:text-black transition-colors">
                Circles
              </span>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-800 border border-zinc-200">
                PRO
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== '/circles' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-950'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-zinc-950' : 'text-zinc-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Global Quick Search Cue & User Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 rounded-lg border border-stone-200/80 bg-stone-50/80 px-2.5 py-1.5 text-xs text-stone-500 hover:border-stone-300 hover:bg-stone-100/70 transition-all shadow-xs cursor-pointer"
            title="Press Cmd+K or / to open universal search"
          >
            <Search className="h-3.5 w-3.5 text-stone-400" />
            <span>Search or jump to...</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-stone-400 shadow-xs">
              ⌘K
            </kbd>
          </button>

          <div className="h-4 w-px bg-stone-200 mx-1" />

          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative inline-flex items-center justify-center rounded-lg p-2 text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/settings"
                className="group flex items-center gap-2 rounded-xl border border-stone-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 shadow-xs hover:border-stone-300 hover:bg-stone-50 transition-all"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
                  {user.display_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[120px] truncate">{user.display_name}</span>
                <Settings className="h-3 w-3 text-stone-400 group-hover:text-stone-600 transition-colors" />
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors disabled:opacity-50"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Exit</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_3px_rgba(0,0,0,0.15)] hover:bg-zinc-800 transition-all active:scale-[0.98]"
              >
                <span>Get Started</span>
                <Sparkles className="h-3 w-3 text-stone-300" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-stone-700 hover:bg-stone-100"
            aria-label="Toggle Mobile Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 text-stone-700" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-stone-200 bg-white/95 backdrop-blur-xl px-4 pb-4 pt-2 md:hidden">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              window.dispatchEvent(new CustomEvent('open-command-palette'));
            }}
            className="flex w-full items-center gap-2.5 rounded-lg border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-sm text-stone-600 mb-2"
          >
            <Search className="h-4 w-4 text-stone-400" />
            <span>Search or jump to...</span>
            <kbd className="ml-auto inline-flex items-center rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-stone-400">
              ⌘K
            </kbd>
          </button>
          <div className="flex flex-col space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
                >
                  <Icon className="h-4 w-4 text-zinc-900" />
                  {item.label}
                </Link>
              );
            })}
            {user ? (
              <>
                <Link
                  href="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-zinc-900" />
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-black px-2 py-0.5 text-xs font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
                >
                  <Settings className="h-4 w-4 text-zinc-900" />
                  Settings ({user.display_name})
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-lg border border-stone-200 py-2 text-center text-sm font-medium text-stone-800"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-lg bg-black py-2 text-center text-sm font-semibold text-white"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
