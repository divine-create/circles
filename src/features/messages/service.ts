import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  ConversationItem,
  ConversationParticipantItem,
  ConversationType,
  DirectMessageItem,
} from '@/types/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { createNotification } from '@/features/notifications/service';

export const startConversationSchema = z.object({
  targetUserId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
  initialMessage: z.string().trim().min(1).max(4000).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachments: z
    .array(
      z.object({
        type: z.enum(['image', 'file']),
        url: z.string().url(),
        name: z.string().optional(),
        size: z.number().optional(),
      })
    )
    .max(5)
    .default([]),
});

/**
 * Gets or creates a 1-on-1 direct or listing conversation between two members.
 */
export async function getOrCreateDirectConversation(
  actorUserId: string,
  circleId: string,
  targetUserId: string,
  listingId?: string
): Promise<ConversationItem> {
  if (actorUserId === targetUserId) {
    throw new ValidationError('You cannot start a direct conversation with yourself.');
  }

  return withRlsTransaction(actorUserId, async (tx) => {
    // 1. Assert both users are active members in this circle
    const membersRes = await tx.query<{ user_id: string }>(
      `SELECT user_id FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id IN ($2, $3) AND status = 'active';`,
      [circleId, actorUserId, targetUserId]
    );

    if (membersRes.rows.length < 2) {
      throw new ForbiddenError('Direct messaging requires both users to be active members of this Circle.');
    }

    // 2. Check for an existing conversation
    let existingConvoQuery = `
      SELECT c.id, c.circle_id, c.conversation_type, c.title, c.listing_id, c.last_message_at, c.created_at
      FROM public.conversations c
      JOIN public.conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = $2
      JOIN public.conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = $3
      WHERE c.circle_id = $1
    `;
    const params: unknown[] = [circleId, actorUserId, targetUserId];

    if (listingId) {
      existingConvoQuery += ` AND c.listing_id = $4 LIMIT 1;`;
      params.push(listingId);
    } else {
      existingConvoQuery += ` AND c.conversation_type = 'direct' AND c.listing_id IS NULL LIMIT 1;`;
    }

    const existingRes = await tx.query<ConversationItem>(existingConvoQuery, params);

    let convoId: string;
    if (existingRes.rows.length > 0) {
      convoId = existingRes.rows[0].id;
    } else {
      // Create new conversation
      convoId = crypto.randomUUID();
      const convoType: ConversationType = listingId ? 'listing' : 'direct';

      await tx.query(
        `INSERT INTO public.conversations (id, circle_id, conversation_type, listing_id, last_message_at)
         VALUES ($1, $2, $3, $4, NOW());`,
        [convoId, circleId, convoType, listingId ?? null]
      );

      // Add participants
      await tx.query(
        `INSERT INTO public.conversation_participants (conversation_id, circle_id, user_id, last_read_at)
         VALUES ($1, $2, $3, NOW()), ($1, $2, $4, NOW());`,
        [convoId, circleId, actorUserId, targetUserId]
      );
    }

    return fetchFullConversation(tx, convoId, actorUserId);
  });
}

/**
 * Lists all conversations for a member within a circle with unread count and latest message snippet.
 */
export async function listUserConversations(
  actorUserId: string,
  circleId: string
): Promise<ConversationItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const convosRes = await tx.query<{
      id: string;
      circle_id: string;
      conversation_type: ConversationType;
      title: string | null;
      listing_id: string | null;
      last_message_at: string;
      created_at: string;
      unread_count: string;
    }>(
      `SELECT c.*,
         (
           SELECT COUNT(*)::text
           FROM public.direct_messages dm
           JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $2
           WHERE dm.conversation_id = c.id
             AND dm.created_at > cp.last_read_at
             AND dm.sender_id <> $2
         ) AS unread_count
       FROM public.conversations c
       JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $2
       WHERE c.circle_id = $1
       ORDER BY c.last_message_at DESC;`,
      [circleId, actorUserId]
    );

    const results: ConversationItem[] = [];
    for (const row of convosRes.rows) {
      const full = await fetchFullConversation(tx, row.id, actorUserId);
      results.push({
        ...full,
        unread_count: Number(row.unread_count || 0),
      });
    }

    return results;
  });
}

/**
 * Fetches messages in a conversation and updates the viewer's last_read_at timestamp.
 */
export async function listConversationMessages(
  actorUserId: string,
  circleId: string,
  conversationId: string,
  limit = 50
): Promise<DirectMessageItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    // Assert participant or staff
    const partRes = await tx.query(
      `SELECT 1 FROM public.conversation_participants
       WHERE conversation_id = $1 AND user_id = $2;`,
      [conversationId, actorUserId]
    );

    if (partRes.rows.length === 0) {
      throw new ForbiddenError('You do not have access to this conversation.');
    }

    // Fetch messages
    const msgsRes = await tx.query<
      DirectMessageItem & {
        sender_username: string;
        sender_display_name: string;
        sender_avatar_url: string | null;
      }
    >(
      `SELECT m.*,
         COALESCE(p.username, 'member') AS sender_username,
         COALESCE(p.display_name, 'Member') AS sender_display_name,
         p.avatar_url AS sender_avatar_url
       FROM public.direct_messages m
       LEFT JOIN public.profiles p ON p.id = m.sender_id
       WHERE m.conversation_id = $1 AND m.circle_id = $2
       ORDER BY m.created_at ASC
       LIMIT $3;`,
      [conversationId, circleId, limit]
    );

    // Update last_read_at
    await tx.query(
      `UPDATE public.conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2;`,
      [conversationId, actorUserId]
    );

    return msgsRes.rows.map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      circle_id: row.circle_id,
      sender_id: row.sender_id,
      body: row.body,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      is_deleted: row.is_deleted,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sender: {
        id: row.sender_id,
        username: row.sender_username,
        display_name: row.sender_display_name,
        avatar_url: row.sender_avatar_url,
      },
    }));
  });
}

/**
 * Sends a message in a conversation, bumps last_message_at, and dispatches in-app notifications.
 */
export async function sendDirectMessage(
  actorUserId: string,
  circleId: string,
  conversationId: string,
  input: z.input<typeof sendMessageSchema>
): Promise<DirectMessageItem> {
  const parsed = sendMessageSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    // Assert sender is an active participant
    const partRes = await tx.query<{ user_id: string }>(
      `SELECT user_id FROM public.conversation_participants
       WHERE conversation_id = $1;`,
      [conversationId]
    );

    const isMember = partRes.rows.some((r) => r.user_id === actorUserId);
    if (!isMember) {
      throw new ForbiddenError('You are not a participant in this conversation.');
    }

    const messageId = crypto.randomUUID();
    const insertRes = await tx.query<DirectMessageItem>(
      `INSERT INTO public.direct_messages (id, conversation_id, circle_id, sender_id, body, attachments)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *;`,
      [
        messageId,
        conversationId,
        circleId,
        actorUserId,
        parsed.body,
        JSON.stringify(parsed.attachments),
      ]
    );

    // Bump conversation timestamp
    await tx.query(
      `UPDATE public.conversations
       SET last_message_at = NOW()
       WHERE id = $1;`,
      [conversationId]
    );

    // Sender automatically marks as read
    await tx.query(
      `UPDATE public.conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2;`,
      [conversationId, actorUserId]
    );

    // Get circle slug for notification links
    const circleRes = await tx.query<{ slug: string }>(
      `SELECT slug FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );

    const senderProfileRes = await tx.query<{ display_name: string; username: string }>(
      `SELECT display_name, username FROM public.profiles WHERE id = $1 LIMIT 1;`,
      [actorUserId]
    );

    const recipientIds = partRes.rows
      .map((r) => r.user_id)
      .filter((id) => id !== actorUserId);

    return {
      message: insertRes.rows[0],
      senderName: senderProfileRes.rows[0]?.display_name || senderProfileRes.rows[0]?.username || 'A member',
      circleSlug: circleRes.rows[0]?.slug || 'community',
      recipientIds,
    };
  });

  // Dispatch notifications to recipients
  for (const recipientId of outcome.recipientIds) {
    await createNotification({
      recipientId,
      actorId: actorUserId,
      circleId,
      eventType: 'direct_message',
      title: `Message from ${outcome.senderName}`,
      body: parsed.body.slice(0, 120),
      linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
    }).catch(() => {});
  }

  return outcome.message;
}

/**
 * Helper to hydrate a full conversation item with participants and listing metadata
 */
async function fetchFullConversation(
  tx: { query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  conversationId: string,
  _actorUserId: string
): Promise<ConversationItem> {
  const cRes = await tx.query<ConversationItem>(
    `SELECT * FROM public.conversations WHERE id = $1 LIMIT 1;`,
    [conversationId]
  );
  const convo = cRes.rows[0];
  if (!convo) {
    throw new NotFoundError('Conversation not found.');
  }

  // Fetch participants
  const partsRes = await tx.query<
    ConversationParticipantItem & {
      username: string;
      display_name: string;
      avatar_url: string | null;
    }
  >(
    `SELECT cp.*,
       COALESCE(p.username, 'member') AS username,
       COALESCE(p.display_name, 'Member') AS display_name,
       p.avatar_url
     FROM public.conversation_participants cp
     LEFT JOIN public.profiles p ON p.id = cp.user_id
     WHERE cp.conversation_id = $1;`,
    [conversationId]
  );

  convo.participants = partsRes.rows.map((r) => ({
    conversation_id: r.conversation_id,
    circle_id: r.circle_id,
    user_id: r.user_id,
    last_read_at: r.last_read_at,
    is_muted: r.is_muted,
    joined_at: r.joined_at,
    user: {
      id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
    },
  }));

  // Fetch latest message
  const msgRes = await tx.query<DirectMessageItem>(
    `SELECT * FROM public.direct_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC LIMIT 1;`,
    [conversationId]
  );
  convo.latest_message = msgRes.rows[0] ?? null;

  // If bound to a listing, fetch listing details
  if (convo.listing_id) {
    const listRes = await tx.query<{
      id: string;
      title: string;
      price_amount: number | null;
      price_currency: string;
      listing_type: string;
      image_urls?: string[];
    }>(
      `SELECT id, title, price_amount, price_currency, listing_type, image_urls
       FROM public.marketplace_listings WHERE id = $1 LIMIT 1;`,
      [convo.listing_id]
    );
    if (listRes.rows[0]) {
      convo.listing = {
        ...listRes.rows[0],
        images: Array.isArray(listRes.rows[0].image_urls) ? listRes.rows[0].image_urls : [],
      };
    }
  }

  return convo;
}
