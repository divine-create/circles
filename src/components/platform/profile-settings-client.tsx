'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { ProfileVisibility, UserProfile } from '@/types/domain';

export function ProfileSettingsClient({ initialUser }: { initialUser: UserProfile }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialUser.display_name);
  const [username, setUsername] = useState(initialUser.username);
  const [bio, setBio] = useState(initialUser.bio || '');
  const [location, setLocation] = useState(initialUser.location || '');
  const [avatarUrl, setAvatarUrl] = useState(initialUser.avatar_url || '');
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>(
    initialUser.profile_visibility
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          username,
          bio,
          location: location.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
          profileVisibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update profile.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Network error while saving profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm space-y-6"
    >
      <div className="flex items-center justify-between border-b border-stone-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Profile & Account Settings</h1>
          <p className="mt-1 text-xs text-stone-600">
            Manage your identity and privacy visibility across Circles.
          </p>
        </div>

        {initialUser.is_platform_admin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
            <Shield className="h-3.5 w-3.5" />
            Platform Administrator
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
        >
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-100 p-3.5 text-xs font-semibold text-zinc-900"
        >
          <CheckCircle2 className="h-4 w-4 text-zinc-900" />
          <span>Profile changes saved successfully.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-display-name" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            Display Name
          </label>
          <input
            id="profile-display-name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
          />
        </div>

        <div>
          <label htmlFor="profile-username" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            Username
          </label>
          <input
            id="profile-username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm font-mono text-stone-900"
          />
        </div>
      </div>

      <div>
        <label htmlFor="profile-bio" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
          Bio
        </label>
        <textarea
          id="profile-bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell fellow Circle members about your interests and work..."
          className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="profile-location" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            Location
          </label>
          <input
            id="profile-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. London, UK"
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
          />
        </div>

        <div>
          <label htmlFor="profile-avatar" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            Avatar Image URL
          </label>
          <input
            id="profile-avatar"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
          />
        </div>

        <div>
          <label htmlFor="profile-visibility" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            Profile Visibility
          </label>
          <select
            id="profile-visibility"
            value={profileVisibility}
            onChange={(e) => setProfileVisibility(e.target.value as ProfileVisibility)}
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
          >
            <option value="public">Public — Visible across Circles</option>
            <option value="members_only">Authenticated Members Only</option>
            <option value="private">Private — Only visible to you and platform admins</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end border-t border-stone-100 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-black px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}
