import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(128),
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters.').max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,32}$/, 'Username must be 3-32 characters using lowercase letters, numbers, or underscores.'),
});

export const signInSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password is required.'),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,32}$/, 'Username must be 3-32 lowercase alphanumeric or underscore characters.'),
  bio: z.string().trim().max(500).default(''),
  location: z.string().trim().max(100).nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
  profileVisibility: z.enum(['public', 'members_only', 'private']).default('public'),
});

export const circleCategoryEnum = z.enum([
  'university',
  'neighbourhood',
  'professional',
  'creator',
  'learning',
  'sports',
  'project',
  'local_business',
  'faith',
  'housing',
  'marketplace',
  'nonprofit',
  'general',
]);

export const circleVisibilityEnum = z.enum(['public', 'discoverable_approval', 'private']);
export const membershipPolicyEnum = z.enum(['open', 'approval', 'invite_only']);

export const createCircleSchema = z.object({
  name: z.string().trim().min(2, 'Circle name must be at least 2 characters.').max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers, and hyphens.')
    .min(2)
    .max(64)
    .optional(),
  description: z.string().trim().max(2000).default(''),
  category: circleCategoryEnum.default('general'),
  location: z.string().trim().max(120).optional().nullable(),
  visibility: circleVisibilityEnum.default('public'),
  membershipPolicy: membershipPolicyEnum.default('open'),
  templateKey: z.string().trim().optional().nullable(),
});

export const updateCircleSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  category: circleCategoryEnum.optional(),
  location: z.string().trim().max(120).nullable().optional(),
  avatarUrl: z.string().trim().max(500).nullable().optional(),
  coverUrl: z.string().trim().max(500).nullable().optional(),
  visibility: circleVisibilityEnum.optional(),
  membershipPolicy: membershipPolicyEnum.optional(),
});

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1, 'Space name is required.').max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(1)
    .max(48)
    .optional(),
  description: z.string().trim().max(400).default(''),
  icon: z.string().trim().max(40).default('message-square'),
  capabilityKey: z.string().trim().nullable().optional(),
  visibility: z.enum(['public', 'members', 'staff_only']).default('members'),
  postingPolicy: z.enum(['members', 'moderators', 'admins']).default('members'),
});

export const createPostSchema = z.object({
  circleId: z.string().uuid(),
  spaceId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2, 'Post title must be at least 2 characters.').max(200),
  body: z.string().trim().min(2, 'Post content cannot be empty.').max(10000),
});

export const updatePostSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  body: z.string().trim().min(2).max(10000).optional(),
  isPinned: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  circleId: z.string().uuid(),
  postId: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty.').max(4000),
});

export const createReportSchema = z.object({
  circleId: z.string().uuid(),
  targetType: z.enum(['post', 'comment', 'member', 'listing']),
  targetPostId: z.string().uuid().nullable().optional(),
  targetCommentId: z.string().uuid().nullable().optional(),
  targetUserId: z.string().uuid().nullable().optional(),
  targetListingId: z.string().uuid().nullable().optional(),
  reason: z.enum(['spam', 'harassment', 'misinformation', 'rule_violation', 'other']),
  details: z.string().trim().max(1000).default(''),
});

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}
