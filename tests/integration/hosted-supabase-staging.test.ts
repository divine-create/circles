import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  authenticateUser,
  registerUser,
  requestPasswordRecovery,
  resetPasswordWithToken,
  signOutUser,
  updateUserProfile,
} from '@/features/auth/service';
import {
  createCircle,
  discoverCircles,
  getCircleAuditLogs,
  getCircleBySlugOrId,
} from '@/features/circles/service';
import {
  acceptInvitation,
  approveJoinRequest,
  inviteToCircle,
  joinPublicCircle,
  leaveCircle,
  listCircleMembers,
  requestToJoinCircle,
  transferCircleOwnership,
  updateMemberRole,
} from '@/features/memberships/service';
import {
  getCircleCapabilities,
  updateCircleCapability,
} from '@/features/capabilities/service';
import {
  archiveCircleSpace,
  createCircleSpace,
  listCircleSpaces,
  reorderCircleSpaces,
} from '@/features/spaces/service';
import {
  createComment,
  createPost,
  listCirclePosts,
  saveItem,
  toggleReaction,
  updatePost,
} from '@/features/discussions/service';
import {
  listModerationReports,
  moderateContent,
  reportContent,
} from '@/features/moderation/service';
import { createCircleEvent, rsvpToCircleEvent } from '@/features/events/service';
import { castPollVote, createCirclePoll } from '@/features/polls/service';
import {
  createMarketplaceListing,
  createServiceOrRentalBooking,
  updateServiceOrRentalBookingStatus,
} from '@/features/marketplace/service';
import {
  createJobOpportunity,
  listJobApplications,
  submitJobApplication,
} from '@/features/jobs/service';
import {
  closeDatabasePools,
  getActiveDatabaseBackend,
  listAppliedDatabaseMigrations,
  runDatabaseMigrations,
  withRlsTransaction,
  withServiceRoleTransaction,
} from '@/lib/db/postgres';
import {
  SESSION_COOKIE_NAME,
  verifyAndResolveSessionUser,
} from '@/lib/auth/session';
import { GET as healthGetRoute } from '@/app/api/health/route';
import { POST as loginPostRoute } from '@/app/api/auth/login/route';
import { PATCH as moderationPatchRoute } from '@/app/api/moderation/route';

function parseEnvLocal(): Record<string, string> | null {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf8');
  const vars: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    vars[key] = val;
  }
  return vars.DATABASE_URL ? vars : null;
}

const envLocalVars = parseEnvLocal();

describe.skipIf(!envLocalVars)(
  'Live Hosted Supabase PostgreSQL Staging End-to-End Verification',
  () => {
    const createdUserIds: string[] = [];
    const createdCircleIds: string[] = [];
    const previousEnv: Record<string, string | undefined> = {};

    beforeAll(async () => {
      if (envLocalVars) {
        for (const [key, val] of Object.entries(envLocalVars)) {
          previousEnv[key] = process.env[key];
          process.env[key] = val;
        }
      }
      process.env.CIRCLES_FORCE_REMOTE_PG = 'true';
      await runDatabaseMigrations();
    });

    afterAll(async () => {
      // Clean up test entities created during the live staging verification run
      try {
        await withServiceRoleTransaction(async (tx) => {
          for (const circleId of createdCircleIds) {
            await tx.query(`DELETE FROM public.circles WHERE id = $1;`, [circleId]);
          }
          for (const userId of createdUserIds) {
            await tx.query(`DELETE FROM public.profiles WHERE id = $1;`, [userId]);
            await tx.query(`DELETE FROM auth.users WHERE id = $1;`, [userId]);
          }
        });
      } catch {
        // Ignore cleanup errors
      }
      delete process.env.CIRCLES_FORCE_REMOTE_PG;
      for (const [key, prevVal] of Object.entries(previousEnv)) {
        if (prevVal === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = prevVal;
        }
      }
      await closeDatabasePools();
    });

    it(
      'Executes full Phase 5 staging checklist against live hosted Supabase PostgreSQL (migrations, health, auth, sessions, profile RLS, circles, memberships, capabilities, spaces, discussions, moderation)',
      async () => {
        expect(getActiveDatabaseBackend()).toBe('remote_pg');

        // 1. Verify migrations & GET /api/health on live Supabase
        const migrations = await listAppliedDatabaseMigrations();
        expect(migrations.map((m) => m.version)).toEqual([
          '0001',
          '0002',
          '0003',
          '0004',
          '0005',
          '0006',
          '0007',
          '0008',
          '0009',
          '0010',
          '0011',
          '0012',
          '0013',
          '0014',
          '0015',
          '0016',
          '0017',
        ]);

        const healthRes = await healthGetRoute();
        expect(healthRes.status).toBe(200);
        const healthBody = await healthRes.json();
        expect(healthBody.status).toBe('healthy');
        expect(healthBody.database).toBe('connected');
        expect(healthBody.backend).toBe('remote_pg');
        expect(healthBody.mode).toBe('supabase_configured');

        // 2. Authentication & Session Lifecycle on Hosted Supabase
        const suffix = Date.now();
        const ownerReg = await registerUser({
          email: `stg-owner-${suffix}@example.com`,
          username: `stg_owner_${suffix}`,
          displayName: 'Staging Owner',
          password: 'StagingPassword123!',
        });
        createdUserIds.push(ownerReg.user.id);

        const adminReg = await registerUser({
          email: `stg-admin-${suffix}@example.com`,
          username: `stg_admin_${suffix}`,
          displayName: 'Staging Admin',
          password: 'StagingPassword123!',
        });
        createdUserIds.push(adminReg.user.id);

        const memberReg = await registerUser({
          email: `stg-member-${suffix}@example.com`,
          username: `stg_member_${suffix}`,
          displayName: 'Staging Member',
          password: 'StagingPassword123!',
        });
        createdUserIds.push(memberReg.user.id);

        const outsiderReg = await registerUser({
          email: `stg-outsider-${suffix}@example.com`,
          username: `stg_outsider_${suffix}`,
          displayName: 'Staging Outsider',
          password: 'StagingPassword123!',
        });
        createdUserIds.push(outsiderReg.user.id);

        // Verify session resolution and invalid password rejection
        expect((await verifyAndResolveSessionUser(ownerReg.sessionToken))?.id).toBe(
          ownerReg.user.id
        );
        await expect(
          authenticateUser({
            email: ownerReg.user.email,
            password: 'WrongPassword999!',
          })
        ).rejects.toThrow(/Invalid email or password/i);

        // Session fixation rotation on login
        const reloginReq = new NextRequest(new URL('http://localhost:3000/api/auth/login'), {
          method: 'POST',
          headers: new Headers({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${outsiderReg.sessionToken}`,
          }),
          body: JSON.stringify({
            email: outsiderReg.user.email,
            password: 'StagingPassword123!',
          }),
        });
        reloginReq.cookies.set(SESSION_COOKIE_NAME, outsiderReg.sessionToken);
        const reloginRes = await loginPostRoute(reloginReq);
        expect(reloginRes.status).toBe(200);
        const reloginBody = await reloginRes.json();
        expect(await verifyAndResolveSessionUser(outsiderReg.sessionToken)).toBeNull();
        expect((await verifyAndResolveSessionUser(reloginBody.sessionToken))?.id).toBe(
          outsiderReg.user.id
        );

        // Sign out revokes session
        await signOutUser(reloginBody.sessionToken);
        expect(await verifyAndResolveSessionUser(reloginBody.sessionToken)).toBeNull();

        // Password recovery & reset revokes all user sessions and is single-use
        const activeOutSession = await authenticateUser({
          email: outsiderReg.user.email,
          password: 'StagingPassword123!',
        });
        const recovery = await requestPasswordRecovery(outsiderReg.user.email);
        expect(recovery.previewToken).toBeTruthy();
        await resetPasswordWithToken(recovery.previewToken!, 'NewStagingPassword456!');
        expect(await verifyAndResolveSessionUser(activeOutSession.sessionToken)).toBeNull();
        await expect(
          resetPasswordWithToken(recovery.previewToken!, 'SecondUsePassword789!')
        ).rejects.toThrow(/Invalid or expired/i);

        // 3. Circle Lifecycle & Visibility Isolation (public, discoverable_approval, private)
        const pubCircle = await createCircle(ownerReg.user.id, {
          name: `Staging Public Circle ${suffix}`,
          slug: `stg-pub-${suffix}`,
          description: 'Public community on hosted Supabase staging.',
          category: 'university',
          visibility: 'public',
          membershipPolicy: 'open',
          templateKey: 'university',
        });
        createdCircleIds.push(pubCircle.id);

        const approvalCircle = await createCircle(ownerReg.user.id, {
          name: `Staging Approval Circle ${suffix}`,
          slug: `stg-app-${suffix}`,
          description: 'Discoverable approval community on hosted Supabase.',
          category: 'professional',
          visibility: 'discoverable_approval',
          membershipPolicy: 'approval',
          templateKey: 'professional',
        });
        createdCircleIds.push(approvalCircle.id);

        const privCircle = await createCircle(ownerReg.user.id, {
          name: `Staging Private Circle ${suffix}`,
          slug: `stg-priv-${suffix}`,
          description: 'Private community on hosted Supabase.',
          category: 'neighbourhood',
          visibility: 'private',
          membershipPolicy: 'invite_only',
          templateKey: 'neighbourhood',
        });
        createdCircleIds.push(privCircle.id);

        // Anonymous discovery sees public & discoverable_approval, never private
        const discoveredAnon = await discoverCircles(null, { search: `Staging` });
        const discoveredIds = new Set(discoveredAnon.map((c) => c.id));
        expect(discoveredIds.has(pubCircle.id)).toBe(true);
        expect(discoveredIds.has(approvalCircle.id)).toBe(true);
        expect(discoveredIds.has(privCircle.id)).toBe(false);
        expect(await getCircleBySlugOrId(null, privCircle.slug)).toBeNull();

        // Non-member cannot read spaces or posts inside discoverable_approval Circle
        const anonApprovalSpaces = await withRlsTransaction(null, async (tx) => {
          return tx.query(`SELECT id FROM public.circle_spaces WHERE circle_id = $1;`, [
            approvalCircle.id,
          ]);
        });
        expect(anonApprovalSpaces.rows.length).toBe(0);

        // 4. Memberships, Join Requests, Invitations, Role Hierarchy & Ownership Protection
        await joinPublicCircle(adminReg.user.id, pubCircle.id);
        await joinPublicCircle(memberReg.user.id, pubCircle.id);
        await updateMemberRole(ownerReg.user.id, pubCircle.id, adminReg.user.id, 'admin');

        // Approval Circle join request workflow
        const jr = await requestToJoinCircle(
          memberReg.user.id,
          approvalCircle.id,
          'Excited to join staging!'
        );
        expect(jr.status).toBe('pending');
        await approveJoinRequest(ownerReg.user.id, approvalCircle.id, jr.id);
        const approvalMembers = await listCircleMembers(ownerReg.user.id, approvalCircle.id);
        expect(approvalMembers.some((m) => m.user_id === memberReg.user.id)).toBe(true);

        // Private Circle invitation workflow & email spoofing block
        const invite = await inviteToCircle(
          ownerReg.user.id,
          privCircle.id,
          outsiderReg.user.email,
          'member'
        );
        await expect(
          acceptInvitation(memberReg.user.id, invite.rawToken)
        ).rejects.toThrow(/email address/i);
        await acceptInvitation(outsiderReg.user.id, invite.rawToken);
        const privMembers = await listCircleMembers(ownerReg.user.id, privCircle.id);
        expect(privMembers.some((m) => m.user_id === outsiderReg.user.id)).toBe(true);

        // Profile visibility ('members_only' & 'private') on hosted Supabase RLS
        await updateUserProfile(ownerReg.user.id, ownerReg.user.id, {
          displayName: 'Staging Owner Members Only',
          username: ownerReg.user.username,
          bio: 'Visible to co-members',
          profileVisibility: 'members_only',
        });
        const coMemberProfileCheck = await withRlsTransaction(memberReg.user.id, async (tx) => {
          return tx.query(`SELECT id FROM public.profiles WHERE id = $1;`, [ownerReg.user.id]);
        });
        expect(coMemberProfileCheck.rows.length).toBe(1);

        // Last-owner protection & ownership transfer
        await expect(leaveCircle(ownerReg.user.id, pubCircle.id)).rejects.toThrow(/sole owner/i);
        await transferCircleOwnership(ownerReg.user.id, pubCircle.id, adminReg.user.id);
        // Transfer back to original owner
        await transferCircleOwnership(adminReg.user.id, pubCircle.id, ownerReg.user.id);

        // 5. Capabilities, Spaces & Discussions
        const capsBefore = await getCircleCapabilities(ownerReg.user.id, pubCircle.id);
        expect(capsBefore.some((c) => c.capability_key === 'discussions' && c.enabled)).toBe(true);

        const customSpace = await createCircleSpace(ownerReg.user.id, pubCircle.id, {
          name: 'Staging Engineering',
          slug: 'staging-engineering',
          description: 'Live Supabase space',
          capabilityKey: 'discussions',
          postingPolicy: 'members',
        });

        const post = await createPost(memberReg.user.id, {
          circleId: pubCircle.id,
          spaceId: customSpace.id,
          title: 'Hello Hosted Supabase Staging!',
          body: 'Verified real PostgreSQL persistence and RLS.',
        });
        await createComment(ownerReg.user.id, {
          circleId: pubCircle.id,
          postId: post.id,
          body: 'Confirmed on live Supabase!',
        });
        await toggleReaction(adminReg.user.id, pubCircle.id, post.id, 'like');
        await saveItem(memberReg.user.id, pubCircle.id, post.id);

        // Ordinary member cannot pin post
        await expect(
          updatePost(memberReg.user.id, pubCircle.id, post.id, { isPinned: true })
        ).rejects.toThrow(/Only Circle moderators, administrators, or owners can pin posts/i);

        // Capability settings enforcement (allowMemberPosts: false)
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'discussions', true, {
          allowMemberPosts: false,
        });
        await expect(
          createPost(memberReg.user.id, {
            circleId: pubCircle.id,
            title: 'Blocked by setting',
            body: 'Should fail',
          })
        ).rejects.toThrow(/disabled/i);

        // Non-destructive capability disabling preserves data & re-enabling restores it
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'discussions', false);
        await expect(listCirclePosts(memberReg.user.id, pubCircle.id)).rejects.toThrow(/disabled/i);
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'discussions', true, {
          allowMemberPosts: true,
        });
        const restoredPosts = await listCirclePosts(memberReg.user.id, pubCircle.id);
        expect(restoredPosts.some((p) => p.id === post.id)).toBe(true);

        // Reorder and archive spaces
        const spacesList = await listCircleSpaces(ownerReg.user.id, pubCircle.id);
        await reorderCircleSpaces(
          ownerReg.user.id,
          pubCircle.id,
          spacesList.map((s) => s.id)
        );
        await archiveCircleSpace(ownerReg.user.id, pubCircle.id, customSpace.id, true);

        // 6. Moderation, Member Suspension & Audit Logs
        const report = await reportContent(adminReg.user.id, {
          circleId: pubCircle.id,
          targetType: 'post',
          targetPostId: post.id,
          reason: 'rule_violation',
          details: 'Testing live hosted Supabase moderation report.',
        });
        const reports = await listModerationReports(ownerReg.user.id, pubCircle.id);
        expect(reports.some((r) => r.id === report.id)).toBe(true);

        const suspendReq = new NextRequest(new URL('http://localhost:3000/api/moderation'), {
          method: 'PATCH',
          headers: new Headers({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerReg.sessionToken}`,
          }),
          body: JSON.stringify({
            circleId: pubCircle.id,
            actionType: 'suspend_member',
            targetId: memberReg.user.id,
            reason: 'Staging suspension verification',
          }),
        });
        const suspendRes = await moderationPatchRoute(suspendReq);
        expect(suspendRes.status).toBe(200);

        // Suspended member cannot post or self-restore
        await expect(
          createPost(memberReg.user.id, {
            circleId: pubCircle.id,
            title: 'Suspended post',
            body: 'Blocked',
          })
        ).rejects.toThrow();

        await moderateContent(ownerReg.user.id, {
          circleId: pubCircle.id,
          actionType: 'restore_member',
          targetId: memberReg.user.id,
          reason: 'Staging restoration verified',
        });

        const auditLogs = await getCircleAuditLogs(ownerReg.user.id, pubCircle.id);
        expect(auditLogs.length).toBeGreaterThanOrEqual(4);

        // 7. Verify Phase B-D Capabilities on Live Hosted Supabase (Events, Polls, Marketplace Booking Conflicts, Job Application RLS)
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'events', true);
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'rsvps', true);
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'polls_decisions', true);
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'listings_discovery', true);
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'services_bookings', true);
        await updateCircleCapability(ownerReg.user.id, pubCircle.id, 'jobs_opportunities', true);

        const stgEvent = await createCircleEvent(ownerReg.user.id, {
          circleId: pubCircle.id,
          title: 'Hosted Supabase Townhall',
          startsAt: new Date(Date.now() + 86400_000).toISOString(),
          endsAt: new Date(Date.now() + 90000_000).toISOString(),
          capacity: 1,
        });
        const rsvp1 = await rsvpToCircleEvent(
          memberReg.user.id,
          pubCircle.id,
          stgEvent.id,
          'register'
        );
        expect(rsvp1.rsvp.status).toBe('going');

        const stgPoll = await createCirclePoll(ownerReg.user.id, {
          circleId: pubCircle.id,
          question: 'Approve staging release?',
          allowMultiple: false,
          resultsVisibility: 'after_vote',
          options: ['Ship to staging', 'Hold'],
        });
        const votedPoll = await castPollVote(memberReg.user.id, pubCircle.id, stgPoll.id, {
          optionIds: [stgPoll.options[0].id],
        });
        expect(votedPoll.total_votes).toBe(1);

        const stgListing = await createMarketplaceListing(ownerReg.user.id, {
          circleId: pubCircle.id,
          listingType: 'service',
          category: 'mentorship',
          title: 'Architecture Review Session',
          priceAmount: 50,
          pricingUnit: 'hourly',
        });
        const bk1 = await createServiceOrRentalBooking(
          memberReg.user.id,
          pubCircle.id,
          stgListing.id,
          {
            bookingType: 'service',
            startsAt: '2027-06-01T10:00:00.000Z',
            endsAt: '2027-06-01T11:00:00.000Z',
          }
        );
        const bk2 = await createServiceOrRentalBooking(
          adminReg.user.id,
          pubCircle.id,
          stgListing.id,
          {
            bookingType: 'service',
            startsAt: '2027-06-01T10:30:00.000Z',
            endsAt: '2027-06-01T11:30:00.000Z',
          }
        );
        await updateServiceOrRentalBookingStatus(ownerReg.user.id, pubCircle.id, bk1.id, {
          status: 'approved',
        });
        await expect(
          updateServiceOrRentalBookingStatus(ownerReg.user.id, pubCircle.id, bk2.id, {
            status: 'approved',
          })
        ).rejects.toThrow(/Booking conflict/i);

        const stgJob = await createJobOpportunity(ownerReg.user.id, {
          circleId: pubCircle.id,
          title: 'Platform Engineer',
          description: 'Build multi-tenant community tools.',
        });
        await submitJobApplication(memberReg.user.id, pubCircle.id, stgJob.id, {
          coverNote: 'Applying on live Supabase staging.',
        });
        const ownerApps = await listJobApplications(ownerReg.user.id, pubCircle.id, stgJob.id);
        expect(ownerApps.length).toBe(1);
      },
      360000
    );
  }
);
