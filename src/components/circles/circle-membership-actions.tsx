'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  Sliders,
  UserPlus,
} from 'lucide-react';
import { Circle } from '@/types/domain';

interface CircleMembershipActionsProps {
  circle: Circle;
  isAuthenticated: boolean;
  inviteToken?: string | null;
}

export function CircleMembershipActions({
  circle,
  isAuthenticated,
  inviteToken,
}: CircleMembershipActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  const isMember = circle.current_user_membership_status === 'active';
  const isPending = circle.current_user_join_request_status === 'pending';
  const isStaff =
    circle.current_user_role === 'owner' || circle.current_user_role === 'admin';

  async function handleJoin() {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not join Circle.');
        return;
      }
      setFeedback('You are now an active member of this Circle.');
      router.refresh();
    } catch {
      setError('Network error while joining Circle.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestToJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', message: requestNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit join request.');
        return;
      }
      setShowRequestForm(false);
      setFeedback('Your membership request has been submitted for administrator approval.');
      router.refresh();
    } catch {
      setError('Network error while requesting membership.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptInvite() {
    if (!inviteToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept_invite', token: inviteToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not accept invitation.');
        return;
      }
      setFeedback('Invitation accepted! Welcome to the Circle.');
      router.refresh();
    } catch {
      setError('Network error while accepting invitation.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    if (!confirm(`Are you sure you want to leave "${circle.name}"?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to leave Circle.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error while leaving Circle.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {inviteToken && !isMember && (
          <button
            type="button"
            onClick={handleAcceptInvite}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Accept Circle Invitation</span>
          </button>
        )}

        {isMember ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 border border-zinc-200 px-3.5 py-2 text-xs font-semibold capitalize text-zinc-900">
              <CheckCircle2 className="h-3.5 w-3.5 text-zinc-900" />
              Active {circle.current_user_role}
            </span>

            {isStaff && (
              <Link
                href={`/circles/${circle.slug}/studio`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Circle Studio</span>
              </Link>
            )}

            {circle.current_user_role !== 'owner' && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sand-300 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-sand-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Leave</span>
              </button>
            )}
          </>
        ) : isPending ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
            <Clock className="h-3.5 w-3.5" />
            Membership Request Pending Approval
          </span>
        ) : circle.membership_policy === 'open' && circle.visibility === 'public' ? (
          <button
            type="button"
            onClick={handleJoin}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            <span>{loading ? 'Joining...' : 'Join Circle'}</span>
          </button>
        ) : circle.membership_policy === 'approval' ? (
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                router.push('/login');
                return;
              }
              setShowRequestForm(!showRequestForm);
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            <span>Request to Join Circle</span>
          </button>
        ) : null}
      </div>

      {showRequestForm && (
        <form
          onSubmit={handleRequestToJoin}
          className="mt-3 max-w-md rounded-xl border border-sand-200 bg-sand-50 p-3.5 space-y-2.5"
        >
          <label htmlFor="join-note" className="block text-xs font-semibold text-stone-700">
            Introduction note for Circle administrators (optional)
          </label>
          <textarea
            id="join-note"
            rows={2}
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Share why you'd like to join this Circle..."
            className="w-full rounded-lg border border-sand-300 bg-white p-2 text-xs text-stone-900"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-sand-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-800"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-xs text-zinc-900"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-zinc-900" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}
