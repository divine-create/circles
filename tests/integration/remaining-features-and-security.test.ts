import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { joinPublicCircle, listCircleMembers } from '@/features/memberships/service';
import {
  getCircleNavigation,
  updateCircleCapability,
} from '@/features/capabilities/service';
import {
  createCircleEvent,
  listCircleEvents,
  recordEventAttendance,
  rsvpToCircleEvent,
} from '@/features/events/service';
import {
  castPollVote,
  createCirclePoll,
  listCirclePolls,
  updatePollStatus,
} from '@/features/polls/service';
import {
  createListingInquiry,
  createMarketplaceListing,
  createServiceOrRentalBooking,
  listMarketplaceListings,
  respondToListingInquiry,
  toggleSavedListing,
  updateMarketplaceListing,
  updateServiceOrRentalBookingStatus,
} from '@/features/marketplace/service';
import {
  createJobOpportunity,
  listJobApplications,
  reviewJobApplication,
  submitJobApplication,
} from '@/features/jobs/service';
import {
  createCircleProject,
  createLearningResource,
  createProjectTask,
  listCircleProjects,
  listLearningResources,
  toggleResourceBookmark,
  updateProjectTask,
} from '@/features/resources/service';
import {
  createCommunityChallenge,
  createFundraisingCampaign,
  createFundraisingPledge,
  createGovernanceProposal,
  createSupportTicket,
  decideGovernanceProposal,
  listFundraisingCampaigns,
  listSupportTickets,
  reviewChallengeSubmission,
  submitChallengeEntry,
  updateSupportTicket,
} from '@/features/governance/service';
import {
  createMediaUpload,
  deleteOrCleanupMediaUpload,
  getMediaUploadForDownload,
} from '@/features/uploads/service';
import { listUserNotifications } from '@/features/notifications/service';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  assertCsrfProtection,
  checkDistributedRateLimit,
} from '@/lib/auth/api-helpers';
import { POST as loginPostRoute } from '@/app/api/auth/login/route';

describe('Remaining Capabilities, Domain Workflows & Security Hardening', () => {
  it('1. Enforces CSRF Origin/Sec-Fetch-Site validation on state-changing requests and distributed PostgreSQL rate limiting', async () => {
    // Cross-site Sec-Fetch-Site must be rejected with 403
    const crossSiteReq = new NextRequest('http://localhost:3000/api/circles', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        'sec-fetch-site': 'cross-site',
      },
    });
    expect(() => assertCsrfProtection(crossSiteReq)).toThrow(
      /Cross-site state-changing request blocked/i
    );

    // Mismatched Origin header must be rejected with 403
    const mismatchedOriginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'https://evil-phishing.example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'victim@example.com', password: 'Password123!' }),
    });
    const csrfLoginRes = await loginPostRoute(mismatchedOriginReq);
    expect(csrfLoginRes.status).toBe(403);
    const csrfLoginBody = await csrfLoginRes.json();
    expect(csrfLoginBody.code).toBe('FORBIDDEN');

    // Same-origin Origin header is allowed
    const sameOriginReq = new NextRequest('http://localhost:3000/api/circles', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    });
    expect(() => assertCsrfProtection(sameOriginReq)).not.toThrow();

    // Distributed PostgreSQL rate limit bucket enforcement
    const bucketKey = `test-dist-rl-${Date.now()}`;
    const r1 = await checkDistributedRateLimit(bucketKey, 2, 60_000, true);
    const r2 = await checkDistributedRateLimit(bucketKey, 2, 60_000, true);
    const r3 = await checkDistributedRateLimit(bucketKey, 2, 60_000, true);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(false);

    // Non-service_role cannot query public.rate_limit_buckets
    await expect(
      withRlsTransaction(null, async (tx) => {
        await tx.query(`SELECT * FROM public.rate_limit_buckets;`);
      })
    ).rejects.toThrow(/permission denied/i);
  });

  it('2. Executes Events, RSVPs, Capacity Waitlist Auto-Promotion, Attendance Check-In & Non-Destructive Capability Disabling', async () => {
    const suffix = Date.now();
    const { user: owner } = await registerUser({
      email: `ev-owner-${suffix}@example.com`,
      username: `ev_owner_${suffix}`,
      displayName: 'Event Owner',
      password: 'Password123!',
    });
    const { user: memberA } = await registerUser({
      email: `ev-m1-${suffix}@example.com`,
      username: `ev_m1_${suffix}`,
      displayName: 'Member Alpha',
      password: 'Password123!',
    });
    const { user: memberB } = await registerUser({
      email: `ev-m2-${suffix}@example.com`,
      username: `ev_m2_${suffix}`,
      displayName: 'Member Beta',
      password: 'Password123!',
    });

    const circle = await createCircle(owner.id, {
      name: `Events Test Circle ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'university',
    });

    await joinPublicCircle(memberA.id, circle.id);
    await joinPublicCircle(memberB.id, circle.id);

    await updateCircleCapability(owner.id, circle.id, 'events', true);
    await updateCircleCapability(owner.id, circle.id, 'rsvps', true);
    await updateCircleCapability(owner.id, circle.id, 'attendance', true);

    const nav = await getCircleNavigation(owner.id, circle.id, circle.slug);
    expect(nav.navigationItems.some((i) => i.href.endsWith('/events'))).toBe(true);

    // Create an event with capacity = 1
    const startsAt = new Date(Date.now() + 86400_000).toISOString();
    const endsAt = new Date(Date.now() + 90000_000).toISOString();
    const event = await createCircleEvent(owner.id, {
      circleId: circle.id,
      title: 'Capacity-Limited Systems Workshop',
      description: 'Hands-on consensus debugging.',
      eventType: 'workshop',
      locationType: 'hybrid',
      venueText: 'Room 101',
      startsAt,
      endsAt,
      capacity: 1,
    });

    // Member A RSVPs -> status is 'going'
    const rsvpA = await rsvpToCircleEvent(memberA.id, circle.id, event.id, 'register');
    expect(rsvpA.rsvp.status).toBe('going');

    // Member B RSVPs -> capacity is full, automatically placed on waitlist ('waitlisted')
    const rsvpB = await rsvpToCircleEvent(memberB.id, circle.id, event.id, 'register');
    expect(rsvpB.rsvp.status).toBe('waitlisted');

    // Member A cancels RSVP -> Member B is automatically promoted from waitlist to 'going'!
    const cancelA = await rsvpToCircleEvent(memberA.id, circle.id, event.id, 'cancel');
    expect(cancelA.rsvp.status).toBe('cancelled');
    expect(cancelA.promotedUserId).toBe(memberB.id);

    const eventsAfterPromotion = await listCircleEvents(memberB.id, circle.id);
    const updatedEvent = eventsAfterPromotion.find((e) => e.id === event.id)!;
    expect(updatedEvent.going_count).toBe(1);
    expect(updatedEvent.waitlisted_count).toBe(0);
    expect(updatedEvent.viewer_rsvp_status).toBe('going');

    const bNotifs = await listUserNotifications(memberB.id);
    expect(bNotifs.some((n) => n.title.includes('Promoted from Waitlist'))).toBe(true);

    // Ordinary member cannot record attendance for others; organizer can
    await expect(
      recordEventAttendance(memberA.id, circle.id, event.id, memberB.id, true)
    ).rejects.toThrow(/Only the event organizer/i);

    const checkedIn = await recordEventAttendance(
      owner.id,
      circle.id,
      event.id,
      memberB.id,
      true
    );
    expect(checkedIn.attended).toBe(true);

    // Disable events stack -> blocks reads but preserves data when re-enabled
    await updateCircleCapability(owner.id, circle.id, 'attendance', false);
    await updateCircleCapability(owner.id, circle.id, 'rsvps', false);
    await updateCircleCapability(owner.id, circle.id, 'events', false);

    await expect(listCircleEvents(owner.id, circle.id)).rejects.toThrow();

    await updateCircleCapability(owner.id, circle.id, 'events', true);
    const restoredEvents = await listCircleEvents(owner.id, circle.id);
    expect(restoredEvents.some((e) => e.id === event.id)).toBe(true);
  });

  it('3. Enforces Polls Single-Choice Integrity, Result Visibility Rules (after_vote / after_close), and Poll Closure', async () => {
    const suffix = Date.now() + 100;
    const { user: owner } = await registerUser({
      email: `poll-owner-${suffix}@example.com`,
      username: `poll_owner_${suffix}`,
      displayName: 'Poll Owner',
      password: 'Password123!',
    });
    const { user: voter } = await registerUser({
      email: `poll-voter-${suffix}@example.com`,
      username: `poll_voter_${suffix}`,
      displayName: 'Poll Voter',
      password: 'Password123!',
    });

    const circle = await createCircle(owner.id, {
      name: `Polls Circle ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'general',
    });
    await joinPublicCircle(voter.id, circle.id);
    await updateCircleCapability(owner.id, circle.id, 'polls_decisions', true);

    const poll = await createCirclePoll(owner.id, {
      circleId: circle.id,
      question: 'Should we move sprints to two weeks?',
      allowMultiple: false,
      resultsVisibility: 'after_vote',
      options: ['Yes, two weeks', 'No, keep one week'],
    });

    // Before voting, ordinary member cannot see vote counts when resultsVisibility = 'after_vote'
    const beforeVoteList = await listCirclePolls(voter.id, circle.id);
    expect(beforeVoteList[0].results_visible_to_viewer).toBe(false);
    expect(beforeVoteList[0].total_votes).toBeNull();
    expect(beforeVoteList[0].options[0].vote_count).toBeNull();

    // Single-choice poll rejects voting for multiple options at once
    await expect(
      castPollVote(voter.id, circle.id, poll.id, {
        optionIds: [poll.options[0].id, poll.options[1].id],
      })
    ).rejects.toThrow(/Single-choice polls/i);

    // Voter casts valid single vote -> results become visible to voter
    const afterVote = await castPollVote(voter.id, circle.id, poll.id, {
      optionIds: [poll.options[0].id],
    });
    expect(afterVote.results_visible_to_viewer).toBe(true);
    expect(afterVote.total_votes).toBe(1);
    expect(afterVote.options[0].vote_count).toBe(1);

    // Duplicate vote on single-choice poll is blocked (including at DB trigger level)
    await expect(
      castPollVote(voter.id, circle.id, poll.id, {
        optionIds: [poll.options[1].id],
      })
    ).rejects.toThrow(/already voted/i);

    // Close poll with decision summary -> further voting is blocked
    const closedPoll = await updatePollStatus(owner.id, circle.id, poll.id, {
      status: 'closed',
      decisionSummary: 'Adopted two-week sprint cadence starting next month.',
    });
    expect(closedPoll.status).toBe('closed');
    expect(closedPoll.decision_summary).toContain('two-week sprint');

    await expect(
      castPollVote(owner.id, circle.id, poll.id, {
        optionIds: [poll.options[0].id],
      })
    ).rejects.toThrow(/closed/i);
  });

  it('4. Enforces Marketplace Listings, Inquiries, Service/Rental Bookings, and Database-Level Booking Conflict Prevention', async () => {
    const suffix = Date.now() + 200;
    const { user: provider } = await registerUser({
      email: `mkt-prov-${suffix}@example.com`,
      username: `mkt_prov_${suffix}`,
      displayName: 'Tool Provider',
      password: 'Password123!',
    });
    const { user: buyerA } = await registerUser({
      email: `mkt-b1-${suffix}@example.com`,
      username: `mkt_b1_${suffix}`,
      displayName: 'Buyer One',
      password: 'Password123!',
    });
    const { user: buyerB } = await registerUser({
      email: `mkt-b2-${suffix}@example.com`,
      username: `mkt_b2_${suffix}`,
      displayName: 'Buyer Two',
      password: 'Password123!',
    });

    const circle = await createCircle(provider.id, {
      name: `Neighbourhood Exchange ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'neighbourhood',
    });
    await joinPublicCircle(buyerA.id, circle.id);
    await joinPublicCircle(buyerB.id, circle.id);

    await updateCircleCapability(provider.id, circle.id, 'listings_discovery', true);
    await updateCircleCapability(provider.id, circle.id, 'services_bookings', true);
    await updateCircleCapability(provider.id, circle.id, 'rentals_sharing', true);

    const rentalListing = await createMarketplaceListing(provider.id, {
      circleId: circle.id,
      listingType: 'rental',
      category: 'tools',
      title: 'Heavy-Duty Pressure Washer',
      description: 'Available for weekend patio cleaning.',
      priceAmount: 15,
      pricingUnit: 'daily',
      condition: 'good',
      location: '14 Oak Street',
    });

    // Buyer A cannot edit Provider's listing
    await expect(
      updateMarketplaceListing(buyerA.id, circle.id, rentalListing.id, {
        priceAmount: 0,
      })
    ).rejects.toThrow(/Only the listing owner/i);

    // Save/bookmark listing
    const saveRes = await toggleSavedListing(buyerA.id, circle.id, rentalListing.id);
    expect(saveRes.saved).toBe(true);

    // Buyer A submits inquiry -> Provider responds
    const inquiry = await createListingInquiry(buyerA.id, circle.id, rentalListing.id, {
      message: 'Does this include the surface cleaner attachment?',
    });
    expect(inquiry.status).toBe('open');

    const responded = await respondToListingInquiry(provider.id, circle.id, inquiry.id, {
      status: 'responded',
      sellerResponse: 'Yes, both nozzles and the patio disk are included!',
    });
    expect(responded.status).toBe('responded');

    // Overlapping rental booking conflict test
    const slotStart = '2027-05-10T09:00:00.000Z';
    const slotEnd = '2027-05-10T17:00:00.000Z';

    const bookingA = await createServiceOrRentalBooking(
      buyerA.id,
      circle.id,
      rentalListing.id,
      {
        bookingType: 'rental',
        startsAt: slotStart,
        endsAt: slotEnd,
        notes: 'Borrowing for Saturday driveway wash.',
      }
    );

    const bookingB = await createServiceOrRentalBooking(
      buyerB.id,
      circle.id,
      rentalListing.id,
      {
        bookingType: 'rental',
        startsAt: '2027-05-10T12:00:00.000Z',
        endsAt: '2027-05-10T18:00:00.000Z',
        notes: 'Overlapping afternoon request.',
      }
    );

    // Provider approves Booking A -> succeeds
    const approvedA = await updateServiceOrRentalBookingStatus(
      provider.id,
      circle.id,
      bookingA.id,
      { status: 'approved' }
    );
    expect(approvedA.status).toBe('approved');

    // Provider attempts to approve overlapping Booking B -> blocked by trg_prevent_booking_conflicts!
    await expect(
      updateServiceOrRentalBookingStatus(provider.id, circle.id, bookingB.id, {
        status: 'approved',
      })
    ).rejects.toThrow(/Booking conflict/i);

    // Mark Booking A as returned
    const returnedA = await updateServiceOrRentalBookingStatus(
      provider.id,
      circle.id,
      bookingA.id,
      { status: 'returned', providerNote: 'Returned clean and on time.' }
    );
    expect(returnedA.status).toBe('returned');
    expect(returnedA.returned_at).toBeTruthy();

    const filtered = await listMarketplaceListings(buyerA.id, circle.id, {
      listingType: 'rental',
      search: 'Pressure Washer',
    });
    expect(filtered.length).toBe(1);
  });

  it('5. Enforces Jobs & Opportunities Workflow and Strict Applicant Privacy (Service Layer + PostgreSQL RLS)', async () => {
    const suffix = Date.now() + 300;
    const { user: owner } = await registerUser({
      email: `job-owner-${suffix}@example.com`,
      username: `job_owner_${suffix}`,
      displayName: 'Circle Owner',
      password: 'Password123!',
    });
    const { user: poster } = await registerUser({
      email: `job-poster-${suffix}@example.com`,
      username: `job_poster_${suffix}`,
      displayName: 'Hiring Lead',
      password: 'Password123!',
    });
    const { user: applicant } = await registerUser({
      email: `job-app-${suffix}@example.com`,
      username: `job_app_${suffix}`,
      displayName: 'Candidate Alice',
      password: 'Password123!',
    });
    const { user: bystander } = await registerUser({
      email: `job-bys-${suffix}@example.com`,
      username: `job_bys_${suffix}`,
      displayName: 'Curious Bystander',
      password: 'Password123!',
    });

    const circle = await createCircle(owner.id, {
      name: `Career Network ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'professional',
    });
    await joinPublicCircle(poster.id, circle.id);
    await joinPublicCircle(applicant.id, circle.id);
    await joinPublicCircle(bystander.id, circle.id);

    await updateCircleCapability(owner.id, circle.id, 'jobs_opportunities', true);

    const job = await createJobOpportunity(poster.id, {
      circleId: circle.id,
      title: 'Staff Security Engineer',
      organizationName: 'Acme Cloud',
      opportunityType: 'full_time',
      workMode: 'remote',
      compensationText: '$190k - $220k',
      description: 'Lead PostgreSQL RLS architecture and zero-trust services.',
    });

    const application = await submitJobApplication(applicant.id, circle.id, job.id, {
      coverNote: '10 years building multi-tenant systems with strict RLS.',
      portfolioUrl: 'https://github.com/alice',
    });
    expect(application.status).toBe('submitted');

    // Bystander (an active member of the Circle) CANNOT see Alice's application via service or direct PostgreSQL RLS!
    const bystanderApps = await listJobApplications(bystander.id, circle.id);
    expect(bystanderApps.length).toBe(0);

    const bystanderDirectRls = await withRlsTransaction(bystander.id, async (tx) => {
      const res = await tx.query(
        `SELECT * FROM public.job_applications WHERE circle_id = $1;`,
        [circle.id]
      );
      return res.rows;
    });
    expect(bystanderDirectRls.length).toBe(0);

    // Poster and Applicant CAN see the application
    const posterApps = await listJobApplications(poster.id, circle.id);
    expect(posterApps.length).toBe(1);
    expect(posterApps[0].id).toBe(application.id);

    // Poster reviews and shortlists the application
    const shortlisted = await reviewJobApplication(poster.id, circle.id, application.id, {
      status: 'shortlisted',
      reviewerNote: 'Strong distributed systems background — scheduling interview.',
    });
    expect(shortlisted.status).toBe('shortlisted');
  });

  it('6. Executes Learning Resources, Bookmarks, Collaborative Projects, Governance, Fundraising Pledges, Challenges (Anti-Self-Award) & Private Support Tickets', async () => {
    const suffix = Date.now() + 400;
    const { user: owner } = await registerUser({
      email: `gov-owner-${suffix}@example.com`,
      username: `gov_owner_${suffix}`,
      displayName: 'Community Founder',
      password: 'Password123!',
    });
    const { user: memberA } = await registerUser({
      email: `gov-m1-${suffix}@example.com`,
      username: `gov_m1_${suffix}`,
      displayName: 'Builder Member',
      password: 'Password123!',
    });
    const { user: memberB } = await registerUser({
      email: `gov-m2-${suffix}@example.com`,
      username: `gov_m2_${suffix}`,
      displayName: 'Other Member',
      password: 'Password123!',
    });

    const circle = await createCircle(owner.id, {
      name: `Full Guild ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'learning',
    });
    await joinPublicCircle(memberA.id, circle.id);
    await joinPublicCircle(memberB.id, circle.id);

    await updateCircleCapability(owner.id, circle.id, 'learning_resources', true);
    await updateCircleCapability(owner.id, circle.id, 'projects_collaboration', true);
    await updateCircleCapability(owner.id, circle.id, 'governance_committees', true);
    await updateCircleCapability(owner.id, circle.id, 'fundraising_causes', true);
    await updateCircleCapability(owner.id, circle.id, 'challenges_rewards', true);
    await updateCircleCapability(owner.id, circle.id, 'help_desk', true);

    // Member directory search & role filtering
    const ownerFilter = await listCircleMembers(owner.id, circle.id, { role: 'owner' });
    expect(ownerFilter.length).toBe(1);
    expect(ownerFilter[0].user_id).toBe(owner.id);

    // 1. Learning resource & bookmark
    const resource = await createLearningResource(memberA.id, {
      circleId: circle.id,
      capabilityKey: 'learning_resources',
      category: 'curriculum',
      title: 'Zero-Downtime PostgreSQL Migrations',
      summary: 'Forward-only patterns for multi-tenant schemas.',
      contentBody: 'Always avoid long table locks and verify RLS policies.',
      difficultyLevel: 'advanced',
    });
    const bm = await toggleResourceBookmark(memberB.id, circle.id, resource.id);
    expect(bm.bookmarked).toBe(true);
    const bookmarkedList = await listLearningResources(memberB.id, circle.id, {
      bookmarkedOnly: true,
    });
    expect(bookmarkedList.length).toBe(1);

    // 2. Collaborative project & task completion
    const project = await createCircleProject(memberA.id, {
      circleId: circle.id,
      name: 'Community Docs Portal',
      description: 'Curating onboarding guides.',
    });
    const task = await createProjectTask(memberA.id, circle.id, project.id, {
      title: 'Write RLS architecture chapter',
      priority: 'high',
    });
    const doneTask = await updateProjectTask(memberA.id, circle.id, task.id, {
      status: 'done',
    });
    expect(doneTask.status).toBe('done');
    expect(doneTask.completed_at).toBeTruthy();

    const projects = await listCircleProjects(memberA.id, circle.id);
    expect(projects[0].tasks?.length).toBe(1);

    // 3. Governance proposal & admin decision
    const proposal = await createGovernanceProposal(memberA.id, {
      circleId: circle.id,
      committeeName: 'Architecture Committee',
      title: 'Adopt Bi-Weekly Security Reviews',
      body: 'Every capability release undergoes automated RLS regression verification.',
    });
    await expect(
      decideGovernanceProposal(memberB.id, circle.id, proposal.id, {
        status: 'approved',
      })
    ).rejects.toThrow(/Only Circle administrators or owners/i);

    const decided = await decideGovernanceProposal(owner.id, circle.id, proposal.id, {
      status: 'approved',
      decisionRationale: 'Unanimously ratified by Circle leadership.',
    });
    expect(decided.status).toBe('approved');

    // 4. Fundraising campaign & community pledges
    const campaign = await createFundraisingCampaign(owner.id, {
      circleId: circle.id,
      title: 'Annual Community Scholarship Fund',
      description: 'Supporting student conference travel grants.',
      goalAmount: 2000,
      currency: 'USD',
    });
    await createFundraisingPledge(memberA.id, circle.id, campaign.id, {
      pledgeAmount: 150,
      message: 'Happy to support student researchers!',
    });
    const campaigns = await listFundraisingCampaigns(memberA.id, circle.id);
    expect(campaigns[0].pledged_total).toBe(150);
    expect(campaigns[0].pledge_count).toBe(1);

    // 5. Challenges & Rewards (including DB trigger protection against self-awarding)
    const challenge = await createCommunityChallenge(owner.id, {
      circleId: circle.id,
      title: '30-Day Open Source Contribution Streak',
      description: 'Submit a verified PR link.',
      rewardBadgeName: 'Open Source Champion',
      rewardPoints: 250,
    });

    const submission = await submitChallengeEntry(memberA.id, circle.id, challenge.id, {
      submissionText: 'Merged PR #42 adding composite foreign keys.',
      proofUrl: 'https://github.com/example/repo/pull/42',
    });
    expect(submission.status).toBe('submitted');
    expect(submission.awarded_points).toBe(0);

    // Ordinary member attempting to self-approve or award points directly in PostgreSQL is blocked
    await expect(
      reviewChallengeSubmission(memberA.id, circle.id, submission.id, {
        status: 'approved',
        awardedPoints: 9999,
      })
    ).rejects.toThrow(/Only Circle moderators/i);

    const awarded = await reviewChallengeSubmission(owner.id, circle.id, submission.id, {
      status: 'approved',
    });
    expect(awarded.status).toBe('approved');
    expect(awarded.awarded_points).toBe(250);
    expect(awarded.awarded_badge).toBe('Open Source Champion');

    // 6. Help Desk private support ticket isolation
    const privateTicket = await createSupportTicket(memberA.id, {
      circleId: circle.id,
      category: 'membership',
      priority: 'high',
      isPrivate: true,
      subject: 'Confidential accommodation request',
      description: 'Requesting accessible seating for the upcoming workshop.',
    });

    // Member B (ordinary member) CANNOT read Member A's private support ticket!
    const memberBTickets = await listSupportTickets(memberB.id, circle.id);
    expect(memberBTickets.some((t) => t.id === privateTicket.id)).toBe(false);

    // Owner/moderator CAN read and resolve Member A's private ticket
    const ownerTickets = await listSupportTickets(owner.id, circle.id);
    expect(ownerTickets.some((t) => t.id === privateTicket.id)).toBe(true);

    const resolvedTicket = await updateSupportTicket(
      owner.id,
      circle.id,
      privateTicket.id,
      {
        status: 'resolved',
        resolutionNotes: 'Reserved front-row accessible seating for you.',
      }
    );
    expect(resolvedTicket.status).toBe('resolved');
  });

  it('7. Enforces Secure Media & File Upload Validation (MIME Allowlist, Magic Bytes, Size Limit, Signed URLs & Deletion)', async () => {
    const suffix = Date.now() + 500;
    const { user: uploader } = await registerUser({
      email: `up-user-${suffix}@example.com`,
      username: `up_user_${suffix}`,
      displayName: 'Media Uploader',
      password: 'Password123!',
    });
    const { user: outsider } = await registerUser({
      email: `up-out-${suffix}@example.com`,
      username: `up_out_${suffix}`,
      displayName: 'Outsider User',
      password: 'Password123!',
    });

    // 1. Reject unsupported MIME type (e.g., application/x-msdownload or image/svg+xml with scripts)
    await expect(
      createMediaUpload(uploader.id, {
        originalFilename: 'xss.svg',
        mimeType: 'image/svg+xml',
        visibility: 'private',
        contentBase64: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64'),
      })
    ).rejects.toThrow(/Unsupported MIME type/i);

    // 2. Reject spoofed magic bytes (declaring image/png but sending HTML/script payload)
    await expect(
      createMediaUpload(uploader.id, {
        originalFilename: 'spoof.png',
        mimeType: 'image/png',
        visibility: 'private',
        contentBase64: Buffer.from('<html><script>alert(1)</script></html>').toString(
          'base64'
        ),
      })
    ).rejects.toThrow(/Executable or active HTML|signature does not match/i);

    // 3. Valid 1x1 PNG binary header succeeds
    const validPngBytes = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
      'hex'
    );
    const uploaded = await createMediaUpload(uploader.id, {
      originalFilename: '../../My Avatar Photo!!.png',
      mimeType: 'image/png',
      visibility: 'private',
      contentBase64: validPngBytes.toString('base64'),
    });

    expect(uploaded.safe_filename).toMatch(/^my-avatar-photo-[a-f0-9]{8}\.png$/);
    expect(uploaded.object_path).toContain(uploader.id);
    expect(uploaded.signed_download_url).toContain('/api/uploads/');

    // 4. Outsider cannot download private upload without valid signature
    await expect(
      getMediaUploadForDownload(outsider.id, uploaded.id)
    ).rejects.toThrow(/not found or access denied|private/i);

    // 5. Uploader can download their own file and bytes match
    const downloaded = await getMediaUploadForDownload(uploader.id, uploaded.id);
    expect(downloaded.buffer.equals(validPngBytes)).toBe(true);

    // 6. Deleting the upload removes content and blocks subsequent downloads
    const delRes = await deleteOrCleanupMediaUpload(uploader.id, uploaded.id);
    expect(delRes.deleted).toBe(true);

    await expect(
      getMediaUploadForDownload(uploader.id, uploaded.id)
    ).rejects.toThrow(/not found/i);
  });
});
