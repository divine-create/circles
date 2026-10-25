'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, AtSign, Lock, Mail, User } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not complete registration.');
        return;
      }
      router.push('/circles');
      router.refresh();
    } catch {
      setError('Network error while creating your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-sand-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Create your account</h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Join existing Circles or launch a configurable community of your own.
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
            <label htmlFor="displayName" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
              Full / Display Name
            </label>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (!username) {
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]+/g, '_')
                        .replace(/^_+|_+$/g, '')
                        .slice(0, 28)
                    );
                  }
                }}
                placeholder="Elena Vance"
                className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
              Username
            </label>
            <div className="relative mt-1.5">
              <AtSign className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="elena_vance"
                className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-stone-500">
              3–32 lowercase letters, numbers, or underscores.
            </p>
          </div>

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
                placeholder="elena@example.com"
                className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-700 py-3 text-sm font-semibold text-white shadow-sm hover:bg-forest-800 disabled:opacity-50"
          >
            <span>{loading ? 'Creating account...' : 'Create Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-stone-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-forest-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
