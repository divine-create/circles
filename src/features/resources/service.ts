import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  CircleProjectItem,
  CircleRole,
  CircleVisibility,
  LearningResourceItem,
  MembershipStatus,
  ProjectMemberItem,
  ProjectTaskItem,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { canReadCircleContent } from '@/lib/authorization/permissions';

const RESOURCE_CAPABILITY_KEYS = [
  'learning_resources',
  'shared_resources',
  'media_publishing',
];

export const createResourceSchema = z.object({
  circleId: z.string().uuid(),
  capabilityKey: z
    .enum(['learning_resources', 'shared_resources', 'media_publishing'])
    .default('learning_resources'),
  category: z.string().trim().min(1).max(60).default('guide'),
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().max(600).default(''),
  contentBody: z.string().trim().max(25000).default(''),
  externalUrl: z.string().url().nullable().optional(),
  attachmentUrl: z.string().trim().max(1000).nullable().optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
});

export const createProjectSchema = z.object({
  circleId: z.string().uuid(),
  spaceId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(3).max(140),
  description: z.string().trim().max(4000).default(''),
  targetDate: z.string().datetime().nullable().optional(),
});

export const createProjectTaskSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(3000).default(''),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().datetime().nullable().optional(),
});

export const updateProjectTaskSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export async function createLearningResource(
  actorUserId: string,
  input: z.input<typeof createResourceSchema>
): Promise<LearningResourceItem> {
  const parsed = createResourceSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ capability_key: string }>(
      `SELECT capability_key FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = ANY($2::text[]) AND enabled = true;`,
      [parsed.circleId, RESOURCE_CAPABILITY_KEYS]
    );
    if (capRes.rows.length === 0) {
      throw new CapabilityDisabledError('learning_resources');
    }

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can publish resources.');
    }

    const res = await tx.query<LearningResourceItem>(
      `INSERT INTO public.learning_resources_items (
         id, circle_id, author_id, capability_key, category, title, summary,
         content_body, external_url, attachment_url, difficulty_level, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'published')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.capabilityKey,
        parsed.category,
        parsed.title,
        parsed.summary,
        parsed.contentBody,
        parsed.externalUrl ?? null,
        parsed.attachmentUrl ?? null,
        parsed.difficultyLevel ?? null,
      ]
    );

    return {
      ...res.rows[0],
      viewer_has_bookmarked: false,
      bookmark_count: 0,
    };
  });
}

export async function listLearningResources(
  actorUserId: string | null,
  circleId: string,
  options?: {
    capabilityKey?: 'learning_resources' | 'shared_resources' | 'media_publishing';
    category?: string;
    search?: string;
    bookmarkedOnly?: boolean;
  }
): Promise<LearningResourceItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const capRes = await tx.query<{ capability_key: string }>(
      `SELECT capability_key FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = ANY($2::text[]) AND enabled = true;`,
      [circleId, RESOURCE_CAPABILITY_KEYS]
    );
    if (capRes.rows.length === 0) {
      throw new CapabilityDisabledError('learning_resources');
    }

    let membership: { role: CircleRole; status: MembershipStatus } | null = null;
    if (actorUserId) {
      const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
        `SELECT role, status FROM public.circle_memberships
         WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
        [circleId, actorUserId]
      );
      membership = memRes.rows[0] ?? null;
    }

    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view resources in this Circle.');
    }

    const res = await tx.query<
      LearningResourceItem & {
        author_username: string;
        author_display_name: string;
        author_avatar_url: string | null;
        bookmark_count: number;
        viewer_has_bookmarked: boolean;
      }
    >(
      `SELECT r.*,
         COALESCE(u.username, 'member') AS author_username,
         COALESCE(u.display_name, 'Member') AS author_display_name,
         u.avatar_url AS author_avatar_url,
         (SELECT COUNT(*)::int FROM public.resource_bookmarks b WHERE b.resource_id = r.id) AS bookmark_count,
         EXISTS (
           SELECT 1 FROM public.resource_bookmarks b
           WHERE b.resource_id = r.id AND b.user_id = $2
         ) AS viewer_has_bookmarked
       FROM public.learning_resources_items r
       LEFT JOIN public.profiles u ON u.id = r.author_id
       WHERE r.circle_id = $1 AND r.status = 'published'
       ORDER BY r.created_at DESC;`,
      [circleId, actorUserId]
    );

    let items: LearningResourceItem[] = res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      author_id: r.author_id,
      capability_key: r.capability_key,
      category: r.category,
      title: r.title,
      summary: r.summary,
      content_body: r.content_body,
      external_url: r.external_url,
      attachment_url: r.attachment_url,
      difficulty_level: r.difficulty_level,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: {
        id: r.author_id,
        username: r.author_username,
        display_name: r.author_display_name,
        avatar_url: r.author_avatar_url,
      },
      bookmark_count: Number(r.bookmark_count ?? 0),
      viewer_has_bookmarked: Boolean(r.viewer_has_bookmarked),
    }));

    if (options?.capabilityKey) {
      items = items.filter((i) => i.capability_key === options.capabilityKey);
    }
    if (options?.category) {
      items = items.filter((i) => i.category.toLowerCase() === options.category!.toLowerCase());
    }
    if (options?.bookmarkedOnly) {
      items = items.filter((i) => i.viewer_has_bookmarked);
    }
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.content_body.toLowerCase().includes(q)
      );
    }

    return items;
  });
}

export async function toggleResourceBookmark(
  actorUserId: string,
  circleId: string,
  resourceId: string
): Promise<{ bookmarked: boolean }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM public.resource_bookmarks
       WHERE resource_id = $1 AND circle_id = $2 AND user_id = $3 LIMIT 1;`,
      [resourceId, circleId, actorUserId]
    );

    if (existing.rows[0]) {
      await tx.query(`DELETE FROM public.resource_bookmarks WHERE id = $1;`, [
        existing.rows[0].id,
      ]);
      return { bookmarked: false };
    }

    await tx.query(
      `INSERT INTO public.resource_bookmarks (id, circle_id, resource_id, user_id)
       VALUES ($1, $2, $3, $4);`,
      [crypto.randomUUID(), circleId, resourceId, actorUserId]
    );
    return { bookmarked: true };
  });
}

export async function createCircleProject(
  actorUserId: string,
  input: z.input<typeof createProjectSchema>
): Promise<CircleProjectItem> {
  const parsed = createProjectSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'projects_collaboration' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('projects_collaboration');
    }

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    if (!memRes.rows[0] || memRes.rows[0].status !== 'active') {
      throw new ForbiddenError('Only active Circle members can create collaborative projects.');
    }

    const projectId = crypto.randomUUID();
    const projRes = await tx.query<CircleProjectItem>(
      `INSERT INTO public.circle_projects (
         id, circle_id, space_id, owner_id, name, description, status, target_date
       ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *;`,
      [
        projectId,
        parsed.circleId,
        parsed.spaceId ?? null,
        actorUserId,
        parsed.name,
        parsed.description,
        parsed.targetDate ?? null,
      ]
    );

    await tx.query(
      `INSERT INTO public.project_members (id, project_id, circle_id, user_id, role)
       VALUES ($1, $2, $3, $4, 'lead');`,
      [crypto.randomUUID(), projectId, parsed.circleId, actorUserId]
    );

    return {
      ...projRes.rows[0],
      members: [],
      tasks: [],
    };
  });
}

export async function joinCircleProject(
  actorUserId: string,
  circleId: string,
  projectId: string
): Promise<ProjectMemberItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'projects_collaboration' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('projects_collaboration');
    }

    const inserted = await tx.query<ProjectMemberItem>(
      `INSERT INTO public.project_members (id, project_id, circle_id, user_id, role)
       VALUES ($1, $2, $3, $4, 'contributor')
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = public.project_members.role
       RETURNING *;`,
      [crypto.randomUUID(), projectId, circleId, actorUserId]
    );

    return inserted.rows[0];
  });
}

export async function createProjectTask(
  actorUserId: string,
  circleId: string,
  projectId: string,
  input: z.input<typeof createProjectTaskSchema>
): Promise<ProjectTaskItem> {
  const parsed = createProjectTaskSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'projects_collaboration' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('projects_collaboration');
    }

    const res = await tx.query<ProjectTaskItem>(
      `INSERT INTO public.project_tasks (
         id, project_id, circle_id, creator_id, assignee_id,
         title, description, priority, status, due_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'todo', $9)
       RETURNING *;`,
      [
        crypto.randomUUID(),
        projectId,
        circleId,
        actorUserId,
        parsed.assigneeId ?? null,
        parsed.title,
        parsed.description,
        parsed.priority,
        parsed.dueDate ?? null,
      ]
    );

    return res.rows[0];
  });
}

export async function updateProjectTask(
  actorUserId: string,
  circleId: string,
  taskId: string,
  input: z.input<typeof updateProjectTaskSchema>
): Promise<ProjectTaskItem> {
  const parsed = updateProjectTaskSchema.parse(input);
  if (Object.keys(parsed).length === 0) {
    throw new ValidationError('Provide at least one field to update.');
  }

  return withRlsTransaction(actorUserId, async (tx) => {
    const existingRes = await tx.query<ProjectTaskItem>(
      `SELECT * FROM public.project_tasks WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [taskId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Project task not found.');
    }

    const nextStatus = parsed.status ?? existing.status;
    const updated = await tx.query<ProjectTaskItem>(
      `UPDATE public.project_tasks
       SET title = $1,
           status = $2,
           priority = $3,
           assignee_id = $4,
           completed_at = CASE WHEN $2 = 'done' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $5 AND circle_id = $6
       RETURNING *;`,
      [
        parsed.title ?? existing.title,
        nextStatus,
        parsed.priority ?? existing.priority,
        parsed.assigneeId !== undefined ? parsed.assigneeId : existing.assignee_id,
        taskId,
        circleId,
      ]
    );

    return updated.rows[0];
  });
}

export async function listCircleProjects(
  actorUserId: string | null,
  circleId: string
): Promise<CircleProjectItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'projects_collaboration' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('projects_collaboration');
    }

    const projectsRes = await tx.query<
      CircleProjectItem & {
        owner_username: string;
        owner_display_name: string;
        owner_avatar_url: string | null;
      }
    >(
      `SELECT p.*,
         COALESCE(u.username, 'owner') AS owner_username,
         COALESCE(u.display_name, 'Owner') AS owner_display_name,
         u.avatar_url AS owner_avatar_url
       FROM public.circle_projects p
       LEFT JOIN public.profiles u ON u.id = p.owner_id
       WHERE p.circle_id = $1
       ORDER BY p.created_at DESC;`,
      [circleId]
    );

    if (projectsRes.rows.length === 0) {
      return [];
    }

    const membersRes = await tx.query<
      ProjectMemberItem & {
        username: string;
        display_name: string;
        avatar_url: string | null;
      }
    >(
      `SELECT m.*,
         COALESCE(u.username, 'member') AS username,
         COALESCE(u.display_name, 'Member') AS display_name,
         u.avatar_url
       FROM public.project_members m
       LEFT JOIN public.profiles u ON u.id = m.user_id
       WHERE m.circle_id = $1
       ORDER BY m.joined_at ASC;`,
      [circleId]
    );

    const tasksRes = await tx.query<
      ProjectTaskItem & {
        assignee_username: string | null;
        assignee_display_name: string | null;
      }
    >(
      `SELECT t.*,
         u.username AS assignee_username,
         u.display_name AS assignee_display_name
       FROM public.project_tasks t
       LEFT JOIN public.profiles u ON u.id = t.assignee_id
       WHERE t.circle_id = $1
       ORDER BY t.created_at ASC;`,
      [circleId]
    );

    return projectsRes.rows.map((proj) => ({
      id: proj.id,
      circle_id: proj.circle_id,
      space_id: proj.space_id,
      owner_id: proj.owner_id,
      name: proj.name,
      description: proj.description,
      status: proj.status,
      target_date: proj.target_date,
      created_at: proj.created_at,
      updated_at: proj.updated_at,
      owner: {
        id: proj.owner_id,
        username: proj.owner_username,
        display_name: proj.owner_display_name,
        avatar_url: proj.owner_avatar_url,
      },
      members: membersRes.rows
        .filter((m) => m.project_id === proj.id)
        .map((m) => ({
          id: m.id,
          project_id: m.project_id,
          circle_id: m.circle_id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          profile: {
            id: m.user_id,
            username: m.username,
            display_name: m.display_name,
            avatar_url: m.avatar_url,
          },
        })),
      tasks: tasksRes.rows
        .filter((t) => t.project_id === proj.id)
        .map((t) => ({
          id: t.id,
          project_id: t.project_id,
          circle_id: t.circle_id,
          creator_id: t.creator_id,
          assignee_id: t.assignee_id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          due_date: t.due_date,
          completed_at: t.completed_at,
          created_at: t.created_at,
          updated_at: t.updated_at,
          assignee: t.assignee_id
            ? {
                id: t.assignee_id,
                username: t.assignee_username ?? 'member',
                display_name: t.assignee_display_name ?? 'Member',
              }
            : null,
        })),
    }));
  });
}
