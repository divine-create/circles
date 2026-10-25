import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import {
  getAuthenticatedUser,
  verifyAndResolveSessionUser,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { UserProfile } from '@/types/domain';
import { logger } from '@/lib/logging';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 40,
  windowMs = 60_000,
  enforceInTest = false
): boolean {
  if (process.env.NODE_ENV === 'test' && !enforceInTest) return true;
  const now = Date.now();
  const bucket = rateLimitStore.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxRequests;
}

export function resetRateLimitsForTest(): void {
  rateLimitStore.clear();
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

  logger.error('Unhandled API route error', {
    error: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    { error: 'An unexpected server error occurred.', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
