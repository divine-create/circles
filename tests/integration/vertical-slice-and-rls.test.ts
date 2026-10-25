import { beforeEach, describe, expect, it } from 'vitest';
import { resetTestDatabase, withRlsTransaction } from '@/lib/db/postgres';
import {
  authenticateUser,
  registerUser,
  requestPasswordRecovery,
  resetPasswordWithToken,
  updateUserProfile,
} from '@/features/auth/service';
import {
  createCircle,
  discoverCircles,
  getCircleBySlugOrId,
  updateCircle,
} from '@/features/circles/service';
import {
  acceptInvitation,
  approveJoinRequest,
  inviteToCircle,
  joinPublicCircle,
  leaveCircle,
  requestToJoinCircle,
  transferCircleOwnership,
} from '@/features/memberships/service';
import {
  getCircleCapabilities,
  getCircleNavigation,
  updateCircleCapability,
} from '@/features/capabilities/service';
import { createCircleSpace, listCircleSpaces } from '@/features/spaces/service';
import {
  createComment,
  createPost,
  getPostWithComments,
  listCirclePosts,
  saveItem,
  toggleReaction,
  updatePost,
} from '@/features/discussions/service';
import { listModerationReports, moderateContent, reportContent } from '@/features/moderation/service';
import { listUserNotifications } from '@/features/notifications/service';

describe('Circles End-to-End Vertical Slice & PostgreSQL RLS Integration Suite', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('executes the complete P0 vertical slice with real PostgreSQL persistence and RLS enforcement', async () => {
    // 1. User 1 registers and signs in
    const { user: ownerUser } = await registerUser({
      email: 'founder@university.edu',
      password: 'SecurePassword123!',
      displayName: 'Dr. Clara Mensah',
      username: 'clara_mensah',
    });

    const signedIn = await authenticateUser({
      email: 'founder@university.edu',
      password: 'SecurePassword123!',
    });
    expect(signedIn.user.id).toBe(ownerUser.id);
    expect(signedIn.sessionToken).toBeTruthy();

    // 2. Register a second user (applicant/member) and a third user (outsider)
    const { user: secondUser } = await registerUser({
      email: 'student@university.edu',
      password: 'SecurePassword123!',
      displayName: 'Marcus Vance',
      username: 'marcus_vance',
    });

    const { user: outsiderUser } = await registerUser({
      email: 'outsider@example.com',
      password: 'SecurePassword123!',
      displayName: 'External User',
      username: 'external_user',
    });

    // Verify User 2 cannot edit User 1's profile (blocked by RLS)
    await expect(
      updateUserProfile(secondUser.id, ownerUser.id, {
        displayName: 'Spoofed Name',
        username: 'clara_mensah',
        bio: 'Hacked',
        profileVisibility: 'public',
      })
    ).rejects.toThrow();

    // 3. User 1 creates a Circle from the University template
    const circle = await createCircle(ownerUser.id, {
      name: 'Cambridge Distributed Systems Society',
      slug: 'cambridge-systems',
      description: 'Research discussions and systems engineering cohorts.',
      category: 'university',
      location: 'Cambridge, UK',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'university',
    });

    expect(circle.slug).toBe('cambridge-systems');
    expect(circle.current_user_role).toBe('owner');
    expect(circle.member_count).toBe(1);

    // 4. Verify default capabilities and spaces were initialized in PostgreSQL
    const initialCaps = await getCircleCapabilities(ownerUser.id, circle.id);
    const enabledKeys = initialCaps.filter((c) => c.enabled).map((c) => c.capability_key);
    expect(enabledKeys).toContain('discussions');
    expect(enabledKeys).toContain('spaces');
    expect(enabledKeys).toContain('member_directory');
    expect(enabledKeys).toContain('events');

    const initialSpaces = await listCircleSpaces(ownerUser.id, circle.id);
    expect(initialSpaces.length).toBeGreaterThanOrEqual(3);

    // 5. Owner updates a Circle setting
    const updatedCircle = await updateCircle(ownerUser.id, circle.id, {
      description: 'Updated description: Systems research, consensus protocols, and study groups.',
      location: 'Cambridge Computer Lab',
    });
    expect(updatedCircle.location).toBe('Cambridge Computer Lab');

    // Unauthorized user cannot update Circle settings
    await expect(
      updateCircle(secondUser.id, circle.id, {
        name: 'Unauthorized Rename',
      })
    ).rejects.toThrow();

    // 6. Second user discovers the Circle and joins it
    const discovered = await discoverCircles(secondUser.id, { search: 'Cambridge' });
    expect(discovered.some((c) => c.id === circle.id)).toBe(true);

    const joinedMembership = await joinPublicCircle(secondUser.id, circle.id);
    expect(joinedMembership.role).toBe('member');
    expect(joinedMembership.status).toBe('active');

    // 7. Authorized member creates a post in a space
    const generalSpace = initialSpaces.find((s) => s.slug === 'general') ?? initialSpaces[0];
    const post = await createPost(secondUser.id, {
      circleId: circle.id,
      spaceId: generalSpace.id,
      title: 'Raft vs Paxos Study Notes',
      body: 'Sharing our annotated implementation notes from this week.',
    });
    expect(post.title).toBe('Raft vs Paxos Study Notes');

    // 8. Post persists across fresh queries; comments, reactions, and saved items work
    const feed = await listCirclePosts(ownerUser.id, circle.id);
    expect(feed.length).toBe(1);
    expect(feed[0].id).toBe(post.id);

    const comment = await createComment(ownerUser.id, {
      circleId: circle.id,
      postId: post.id,
      body: 'Great summary, pinning this for Thursday seminar!',
    });
    expect(comment.body).toContain('Great summary');

    // Second user receives an in-app notification for the reply
    const secondUserNotifs = await listUserNotifications(secondUser.id);
    expect(secondUserNotifs.some((n) => n.event_type === 'new_comment')).toBe(true);

    const reaction = await toggleReaction(ownerUser.id, circle.id, post.id, 'like');
    expect(reaction.active).toBe(true);
    expect(reaction.reactionCount).toBe(1);

    const saved = await saveItem(ownerUser.id, circle.id, post.id);
    expect(saved.saved).toBe(true);

    const detail = await getPostWithComments(secondUser.id, circle.id, post.id);
    expect(detail.comments.length).toBe(1);
    expect(detail.post.reaction_count).toBe(1);

    // 9. Non-member (outsiderUser) cannot create posts or modify member content
    await expect(
      createPost(outsiderUser.id, {
        circleId: circle.id,
        title: 'Outsider Post',
        body: 'Should be rejected',
      })
    ).rejects.toThrow();

    await expect(
      updatePost(outsiderUser.id, circle.id, post.id, {
        title: 'Tampered Title',
      })
    ).rejects.toThrow();
  });

  it('enforces approval-based joining, private Circle isolation, invitations, and cross-Circle anti-IDOR', async () => {
    const { user: owner } = await registerUser({
      email: 'owner@hood.org',
      password: 'Password123!',
      displayName: 'Neighbourhood Lead',
      username: 'hood_lead',
    });
    const { user: applicant } = await registerUser({
      email: 'resident@hood.org',
      password: 'Password123!',
      displayName: 'Local Resident',
      username: 'local_resident',
    });
    const { user: invitee } = await registerUser({
      email: 'invited@stealth.io',
      password: 'Password123!',
      displayName: 'Invited Builder',
      username: 'invited_builder',
    });

    // Create an Approval-Based Circle
    const approvalCircle = await createCircle(owner.id, {
      name: 'Barnsbury Residents Circle',
      visibility: 'discoverable_approval',
      membershipPolicy: 'approval',
      category: 'neighbourhood',
    });

    // Applicant can discover the Circle, but cannot join directly as open or read its posts before approval
    const discovered = await discoverCircles(applicant.id);
    expect(discovered.some((c) => c.id === approvalCircle.id)).toBe(true);

    await expect(joinPublicCircle(applicant.id, approvalCircle.id)).rejects.toThrow();

    // Direct PostgreSQL RLS check: non-member cannot read posts in a discoverable_approval Circle
    const ownerPost = await createPost(owner.id, {
      circleId: approvalCircle.id,
      title: 'Internal AGM Minutes',
      body: 'Confidential minutes for approved residents.',
    });
    expect(ownerPost.id).toBeTruthy();

    const leakedPostsForNonMember = await withRlsTransaction(applicant.id, async (tx) => {
      const res = await tx.query(`SELECT * FROM public.posts WHERE circle_id = $1;`, [
        approvalCircle.id,
      ]);
      return res.rows;
    });
    expect(leakedPostsForNonMember.length).toBe(0);

    // Applicant submits a join request; duplicate pending request is rejected
    const joinReq = await requestToJoinCircle(
      applicant.id,
      approvalCircle.id,
      'I live at 42 Barnsbury Square.'
    );
    expect(joinReq.status).toBe('pending');

    await expect(
      requestToJoinCircle(applicant.id, approvalCircle.id, 'Duplicate request')
    ).rejects.toThrow();

    // Owner approves the join request -> Applicant becomes active member and can now read posts
    const approvedMembership = await approveJoinRequest(
      owner.id,
      approvalCircle.id,
      joinReq.id
    );
    expect(approvedMembership.status).toBe('active');

    const visiblePostsAfterApproval = await listCirclePosts(applicant.id, approvalCircle.id);
    expect(visiblePostsAfterApproval.length).toBe(1);

    // Create a Private Circle
    const privateCircle = await createCircle(owner.id, {
      name: 'Stealth Hardware Team',
      visibility: 'private',
      membershipPolicy: 'invite_only',
      category: 'project',
    });

    // Private Circle must NOT leak in public discovery or direct lookup by non-members
    const publicSearch = await discoverCircles(applicant.id, { search: 'Stealth' });
    expect(publicSearch.some((c) => c.id === privateCircle.id)).toBe(false);

    const directLookupByNonMember = await getCircleBySlugOrId(applicant.id, privateCircle.id);
    expect(directLookupByNonMember).toBeNull();

    // Invite `invitee` to the Private Circle and accept invitation
    const { rawToken } = await inviteToCircle(
      owner.id,
      privateCircle.id,
      invitee.email,
      'moderator'
    );
    const accepted = await acceptInvitation(invitee.id, rawToken);
    expect(accepted.role).toBe('moderator');
    expect(accepted.status).toBe('active');

    // Verify Cross-Circle Space attachment is blocked (cannot attach space from approvalCircle to a post in privateCircle)
    const approvalSpaces = await listCircleSpaces(owner.id, approvalCircle.id);
    await expect(
      createPost(owner.id, {
        circleId: privateCircle.id,
        spaceId: approvalSpaces[0].id,
        title: 'Cross-Circle Injection Attempt',
        body: 'Should fail validation and composite FK.',
      })
    ).rejects.toThrow();
  });

  it('preserves data when disabling a capability, enforces last-owner protection, and records moderation actions', async () => {
    const { user: owner } = await registerUser({
      email: 'lead@club.org',
      password: 'Password123!',
      displayName: 'Club Founder',
      username: 'club_founder',
    });
    const { user: member } = await registerUser({
      email: 'member@club.org',
      password: 'Password123!',
      displayName: 'Club Member',
      username: 'club_member',
    });

    const circle = await createCircle(owner.id, {
      name: 'Highland Running Club',
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'sports',
      templateKey: 'sports',
    });

    await joinPublicCircle(member.id, circle.id);

    const post = await createPost(member.id, {
      circleId: circle.id,
      title: 'Saturday Trail Route',
      body: 'Meeting at 7:30am at the north gate.',
    });

    // Disable `discussions` capability -> blocks reading/creating posts and hides Discussions from navigation,
    // but preserves the post row in PostgreSQL!
    await updateCircleCapability(owner.id, circle.id, 'discussions', false);

    const navWhileDisabled = await getCircleNavigation(owner.id, circle.id, circle.slug);
    expect(navWhileDisabled.enabledCapabilityKeys).not.toContain('discussions');

    await expect(listCirclePosts(member.id, circle.id)).rejects.toThrow();

    // Re-enable `discussions` -> previously created post is intact!
    await updateCircleCapability(owner.id, circle.id, 'discussions', true);
    const postsAfterReenable = await listCirclePosts(member.id, circle.id);
    expect(postsAfterReenable.some((p) => p.id === post.id)).toBe(true);

    // Content Reporting & Moderation workflow
    const report = await reportContent(member.id, {
      circleId: circle.id,
      targetType: 'post',
      targetPostId: post.id,
      reason: 'spam',
      details: 'Duplicate route thread',
    });
    expect(report.status).toBe('open');

    const reportsQueue = await listModerationReports(owner.id, circle.id);
    expect(reportsQueue.some((r) => r.id === report.id)).toBe(true);

    await moderateContent(owner.id, {
      circleId: circle.id,
      reportId: report.id,
      actionType: 'remove_post',
      targetId: post.id,
      reason: 'Removed duplicate thread',
    });

    const postsAfterModeration = await listCirclePosts(member.id, circle.id);
    expect(postsAfterModeration.some((p) => p.id === post.id)).toBe(false);

    // Last-owner protection: sole owner cannot leave Circle until ownership is transferred
    await expect(leaveCircle(owner.id, circle.id)).rejects.toThrow();

    await transferCircleOwnership(owner.id, circle.id, member.id);
    // Now previous owner (demoted to admin) can leave safely
    await leaveCircle(owner.id, circle.id);

    // Password recovery & reset workflow
    const recovery = await requestPasswordRecovery(member.email);
    expect(recovery.recoveryTokenIssued).toBe(true);
    expect(recovery.previewToken).toBeTruthy();

    await resetPasswordWithToken(recovery.previewToken!, 'NewStrongPass456!');
    const relogin = await authenticateUser({
      email: member.email,
      password: 'NewStrongPass456!',
    });
    expect(relogin.user.id).toBe(member.id);
  });

  it('allows creating custom spaces and enforces space posting policies', async () => {
    const { user: owner } = await registerUser({
      email: 'admin@guild.dev',
      password: 'Password123!',
      displayName: 'Guild Owner',
      username: 'guild_owner',
    });
    const { user: regularMember } = await registerUser({
      email: 'dev@guild.dev',
      password: 'Password123!',
      displayName: 'Regular Dev',
      username: 'regular_dev',
    });

    const circle = await createCircle(owner.id, {
      name: 'Systems Guild',
      visibility: 'public',
      membershipPolicy: 'open',
    });
    await joinPublicCircle(regularMember.id, circle.id);

    const adminOnlySpace = await createCircleSpace(owner.id, circle.id, {
      name: 'Official Releases',
      slug: 'releases',
      description: 'Only admins may publish release notes.',
      postingPolicy: 'admins',
    });

    // Regular member cannot post in an 'admins' space (enforced by both service and PostgreSQL RLS)
    await expect(
      createPost(regularMember.id, {
        circleId: circle.id,
        spaceId: adminOnlySpace.id,
        title: 'Unauthorized Release',
        body: 'Should be blocked',
      })
    ).rejects.toThrow();

    // Owner can post in the 'admins' space
    const releasePost = await createPost(owner.id, {
      circleId: circle.id,
      spaceId: adminOnlySpace.id,
      title: 'v1.0.0 Production Release',
      body: 'All checks green.',
    });
    expect(releasePost.space_id).toBe(adminOnlySpace.id);
  });
});
