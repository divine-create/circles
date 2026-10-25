export type CircleVisibility = 'public' | 'discoverable_approval' | 'private';
export type MembershipPolicy = 'open' | 'approval' | 'invite_only';
export type CircleRole = 'owner' | 'admin' | 'moderator' | 'member';
export type MembershipStatus = 'active' | 'suspended' | 'left';
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
export type ProfileVisibility = 'public' | 'members_only' | 'private';

export type CircleCategory =
  | 'university'
  | 'neighbourhood'
  | 'professional'
  | 'creator'
  | 'learning'
  | 'sports'
  | 'project'
  | 'local_business'
  | 'faith'
  | 'housing'
  | 'marketplace'
  | 'nonprofit'
  | 'general';

export type CapabilityCategory =
  | 'community'
  | 'events_activities'
  | 'commerce_discovery'
  | 'knowledge_collaboration'
  | 'organization_finance';

export type CapabilityReleaseStage = 'stable' | 'beta' | 'planned';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  location: string | null;
  profile_visibility: ProfileVisibility;
  is_platform_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Circle {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: CircleCategory;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  visibility: CircleVisibility;
  membership_policy: MembershipPolicy;
  status: 'active' | 'archived' | 'suspended';
  owner_id: string;
  template_key: string | null;
  template_version: number | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  member_count?: number;
  current_user_role?: CircleRole | null;
  current_user_membership_status?: MembershipStatus | null;
  current_user_join_request_status?: JoinRequestStatus | null;
}

export interface CircleMembership {
  id: string;
  circle_id: string;
  user_id: string;
  role: CircleRole;
  status: MembershipStatus;
  joined_at: string;
  updated_at: string;
  profile?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'bio'>;
}

export interface CircleJoinRequest {
  id: string;
  circle_id: string;
  user_id: string;
  message: string;
  status: JoinRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  profile?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'email' | 'avatar_url'>;
}

export interface CircleInvitation {
  id: string;
  circle_id: string;
  inviter_id: string;
  invited_email: string;
  invited_user_id: string | null;
  role: Exclude<CircleRole, 'owner'>;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  circle_name?: string;
  circle_slug?: string;
  inviter_name?: string;
}

export interface CapabilityDefinition {
  key: string;
  name: string;
  description: string;
  version: string;
  category: CapabilityCategory;
  default_enabled: boolean;
  release_stage: CapabilityReleaseStage;
  dependencies: string[];
  default_settings: Record<string, unknown>;
  required_permissions: string[];
  navigation_config: {
    label: string;
    path: string;
    icon: string;
  };
}

export interface CircleCapabilityState {
  id: string;
  circle_id: string;
  capability_key: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  enabled_by: string | null;
  enabled_at: string | null;
  disabled_at: string | null;
  updated_at: string;
  definition?: CapabilityDefinition;
}

export interface CircleSpace {
  id: string;
  circle_id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  capability_key: string | null;
  visibility: 'public' | 'members' | 'staff_only';
  posting_policy: 'members' | 'moderators' | 'admins';
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CircleNavigationItem {
  id: string;
  circle_id: string;
  label: string;
  href: string;
  icon: string;
  capability_key: string | null;
  space_id: string | null;
  visibility: 'public' | 'members' | 'staff_only';
  sort_order: number;
  is_enabled: boolean;
}

export interface PostItem {
  id: string;
  circle_id: string;
  space_id: string | null;
  author_id: string;
  title: string;
  body: string;
  status: 'published' | 'archived' | 'removed';
  is_pinned: boolean;
  comment_count: number;
  reaction_count: number;
  created_at: string;
  updated_at: string;
  author?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  space?: Pick<CircleSpace, 'id' | 'name' | 'slug' | 'icon'> | null;
  viewer_has_liked?: boolean;
  viewer_has_saved?: boolean;
}

export interface CommentItem {
  id: string;
  post_id: string;
  circle_id: string;
  author_id: string;
  body: string;
  status: 'published' | 'removed';
  created_at: string;
  updated_at: string;
  author?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  circle_id: string | null;
  event_type:
    | 'invitation_received'
    | 'join_request_received'
    | 'join_request_approved'
    | 'join_request_rejected'
    | 'new_comment'
    | 'role_changed'
    | 'circle_announcement'
    | 'moderation_notice';
  title: string;
  body: string;
  link_url: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ContentReportItem {
  id: string;
  circle_id: string;
  circle_name?: string;
  circle_slug?: string;
  reporter_id: string;
  reporter_name?: string;
  target_type: 'post' | 'comment' | 'member';
  target_post_id: string | null;
  target_comment_id: string | null;
  target_user_id: string | null;
  target_preview?: string;
  reason: 'spam' | 'harassment' | 'misinformation' | 'rule_violation' | 'other';
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  circle_id: string | null;
  actor_id: string | null;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
