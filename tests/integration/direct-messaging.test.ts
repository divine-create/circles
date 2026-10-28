import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { runDatabaseMigrations } from '@/lib/db/postgres';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import { joinPublicCircle } from '@/features/memberships/service';
import { createMarketplaceListing } from '@/features/marketplace/service';
import {
  getOrCreateDirectConversation,
  listUserConversations,
  listConversationMessages,
  sendDirectMessage,
} from '@/features/messages/service';
import { ForbiddenError, ValidationError } from '@/lib/errors';

describe('Direct & Group Messaging and Marketplace Bridge Integration Suite', () => {
  beforeAll(async () => {
    await runDatabaseMigrations();
  });

  it('enforces 1-on-1 direct conversation creation, anti-self messaging, and message sending', async () => {
    const timestamp = Date.now();
    const { user: userA } = await registerUser({
      email: `dm-user-a-${timestamp}@test.local`,
      password: 'Password123!',
      username: `usera_${timestamp}`,
      displayName: 'User A',
    });

    const { user: userB } = await registerUser({
      email: `dm-user-b-${timestamp}@test.local`,
      password: 'Password123!',
      username: `userb_${timestamp}`,
      displayName: 'User B',
    });

    const circle = await createCircle(userA.id, {
      name: `DM Circle ${timestamp}`,
      slug: `dm-circle-${timestamp}`,
      description: 'Circle for DM testing',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await joinPublicCircle(userB.id, circle.id);

    // 1. Prevent self-messaging
    await expect(
      getOrCreateDirectConversation(userA.id, circle.id, userA.id)
    ).rejects.toThrow(ValidationError);

    // 2. Start conversation between userA and userB
    const convo = await getOrCreateDirectConversation(userA.id, circle.id, userB.id);
    expect(convo.id).toBeDefined();
    expect(convo.circle_id).toBe(circle.id);
    expect(convo.conversation_type).toBe('direct');
    expect(convo.participants.length).toBe(2);

    // 3. Getting the conversation again from userB should return the same conversation
    const convoAgain = await getOrCreateDirectConversation(userB.id, circle.id, userA.id);
    expect(convoAgain.id).toBe(convo.id);

    // 4. Send message from User A to User B
    const sentMsg = await sendDirectMessage(userA.id, circle.id, convo.id, {
      body: 'Hello User B, are you free this weekend?',
    });
    expect(sentMsg.id).toBeDefined();
    expect(sentMsg.body).toBe('Hello User B, are you free this weekend?');
    expect(sentMsg.sender_id).toBe(userA.id);

    // 5. User B reads messages and checks inbox
    const userBConvos = await listUserConversations(userB.id, circle.id);
    expect(userBConvos.length).toBe(1);
    expect(userBConvos[0].unread_count).toBe(1);

    const messages = await listConversationMessages(userB.id, circle.id, convo.id);
    expect(messages.length).toBe(1);
    expect(messages[0].body).toBe('Hello User B, are you free this weekend?');

    // 6. After reading, unread count resets to 0
    const userBConvosAfter = await listUserConversations(userB.id, circle.id);
    expect(userBConvosAfter[0].unread_count).toBe(0);

    // 7. Non-member userC cannot read messages
    const { user: userC } = await registerUser({
      email: `dm-user-c-${timestamp}@test.local`,
      password: 'Password123!',
      username: `userc_${timestamp}`,
      displayName: 'User C',
    });

    await expect(
      listConversationMessages(userC.id, circle.id, convo.id)
    ).rejects.toThrow(ForbiddenError);
  });

  it('bridges a direct conversation to a specific marketplace listing inquiry', async () => {
    const timestamp = Date.now();
    const { user: seller } = await registerUser({
      email: `seller-dm-${timestamp}@test.local`,
      password: 'Password123!',
      username: `seller_${timestamp}`,
      displayName: 'Seller Sam',
    });

    const { user: buyer } = await registerUser({
      email: `buyer-dm-${timestamp}@test.local`,
      password: 'Password123!',
      username: `buyer_${timestamp}`,
      displayName: 'Buyer Bob',
    });

    const circle = await createCircle(seller.id, {
      name: `Market DM Circle ${timestamp}`,
      slug: `market-dm-circle-${timestamp}`,
      description: 'Circle for market DM testing',
      visibility: 'public',
      membershipPolicy: 'open',
    });

    await updateCircleCapability(seller.id, circle.id, 'marketplace', true);

    await joinPublicCircle(buyer.id, circle.id);

    const listing = await createMarketplaceListing(seller.id, {
      circleId: circle.id,
      listingType: 'product',
      category: 'Electronics',
      title: 'Vintage Camera',
      description: 'Tested and works',
      priceAmount: 120.00,
      priceCurrency: 'USD',
      status: 'published',
    });

    // Buyer initiates conversation about this listing
    const listingConvo = await getOrCreateDirectConversation(buyer.id, circle.id, seller.id, listing.id);
    expect(listingConvo.id).toBeDefined();
    expect(listingConvo.conversation_type).toBe('listing');
    expect(listingConvo.listing_id).toBe(listing.id);
    expect(listingConvo.listing?.title).toBe('Vintage Camera');

    // Buyer sends inquiry
    await sendDirectMessage(buyer.id, circle.id, listingConvo.id, {
      body: 'Hi Sam! Does this camera come with the original leather case?',
    });

    // Seller replies
    await sendDirectMessage(seller.id, circle.id, listingConvo.id, {
      body: 'Yes Bob, case and strap are included!',
    });

    const thread = await listConversationMessages(buyer.id, circle.id, listingConvo.id);
    expect(thread.length).toBe(2);
    expect(thread[0].body).toContain('original leather case');
    expect(thread[1].body).toContain('case and strap are included');
  });
});

