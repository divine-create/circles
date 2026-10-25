import crypto from 'crypto';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import { NotificationItem } from '@/types/domain';
import { sendTransactionalEmail } from '@/lib/email';

export interface CreateNotificationInput {
  recipientId: string;
  actorId?: string | null;
  circleId?: string | null;
  eventType: NotificationItem['event_type'];
  title: string;
  body: string;
  linkUrl: string;
  idempotencyKey?: string;
  sendEmail?: boolean;
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationItem | null> {
  if (input.actorId && input.actorId === input.recipientId) {
    // Do not self-notify on own comments
    if (input.eventType === 'new_comment') return null;
  }

  return withServiceRoleTransaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.query<NotificationItem>(
        `SELECT * FROM public.notifications WHERE idempotency_key = $1 LIMIT 1;`,
        [input.idempotencyKey]
      );
      if (existing.rows[0]) {
        return existing.rows[0];
      }
    }

    const notifId = crypto.randomUUID();
    const res = await tx.query<NotificationItem>(
      `INSERT INTO public.notifications (
         id, recipient_id, actor_id, circle_id, event_type, title, body, link_url, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        notifId,
        input.recipientId,
        input.actorId ?? null,
        input.circleId ?? null,
        input.eventType,
        input.title,
        input.body,
        input.linkUrl,
        input.idempotencyKey ?? null,
      ]
    );

    const notification = res.rows[0];

    await tx.query(
      `INSERT INTO public.notification_deliveries (id, notification_id, channel, status)
       VALUES ($1, $2, 'in_app', 'delivered')
       ON CONFLICT (notification_id, channel) DO NOTHING;`,
      [crypto.randomUUID(), notifId]
    );

    if (input.sendEmail) {
      const profileRes = await tx.query<{ email: string }>(
        `SELECT email FROM public.profiles WHERE id = $1 LIMIT 1;`,
        [input.recipientId]
      );
      const recipientEmail = profileRes.rows[0]?.email;
      if (recipientEmail) {
        const emailResult = await sendTransactionalEmail({
          to: recipientEmail,
          subject: input.title,
          text: `${input.body}\n\nOpen in Circles: ${input.linkUrl}`,
          html: `<p>${input.body}</p><p><a href="${input.linkUrl}">Open in Circles</a></p>`,
        });

        await tx.query(
          `INSERT INTO public.notification_deliveries (
             id, notification_id, channel, status, provider_reference, error_message
           ) VALUES ($1, $2, 'email', $3, $4, $5)
           ON CONFLICT (notification_id, channel) DO NOTHING;`,
          [
            crypto.randomUUID(),
            notifId,
            emailResult.status,
            emailResult.providerReference ?? null,
            emailResult.errorMessage ?? null,
          ]
        );
      }
    }

    return notification;
  });
}

export async function listUserNotifications(actorUserId: string): Promise<NotificationItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<NotificationItem>(
      `SELECT * FROM public.notifications
       WHERE recipient_id = $1
       ORDER BY created_at DESC
       LIMIT 50;`,
      [actorUserId]
    );
    return res.rows;
  });
}

export async function markNotificationRead(
  actorUserId: string,
  notificationId: string
): Promise<void> {
  await withRlsTransaction(actorUserId, async (tx) => {
    await tx.query(
      `UPDATE public.notifications
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND recipient_id = $2;`,
      [notificationId, actorUserId]
    );
  });
}

export async function markAllNotificationsRead(actorUserId: string): Promise<void> {
  await withRlsTransaction(actorUserId, async (tx) => {
    await tx.query(
      `UPDATE public.notifications
       SET is_read = true, read_at = NOW()
       WHERE recipient_id = $1 AND is_read = false;`,
      [actorUserId]
    );
  });
}
