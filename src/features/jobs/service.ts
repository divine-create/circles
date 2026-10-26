import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  CircleRole,
  CircleVisibility,
  JobApplicationItem,
  JobOpportunityItem,
  MembershipStatus,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { createNotification } from '@/features/notifications/service';

export const createJobOpportunitySchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  organizationName: z.string().trim().max(140).default(''),
  opportunityType: z
    .enum(['full_time', 'part_time', 'internship', 'freelance', 'volunteer', 'collaboration'])
    .default('full_time'),
  workMode: z.enum(['remote', 'on_site', 'hybrid']).default('remote'),
  location: z.string().trim().max(180).nullable().optional(),
  compensationText: z.string().trim().max(180).nullable().optional(),
  description: z.string().trim().min(5).max(10000),
  requirements: z.string().trim().max(6000).default(''),
  applicationDeadline: z.string().datetime().nullable().optional(),
});

export const updateJobOpportunitySchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  organizationName: z.string().trim().max(140).optional(),
  opportunityType: z
    .enum(['full_time', 'part_time', 'internship', 'freelance', 'volunteer', 'collaboration'])
    .optional(),
  workMode: z.enum(['remote', 'on_site', 'hybrid']).optional(),
  location: z.string().trim().max(180).nullable().optional(),
  compensationText: z.string().trim().max(180).nullable().optional(),
  description: z.string().trim().min(5).max(10000).optional(),
  requirements: z.string().trim().max(6000).optional(),
  status: z.enum(['open', 'closed', 'archived']).optional(),
});

export const submitJobApplicationSchema = z.object({
  coverNote: z.string().trim().min(5).max(5000),
  resumeUrl: z.string().trim().max(1000).nullable().optional(),
  portfolioUrl: z.string().trim().max(1000).nullable().optional(),
});

export const reviewJobApplicationSchema = z.object({
  status: z.enum(['under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn']),
  reviewerNote: z.string().trim().max(2000).optional(),
});

async function assertJobsCapability(
  tx: { query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  circleId: string,
  actorUserId: string | null
): Promise<{
  circle: { id: string; slug: string; visibility: CircleVisibility };
  membership: { role: CircleRole; status: MembershipStatus } | null;
  allowMemberJobPosts: boolean;
}> {
  const circleRes = await tx.query<{
    id: string;
    slug: string;
    visibility: CircleVisibility;
  }>(`SELECT id, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
  const circle = circleRes.rows[0];
  if (!circle) {
    throw new NotFoundError('Circle not found.');
  }

  const capRes = await tx.query<{ enabled: boolean; settings: Record<string, unknown> }>(
    `SELECT enabled, settings FROM public.circle_capabilities
     WHERE circle_id = $1 AND capability_key = 'jobs_opportunities' AND enabled = true LIMIT 1;`,
    [circleId]
  );
  if (!capRes.rows[0]?.enabled) {
    throw new CapabilityDisabledError('jobs_opportunities');
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

  return {
    circle,
    membership,
    allowMemberJobPosts: capRes.rows[0].settings?.allowMemberJobPosts !== false,
  };
}

export async function createJobOpportunity(
  actorUserId: string,
  input: z.input<typeof createJobOpportunitySchema>
): Promise<JobOpportunityItem> {
  const parsed = createJobOpportunitySchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership, allowMemberJobPosts } = await assertJobsCapability(
      tx,
      parsed.circleId,
      actorUserId
    );
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can post job opportunities.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (!allowMemberJobPosts && !isStaff) {
      throw new ForbiddenError(
        'This Circle restricts job opportunity posting to moderators, administrators, and owners.'
      );
    }

    const res = await tx.query<JobOpportunityItem>(
      `INSERT INTO public.job_opportunities (
         id, circle_id, poster_id, title, organization_name, opportunity_type,
         work_mode, location, compensation_text, description, requirements,
         application_deadline, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.title,
        parsed.organizationName,
        parsed.opportunityType,
        parsed.workMode,
        parsed.location ?? null,
        parsed.compensationText ?? null,
        parsed.description,
        parsed.requirements,
        parsed.applicationDeadline ?? null,
      ]
    );

    return res.rows[0];
  });
}

export async function listJobOpportunities(
  actorUserId: string | null,
  circleId: string,
  options?: {
    opportunityType?: string;
    workMode?: string;
    search?: string;
    status?: 'open' | 'closed' | 'all';
  }
): Promise<JobOpportunityItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertJobsCapability(tx, circleId, actorUserId);
    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view opportunities in this Circle.');
    }

    const res = await tx.query<
      JobOpportunityItem & {
        poster_username: string;
        poster_display_name: string;
        poster_avatar_url: string | null;
        application_count: number;
        viewer_application_status: string | null;
      }
    >(
      `SELECT j.*,
         COALESCE(u.username, 'member') AS poster_username,
         COALESCE(u.display_name, 'Member') AS poster_display_name,
         u.avatar_url AS poster_avatar_url,
         (SELECT COUNT(*)::int FROM public.job_applications a WHERE a.opportunity_id = j.id) AS application_count,
         (SELECT a.status FROM public.job_applications a WHERE a.opportunity_id = j.id AND a.applicant_id = $2 LIMIT 1) AS viewer_application_status
       FROM public.job_opportunities j
       LEFT JOIN public.profiles u ON u.id = j.poster_id
       WHERE j.circle_id = $1
       ORDER BY j.created_at DESC;`,
      [circleId, actorUserId]
    );

    let items: JobOpportunityItem[] = res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      poster_id: r.poster_id,
      title: r.title,
      organization_name: r.organization_name,
      opportunity_type: r.opportunity_type,
      work_mode: r.work_mode,
      location: r.location,
      compensation_text: r.compensation_text,
      description: r.description,
      requirements: r.requirements,
      application_deadline: r.application_deadline,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      poster: {
        id: r.poster_id,
        username: r.poster_username,
        display_name: r.poster_display_name,
        avatar_url: r.poster_avatar_url,
      },
      application_count: Number(r.application_count ?? 0),
      viewer_application_status: r.viewer_application_status ?? null,
    }));

    if (options?.opportunityType) {
      items = items.filter((i) => i.opportunity_type === options.opportunityType);
    }
    if (options?.workMode) {
      items = items.filter((i) => i.work_mode === options.workMode);
    }
    if (options?.status && options.status !== 'all') {
      items = items.filter((i) => i.status === options.status);
    }
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.organization_name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.location ?? '').toLowerCase().includes(q)
      );
    }

    return items;
  });
}

export async function updateJobOpportunity(
  actorUserId: string,
  circleId: string,
  opportunityId: string,
  input: z.input<typeof updateJobOpportunitySchema>
): Promise<JobOpportunityItem> {
  const parsed = updateJobOpportunitySchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertJobsCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<JobOpportunityItem>(
      `SELECT * FROM public.job_opportunities WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [opportunityId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Opportunity not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (existing.poster_id !== actorUserId && !isStaff) {
      throw new ForbiddenError('Only the opportunity poster or a Circle moderator can edit this posting.');
    }

    const updated = await tx.query<JobOpportunityItem>(
      `UPDATE public.job_opportunities
       SET title = $1,
           organization_name = $2,
           opportunity_type = $3,
           work_mode = $4,
           location = $5,
           compensation_text = $6,
           description = $7,
           requirements = $8,
           status = $9,
           updated_at = NOW()
       WHERE id = $10 AND circle_id = $11
       RETURNING *;`,
      [
        parsed.title ?? existing.title,
        parsed.organizationName ?? existing.organization_name,
        parsed.opportunityType ?? existing.opportunity_type,
        parsed.workMode ?? existing.work_mode,
        parsed.location !== undefined ? parsed.location : existing.location,
        parsed.compensationText !== undefined
          ? parsed.compensationText
          : existing.compensation_text,
        parsed.description ?? existing.description,
        parsed.requirements ?? existing.requirements,
        parsed.status ?? existing.status,
        opportunityId,
        circleId,
      ]
    );

    return updated.rows[0];
  });
}

export async function submitJobApplication(
  actorUserId: string,
  circleId: string,
  opportunityId: string,
  input: z.input<typeof submitJobApplicationSchema>
): Promise<JobApplicationItem> {
  const parsed = submitJobApplicationSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertJobsCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can apply to job opportunities.');
    }

    const jobRes = await tx.query<JobOpportunityItem>(
      `SELECT * FROM public.job_opportunities WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [opportunityId, circleId]
    );
    const job = jobRes.rows[0];
    if (!job) {
      throw new NotFoundError('Job opportunity not found in this Circle.');
    }

    if (job.poster_id === actorUserId) {
      throw new ValidationError('You cannot apply to your own job opportunity.');
    }

    if (job.status !== 'open') {
      throw new ValidationError('This job opportunity is no longer accepting applications.');
    }

    if (
      job.application_deadline &&
      new Date(job.application_deadline).getTime() <= Date.now()
    ) {
      throw new ValidationError('The application deadline for this opportunity has passed.');
    }

    try {
      const inserted = await tx.query<JobApplicationItem>(
        `INSERT INTO public.job_applications (
           id, circle_id, opportunity_id, applicant_id, cover_note,
           resume_url, portfolio_url, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted')
         RETURNING *;`,
        [
          crypto.randomUUID(),
          circleId,
          opportunityId,
          actorUserId,
          parsed.coverNote,
          parsed.resumeUrl ?? null,
          parsed.portfolioUrl ?? null,
        ]
      );

      return {
        application: inserted.rows[0],
        jobTitle: job.title,
        posterId: job.poster_id,
        circleSlug: circle.slug,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key')) {
        throw new ConflictError('You have already applied to this opportunity.');
      }
      throw err;
    }
  });

  await createNotification({
    recipientId: outcome.posterId,
    actorId: actorUserId,
    circleId,
    eventType: 'job_application',
    title: `New Application: ${outcome.jobTitle}`,
    body: parsed.coverNote.slice(0, 140),
    linkUrl: `/circles/${outcome.circleSlug}/jobs`,
  });

  return outcome.application;
}

/**
 * Lists applications visible to the actor.
 * Defense in depth: both this service query and PostgreSQL RLS policy `job_applications_select`
 * ensure ordinary members can ONLY see their own applications, while the opportunity poster
 * and Circle admins/owners can review applications for that opportunity.
 */
export async function listJobApplications(
  actorUserId: string,
  circleId: string,
  opportunityId?: string
): Promise<JobApplicationItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertJobsCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const isAdminOrOwner = ['owner', 'admin'].includes(membership.role);

    const res = await tx.query<
      JobApplicationItem & {
        opportunity_title: string;
        opportunity_poster_id: string;
        applicant_username: string;
        applicant_display_name: string;
        applicant_email: string;
        applicant_avatar_url: string | null;
      }
    >(
      `SELECT a.*,
         j.title AS opportunity_title,
         j.poster_id AS opportunity_poster_id,
         COALESCE(u.username, 'applicant') AS applicant_username,
         COALESCE(u.display_name, 'Applicant') AS applicant_display_name,
         COALESCE(u.email, '') AS applicant_email,
         u.avatar_url AS applicant_avatar_url
       FROM public.job_applications a
       INNER JOIN public.job_opportunities j ON j.id = a.opportunity_id AND j.circle_id = a.circle_id
       LEFT JOIN public.profiles u ON u.id = a.applicant_id
       WHERE a.circle_id = $1
         AND ($2::uuid IS NULL OR a.opportunity_id = $2::uuid)
       ORDER BY a.created_at DESC;`,
      [circleId, opportunityId ?? null]
    );

    // Explicit application-layer privacy filter complementing PostgreSQL RLS
    return res.rows
      .filter(
        (r) =>
          r.applicant_id === actorUserId ||
          r.opportunity_poster_id === actorUserId ||
          isAdminOrOwner
      )
      .map((r) => ({
        id: r.id,
        circle_id: r.circle_id,
        opportunity_id: r.opportunity_id,
        opportunity_title: r.opportunity_title,
        applicant_id: r.applicant_id,
        cover_note: r.cover_note,
        resume_url: r.resume_url,
        portfolio_url: r.portfolio_url,
        status: r.status,
        reviewer_note: r.reviewer_note,
        reviewed_by: r.reviewed_by,
        reviewed_at: r.reviewed_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        applicant: {
          id: r.applicant_id,
          username: r.applicant_username,
          display_name: r.applicant_display_name,
          email: r.applicant_email,
          avatar_url: r.applicant_avatar_url,
        },
      }));
  });
}

export async function reviewJobApplication(
  actorUserId: string,
  circleId: string,
  applicationId: string,
  input: z.input<typeof reviewJobApplicationSchema>
): Promise<JobApplicationItem> {
  const parsed = reviewJobApplicationSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertJobsCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<
      JobApplicationItem & { poster_id: string; opportunity_title: string }
    >(
      `SELECT a.*, j.poster_id, j.title AS opportunity_title
       FROM public.job_applications a
       INNER JOIN public.job_opportunities j ON j.id = a.opportunity_id AND j.circle_id = a.circle_id
       WHERE a.id = $1 AND a.circle_id = $2
       LIMIT 1;`,
      [applicationId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Application not found.');
    }

    const isAdminOrOwner = ['owner', 'admin'].includes(membership.role);
    const isPoster = existing.poster_id === actorUserId;
    const isApplicant = existing.applicant_id === actorUserId;

    if (parsed.status === 'withdrawn') {
      if (!isApplicant) {
        throw new ForbiddenError('Only the applicant can withdraw their application.');
      }
    } else if (!isPoster && !isAdminOrOwner) {
      throw new ForbiddenError(
        'Only the opportunity poster or a Circle administrator can review this application.'
      );
    }

    const updated = await tx.query<JobApplicationItem>(
      `UPDATE public.job_applications
       SET status = $1,
           reviewer_note = COALESCE($2, reviewer_note),
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND circle_id = $5
       RETURNING *;`,
      [parsed.status, parsed.reviewerNote ?? null, actorUserId, applicationId, circleId]
    );

    return {
      application: updated.rows[0],
      opportunityTitle: existing.opportunity_title,
      circleSlug: circle.slug,
    };
  });

  if (actorUserId !== outcome.application.applicant_id) {
    await createNotification({
      recipientId: outcome.application.applicant_id,
      actorId: actorUserId,
      circleId,
      eventType: 'job_application',
      title: `Application Status Updated: ${outcome.opportunityTitle}`,
      body:
        outcome.application.reviewer_note ??
        `Your application status for "${outcome.opportunityTitle}" is now ${outcome.application.status}.`,
      linkUrl: `/circles/${outcome.circleSlug}/jobs`,
    });
  }

  return outcome.application;
}
