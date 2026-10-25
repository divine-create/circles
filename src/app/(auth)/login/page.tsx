'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, KeyRound, Lock, Mail } from 'lucide-react';

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
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-sand-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Sign in to Circles</h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Access your communities, spaces, and Circle Studio controls.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
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
                className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Password
              </label>
              <Link href="/recover" className="text-xs font-medium text-forest-700 hover:underline">
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
                className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-700 py-3 text-sm font-semibold text-white shadow-sm hover:bg-forest-800 disabled:opacity-50"
          >
            <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Seeded Accounts for Local Verification */}
        <div className="mt-6 border-t border-sand-200 pt-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
            <KeyRound className="h-3.5 w-3.5 text-forest-700" />
            Seeded Local Verification Accounts:
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => fillDemoAccount('amara@circles.dev')}
              className="flex items-center justify-between rounded-lg border border-sand-200 bg-sand-50 px-3 py-1.5 text-xs text-stone-700 hover:bg-sand-100"
            >
              <span className="font-medium">Amara Okafor (Owner & Platform Admin)</span>
              <span className="text-stone-500">amara@circles.dev</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('liam@circles.dev')}
              className="flex items-center justify-between rounded-lg border border-sand-200 bg-sand-50 px-3 py-1.5 text-xs text-stone-700 hover:bg-sand-100"
            >
              <span className="font-medium">Liam Chen (University Circle Owner)</span>
              <span className="text-stone-500">liam@circles.dev</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('sofia@circles.dev')}
              className="flex items-center justify-between rounded-lg border border-sand-200 bg-sand-50 px-3 py-1.5 text-xs text-stone-700 hover:bg-sand-100"
            >
              <span className="font-medium">Sofia Rossi (Community Member)</span>
              <span className="text-stone-500">sofia@circles.dev</span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stone-600">
          Don&apos;t have an account yet?{' '}
          <Link href="/register" className="font-semibold text-forest-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
