import { describe, expect, it } from 'vitest';
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
} from '@/features/memberships/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import { createPost, listCirclePosts, toggleReaction } from '@/features/discussions/service';
import { moderateContent } from '@/features/moderation/service';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  verifyAndResolveSessionUser,
  verifySignedSessionToken,
} from '@/lib/auth/session';
import {
  assertProductionDatabaseConfigured,
  ConfigurationError,
  getVerifiedSessionSecret,
} from '@/lib/config/env';

describe('Independent Security & Production-Readiness Audit Regression Suite', () => {
  it('1. Enforces stateful session revocation on logout, rejects forged/expired tokens, and revokes all sessions on password reset', async () => {
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

    // Logout immediately revokes the session token server-side
    await signOutUser(reg.sessionToken);
    const resolvedAfterLogout = await verifyAndResolveSessionUser(reg.sessionToken);
    expect(resolvedAfterLogout).toBeNull();

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

  it('2. Rejects expired password recovery tokens (>1 hour old)', async () => {
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
  });

  it('3. Blocks direct PostgreSQL RLS & trigger privilege escalation (email spoofing, owner_id overwrite, role hierarchy bypass, suspended self-restore)', async () => {
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

    // 3d. Circle admin cannot promote a member to admin or owner via direct SQL
    await expect(
      withRlsTransaction(admin.id, async (tx) => {
        await tx.query(
          `UPDATE public.circle_memberships SET role = 'admin' WHERE circle_id = $1 AND user_id = $2;`,
          [circle.id, member.id]
        );
      })
    ).rejects.toThrow(/Only Circle owners can promote members to administrator or owner/i);

    // 3e. Suspended member cannot self-restore or self-leave via direct SQL
    await moderateContent(moderator.id, {
      circleId: circle.id,
      actionType: 'suspend_member',
      targetId: member.id,
      reason: 'Rule violation',
    });
    await expect(
      withRlsTransaction(member.id, async (tx) => {
        await tx.query(
          `UPDATE public.circle_memberships SET status = 'active' WHERE circle_id = $1 AND user_id = $2;`,
          [circle.id, member.id]
        );
      })
    ).rejects.toThrow(/Suspended members cannot modify their own membership status/i);

    // 3f. Client cannot spoof notifications claiming to be another actor
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

  it('4. Protects private user profiles under RLS while keeping their public Circle posts readable', async () => {
    const suffix = Date.now() + 3;
    const author = (
      await registerUser({
        email: `priv-author-${suffix}@example.com`,
        username: `priv_author_${suffix}`,
        displayName: 'Private Author',
        password: 'Password123!',
      })
    ).user;
    const viewer = (
      await registerUser({
        email: `viewer-${suffix}@example.com`,
        username: `viewer_${suffix}`,
        displayName: 'Other Viewer',
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

    await createPost(author.id, {
      circleId: circle.id,
      title: 'Public Post by Private Profile User',
      body: 'This post is in a public Circle.',
    });

    // Author sets profile_visibility to 'private'
    await updateUserProfile(author.id, author.id, {
      displayName: 'Private Author',
      username: author.username,
      bio: 'Secret personal bio',
      profileVisibility: 'private',
    });

    // Anonymous and unrelated authenticated users cannot read the private profile directly
    const anonProfileRead = await withRlsTransaction(null, async (tx) => {
      return tx.query(`SELECT * FROM public.profiles WHERE id = $1;`, [author.id]);
    });
    expect(anonProfileRead.rows.length).toBe(0);

    const otherUserProfileRead = await withRlsTransaction(viewer.id, async (tx) => {
      return tx.query(`SELECT * FROM public.profiles WHERE id = $1;`, [author.id]);
    });
    expect(otherUserProfileRead.rows.length).toBe(0);

    // Public Circle post remains visible to anonymous users with safe fallback display name
    const anonPosts = await listCirclePosts(null, circle.id);
    expect(anonPosts.length).toBe(1);
    expect(anonPosts[0].title).toBe('Public Post by Private Profile User');
    expect(anonPosts[0].author?.display_name).toBe('Circle Member');
  });

  it('5. Enforces capability settings (allowMemberPosts & allowReactions) and fails closed on missing production config', async () => {
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
      category: 'learning',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'learning',
    });

    await joinPublicCircle(member.id, circle.id);

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

    // Member cannot create post when allowMemberPosts is false
    await expect(
      createPost(member.id, {
        circleId: circle.id,
        title: 'Member Post Attempt',
        body: 'Should be blocked by capability setting.',
      })
    ).rejects.toThrow(/Member post creation is currently disabled/i);

    // Member cannot react when allowReactions is false
    await expect(toggleReaction(member.id, circle.id, ownerPost.id)).rejects.toThrow(
      /Reactions are disabled/i
    );

    // Owner can still post even when allowMemberPosts is false
    const secondOwnerPost = await createPost(owner.id, {
      circleId: circle.id,
      title: 'Second Owner Announcement',
      body: 'Owners and moderators can still post.',
    });
    expect(secondOwnerPost.id).toBeTruthy();

    // Verify fail-closed production environment guards
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.CIRCLES_SESSION_SECRET;
    const prevSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevAllowEmbedded = process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.CIRCLES_SESSION_SECRET;
      expect(() => getVerifiedSessionSecret()).toThrow(ConfigurationError);

      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION;
      expect(() => assertProductionDatabaseConfigured()).toThrow(ConfigurationError);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      if (prevSecret !== undefined) process.env.CIRCLES_SESSION_SECRET = prevSecret;
      if (prevSupabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupabaseUrl;
      if (prevAllowEmbedded !== undefined) {
        process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION = prevAllowEmbedded;
      }
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
