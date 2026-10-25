import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { getAuthenticatedUser, verifySignedSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { UserProfile } from '@/types/domain';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { logger } from '@/lib/logging';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 40, windowMs = 60_000): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const now = Date.now();
  const bucket = rateLimitStore.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxRequests;
}

export async function resolveApiUser(req: NextRequest): Promise<UserProfile | null> {
  const bearer = req.headers.get('authorization');
  if (bearer && bearer.startsWith('Bearer ')) {
    const token = bearer.slice(7).trim();
    const verified = verifySignedSessionToken(token);
    if (verified) {
      return withServiceRoleTransaction(async (tx) => {
        const res = await tx.query<UserProfile & { platform_role: string | null }>(
          `SELECT p.*, pr.role AS platform_role
           FROM public.profiles p
           LEFT JOIN public.platform_roles pr ON pr.user_id = p.id
           WHERE p.id = $1 LIMIT 1;`,
          [verified.sub]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          ...row,
          is_platform_admin: Boolean(row.platform_role),
        };
      });
    }
  }

  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    const verified = verifySignedSessionToken(cookieToken);
    if (verified) {
      return withServiceRoleTransaction(async (tx) => {
        const res = await tx.query<UserProfile & { platform_role: string | null }>(
          `SELECT p.*, pr.role AS platform_role
           FROM public.profiles p
           LEFT JOIN public.platform_roles pr ON pr.user_id = p.id
           WHERE p.id = $1 LIMIT 1;`,
          [verified.sub]
        );
        const row = res.rows[0];
        if (!row) return null;
        return {
          ...row,
          is_platform_admin: Boolean(row.platform_role),
        };
      });
    }
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
