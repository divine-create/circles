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
  Settings,
  ShieldAlert,
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
    { href: '/explore', label: 'Explore Circles', icon: Compass },
    ...(user
      ? [
          { href: '/circles', label: 'My Circles', icon: Layers },
          { href: '/circles/new', label: 'Start a Circle', icon: PlusCircle },
          { href: '/moderation', label: 'Moderation', icon: ShieldAlert },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-sand-50/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-forest-800 focus:outline-none focus:ring-2 focus:ring-forest-500 rounded-lg"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-700 text-white shadow-sm">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white" />
            </span>
            <span className="text-lg font-bold tracking-tight text-stone-900">Circles</span>
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
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-forest-50 text-forest-800'
                      : 'text-stone-600 hover:bg-sand-100 hover:text-stone-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative inline-flex items-center justify-center rounded-lg p-2 text-stone-600 hover:bg-sand-100 hover:text-stone-900"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-forest-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/settings"
                className="inline-flex items-center gap-2.5 rounded-xl border border-sand-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:border-sand-300"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-100 text-xs font-semibold text-forest-800">
                  {user.display_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[140px] truncate">{user.display_name}</span>
                <Settings className="h-3.5 w-3.5 text-stone-400" />
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-sand-100 hover:text-stone-900 disabled:opacity-50"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-700 hover:bg-sand-100"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-forest-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-forest-800 transition-colors"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-stone-700 hover:bg-sand-100"
            aria-label="Toggle Mobile Menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-sand-200 bg-white px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-sand-100"
                >
                  <Icon className="h-4 w-4 text-forest-700" />
                  {item.label}
                </Link>
              );
            })}
            {user ? (
              <>
                <Link
                  href="/notifications"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-sand-100"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-forest-700" />
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-forest-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-sand-100"
                >
                  <Settings className="h-4 w-4 text-forest-700" />
                  Profile & Settings ({user.display_name})
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
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
                  className="w-full rounded-lg border border-sand-300 py-2 text-center text-sm font-medium text-stone-800"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="w-full rounded-lg bg-forest-700 py-2 text-center text-sm font-semibold text-white"
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
