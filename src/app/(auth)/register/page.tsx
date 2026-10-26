'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, AtSign, Lock, Mail, Sparkles, User } from 'lucide-react';

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
    <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-zinc-400/10 blur-3xl pointer-events-none" />

      <div className="relative rounded-2xl border border-stone-200/90 bg-white/90 backdrop-blur-xl p-8 shadow-premium">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-900 border border-zinc-200 mb-2">
            <Sparkles className="h-3 w-3 text-zinc-900" />
            <span>Join Platform</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">Create your account</h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500">
            Join existing Circles or launch a configurable community of your own.
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
            <label htmlFor="displayName" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
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
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="username" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
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
                onChange={(e) => setUsername(e.target.value)}
                placeholder="elena_vance"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all font-mono text-xs sm:text-sm"
              />
            </div>
          </div>

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
                placeholder="elena@example.com"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
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
                placeholder="••••••••"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2.5 pl-9 pr-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-stone-400">Minimum 8 characters.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_3px_rgba(0,0,0,0.15)] hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <span>{loading ? 'Registering...' : 'Create Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-stone-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-stone-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
