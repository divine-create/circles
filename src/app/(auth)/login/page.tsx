'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, KeyRound, Lock, Mail, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to sign in.');
        return;
      }
      router.push('/circles');
      router.refresh();
    } catch {
      setError('Network error while signing in.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('CirclesDemo123!');
    setError(null);
  }

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-zinc-400/10 blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl border border-stone-200/90 bg-white/90 backdrop-blur-xl p-8 shadow-premium">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-900 border border-zinc-200 mb-2">
            <Sparkles className="h-3 w-3 text-zinc-900" />
            <span>Secure Authentication</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">Sign in to Circles</h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500">
            Access your active communities, spaces, and studio controls.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Email Address
            </label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Password
              </label>
              <Link href="/recover" className="text-xs font-medium text-stone-900 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_3px_rgba(0,0,0,0.15)] hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Seeded Accounts for Local Verification */}
        <div className="mt-6 border-t border-stone-100 pt-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
            <KeyRound className="h-3.5 w-3.5 text-zinc-900" />
            <span>Developer Seed Accounts</span>
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => fillDemoAccount('amara@circles.dev')}
              className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-stone-50/70 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100 transition-colors text-left"
            >
              <div>
                <p className="font-semibold text-stone-900">Amara Okafor</p>
                <p className="text-[10px] text-stone-500 font-mono">amara@circles.dev</p>
              </div>
              <span className="rounded bg-zinc-950 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white">
                ADMIN
              </span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('liam@circles.dev')}
              className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-stone-50/70 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100 transition-colors text-left"
            >
              <div>
                <p className="font-semibold text-stone-900">Liam Chen</p>
                <p className="text-[10px] text-stone-500 font-mono">liam@circles.dev</p>
              </div>
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-mono font-bold text-zinc-900">
                OWNER
              </span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('sofia@circles.dev')}
              className="flex items-center justify-between rounded-xl border border-stone-200/80 bg-stone-50/70 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100 transition-colors text-left"
            >
              <div>
                <p className="font-semibold text-stone-900">Sofia Rossi</p>
                <p className="text-[10px] text-stone-500 font-mono">sofia@circles.dev</p>
              </div>
              <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[9px] font-mono font-bold text-stone-700">
                MEMBER
              </span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stone-500">
          Don&apos;t have an account yet?{' '}
          <Link href="/register" className="font-semibold text-forest-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
