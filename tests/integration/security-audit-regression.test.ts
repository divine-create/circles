import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  registerUser,
  authenticateUser,
  requestPasswordRecovery,
  resetPasswordWithToken,
  signOutUser,
  updateUserProfile,
} from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import {
  joinPublicCircle,
  inviteToCircle,
  updateMemberRole,
  listCircleMembers,
} from '@/features/memberships/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import {
  archiveCircleSpace,
  createCircleSpace,
  reorderCircleSpaces,
} from '@/features/spaces/service';
import {
  createPost,
  listCirclePosts,
  saveItem,
  toggleReaction,
  updatePost,
} from '@/features/discussions/service';
import { moderateContent } from '@/features/moderation/service';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  createSignedSessionToken,
  SESSION_COOKIE_NAME,
  verifyAndResolveSessionUser,
  verifySignedSessionToken,
} from '@/lib/auth/session';
import {
  assertProductionDatabaseConfigured,
  ConfigurationError,
  getVerifiedSessionSecret,
} from '@/lib/config/env';
import { GET as healthGetRoute } from '@/app/api/health/route';
import { POST as loginPostRoute } from '@/app/api/auth/login/route';
import { PATCH as moderationPatchRoute } from '@/app/api/moderation/route';

describe('Independent Security & Production-Readiness Audit Regression Suite', () => {
  it('1. Enforces stateful session revocation on logout, session rotation on re-login, rejects forged/expired tokens, and revokes all sessions on password reset', async () => {
    const suffix = Date.now();
    const reg = await registerUser({
      email: `sec-auth-${suffix}@example.com`,
      username: `sec_auth_${suffix}`,
      displayName: 'Security Auth Tester',
      password: 'InitialPassword123!',
    });

    // Active session resolves user
    const resolvedBefore = await verifyAndResolveSessionUser(reg.sessionToken);
    expect(resolvedBefore?.id).toBe(reg.user.id);

    // Forged signature is rejected
    const [payloadPart] = reg.sessionToken.split('.');
    const forgedToken = `${payloadPart}.forged_signature_value`;
    expect(verifySignedSessionToken(forgedToken)).toBeNull();
    expect(await verifyAndResolveSessionUser(forgedToken)).toBeNull();

    // Expired token is rejected
    const expiredToken = createSignedSessionToken(reg.user.id, reg.user.email, -60);
    expect(verifySignedSessionToken(expiredToken)).toBeNull();
    expect(await verifyAndResolveSessionUser(expiredToken)).toBeNull();

    // Session fixation protection: logging in via POST /api/auth/login with an existing session token revokes the old session
    const reloginReq = new NextRequest(new URL('http://localhost:3000/api/auth/login'), {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${reg.sessionToken}`,
      }),
      body: JSON.stringify({
        email: reg.user.email,
        password: 'InitialPassword123!',
      }),
    });
    reloginReq.cookies.set(SESSION_COOKIE_NAME, reg.sessionToken);
    const reloginRes = await loginPostRoute(reloginReq);
    expect(reloginRes.status).toBe(200);
    const reloginData = await reloginRes.json();
    expect(reloginData.sessionToken).toBeTruthy();
    expect(reloginData.sessionToken).not.toBe(reg.sessionToken);

    // Prior token passed into login is now revoked!
    expect(await verifyAndResolveSessionUser(reg.sessionToken)).toBeNull();
    // New token is active
    expect((await verifyAndResolveSessionUser(reloginData.sessionToken))?.id).toBe(reg.user.id);

    // Logout immediately revokes the session token server-side
    await signOutUser(reloginData.sessionToken);
    expect(await verifyAndResolveSessionUser(reloginData.sessionToken)).toBeNull();

    // Sign in with two new sessions, then reset password -> both sessions must be revoked
    const login1 = await authenticateUser({
      email: reg.user.email,
      password: 'InitialPassword123!',
    });
    const login2 = await authenticateUser({
      email: reg.user.email,
      password: 'InitialPassword123!',
    });

    expect((await verifyAndResolveSessionUser(login1.sessionToken))?.id).toBe(reg.user.id);
    expect((await verifyAndResolveSessionUser(login2.sessionToken))?.id).toBe(reg.user.id);

    const recovery = await requestPasswordRecovery(reg.user.email);
    expect(recovery.previewToken).toBeTruthy();

    await resetPasswordWithToken(recovery.previewToken!, 'UpdatedPassword456!');

    // Both previous sessions must now be revoked
    expect(await verifyAndResolveSessionUser(login1.sessionToken)).toBeNull();
    expect(await verifyAndResolveSessionUser(login2.sessionToken)).toBeNull();

    // Reusing the single-use recovery token a second time must fail
    await expect(
      resetPasswordWithToken(recovery.previewToken!, 'AnotherPassword789!')
    ).rejects.toThrow(/Invalid or expired password recovery token/i);
  });

  it('2. Rejects expired password recovery tokens (>1 hour old) and never exposes previewToken in production', async () => {
    const suffix = Date.now() + 1;
    const reg = await registerUser({
      email: `sec-exp-${suffix}@example.com`,
      username: `sec_exp_${suffix}`,
      displayName: 'Expired Recovery User',
      password: 'InitialPassword123!',
    });

    const recovery = await requestPasswordRecovery(reg.user.email);
    expect(recovery.previewToken).toBeTruthy();

    // Backdate recovery_sent_at by 2 hours in auth.users
    await withServiceRoleTransaction(async (tx) => {
      await tx.query(
        `UPDATE auth.users SET recovery_sent_at = NOW() - INTERVAL '2 hours' WHERE id = $1;`,
        [reg.user.id]
      );
    });

    await expect(
      resetPasswordWithToken(recovery.previewToken!, 'NewPassword999!')
    ).rejects.toThrow(/Invalid or expired password recovery token/i);

    // Verify previewToken is omitted when NODE_ENV === 'production'
    const prevNodeEnv = process.env.NODE_ENV;
    const prevAllowEmbedded = process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION = 'true';
      const prodRecovery = await requestPasswordRecovery(reg.user.email);
      expect(prodRecovery.recoveryTokenIssued).toBe(true);
      expect(prodRecovery.previewToken).toBeUndefined();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      if (prevAllowEmbedded !== undefined) {
        process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION = prevAllowEmbedded;
      } else {
        delete process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
      }
    }
  });

  it('3. Blocks direct PostgreSQL RLS & trigger privilege escalation (email spoofing, owner_id overwrite, INSERT/UPDATE role hierarchy bypass, post pinning by member, suspended self-restore)', async () => {
    const suffix = Date.now() + 2;
    const owner = (
      await registerUser({
        email: `rls-owner-${suffix}@example.com`,
        username: `rls_owner_${suffix}`,
        displayName: 'RLS Owner',
        password: 'Password123!',
      })
    ).user;
    const admin = (
      await registerUser({
        email: `rls-admin-${suffix}@example.com`,
        username: `rls_admin_${suffix}`,
        displayName: 'RLS Admin',
        password: 'Password123!',
      })
    ).user;
    const moderator = (
      await registerUser({
        email: `rls-mod-${suffix}@example.com`,
        username: `rls_mod_${suffix}`,
        displayName: 'RLS Moderator',
        password: 'Password123!',
      })
    ).user;
    const member = (
      await registerUser({
        email: `rls-member-${suffix}@example.com`,
        username: `rls_member_${suffix}`,
        displayName: 'RLS Member',
        password: 'Password123!',
      })
    ).user;
    const outsider = (
      await registerUser({
        email: `rls-outsider-${suffix}@example.com`,
        username: `rls_outsider_${suffix}`,
        displayName: 'RLS Outsider',
        password: 'Password123!',
      })
    ).user;

    const circle = await createCircle(owner.id, {
      name: `RLS Hardening Circle ${suffix}`,
      slug: `rls-hardening-${suffix}`,
      description: 'Testing PostgreSQL triggers and RLS policies directly.',
      category: 'professional',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'professional',
    });

    await joinPublicCircle(admin.id, circle.id);
    await joinPublicCircle(moderator.id, circle.id);
    await joinPublicCircle(member.id, circle.id);

    await updateMemberRole(owner.id, circle.id, admin.id, 'admin');
    await updateMemberRole(owner.id, circle.id, moderator.id, 'moderator');

    // 3a. Profile email spoofing blocked by trg_protect_profile_identity
    await inviteToCircle(owner.id, circle.id, 'vip-invitee@example.com', 'admin');
    await expect(
      withRlsTransaction(member.id, async (tx) => {
        await tx.query(`UPDATE public.profiles SET email = 'vip-invitee@example.com' WHERE id = $1;`, [
          member.id,
        ]);
      })
    ).rejects.toThrow(/Profile email cannot be modified/i);

    // 3b. Circle admin cannot overwrite circles.owner_id via direct SQL
    await expect(
      withRlsTransaction(admin.id, async (tx) => {
        await tx.query(`UPDATE public.circles SET owner_id = $1 WHERE id = $2;`, [
          admin.id,
          circle.id,
        ]);
      })
    ).rejects.toThrow(/Only the current Circle owner can transfer Circle ownership/i);

    // 3c. Circle moderator cannot demote or suspend an admin or owner via direct SQL
    await expect(
      withRlsTransaction(moderator.id, async (tx) => {
        await tx.query(
          `UPDATE public.circle_memberships SET role = 'member' WHERE circle_id = $1 AND user_id = $2;`,
          [circle.id, admin.id]
        );
      })
    ).rejects.toThrow(/Moderators can only suspend or restore ordinary members/i);

    // 3d. Circle admin cannot promote a member to admin or owner via direct SQL UPDATE
    await expect(
      withRlsTransaction(admin.id, async (tx) => {
        await tx.query(
          `UPDATE public.circle_memberships SET role = 'admin' WHERE circle_id = $1 AND user_id = $2;`,
          [circle.id, member.id]
        );
      })
    ).rejects.toThrow(/Only Circle owners can promote members to administrator or owner/i);

    // 3e. Circle admin cannot INSERT a new membership with role 'owner' or 'admin' via direct SQL
    await expect(
      withRlsTransaction(admin.id, async (tx) => {
        await tx.query(
          `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
           VALUES (gen_random_uuid(), $1, $2, 'owner', 'active');`,
          [circle.id, outsider.id]
        );
      })
    ).rejects.toThrow(/Only Circle owners can assign administrator or owner roles|row-level security/i);

    // 3f. Circle admin cannot invite a user with role 'admin'
    await expect(
      inviteToCircle(admin.id, circle.id, 'new-admin@example.com', 'admin')
    ).rejects.toThrow(/Only a Circle owner can invite a member as an administrator/i);

    // 3g. Ordinary member cannot pin their own post via updatePost or direct SQL
    const memberPost = await createPost(member.id, {
      circleId: circle.id,
      title: 'Regular Member Post',
      body: 'Testing pin restriction.',
    });
    await expect(
      updatePost(member.id, circle.id, memberPost.id, { isPinned: true })
    ).rejects.toThrow(/Only Circle moderators, administrators, or owners can pin posts/i);

    await expect(
      withRlsTransaction(member.id, async (tx) => {
        await tx.query(`UPDATE public.posts SET is_pinned = true WHERE id = $1;`, [memberPost.id]);
      })
    ).rejects.toThrow(/Only Circle moderators, administrators, or owners can pin or unpin posts/i);

    // 3h. Suspended member cannot self-restore or self-leave via direct SQL, and Circle Studio PATCH /api/moderation works end-to-end
    const modSession = await authenticateUser({
      email: moderator.email,
      password: 'Password123!',
    });
    const studioSuspendReq = new NextRequest(new URL('http://localhost:3000/api/moderation'), {
      method: 'PATCH',
      headers: new Headers({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modSession.sessionToken}`,
      }),
      body: JSON.stringify({
        circleId: circle.id,
        actionType: 'suspend_member',
        targetId: member.id,
        reason: 'Rule violation in Circle Studio',
      }),
    });
    const studioSuspendRes = await moderationPatchRoute(studioSuspendReq);
    expect(studioSuspendRes.status).toBe(200);

    const membersAfterSuspend = await listCircleMembers(owner.id, circle.id);
    expect(membersAfterSuspend.find((m) => m.user_id === member.id)?.status).toBe('suspended');

    await expect(
      withRlsTransaction(member.id, async (tx) => {
        await tx.query(
          `UPDATE public.circle_memberships SET status = 'active' WHERE circle_id = $1 AND user_id = $2;`,
          [circle.id, member.id]
        );
      })
    ).rejects.toThrow(/Suspended members cannot modify their own membership status/i);

    // Restore member via Moderation API
    await moderateContent(moderator.id, {
      circleId: circle.id,
      actionType: 'restore_member',
      targetId: member.id,
      reason: 'Restored after review',
    });
    const membersAfterRestore = await listCircleMembers(owner.id, circle.id);
    expect(membersAfterRestore.find((m) => m.user_id === member.id)?.status).toBe('active');

    // 3i. Client cannot spoof notifications claiming to be another actor
    await expect(
      withRlsTransaction(member.id, async (tx) => {
        await tx.query(
          `INSERT INTO public.notifications (recipient_id, actor_id, circle_id, event_type, title, body)
           VALUES ($1, $2, $3, 'system', 'Spoofed', 'Spoofed body');`,
          [owner.id, admin.id, circle.id]
        );
      })
    ).rejects.toThrow(/row-level security/i);
  });

  it('4. Protects private and members_only user profiles under RLS while keeping public Circle posts readable', async () => {
    const suffix = Date.now() + 3;
    const author = (
      await registerUser({
        email: `priv-author-${suffix}@example.com`,
        username: `priv_author_${suffix}`,
        displayName: 'Private Author',
        password: 'Password123!',
      })
    ).user;
    const coMember = (
      await registerUser({
        email: `comember-${suffix}@example.com`,
        username: `comember_${suffix}`,
        displayName: 'Co-Member Viewer',
        password: 'Password123!',
      })
    ).user;
    const outsider = (
      await registerUser({
        email: `viewer-${suffix}@example.com`,
        username: `viewer_${suffix}`,
        displayName: 'Outsider Viewer',
        password: 'Password123!',
      })
    ).user;

    const circle = await createCircle(author.id, {
      name: `Public Circle Private Author ${suffix}`,
      slug: `pub-priv-author-${suffix}`,
      description: 'Testing private profile RLS + LEFT JOIN behavior.',
      category: 'general',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'custom',
    });

    await joinPublicCircle(coMember.id, circle.id);

    await createPost(author.id, {
      circleId: circle.id,
      title: 'Public Post by Private Profile User',
      body: 'This post is in a public Circle.',
    });

    // 4a. Author sets profile_visibility to 'members_only' -> coMember can read, outsider cannot!
    await updateUserProfile(author.id, author.id, {
      displayName: 'Members Only Author',
      username: author.username,
      bio: 'Shared with Circle co-members',
      profileVisibility: 'members_only',
    });

    const coMemberRead = await withRlsTransaction(coMember.id, async (tx) => {
      return tx.query(`SELECT id, display_name FROM public.profiles WHERE id = $1;`, [author.id]);
    });
    expect(coMemberRead.rows.length).toBe(1);

    const outsiderMembersOnlyRead = await withRlsTransaction(outsider.id, async (tx) => {
      return tx.query(`SELECT id, display_name FROM public.profiles WHERE id = $1;`, [author.id]);
    });
    expect(outsiderMembersOnlyRead.rows.length).toBe(0);

    // 4b. Author sets profile_visibility to 'private' -> neither anon, outsider, nor coMember can read directly
    await updateUserProfile(author.id, author.id, {
      displayName: 'Private Author',
      username: author.username,
      bio: 'Secret personal bio',
      profileVisibility: 'private',
    });

    const anonProfileRead = await withRlsTransaction(null, async (tx) => {
      return tx.query(`SELECT * FROM public.profiles WHERE id = $1;`, [author.id]);
    });
    expect(anonProfileRead.rows.length).toBe(0);

    const coMemberPrivateRead = await withRlsTransaction(coMember.id, async (tx) => {
      return tx.query(`SELECT * FROM public.profiles WHERE id = $1;`, [author.id]);
    });
    expect(coMemberPrivateRead.rows.length).toBe(0);

    // Public Circle post remains visible to anonymous users with safe fallback display name
    const anonPosts = await listCirclePosts(null, circle.id);
    expect(anonPosts.length).toBe(1);
    expect(anonPosts[0].title).toBe('Public Post by Private Profile User');
    expect(anonPosts[0].author?.display_name).toBe('Circle Member');
  });

  it('5. Enforces capability settings & disabled capabilities in both services and direct SQL RLS, plus production config & health checks', async () => {
    const suffix = Date.now() + 4;
    const owner = (
      await registerUser({
        email: `cap-owner-${suffix}@example.com`,
        username: `cap_owner_${suffix}`,
        displayName: 'Cap Owner',
        password: 'Password123!',
      })
    ).user;
    const member = (
      await registerUser({
        email: `cap-member-${suffix}@example.com`,
        username: `cap_member_${suffix}`,
        displayName: 'Cap Member',
        password: 'Password123!',
      })
    ).user;

    const circle = await createCircle(owner.id, {
      name: `Capability Settings Circle ${suffix}`,
      slug: `cap-settings-${suffix}`,
      description: 'Testing capability settings enforcement.',
      category: 'general',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'custom',
    });

    await joinPublicCircle(member.id, circle.id);

    const customSpace = await createCircleSpace(owner.id, circle.id, {
      name: 'Research Notes',
      slug: 'research-notes',
      description: 'Space for research notes',
      capabilityKey: 'discussions',
      postingPolicy: 'members',
    });

    const ownerPost = await createPost(owner.id, {
      circleId: circle.id,
      title: 'Owner Announcement',
      body: 'Initial post before locking member posts.',
    });

    // Disable allowMemberPosts and allowReactions in discussions capability settings
    await updateCircleCapability(owner.id, circle.id, 'discussions', true, {
      allowMemberPosts: false,
      allowReactions: false,
    });

    // Member cannot create post via service OR via direct SQL RLS when allowMemberPosts is false
    await expect(
      createPost(member.id, {
        circleId: circle.id,
        title: 'Member Post Attempt',
        body: 'Should be blocked by capability setting.',
      })
    ).rejects.toThrow(/Member post creation is currently disabled/i);

    await expect(
      withRlsTransaction(member.id, async (tx) => {
        await tx.query(
          `INSERT INTO public.posts (id, circle_id, author_id, title, body, status)
           VALUES (gen_random_uuid(), $1, $2, 'Direct SQL Post', 'Should fail RLS', 'published');`,
          [circle.id, member.id]
        );
      })
    ).rejects.toThrow(/row-level security/i);

    // Member cannot react via service OR direct SQL RLS when allowReactions is false
    await expect(toggleReaction(member.id, circle.id, ownerPost.id)).rejects.toThrow(
      /Reactions are disabled/i
    );

    await expect(
      withRlsTransaction(member.id, async (tx) => {
        await tx.query(
          `INSERT INTO public.reactions (id, circle_id, post_id, user_id, reaction_type)
           VALUES (gen_random_uuid(), $1, $2, $3, 'like');`,
          [circle.id, ownerPost.id, member.id]
        );
      })
    ).rejects.toThrow(/row-level security/i);

    // Disable 'discussions' capability -> blocks saveItem as well
    await updateCircleCapability(owner.id, circle.id, 'discussions', false);
    await expect(saveItem(member.id, circle.id, ownerPost.id)).rejects.toThrow(/disabled/i);

    // Disable 'spaces' capability -> blocks archiveCircleSpace, reorderCircleSpaces, and non-admin direct SQL SELECT on circle_spaces
    await updateCircleCapability(owner.id, circle.id, 'spaces', false);
    await expect(
      archiveCircleSpace(owner.id, circle.id, customSpace.id, true)
    ).rejects.toThrow(/disabled/i);
    await expect(
      reorderCircleSpaces(owner.id, circle.id, [customSpace.id])
    ).rejects.toThrow(/disabled/i);

    const memberSpacesReadWhenDisabled = await withRlsTransaction(member.id, async (tx) => {
      return tx.query(`SELECT * FROM public.circle_spaces WHERE circle_id = $1;`, [circle.id]);
    });
    expect(memberSpacesReadWhenDisabled.rows.length).toBe(0);

    // Verify fail-closed production environment guards (including weak low-entropy secret & partial Supabase config)
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.CIRCLES_SESSION_SECRET;
    const prevSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const prevServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevDbUrl = process.env.DATABASE_URL;
    const prevAllowEmbedded = process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.CIRCLES_SESSION_SECRET;
      expect(() => getVerifiedSessionSecret()).toThrow(ConfigurationError);

      // Low-entropy 32-char secret must also be rejected in production
      process.env.CIRCLES_SESSION_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      expect(() => getVerifiedSessionSecret()).toThrow(ConfigurationError);

      // High-entropy 32+ char secret succeeds
      process.env.CIRCLES_SESSION_SECRET = '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e';
      expect(getVerifiedSessionSecret()).toBe('9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e');

      // Partial Supabase config (missing DATABASE_URL / SUPABASE_SERVICE_ROLE_KEY) must fail closed in production
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.DATABASE_URL;
      delete process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
      expect(() => assertProductionDatabaseConfigured()).toThrow(ConfigurationError);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      if (prevSecret !== undefined) process.env.CIRCLES_SESSION_SECRET = prevSecret;
      else delete process.env.CIRCLES_SESSION_SECRET;
      if (prevSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupabaseUrl;
      else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (prevAnonKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnonKey;
      else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (prevServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevServiceKey;
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (prevDbUrl !== undefined) process.env.DATABASE_URL = prevDbUrl;
      else delete process.env.DATABASE_URL;
      if (prevAllowEmbedded !== undefined) {
        process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION = prevAllowEmbedded;
      } else {
        delete process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
      }
    }

    // Verify GET /api/health when healthy (200) and when database is unavailable (503 without leaking internal error message)
    const healthyRes = await healthGetRoute();
    expect(healthyRes.status).toBe(200);
    const healthyBody = await healthyRes.json();
    expect(healthyBody.status).toBe('healthy');
    expect(healthyBody.database).toBe('connected');

    process.env.CIRCLES_SIMULATE_DB_UNAVAILABLE = 'true';
    try {
      const unhealthyRes = await healthGetRoute();
      expect(unhealthyRes.status).toBe(503);
      const unhealthyBody = await unhealthyRes.json();
      expect(unhealthyBody.status).toBe('unhealthy');
      expect(unhealthyBody.error).toBeUndefined();
      expect(JSON.stringify(unhealthyBody)).not.toContain('Simulated database outage');
    } finally {
      delete process.env.CIRCLES_SIMULATE_DB_UNAVAILABLE;
    }
  });

  it('6. Guarantees transaction rollback on failure and isolates concurrent user transactions', async () => {
    const suffix = Date.now() + 5;
    const userA = (
      await registerUser({
        email: `tx-a-${suffix}@example.com`,
        username: `tx_a_${suffix}`,
        displayName: 'User A',
        password: 'Password123!',
      })
    ).user;
    const userB = (
      await registerUser({
        email: `tx-b-${suffix}@example.com`,
        username: `tx_b_${suffix}`,
        displayName: 'User B',
        password: 'Password123!',
      })
    ).user;

    // Failed transaction rolls back bio update
    await expect(
      withRlsTransaction(userA.id, async (tx) => {
        await tx.query(`UPDATE public.profiles SET bio = 'Temporary Uncommitted Bio' WHERE id = $1;`, [
          userA.id,
        ]);
        throw new Error('Simulated mid-transaction failure');
      })
    ).rejects.toThrow(/Simulated mid-transaction failure/);

    const profileCheck = await withRlsTransaction(userA.id, async (tx) => {
      return tx.query<{ bio: string }>(`SELECT bio FROM public.profiles WHERE id = $1;`, [userA.id]);
    });
    expect(profileCheck.rows[0]?.bio).not.toBe('Temporary Uncommitted Bio');

    // Concurrent transactions for userA, userB, and anon never leak auth.uid()
    const [uidA, uidB, uidAnon] = await Promise.all([
      withRlsTransaction(userA.id, async (tx) => {
        const res = await tx.query<{ uid: string | null }>(`SELECT auth.uid()::text AS uid;`);
        return res.rows[0]?.uid;
      }),
      withRlsTransaction(userB.id, async (tx) => {
        const res = await tx.query<{ uid: string | null }>(`SELECT auth.uid()::text AS uid;`);
        return res.rows[0]?.uid;
      }),
      withRlsTransaction(null, async (tx) => {
        const res = await tx.query<{ uid: string | null; role: string }>(
          `SELECT auth.uid()::text AS uid, current_user AS role;`
        );
        return res.rows[0];
      }),
    ]);

    expect(uidA).toBe(userA.id);
    expect(uidB).toBe(userB.id);
    expect(uidAnon?.uid).toBeNull();
    expect(uidAnon?.role).toBe('anon');
  });
});
