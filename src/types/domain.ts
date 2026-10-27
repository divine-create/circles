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
    | 'moderation_notice'
    | 'event_rsvp'
    | 'event_updated'
    | 'listing_inquiry'
    | 'booking_status'
    | 'job_application'
    | 'support_ticket'
    | 'challenge_reward'
    | 'governance_update'
    | 'system';
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
  target_type: 'post' | 'comment' | 'member' | 'listing';
  target_post_id: string | null;
  target_comment_id: string | null;
  target_user_id: string | null;
  target_listing_id?: string | null;
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

export interface CircleEventItem {
  id: string;
  circle_id: string;
  space_id: string | null;
  organizer_id: string;
  title: string;
  description: string;
  event_type: 'event' | 'meetup' | 'workshop' | 'online';
  location_type: 'in_person' | 'online' | 'hybrid';
  venue_text: string;
  meeting_url: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number | null;
  registration_closes_at: string | null;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
  organizer?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  going_count?: number;
  waitlisted_count?: number;
  attended_count?: number;
  viewer_rsvp_status?: 'going' | 'waitlisted' | 'cancelled' | null;
  viewer_attended?: boolean;
}

export interface EventRsvpItem {
  id: string;
  event_id: string;
  circle_id: string;
  user_id: string;
  status: 'going' | 'waitlisted' | 'cancelled';
  attended: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface PollOptionItem {
  id: string;
  poll_id: string;
  circle_id: string;
  label: string;
  sort_order: number;
  vote_count: number | null;
  percentage: number | null;
  viewer_voted: boolean;
}

export interface CirclePollItem {
  id: string;
  circle_id: string;
  space_id: string | null;
  creator_id: string;
  question: string;
  description: string;
  allow_multiple: boolean;
  results_visibility: 'always' | 'after_vote' | 'after_close';
  closes_at: string | null;
  status: 'open' | 'closed' | 'archived';
  decision_summary: string | null;
  created_at: string;
  updated_at: string;
  creator?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  total_votes: number | null;
  results_visible_to_viewer: boolean;
  viewer_has_voted: boolean;
  options: PollOptionItem[];
}

export interface MarketplaceListingItem {
  id: string;
  circle_id: string;
  seller_id: string;
  listing_type: 'product' | 'service' | 'rental' | 'housing' | 'directory';
  category: string;
  title: string;
  description: string;
  price_amount: number | null;
  price_currency: string;
  pricing_unit: 'fixed' | 'hourly' | 'daily' | 'monthly' | 'free' | 'negotiable';
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'not_applicable' | null;
  location: string | null;
  contact_preference: 'in_app_inquiry' | 'email' | 'both';
  image_urls: string[];
  service_duration_minutes: number | null;
  available_from: string | null;
  available_until: string | null;
  status: 'draft' | 'published' | 'reserved' | 'sold' | 'archived' | 'removed';
  created_at: string;
  updated_at: string;
  seller?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  viewer_has_saved?: boolean;
}

export interface ListingInquiryItem {
  id: string;
  circle_id: string;
  listing_id: string;
  listing_title?: string;
  buyer_id: string;
  seller_id: string;
  message: string;
  seller_response: string | null;
  status: 'open' | 'responded' | 'accepted' | 'declined' | 'closed';
  created_at: string;
  updated_at: string;
  buyer?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
  seller?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
}

export interface ServiceBookingItem {
  id: string;
  circle_id: string;
  listing_id: string;
  listing_title?: string;
  requester_id: string;
  provider_id: string;
  booking_type: 'service' | 'rental';
  starts_at: string;
  ends_at: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'returned';
  provider_note: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
  provider?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
}

export interface JobOpportunityItem {
  id: string;
  circle_id: string;
  poster_id: string;
  title: string;
  organization_name: string;
  opportunity_type: 'full_time' | 'part_time' | 'internship' | 'freelance' | 'volunteer' | 'collaboration';
  work_mode: 'remote' | 'on_site' | 'hybrid';
  location: string | null;
  compensation_text: string | null;
  description: string;
  requirements: string;
  application_deadline: string | null;
  status: 'open' | 'closed' | 'archived';
  created_at: string;
  updated_at: string;
  poster?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  application_count?: number;
  viewer_application_status?: string | null;
}

export interface JobApplicationItem {
  id: string;
  circle_id: string;
  opportunity_id: string;
  opportunity_title?: string;
  applicant_id: string;
  cover_note: string;
  resume_url: string | null;
  portfolio_url: string | null;
  status: 'submitted' | 'under_review' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  applicant?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'email' | 'avatar_url'>;
}

export interface LearningResourceItem {
  id: string;
  circle_id: string;
  author_id: string;
  capability_key: 'learning_resources' | 'shared_resources' | 'media_publishing';
  category: string;
  title: string;
  summary: string;
  content_body: string;
  external_url: string | null;
  attachment_url: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
  author?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  viewer_has_bookmarked?: boolean;
  bookmark_count?: number;
}

export interface ProjectMemberItem {
  id: string;
  project_id: string;
  circle_id: string;
  user_id: string;
  role: 'lead' | 'contributor' | 'reviewer';
  joined_at: string;
  profile?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface ProjectTaskItem {
  id: string;
  project_id: string;
  circle_id: string;
  creator_id: string;
  assignee_id: string | null;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Pick<UserProfile, 'id' | 'username' | 'display_name'> | null;
}

export interface CircleProjectItem {
  id: string;
  circle_id: string;
  space_id: string | null;
  owner_id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  target_date: string | null;
  created_at: string;
  updated_at: string;
  owner?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  members?: ProjectMemberItem[];
  tasks?: ProjectTaskItem[];
}

export interface GovernanceProposalItem {
  id: string;
  circle_id: string;
  proposer_id: string;
  committee_name: string | null;
  title: string;
  body: string;
  status: 'draft' | 'under_review' | 'approved' | 'rejected' | 'implemented' | 'archived';
  decision_rationale: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  proposer?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
}

export interface FundraisingCampaignItem {
  id: string;
  circle_id: string;
  creator_id: string;
  title: string;
  description: string;
  goal_amount: number;
  currency: string;
  deadline: string | null;
  status: 'active' | 'completed' | 'closed';
  created_at: string;
  updated_at: string;
  pledged_total?: number;
  pledge_count?: number;
}

export interface FundraisingPledgeItem {
  id: string;
  campaign_id: string;
  circle_id: string;
  pledger_id: string;
  pledge_amount: number;
  message: string;
  status: 'pledged' | 'fulfilled_verified' | 'cancelled';
  created_at: string;
  updated_at: string;
  pledger?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
}

export interface CommunityChallengeItem {
  id: string;
  circle_id: string;
  creator_id: string;
  title: string;
  description: string;
  rules: string;
  reward_badge_name: string;
  reward_points: number;
  ends_at: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  submission_count?: number;
  viewer_submission?: ChallengeSubmissionItem | null;
}

export interface ChallengeSubmissionItem {
  id: string;
  challenge_id: string;
  circle_id: string;
  participant_id: string;
  submission_text: string;
  proof_url: string | null;
  status: 'submitted' | 'approved' | 'rejected';
  awarded_points: number;
  awarded_badge: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  participant?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
}

export interface SupportTicketItem {
  id: string;
  circle_id: string;
  requester_id: string;
  assigned_to: string | null;
  category: 'general' | 'technical' | 'membership' | 'mutual_aid' | 'facilities';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_private: boolean;
  subject: string;
  description: string;
  resolution_notes: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  requester?: Pick<UserProfile, 'id' | 'username' | 'display_name'>;
  assignee?: Pick<UserProfile, 'id' | 'username' | 'display_name'> | null;
}

export interface MediaUploadItem {
  id: string;
  circle_id: string | null;
  uploader_id: string;
  bucket_name: string;
  object_path: string;
  original_filename: string;
  safe_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256_checksum: string;
  visibility: 'public' | 'circle_members' | 'private';
  storage_backend: string;
  status: 'active' | 'orphaned' | 'deleted';
  created_at: string;
  signed_download_url?: string;
}

export interface LessonCommentItem {
  id: string;
  lesson_id: string;
  course_id: string;
  circle_id: string;
  author_id: string;
  body: string;
  status: 'published' | 'removed';
  created_at: string;
  updated_at: string;
  author?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface AssignmentSubmissionItem {
  id: string;
  assignment_id: string;
  lesson_id: string;
  course_id: string;
  circle_id: string;
  student_id: string;
  submission_body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  status: 'draft' | 'submitted' | 'in_review' | 'needs_revision' | 'approved';
  grade_score: number | null;
  instructor_feedback: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  student?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  reviewer?: Pick<UserProfile, 'id' | 'username' | 'display_name'> | null;
}

export interface CourseAssignmentItem {
  id: string;
  lesson_id: string;
  course_id: string;
  circle_id: string;
  title: string;
  prompt_body: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  user_submission?: AssignmentSubmissionItem | null;
  all_submissions?: AssignmentSubmissionItem[];
}

export interface CourseLessonItem {
  id: string;
  module_id: string;
  course_id: string;
  circle_id: string;
  title: string;
  slug: string;
  description: string;
  content_body: string;
  video_url: string | null;
  duration_minutes: number;
  attachment_url: string | null;
  attachment_name: string | null;
  is_free_preview: boolean;
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  live_event_id?: string | null;
  is_live_session?: boolean;
  content_blocks?: LessonContentBlock[];
  draft_content_blocks?: LessonContentBlock[] | null;
  learning_objectives?: string[];
  instructor_notes?: string | null;
  is_optional?: boolean;
  prerequisite_lesson_id?: string | null;
  created_at: string;
  updated_at: string;
  is_completed?: boolean;
  is_locked?: boolean;
  lock_reason?: string | null;
  comments?: LessonCommentItem[];
  assignment?: CourseAssignmentItem | null;
  quiz?: CourseQuizItem | null;
}

export type LessonContentBlock =
  | {
      id: string;
      type: 'video';
      url: string;
      provider?: 'youtube' | 'vimeo' | 'loom' | 'custom';
      title?: string;
      durationSec?: number;
    }
  | {
      id: string;
      type: 'rich_text';
      markdown: string;
    }
  | {
      id: string;
      type: 'code_sandbox';
      language: string;
      starterCode: string;
      solutionCode?: string;
      instructions?: string;
    }
  | {
      id: string;
      type: 'file_asset';
      title: string;
      fileUrl: string;
      fileSize?: string;
      mimeType?: string;
    }
  | {
      id: string;
      type: 'discussion_prompt';
      prompt: string;
      spaceId?: string;
      spaceSlug?: string;
    }
  | {
      id: string;
      type: 'live_session';
      meetingUrl: string;
      scheduledAt: string;
      timezone?: string;
      hostName?: string;
    }
  | {
      id: string;
      type: 'reflection_checkpoint';
      prompt: string;
      objectives?: string[];
    }
  | {
      id: string;
      type: 'quiz_checkpoint';
      quizId: string;
      quizTitle?: string;
      passingScore?: number;
      requiredToPass?: boolean;
    };

export interface QuestionBankItem {
  id: string;
  circle_id: string;
  instructor_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  questions_count?: number;
  created_at: string;
  updated_at: string;
}

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'code_challenge'
  | 'file_submission';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface CourseQuestionItem {
  id: string;
  bank_id: string | null;
  circle_id: string;
  type: QuestionType;
  question_text: string;
  explanation: string;
  points: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  options: QuestionOption[];
  correct_answers?: string[];
  rubrics?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseQuizItem {
  id: string;
  circle_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  description: string;
  passing_score: number;
  time_limit_minutes: number | null;
  max_attempts: number | null;
  randomize_questions: boolean;
  feedback_mode: 'immediate' | 'after_submission' | 'after_deadline';
  is_required: boolean;
  created_at: string;
  updated_at: string;
  questions?: (CourseQuestionItem & { sort_order: number; points: number })[];
  user_best_attempt?: CourseQuizAttemptItem | null;
}

export interface CourseQuizAttemptItem {
  id: string;
  quiz_id: string;
  circle_id: string;
  user_id: string;
  status: 'in_progress' | 'submitted' | 'graded';
  started_at: string;
  submitted_at: string | null;
  time_spent_seconds: number;
  score_percent: number | null;
  points_earned: number;
  points_possible: number;
  is_passed: boolean | null;
  instructor_feedback: string | null;
  grader_id?: string | null;
  graded_at?: string | null;
  answers?: CourseQuizAnswerItem[];
}

export interface CourseQuizAnswerItem {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_data: Record<string, unknown>;
  is_correct: boolean | null;
  points_awarded: number;
  instructor_feedback: string | null;
}

export interface LearningPathItem {
  id: string;
  circle_id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels' | null;
  estimated_hours: number;
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  certificate_title?: string | null;
  created_at: string;
  updated_at: string;
  courses_count?: number;
  completed_courses_count?: number;
  courses?: LearningPathCourseItem[];
  user_enrollment?: LearningPathEnrollmentItem | null;
}

export interface LearningPathCourseItem {
  id: string;
  path_id: string;
  course_id: string;
  circle_id: string;
  sort_order: number;
  is_required: boolean;
  course?: CourseItem;
  is_completed?: boolean;
  is_locked?: boolean;
  lock_reason?: string | null;
}

export interface CoursePrerequisiteItem {
  id: string;
  circle_id: string;
  course_id: string;
  prerequisite_course_id: string;
  min_score_percent: number | null;
  prerequisite_course_title?: string;
  prerequisite_course_slug?: string;
  is_satisfied?: boolean;
}

export interface LearningPathEnrollmentItem {
  id: string;
  path_id: string;
  circle_id: string;
  user_id: string;
  status: 'active' | 'completed' | 'dropped';
  progress_percent: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseModuleItem {
  id: string;
  course_id: string;
  circle_id: string;
  title: string;
  description: string;
  sort_order: number;
  drip_type?: 'instant' | 'relative_days' | 'calendar_date';
  drip_days_after_enrollment?: number;
  drip_unlock_date?: string | null;
  is_locked?: boolean;
  unlocks_at?: string | null;
  created_at: string;
  updated_at: string;
  lessons: CourseLessonItem[];
}

export interface CourseItem {
  id: string;
  circle_id: string;
  instructor_id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels' | null;
  estimated_duration_hours: number;
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  access_rule?: 'open' | 'members_only' | 'min_level' | 'staff_only';
  min_level_required?: number;
  viewer_can_access?: boolean;
  viewer_level?: number;
  created_at: string;
  updated_at: string;
  instructor?: Pick<UserProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  modules?: CourseModuleItem[];
  total_lessons_count?: number;
  completed_lessons_count?: number;
  progress_percentage?: number;
  is_enrolled?: boolean;
  learning_objectives?: string[];
  published_version?: number;
  validation_issues?: string[];
  prerequisites?: CoursePrerequisiteItem[];
}

export interface CourseLessonCompletionItem {
  id: string;
  lesson_id: string;
  course_id: string;
  circle_id: string;
  user_id: string;
  completed_at: string;
}

export interface CourseEnrollmentItem {
  id: string;
  course_id: string;
  circle_id: string;
  student_id: string;
  enrolled_at: string;
}

export interface MemberXpSummary {
  user_id: string;
  total_xp: number;
  current_level: number;
  next_level_xp: number;
  level_progress_percentage: number;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_xp: number;
  current_level: number;
  rank: number;
}

export interface StudentCourseProgress {
  course_id: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  completed_lesson_ids: string[];
  next_lesson_id: string | null;
}

// ============================================================================
// Hyper-Configurable Financial & Pricing Engine Types
// ============================================================================

export type BillingType =
  | 'one_time'
  | 'recurring'
  | 'installments'
  | 'sliding_scale'
  | 'metered_pack';

export type IntervalUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type EntitlementTargetType =
  | 'circle_membership'
  | 'space_access'
  | 'course_access'
  | 'role_grant'
  | 'resource_quota'
  | 'badge_grant';

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible'
  | 'refunded';

export type PaymentMethod =
  | 'stripe'
  | 'bank_transfer'
  | 'cash'
  | 'manual_credit'
  | 'external_erp'
  | 'free_grant';

export type EntitlementStatus =
  | 'active'
  | 'grace_period'
  | 'expired'
  | 'revoked';

export type TreasuryEntryType = 'revenue' | 'expense' | 'transfer';

export type TreasuryCategory =
  | 'dues'
  | 'maintenance'
  | 'amenities'
  | 'courses'
  | 'events'
  | 'utilities'
  | 'reserve_fund'
  | 'refunds'
  | 'other';

export interface PricingPlanItem {
  id: string;
  circle_id: string;
  slug: string;
  name: string;
  description: string;
  billing_type: BillingType;
  amount_cents: number;
  currency: string;
  interval_unit: IntervalUnit | null;
  interval_count: number | null;
  installment_count: number | null;
  min_amount_cents: number | null;
  suggested_amounts_cents: number[];
  is_active: boolean;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  entitlements?: PricingPlanEntitlementItem[];
}

export interface PricingPlanEntitlementItem {
  id: string;
  plan_id: string;
  circle_id: string;
  target_type: EntitlementTargetType;
  target_id: string | null;
  quota_quantity: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  circle_id: string;
  user_id: string;
  plan_id: string | null;
  invoice_number: string;
  title: string;
  description: string;
  status: InvoiceStatus;
  total_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  due_date: string | null;
  paid_at: string | null;
  notes: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  user_display_name?: string;
  user_username?: string;
  plan_name?: string;
}

export interface MemberEntitlementItem {
  id: string;
  circle_id: string;
  user_id: string;
  plan_id: string | null;
  invoice_id: string | null;
  target_type: EntitlementTargetType;
  target_id: string | null;
  status: EntitlementStatus;
  granted_at: string;
  expires_at: string | null;
  grace_period_ends_at: string | null;
  remaining_quota: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CommunityTreasuryLedgerItem {
  id: string;
  circle_id: string;
  entry_type: TreasuryEntryType;
  category: TreasuryCategory;
  amount_cents: number;
  currency: string;
  description: string;
  is_public_to_members: boolean;
  invoice_id: string | null;
  recorded_by: string;
  entry_date: string;
  metadata: Record<string, unknown>;
  created_at: string;
  recorded_by_name?: string;
}

export interface TreasurySummary {
  currency: string;
  total_revenue_cents: number;
  total_expense_cents: number;
  net_balance_cents: number;
  category_breakdown: Record<TreasuryCategory, number>;
}

export interface CircleWebhookItem {
  id: string;
  circle_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CircleWebhookDeliveryItem {
  id: string;
  webhook_id: string;
  circle_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  status: 'delivered' | 'failed' | 'retrying';
  delivered_at: string;
}

export interface CircleApiKeyItem {
  id: string;
  circle_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  plainToken?: string;
}



