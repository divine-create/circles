import { NextRequest, NextResponse } from 'next/server';
import { AppError, ForbiddenError } from '@/lib/errors';
import {
  getAuthenticatedUser,
  verifyAndResolveSessionUser,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { UserProfile } from '@/types/domain';
import { logger } from '@/lib/logging';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function checkRateLimit(
  key: string,
  maxRequests = 40,
  windowMs = 60_000,
  enforceInTest = false
): boolean {
  if (
    process.env.NODE_ENV === 'test' &&
    !enforceInTest &&
    process.env.ENFORCE_RATE_LIMIT_IN_TESTS !== 'true'
  ) {
    return true;
  }
  const now = Date.now();
  const bucket = rateLimitStore.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxRequests;
}

/**
 * Distributed rate limiter backed by PostgreSQL (`public.rate_limit_buckets`)
 * for multi-instance staging/production deployments, with graceful local fallback.
 */
export async function checkDistributedRateLimit(
  key: string,
  maxRequests = 40,
  windowMs = 60_000,
  enforceInTest = false
): Promise<boolean> {
  if (
    process.env.NODE_ENV === 'test' &&
    !enforceInTest &&
    process.env.ENFORCE_RATE_LIMIT_IN_TESTS !== 'true'
  ) {
    return true;
  }

  try {
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const hits = await withServiceRoleTransaction(async (tx) => {
      const res = await tx.query<{ hits: number }>(
        `INSERT INTO public.rate_limit_buckets (bucket_key, hits, reset_at, updated_at)
         VALUES ($1, 1, NOW() + ($2::text || ' seconds')::interval, NOW())
         ON CONFLICT (bucket_key) DO UPDATE
           SET hits = CASE
             WHEN public.rate_limit_buckets.reset_at < NOW() THEN 1
             ELSE public.rate_limit_buckets.hits + 1
           END,
           reset_at = CASE
             WHEN public.rate_limit_buckets.reset_at < NOW()
               THEN NOW() + ($2::text || ' seconds')::interval
             ELSE public.rate_limit_buckets.reset_at
           END,
           updated_at = NOW()
         RETURNING hits;`,
        [key, String(windowSeconds)]
      );
      return Number(res.rows[0]?.hits ?? 1);
    });
    return hits <= maxRequests;
  } catch {
    return checkRateLimit(key, maxRequests, windowMs, enforceInTest);
  }
}

export async function resetRateLimitsForTest(): Promise<void> {
  rateLimitStore.clear();
  try {
    await withServiceRoleTransaction(async (tx) => {
      await tx.query(`DELETE FROM public.rate_limit_buckets;`);
    });
  } catch {
    // Ignore if database not initialized yet
  }
}

/**
 * Validates Origin, Referer, and Sec-Fetch-Site headers on state-changing requests
 * to prevent Cross-Site Request Forgery (CSRF) without breaking legitimate local or
 * configured staging/production requests.
 */
export function assertCsrfProtection(req: NextRequest): void {
  const method = (req.method || 'GET').toUpperCase();
  if (!STATE_CHANGING_METHODS.has(method)) {
    return;
  }

  const secFetchSite = req.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite === 'cross-site') {
    throw new ForbiddenError(
      'Cross-site state-changing request blocked by CSRF protection (Sec-Fetch-Site: cross-site).'
    );
  }

  const originHeader = req.headers.get('origin');
  const refererHeader = req.headers.get('referer');
  const sourceUrl = originHeader || refererHeader;

  if (!sourceUrl) {
    // Same-origin non-browser or server-to-server request without Origin/Referer
    return;
  }

  let sourceHost: string;
  try {
    sourceHost = new URL(sourceUrl).host.toLowerCase();
  } catch {
    throw new ForbiddenError('Invalid Origin or Referer header on state-changing request.');
  }

  const allowedHosts = new Set<string>();
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
  const hostHeader = req.headers.get('host')?.trim().toLowerCase();
  const nextUrlHost = req.nextUrl?.host?.toLowerCase();

  if (forwardedHost) allowedHosts.add(forwardedHost);
  if (hostHeader) allowedHosts.add(hostHeader);
  if (nextUrlHost) allowedHosts.add(nextUrlHost);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowedHosts.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host.toLowerCase());
    } catch {
      // Ignore malformed NEXT_PUBLIC_APP_URL
    }
  }

  if (allowedHosts.size > 0 && !allowedHosts.has(sourceHost)) {
    throw new ForbiddenError(
      `CSRF protection blocked request from untrusted origin "${sourceHost}".`
    );
  }
}

export function extractRequestSessionToken(req: NextRequest): string | null {
  const bearer = req.headers.get('authorization');
  if (bearer && bearer.startsWith('Bearer ')) {
    return bearer.slice(7).trim();
  }
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    return cookieToken;
  }
  return null;
}

export async function resolveApiUser(req: NextRequest): Promise<UserProfile | null> {
  assertCsrfProtection(req);

  const token = extractRequestSessionToken(req);
  if (token) {
    return verifyAndResolveSessionUser(token);
  }
  return getAuthenticatedUser();
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ZodError' &&
    'issues' in error &&
    Array.isArray((error as { issues?: Array<{ message?: string }> }).issues)
  ) {
    const firstMsg =
      (error as { issues: Array<{ message?: string }> }).issues[0]?.message ??
      'Invalid request payload.';
    return NextResponse.json({ error: firstMsg, code: 'VALIDATION_ERROR' }, { status: 400 });
  }

  logger.error('Unhandled API route error', {
    error: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    { error: 'An unexpected server error occurred.', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
