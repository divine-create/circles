import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_REGISTRY,
  getAllCapabilityDefinitions,
  getDefaultEnabledCapabilityKeys,
  validateCapabilityTransition,
} from '@/features/capabilities/registry';
import {
  canDiscoverCircle,
  canModifyUserContent,
  canReadCircleContent,
  hasCirclePermission,
} from '@/lib/authorization/permissions';

describe('Capability Registry & Dependency Rules', () => {
  it('defines a complete capability catalog with valid dependencies', () => {
    const all = getAllCapabilityDefinitions();
    expect(all.length).toBeGreaterThanOrEqual(20);

    for (const cap of all) {
      for (const dep of cap.dependencies) {
        expect(CAPABILITY_REGISTRY[dep]).toBeDefined();
      }
    }

    const defaults = getDefaultEnabledCapabilityKeys();
    expect(defaults).toContain('discussions');
    expect(defaults).toContain('spaces');
    expect(defaults).toContain('member_directory');
  });

  it('rejects enabling a capability when its required dependency is disabled', () => {
    const enabled = new Set(['discussions']); // 'spaces' is NOT enabled
    const res = validateCapabilityTransition('events', true, enabled);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Spaces & Subgroups');
  });

  it('allows enabling a capability when its required dependency is enabled', () => {
    const enabled = new Set(['discussions', 'spaces']);
    const res = validateCapabilityTransition('events', true, enabled);
    expect(res.valid).toBe(true);
  });

  it('rejects disabling a capability when another enabled capability depends on it', () => {
    const enabled = new Set(['discussions', 'spaces', 'events', 'rsvps']);
    const disableEvents = validateCapabilityTransition('events', false, enabled);
    expect(disableEvents.valid).toBe(false);
    expect(disableEvents.reason).toContain('RSVPs');

    const disableSpaces = validateCapabilityTransition('spaces', false, enabled);
    expect(disableSpaces.valid).toBe(false);
    expect(disableSpaces.reason).toContain('Events');
  });
});

describe('Centralized Permission Matrix', () => {
  it('enforces visibility and discovery rules across Public, Approval, and Private Circles', () => {
    const anonActor = { userId: null };
    const nonMemberActor = { userId: 'user-1', circleRole: null, membershipStatus: null };
    const invitedActor = {
      userId: 'user-2',
      circleRole: null,
      membershipStatus: null,
      hasPendingInvite: true,
    };
    const activeMember = {
      userId: 'user-3',
      circleRole: 'member' as const,
      membershipStatus: 'active' as const,
    };

    // Public Circle
    expect(canDiscoverCircle('public', anonActor)).toBe(true);
    expect(canReadCircleContent('public', anonActor)).toBe(true);

    // Discoverable with approval Circle
    expect(canDiscoverCircle('discoverable_approval', nonMemberActor)).toBe(true);
    expect(canReadCircleContent('discoverable_approval', nonMemberActor)).toBe(false);
    expect(canReadCircleContent('discoverable_approval', activeMember)).toBe(true);

    // Private Circle
    expect(canDiscoverCircle('private', anonActor)).toBe(false);
    expect(canDiscoverCircle('private', nonMemberActor)).toBe(false);
    expect(canDiscoverCircle('private', invitedActor)).toBe(true);
    expect(canReadCircleContent('private', nonMemberActor)).toBe(false);
    expect(canReadCircleContent('private', activeMember)).toBe(true);
  });

  it('distinguishes Owner, Admin, Moderator, Member, and Suspended roles', () => {
    const owner = { userId: 'u1', circleRole: 'owner' as const, membershipStatus: 'active' as const };
    const admin = { userId: 'u2', circleRole: 'admin' as const, membershipStatus: 'active' as const };
    const mod = { userId: 'u3', circleRole: 'moderator' as const, membershipStatus: 'active' as const };
    const member = { userId: 'u4', circleRole: 'member' as const, membershipStatus: 'active' as const };
    const suspended = { userId: 'u5', circleRole: 'member' as const, membershipStatus: 'suspended' as const };

    expect(hasCirclePermission('circle.transfer_ownership', 'public', owner)).toBe(true);
    expect(hasCirclePermission('circle.transfer_ownership', 'public', admin)).toBe(false);

    expect(hasCirclePermission('circle.manage_capabilities', 'public', admin)).toBe(true);
    expect(hasCirclePermission('circle.manage_capabilities', 'public', mod)).toBe(false);
    expect(hasCirclePermission('circle.manage_capabilities', 'public', member)).toBe(false);

    expect(hasCirclePermission('discussions.moderate', 'public', mod)).toBe(true);
    expect(hasCirclePermission('discussions.moderate', 'public', member)).toBe(false);

    expect(hasCirclePermission('discussions.post', 'public', member)).toBe(true);
    expect(hasCirclePermission('discussions.post', 'public', suspended)).toBe(false);

    expect(canModifyUserContent('u4', member)).toBe(true);
    expect(canModifyUserContent('u1', member)).toBe(false);
    expect(canModifyUserContent('u1', mod)).toBe(true);
  });
});
