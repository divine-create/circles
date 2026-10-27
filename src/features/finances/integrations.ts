import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  CircleApiKeyItem,
  CircleWebhookItem,
} from '@/types/domain';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { logger } from '@/lib/logging';

export const createWebhookSchema = z.object({
  url: z.string().trim().url('Must be a valid HTTPS webhook URL.'),
  description: z.string().trim().max(500).default(''),
  events: z
    .array(
      z.enum([
        'invoice.created',
        'invoice.paid',
        'entitlement.granted',
        'entitlement.revoked',
        'treasury.entry_created',
      ])
    )
    .min(1, 'Select at least one event to subscribe to.'),
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(100),
  permissions: z
    .array(
      z.enum([
        'finances.inbound_webhooks',
        'entitlements.grant',
        'invoices.read',
        'invoices.write',
        'treasury.read',
      ])
    )
    .default(['finances.inbound_webhooks', 'entitlements.grant']),
});

// ============================================================================
// Outbound Webhook Subscriptions
// ============================================================================

export async function createCircleWebhook(
  actorUserId: string,
  circleId: string,
  rawInput: z.input<typeof createWebhookSchema>
): Promise<CircleWebhookItem> {
  const input = createWebhookSchema.parse(rawInput);

  return withRlsTransaction(actorUserId, async (tx) => {
    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can configure outbound webhooks.');
    }

    const id = crypto.randomUUID();
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const res = await tx.query<CircleWebhookItem>(
      `INSERT INTO public.circle_webhooks (
         id, circle_id, url, secret, events, is_active, description
       ) VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING *;`,
      [id, circleId, input.url, secret, input.events, input.description]
    );

    return res.rows[0];
  });
}

export async function listCircleWebhooks(
  actorUserId: string,
  circleId: string
): Promise<CircleWebhookItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can view webhooks.');
    }

    const res = await tx.query<CircleWebhookItem>(
      `SELECT * FROM public.circle_webhooks
       WHERE circle_id = $1
       ORDER BY created_at DESC;`,
      [circleId]
    );

    return res.rows;
  });
}

/**
 * Dispatches an event payload to all active webhooks subscribed to eventType.
 * Generates an HMAC-SHA256 signature in X-Circles-Signature.
 */
export async function dispatchFinancialWebhookEvent(
  circleId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Query webhooks via service role to bypass RLS during background dispatch
  const webhooks = await withServiceRoleTransaction(async (tx) => {
    const res = await tx.query<CircleWebhookItem>(
      `SELECT * FROM public.circle_webhooks
       WHERE circle_id = $1 AND is_active = true AND $2 = ANY(events);`,
      [circleId, eventType]
    );
    return res.rows;
  });

  if (webhooks.length === 0) return;

  const serializedPayload = JSON.stringify({
    id: `evt_${crypto.randomBytes(12).toString('hex')}`,
    event: eventType,
    circleId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  for (const hook of webhooks) {
    const signature = crypto
      .createHmac('sha256', hook.secret)
      .update(serializedPayload)
      .digest('hex');

    // Deliver asynchronously without blocking main flow
    (async () => {
      let status: 'delivered' | 'failed' = 'failed';
      let statusCode: number | null = null;
      let responseBody: string | null = null;

      try {
        const response = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Circles-Signature': `sha256=${signature}`,
            'X-Circles-Event': eventType,
          },
          body: serializedPayload,
        });

        statusCode = response.status;
        responseBody = (await response.text()).slice(0, 1000);
        status = response.ok ? 'delivered' : 'failed';
      } catch (err: unknown) {
        responseBody = err instanceof Error ? err.message : 'Network error during delivery';
      }

      // Record delivery log
      try {
        await withServiceRoleTransaction(async (tx) => {
          await tx.query(
            `INSERT INTO public.circle_webhook_deliveries (
               id, webhook_id, circle_id, event_type, payload,
               response_status, response_body, status, delivered_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
            [
              crypto.randomUUID(),
              hook.id,
              circleId,
              eventType,
              serializedPayload,
              statusCode,
              responseBody,
              status,
            ]
          );
        });
      } catch (logErr) {
        logger.error('Failed to log webhook delivery', { error: logErr });
      }
    })();
  }
}

// ============================================================================
// External Inbound API Keys (for ERPs / Property Management)
// ============================================================================

export function hashApiKey(plainToken: string): string {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

export async function createCircleApiKey(
  actorUserId: string,
  circleId: string,
  rawInput: z.input<typeof createApiKeySchema>
): Promise<CircleApiKeyItem> {
  const input = createApiKeySchema.parse(rawInput);

  return withRlsTransaction(actorUserId, async (tx) => {
    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can create API keys.');
    }

    const id = crypto.randomUUID();
    const rawRandom = crypto.randomBytes(24).toString('hex');
    const plainToken = `cir_live_${rawRandom}`;
    const keyPrefix = plainToken.slice(0, 14);
    const keyHash = hashApiKey(plainToken);

    const res = await tx.query<CircleApiKeyItem>(
      `INSERT INTO public.circle_api_keys (
         id, circle_id, name, key_prefix, key_hash, permissions, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, circle_id, name, key_prefix, permissions, last_used_at, is_active, created_at;`,
      [id, circleId, input.name, keyPrefix, keyHash, input.permissions]
    );

    return {
      ...res.rows[0],
      plainToken, // Only returned once upon creation!
    };
  });
}

export async function verifyCircleApiKey(
  plainToken: string,
  requiredPermission?: string
): Promise<{ circleId: string; keyId: string }> {
  const keyHash = hashApiKey(plainToken);

  return withServiceRoleTransaction(async (tx) => {
    const res = await tx.query<{ id: string; circle_id: string; permissions: string[] }>(
      `UPDATE public.circle_api_keys
       SET last_used_at = NOW()
       WHERE key_hash = $1 AND is_active = true
       RETURNING id, circle_id, permissions;`,
      [keyHash]
    );

    const key = res.rows[0];
    if (!key) {
      throw new UnauthorizedError('Invalid or revoked Circle API Key.');
    }

    if (requiredPermission && !key.permissions.includes(requiredPermission)) {
      throw new ForbiddenError(`API Key missing required permission: "${requiredPermission}".`);
    }

    return {
      circleId: key.circle_id,
      keyId: key.id,
    };
  });
}
