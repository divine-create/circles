import { logger } from '@/lib/logging';

export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailDeliveryResult {
  status: 'delivered' | 'skipped_unconfigured' | 'failed';
  providerReference?: string;
  errorMessage?: string;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
}

export async function sendTransactionalEmail(
  payload: TransactionalEmailPayload
): Promise<EmailDeliveryResult> {
  if (!isResendConfigured()) {
    logger.info('Resend API key not configured; skipping external email delivery.', {
      to: payload.to,
      subject: payload.subject,
    });
    return {
      status: 'skipped_unconfigured',
      errorMessage: 'RESEND_API_KEY is not configured in environment variables.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Circles <notifications@circles.example.com>',
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        status: 'failed',
        errorMessage: `Resend HTTP ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return {
      status: 'delivered',
      providerReference: data.id,
    };
  } catch (err) {
    return {
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Unknown email transport error',
    };
  }
}
