import crypto from 'crypto';
import { logger } from '@/lib/logging';

export interface CheckoutSessionInput {
  circleId: string;
  invoiceId: string;
  planId?: string | null;
  userId: string;
  amountCents: number;
  currency: string;
  title: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  provider: 'stripe' | 'mock';
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventType: string;
  invoiceId?: string;
  circleId?: string;
  paymentReference?: string;
  amountCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProcessorAdapter {
  readonly name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): Promise<WebhookVerificationResult>;
}

export class MockPaymentProcessorAdapter implements PaymentProcessorAdapter {
  readonly name = 'mock';

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const sessionId = `mock_sess_${crypto.randomBytes(12).toString('hex')}`;
    logger.info('Created mock checkout session', {
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      sessionId,
    });

    return {
      sessionId,
      checkoutUrl: `/circles/${input.circleId}/finances?mock_session=${sessionId}&invoice=${input.invoiceId}`,
      provider: 'mock',
    };
  }

  async verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string
  ): Promise<WebhookVerificationResult> {
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const isValid = signature === computedHmac || signature.startsWith('mock_sig_');

    try {
      const parsed = JSON.parse(rawBody);
      return {
        isValid,
        eventType: parsed.type || parsed.event || 'invoice.payment_succeeded',
        invoiceId: parsed.data?.object?.metadata?.invoiceId || parsed.invoiceId,
        circleId: parsed.data?.object?.metadata?.circleId || parsed.circleId,
        paymentReference: parsed.data?.object?.id || `MOCK_TX_${Date.now()}`,
        amountCents: parsed.data?.object?.amount_total || parsed.amountCents,
        currency: parsed.data?.object?.currency || parsed.currency || 'USD',
        metadata: parsed.data?.object?.metadata || parsed.metadata || {},
      };
    } catch {
      return {
        isValid: false,
        eventType: 'unknown',
      };
    }
  }
}

export class StripePaymentProcessorAdapter implements PaymentProcessorAdapter {
  readonly name = 'stripe';
  private readonly secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    // If external Stripe SDK is not installed, use direct fetch to Stripe API v1
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', input.successUrl);
    params.append('cancel_url', input.cancelUrl);
    params.append('client_reference_id', input.invoiceId);
    params.append('metadata[circleId]', input.circleId);
    params.append('metadata[invoiceId]', input.invoiceId);
    if (input.planId) params.append('metadata[planId]', input.planId);
    if (input.customerEmail) params.append('customer_email', input.customerEmail);

    params.append('line_items[0][price_data][currency]', input.currency.toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(input.amountCents));
    params.append('line_items[0][price_data][product_data][name]', input.title);
    params.append('line_items[0][quantity]', '1');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error('Stripe Checkout creation failed', { error: err });
      throw new Error(`Stripe API error: ${err.slice(0, 200)}`);
    }

    const session = (await res.json()) as { id: string; url: string };
    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      provider: 'stripe',
    };
  }

  async verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string
  ): Promise<WebhookVerificationResult> {
    // Verify Stripe signature header (t=timestamp,v1=signature)
    let timestamp = '';
    let signature = '';

    for (const item of signatureHeader.split(',')) {
      const [key, value] = item.split('=');
      if (key?.trim() === 't') timestamp = value?.trim() || '';
      if (key?.trim() === 'v1') signature = value?.trim() || '';
    }

    if (!timestamp || !signature) {
      return { isValid: false, eventType: 'unknown' };
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );

    if (!isValid) {
      return { isValid: false, eventType: 'invalid_signature' };
    }

    try {
      const parsed = JSON.parse(rawBody);
      const sessionObj = parsed.data?.object || {};
      return {
        isValid: true,
        eventType: parsed.type || 'checkout.session.completed',
        invoiceId: sessionObj.metadata?.invoiceId || sessionObj.client_reference_id,
        circleId: sessionObj.metadata?.circleId,
        paymentReference: sessionObj.payment_intent || sessionObj.id,
        amountCents: sessionObj.amount_total,
        currency: sessionObj.currency ? sessionObj.currency.toUpperCase() : 'USD',
        metadata: sessionObj.metadata || {},
      };
    } catch {
      return { isValid: false, eventType: 'malformed_payload' };
    }
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length > 0);
}

export function getPaymentProcessor(): PaymentProcessorAdapter {
  if (isStripeConfigured() && process.env.STRIPE_SECRET_KEY) {
    return new StripePaymentProcessorAdapter(process.env.STRIPE_SECRET_KEY);
  }
  return new MockPaymentProcessorAdapter();
}
