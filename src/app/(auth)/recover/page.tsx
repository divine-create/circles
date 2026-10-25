'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [devPreviewToken, setDevPreviewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestRecovery(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not request password recovery.');
        return;
      }
      if (data.previewToken) {
        setDevPreviewToken(data.previewToken);
        setToken(data.previewToken);
      }
      setStep('reset');
    } catch {
      setError('Network error while requesting recovery.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not reset password.');
        return;
      }
      setStep('done');
    } catch {
      setError('Network error while resetting password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-sand-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Account Recovery</h1>
        <p className="mt-1.5 text-sm text-stone-600">
          Reset your password using a verified recovery token.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequestRecovery} className="mt-6 space-y-4">
            <div>
              <label htmlFor="recover-email" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Account Email
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
                <input
                  id="recover-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-forest-700 py-3 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Recovery Token'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            {devPreviewToken && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Local Development Mode (Resend unconfigured):</p>
                <p className="mt-1 break-all font-mono">{devPreviewToken}</p>
              </div>
            )}
            <div>
              <label htmlFor="token" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Recovery Token
              </label>
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" />
                <input
                  id="token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 pl-9 pr-3.5 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 w-full rounded-xl border border-sand-300 bg-sand-50/50 py-2.5 px-3.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-forest-700 py-3 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
            >
              {loading ? 'Updating Password...' : 'Confirm Password Reset'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="mt-6 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest-50 text-forest-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-stone-800">
              Your password has been updated. You can now sign in with your new credentials.
            </p>
            <Link
              href="/login"
              className="inline-block w-full rounded-xl bg-forest-700 py-3 text-sm font-semibold text-white"
            >
              Return to Sign In
            </Link>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="text-xs font-medium text-stone-500 hover:text-stone-800">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
