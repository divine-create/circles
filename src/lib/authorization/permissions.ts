import { CircleRole, CircleVisibility, MembershipStatus } from '@/types/domain';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

export type CirclePermission =
  | 'circle.view'
  | 'circle.read_content'
  | 'circle.update_settings'
  | 'circle.manage_capabilities'
  | 'circle.manage_spaces'
  | 'circle.manage_members'
  | 'circle.manage_roles'
  | 'circle.transfer_ownership'
  | 'circle.invite'
  | 'circle.approve_requests'
  | 'discussions.read'
  | 'discussions.post'
  | 'discussions.comment'
  | 'discussions.react'
  | 'discussions.moderate'
  | 'moderation.review_reports'
  | 'finance.manage'
  | 'finance.read';

export interface ActorContext {
  userId: string | null;
  isPlatformAdmin?: boolean;
  circleRole?: CircleRole | null;
  membershipStatus?: MembershipStatus | null;
  hasPendingInvite?: boolean;
}

const ROLE_WEIGHT: Record<CircleRole, number> = {
  owner: 40,
  admin: 30,
  moderator: 20,
  member: 10,
};

const ROLE_PERMISSION_MATRIX: Record<CircleRole, Set<CirclePermission>> = {
  owner: new Set([
    'circle.view',
    'circle.read_content',
    'circle.update_settings',
    'circle.manage_capabilities',
    'circle.manage_spaces',
    'circle.manage_members',
    'circle.manage_roles',
    'circle.transfer_ownership',
    'circle.invite',
    'circle.approve_requests',
    'discussions.read',
    'discussions.post',
    'discussions.comment',
    'discussions.react',
    'discussions.moderate',
    'moderation.review_reports',
    'finance.manage',
    'finance.read',
  ]),
  admin: new Set([
    'circle.view',
    'circle.read_content',
    'circle.update_settings',
    'circle.manage_capabilities',
    'circle.manage_spaces',
    'circle.manage_members',
    'circle.invite',
    'circle.approve_requests',
    'discussions.read',
    'discussions.post',
    'discussions.comment',
    'discussions.react',
    'discussions.moderate',
    'moderation.review_reports',
    'finance.manage',
    'finance.read',
  ]),
  moderator: new Set([
    'circle.view',
    'circle.read_content',
    'discussions.read',
    'discussions.post',
    'discussions.comment',
    'discussions.react',
    'discussions.moderate',
    'moderation.review_reports',
    'finance.read',
  ]),
  member: new Set([
    'circle.view',
    'circle.read_content',
    'discussions.read',
    'discussions.post',
    'discussions.comment',
    'discussions.react',
  ]),
};

export function hasMinimumCircleRole(
  actualRole: CircleRole | null | undefined,
  status: MembershipStatus | null | undefined,
  minimumRole: CircleRole
): boolean {
  if (!actualRole || status !== 'active') return false;
  return ROLE_WEIGHT[actualRole] >= ROLE_WEIGHT[minimumRole];
}

export function canDiscoverCircle(
  visibility: CircleVisibility,
  actor: ActorContext
): boolean {
  if (actor.isPlatformAdmin) return true;
  if (visibility === 'public' || visibility === 'discoverable_approval') return true;
  if (actor.membershipStatus === 'active' && actor.circleRole) return true;
  if (actor.hasPendingInvite) return true;
  return false;
}

export function canReadCircleContent(
  visibility: CircleVisibility,
  actor: ActorContext
): boolean {
  if (actor.isPlatformAdmin) return true;
  if (visibility === 'public') return true;
  if (actor.membershipStatus === 'active' && actor.circleRole) return true;
  return false;
}

export function hasCirclePermission(
  permission: CirclePermission,
  visibility: CircleVisibility,
  actor: ActorContext
): boolean {
  if (actor.isPlatformAdmin) {
    // Platform admins can inspect, moderate, and review reports, but do not impersonate owners for normal posting unless members
    if (
      permission === 'circle.view' ||
      permission === 'circle.read_content' ||
      permission === 'discussions.read' ||
      permission === 'discussions.moderate' ||
      permission === 'moderation.review_reports'
    ) {
      return true;
    }
  }

  if (permission === 'circle.view') {
    return canDiscoverCircle(visibility, actor);
  }

  if (permission === 'circle.read_content' || permission === 'discussions.read') {
    return canReadCircleContent(visibility, actor);
  }

  if (!actor.userId || actor.membershipStatus !== 'active' || !actor.circleRole) {
    return false;
  }

  return ROLE_PERMISSION_MATRIX[actor.circleRole].has(permission);
}

export function assertCirclePermission(
  permission: CirclePermission,
  visibility: CircleVisibility,
  actor: ActorContext,
  customMessage?: string
): void {
  if (!actor.userId && permission !== 'circle.view' && permission !== 'circle.read_content') {
    throw new UnauthorizedError();
  }
  if (!hasCirclePermission(permission, visibility, actor)) {
    throw new ForbiddenError(
      customMessage ?? `Insufficient permissions: "${permission}" is not granted for your current role.`
    );
  }
}

export function canModifyUserContent(
  authorId: string,
  actor: ActorContext
): boolean {
  if (!actor.userId) return false;
  if (actor.isPlatformAdmin) return true;
  if (actor.membershipStatus !== 'active' || !actor.circleRole) return false;
  if (actor.userId === authorId) return true;
  return hasMinimumCircleRole(actor.circleRole, actor.membershipStatus, 'moderator');
}
