'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  History,
  LayoutGrid,
  Mail,
  Plus,
  Settings,
  Sliders,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AuditLogItem,
  Circle,
  CircleCapabilityState,
  CircleCategory,
  CircleInvitation,
  CircleJoinRequest,
  CircleMembership,
  CircleRole,
  CircleSpace,
  CircleVisibility,
  MembershipPolicy,
} from '@/types/domain';

interface CircleStudioClientProps {
  circle: Circle;
  capabilities: CircleCapabilityState[];
  spaces: CircleSpace[];
  members: CircleMembership[];
  joinRequests: CircleJoinRequest[];
  invitations: CircleInvitation[];
  auditLogs: AuditLogItem[];
}

export function CircleStudioClient({
  circle: initialCircle,
  capabilities: initialCapabilities,
  spaces: initialSpaces,
  members: initialMembers,
  joinRequests: initialRequests,
  invitations: initialInvitations,
  auditLogs: initialLogs,
}: CircleStudioClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'general' | 'capabilities' | 'spaces' | 'members' | 'audit'
  >('general');

  // General Settings State (with explicit unsaved changes tracking)
  const [name, setName] = useState(initialCircle.name);
  const [description, setDescription] = useState(initialCircle.description);
  const [category, setCategory] = useState<CircleCategory>(initialCircle.category);
  const [location, setLocation] = useState(initialCircle.location || '');
  const [visibility, setVisibility] = useState<CircleVisibility>(initialCircle.visibility);
  const [membershipPolicy, setMembershipPolicy] = useState<MembershipPolicy>(
    initialCircle.membership_policy
  );
  const [savedSnapshot, setSavedSnapshot] = useState({
    name: initialCircle.name,
    description: initialCircle.description,
    category: initialCircle.category,
    location: initialCircle.location || '',
    visibility: initialCircle.visibility,
    membershipPolicy: initialCircle.membership_policy,
  });

  const hasUnsavedChanges =
    name !== savedSnapshot.name ||
    description !== savedSnapshot.description ||
    category !== savedSnapshot.category ||
    location !== savedSnapshot.location ||
    visibility !== savedSnapshot.visibility ||
    membershipPolicy !== savedSnapshot.membershipPolicy;

  const [capabilities, setCapabilities] = useState<CircleCapabilityState[]>(initialCapabilities);
  const [spaces, setSpaces] = useState<CircleSpace[]>(initialSpaces);
  const [members, setMembers] = useState<CircleMembership[]>(initialMembers);
  const [joinRequests, setJoinRequests] = useState<CircleJoinRequest[]>(initialRequests);
  const [invitations, setInvitations] = useState<CircleInvitation[]>(initialInvitations);

  // New Space Form
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceCapability, setNewSpaceCapability] = useState('discussions');
  const [newSpacePolicy, setNewSpacePolicy] = useState<'members' | 'moderators' | 'admins'>('members');

  // Invitation Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<CircleRole, 'owner'>>('member');
  const [lastIssuedToken, setLastIssuedToken] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  function showConfirmedSave(msg: string) {
    setError(null);
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 4000);
  }

  async function handleSaveGeneralSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedBanner(null);

    try {
      const res = await fetch(`/api/circles/${initialCircle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category,
          location: location.trim() || null,
          visibility,
          membershipPolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save Circle settings.');
        return;
      }

      const updated: Circle = data.circle;
      setVisibility(updated.visibility);
      setMembershipPolicy(updated.membership_policy);
      setSavedSnapshot({
        name: updated.name,
        description: updated.description,
        category: updated.category,
        location: updated.location || '',
        visibility: updated.visibility,
        membershipPolicy: updated.membership_policy,
      });
      showConfirmedSave('Circle settings saved successfully.');
      router.refresh();
    } catch {
      setError('Network error while saving settings.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleCapability(
    capabilityKey: string,
    nextEnabled: boolean,
    nextSettings?: Record<string, unknown>
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/capabilities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityKey, enabled: nextEnabled, settings: nextSettings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update capability.');
        return;
      }
      setCapabilities((prev) =>
        prev.map((c) =>
          c.capability_key === capabilityKey
            ? {
                ...c,
                enabled: data.capability.enabled,
                settings: data.capability.settings ?? c.settings,
              }
            : c
        )
      );
      showConfirmedSave(
        nextSettings
          ? `Updated settings for "${capabilityKey}".`
          : `Capability "${capabilityKey}" ${nextEnabled ? 'enabled' : 'disabled (existing data preserved)'}.`
      );
      router.refresh();
    } catch {
      setError('Network error updating capability.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReorderSpace(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= spaces.length) return;
    const nextSpaces = [...spaces];
    const [moved] = nextSpaces.splice(index, 1);
    nextSpaces.splice(targetIndex, 0, moved);
    setSpaces(nextSpaces);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/spaces`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          orderedSpaceIds: nextSpaces.map((s) => s.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Could not reorder spaces.');
        return;
      }
      showConfirmedSave('Space navigation order updated.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferOwnership(newOwnerUserId: string, displayName: string) {
    if (
      !confirm(
        `Transfer primary Circle ownership to ${displayName}? Your role will become Administrator.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer_ownership', newOwnerUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to transfer ownership.');
        return;
      }
      showConfirmedSave(`Ownership transferred to ${displayName}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleMemberSuspension(targetUserId: string, currentStatus: string) {
    const action = currentStatus === 'suspended' ? 'restore_member' : 'suspend_member';
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circleId: initialCircle.id,
          actionType: action,
          targetId: targetUserId,
          reason:
            action === 'suspend_member'
              ? 'Suspended from Circle Studio'
              : 'Restored from Circle Studio',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update member status.');
        return;
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === targetUserId
            ? { ...m, status: action === 'suspend_member' ? 'suspended' : 'active' }
            : m
        )
      );
      showConfirmedSave(
        action === 'suspend_member' ? 'Member suspended.' : 'Member restored to active.'
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/spaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSpaceName,
          description: newSpaceDescription,
          capabilityKey: newSpaceCapability || null,
          postingPolicy: newSpacePolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create space.');
        return;
      }
      setSpaces((prev) => [...prev, data.space]);
      setNewSpaceName('');
      setNewSpaceDescription('');
      showConfirmedSave(`Space "${data.space.name}" created.`);
      router.refresh();
    } catch {
      setError('Network error creating space.');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveSpace(spaceId: string, archived: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/spaces`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', spaceId, archived }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update space state.');
        return;
      }
      setSpaces((prev) => prev.map((s) => (s.id === spaceId ? data.space : s)));
      showConfirmedSave(archived ? 'Space archived.' : 'Space restored.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewJoinRequest(requestId: string, decision: 'approve_request' | 'reject_request') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, requestId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not process join request.');
        return;
      }
      setJoinRequests((prev) =>
        prev.map((jr) =>
          jr.id === requestId
            ? { ...jr, status: decision === 'approve_request' ? 'approved' : 'rejected' }
            : jr
        )
      );
      showConfirmedSave(
        decision === 'approve_request'
          ? 'Join request approved and member added.'
          : 'Join request rejected.'
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateMemberRole(targetUserId: string, role: Exclude<CircleRole, 'owner'>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role', targetUserId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to change member role.');
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.user_id === targetUserId ? { ...m, role } : m))
      );
      showConfirmedSave(`Updated member role to ${role}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastIssuedToken(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not issue invitation.');
        return;
      }
      setInvitations((prev) => [data.invitation, ...prev]);
      setLastIssuedToken(data.rawToken);
      setInviteEmail('');
      showConfirmedSave(`Invitation created for ${data.invitation.invited_email}.`);
    } finally {
      setBusy(false);
    }
  }

  const pendingJoinCount = joinRequests.filter((jr) => jr.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-900">
            Circle Studio Control Center
          </span>
          <h2 className="mt-0.5 text-2xl font-bold text-stone-900">
            Configure {initialCircle.name}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              All changes synced
            </span>
          )}
        </div>
      </div>

      {/* Studio Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {[
          { id: 'general', label: 'Identity & Policy', icon: Settings },
          { id: 'capabilities', label: 'Capabilities Registry', icon: Sliders },
          { id: 'spaces', label: 'Spaces & Navigation', icon: LayoutGrid },
          {
            id: 'members',
            label: `Members & Requests${pendingJoinCount > 0 ? ` (${pendingJoinCount})` : ''}`,
            icon: Users,
          },
          { id: 'audit', label: 'Audit Log', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {savedBanner && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-100 p-4 text-xs font-semibold text-zinc-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-zinc-900" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* TAB 1: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <form
          onSubmit={handleSaveGeneralSettings}
          className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="studio-name" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Circle Name
              </label>
              <input
                id="studio-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
              />
            </div>

            <div>
              <label htmlFor="studio-location" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Location
              </label>
              <input
                id="studio-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Campus, or Remote"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="studio-description" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
              Circle Description
            </label>
            <textarea
              id="studio-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="studio-category" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Category
              </label>
              <select
                id="studio-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CircleCategory)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
              >
                <option value="university">University</option>
                <option value="neighbourhood">Neighbourhood</option>
                <option value="professional">Professional Network</option>
                <option value="creator">Creator Community</option>
                <option value="learning">Learning Community</option>
                <option value="sports">Sports Club</option>
                <option value="project">Project Team</option>
                <option value="local_business">Local Business</option>
                <option value="general">General Community</option>
              </select>
            </div>

            <div>
              <label htmlFor="studio-visibility" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Visibility Mode
              </label>
              <select
                id="studio-visibility"
                value={visibility}
                onChange={(e) => {
                  const nextVis = e.target.value as CircleVisibility;
                  setVisibility(nextVis);
                  if (nextVis === 'private') setMembershipPolicy('invite_only');
                  if (nextVis === 'discoverable_approval') setMembershipPolicy('approval');
                  if (nextVis === 'public' && membershipPolicy === 'invite_only') {
                    setMembershipPolicy('open');
                  }
                }}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900"
              >
                <option value="public">Public</option>
                <option value="discoverable_approval">Discoverable with Approval</option>
                <option value="private">Private (Invite Only)</option>
              </select>
            </div>

            <div>
              <label htmlFor="studio-policy" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Membership Policy
              </label>
              <select
                id="studio-policy"
                value={membershipPolicy}
                onChange={(e) => setMembershipPolicy(e.target.value as MembershipPolicy)}
                disabled={visibility === 'private'}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900 disabled:opacity-60"
              >
                {visibility === 'public' && <option value="open">Open Joining</option>}
                {visibility !== 'private' && <option value="approval">Approval Required</option>}
                {visibility !== 'public' && <option value="invite_only">Invite Only</option>}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 pt-4">
            <span className="text-xs text-stone-500">
              {hasUnsavedChanges
                ? 'You have unsaved configuration changes.'
                : 'Settings match server state.'}
            </span>
            <button
              type="submit"
              disabled={busy || !hasUnsavedChanges}
              className="rounded-xl bg-black px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: CAPABILITY REGISTRY */}
      {activeTab === 'capabilities' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Authoritative Capability Registry
            </h3>
            <p className="mt-1 text-xs text-stone-600">
              Enable or disable capabilities for this Circle. Dependencies are enforced on the
              server, and disabling a capability never deletes its existing historical data.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {capabilities.map((cap) => {
              const def = cap.definition;
              if (!def) return null;
              const isPlanned = def.release_stage === 'planned';

              return (
                <div
                  key={cap.capability_key}
                  className={`flex flex-col justify-between rounded-xl border p-4 ${
                    cap.enabled
                      ? 'border-black/30 bg-stone-100/30'
                      : 'border-stone-200 bg-stone-50/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-stone-900">{def.name}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          def.release_stage === 'stable'
                            ? 'bg-zinc-950 text-white font-mono'
                            : def.release_stage === 'beta'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {def.release_stage === 'planned' ? 'P1 Planned' : def.release_stage}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">{def.description}</p>
                    {def.dependencies.length > 0 && (
                      <p className="mt-2 text-[11px] font-medium text-stone-500">
                        Depends on: <code className="text-stone-700">{def.dependencies.join(', ')}</code>
                      </p>
                    )}

                    {cap.enabled && cap.capability_key === 'discussions' && (
                      <div className="mt-3 flex flex-wrap gap-3 border-t border-stone-200/60 pt-2.5 text-xs text-stone-700">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cap.settings?.allowMemberPosts !== false}
                            disabled={busy}
                            onChange={(e) =>
                              handleToggleCapability(cap.capability_key, true, {
                                ...cap.settings,
                                allowMemberPosts: e.target.checked,
                              })
                            }
                            className="rounded border-stone-200 text-stone-900"
                          />
                          <span>Allow member posts</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cap.settings?.allowReactions !== false}
                            disabled={busy}
                            onChange={(e) =>
                              handleToggleCapability(cap.capability_key, true, {
                                ...cap.settings,
                                allowReactions: e.target.checked,
                              })
                            }
                            className="rounded border-stone-200 text-stone-900"
                          />
                          <span>Allow reactions</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-stone-200/80 pt-3">
                    <span className="text-xs font-semibold text-stone-700">
                      Status: {cap.enabled ? 'Enabled' : 'Disabled'}
                    </span>

                    {isPlanned ? (
                      <span className="text-[11px] font-medium text-stone-400">
                        Deferred to P1 Release
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleCapability(cap.capability_key, !cap.enabled)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          cap.enabled
                            ? 'border border-stone-200 bg-white text-stone-700 hover:bg-red-50 hover:text-red-800'
                            : 'bg-black text-white hover:bg-zinc-800'
                        }`}
                      >
                        {cap.enabled ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SPACES & NAVIGATION */}
      {activeTab === 'spaces' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateSpace}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4"
          >
            <h3 className="text-base font-bold text-stone-900">Create a New Space</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="space-name" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Space Name *
                </label>
                <input
                  id="space-name"
                  type="text"
                  required
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g. Research Seminars"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
                />
              </div>

              <div>
                <label htmlFor="space-capability" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Associated Capability
                </label>
                <select
                  id="space-capability"
                  value={newSpaceCapability}
                  onChange={(e) => setNewSpaceCapability(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
                >
                  <option value="discussions">Discussions & Posts</option>
                  <option value="events">Events</option>
                  <option value="learning_resources">Learning & Resources</option>
                  <option value="jobs_opportunities">Jobs & Opportunities</option>
                  <option value="help_desk">Help Desk & Requests</option>
                  <option value="projects_collaboration">Projects & Collaboration</option>
                </select>
              </div>

              <div>
                <label htmlFor="space-policy" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Posting Permission
                </label>
                <select
                  id="space-policy"
                  value={newSpacePolicy}
                  onChange={(e) => setNewSpacePolicy(e.target.value as typeof newSpacePolicy)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
                >
                  <option value="members">All Active Members</option>
                  <option value="moderators">Moderators & Admins Only</option>
                  <option value="admins">Admins & Owners Only</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="space-desc" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
                Description
              </label>
              <input
                id="space-desc"
                type="text"
                value={newSpaceDescription}
                onChange={(e) => setNewSpaceDescription(e.target.value)}
                placeholder="What happens in this space?"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Space</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-stone-900">Configured Spaces</h3>
            <div className="divide-y divide-stone-100">
              {spaces.map((sp, idx) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-900">{sp.name}</span>
                      <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600">
                        /{sp.slug}
                      </span>
                      {sp.is_archived && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-600">{sp.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy || idx === 0}
                      onClick={() => handleReorderSpace(idx, 'up')}
                      className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || idx === spaces.length - 1}
                      onClick={() => handleReorderSpace(idx, 'down')}
                      className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchiveSpace(sp.id, !sp.is_archived)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>{sp.is_archived ? 'Restore' : 'Archive'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MEMBERS, JOIN REQUESTS & INVITATIONS */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Pending Join Requests */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-stone-900" />
              <h3 className="text-base font-bold text-stone-900">
                Membership Join Requests ({pendingJoinCount} pending)
              </h3>
            </div>

            {joinRequests.length === 0 ? (
              <p className="text-xs text-stone-500">No join requests recorded for this Circle.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {joinRequests.map((jr) => (
                  <div
                    key={jr.id}
                    className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-bold text-stone-900">
                        {jr.profile?.display_name ?? jr.user_id}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          ({jr.profile?.email})
                        </span>
                      </p>
                      {jr.message && (
                        <p className="mt-0.5 text-xs text-stone-600 italic">
                          &ldquo;{jr.message}&rdquo;
                        </p>
                      )}
                    </div>

                    {jr.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewJoinRequest(jr.id, 'approve_request')}
                          className="rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewJoinRequest(jr.id, 'reject_request')}
                          className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-red-50 hover:text-red-800"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-stone-700">
                        {jr.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Issue Invitation */}
          <form
            onSubmit={handleInviteMember}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-stone-900" />
              <h3 className="text-base font-bold text-stone-900">Invite a Member by Email</h3>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Exclude<CircleRole, 'owner'>)}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-900"
              >
                <option value="member">Member</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Administrator</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Send Invitation
              </button>
            </div>

            {lastIssuedToken && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-3 text-xs text-zinc-900">
                <p className="font-semibold">Invitation Link Ready:</p>
                <p className="mt-1 font-mono break-all">
                  /circles/{initialCircle.slug}?inviteToken={lastIssuedToken}
                </p>
              </div>
            )}

            {invitations.length > 0 && (
              <div className="pt-2 text-xs text-stone-500">
                Recent invitations:{' '}
                {invitations
                  .slice(0, 4)
                  .map((inv) => `${inv.invited_email} (${inv.status})`)
                  .join(' · ')}
              </div>
            )}
          </form>

          {/* Member Roles Management */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-stone-900">
              Active Members & Role Assignments ({members.length})
            </h3>
            <div className="divide-y divide-stone-100">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-sm font-bold text-stone-900">
                      {m.profile?.display_name}{' '}
                      <span className="text-xs font-normal text-stone-500">
                        @{m.profile?.username}
                      </span>
                    </p>
                    <p className="text-[11px] text-stone-500 capitalize">Status: {m.status}</p>
                  </div>

                  {m.role === 'owner' ? (
                    <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                      Circle Owner
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleUpdateMemberRole(
                            m.user_id,
                            e.target.value as Exclude<CircleRole, 'owner'>
                          )
                        }
                        className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800"
                      >
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Administrator</option>
                      </select>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleMemberSuspension(m.user_id, m.status)}
                        className="rounded-xl border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
                      >
                        {m.status === 'suspended' ? 'Restore' : 'Suspend'}
                      </button>

                      {initialCircle.current_user_role === 'owner' && m.status === 'active' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleTransferOwnership(
                              m.user_id,
                              m.profile?.display_name || m.user_id
                            )
                          }
                          className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Make Owner
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-stone-900">Security & Configuration Audit Log</h3>
          <div className="divide-y divide-stone-100 text-xs">
            {initialLogs.map((log) => (
              <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-stone-900">{log.action}</span>
                  <span className="text-stone-400">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-stone-600">
                  Actor: {log.actor_name || log.actor_id || 'System'} · Entity: {log.entity_type} (
                  {log.entity_id})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
