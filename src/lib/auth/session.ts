import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createSupabaseServerClient, isSupabaseCloudConfigured } from '@/lib/db/supabase';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { UserProfile } from '@/types/domain';
import { UnauthorizedError } from '@/lib/errors';

export const SESSION_COOKIE_NAME = 'circles_session_token';

function getSessionSecret(): string {
  return process.env.CIRCLES_SESSION_SECRET || 'dev-only-replace-in-production-with-32-byte-secret-key';
}

export interface SignedSessionPayload {
  sub: string;
  email: string;
  exp: number;
}

export function createSignedSessionToken(userId: string, email: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const payload: SignedSessionPayload = {
    sub: userId,
    email,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySignedSessionToken(token: string): SignedSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');

    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(userId: string, email: string): string {
  const token = createSignedSessionToken(userId, email);
  try {
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
  } catch {
    // Ignored outside Next.js request context (e.g. unit/integration tests)
  }
  return token;
}

export function clearSessionCookie(): void {
  try {
    const cookieStore = cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignored outside Next.js request context
  }
}

export async function getAuthenticatedUser(): Promise<UserProfile | null> {
  try {
    if (isSupabaseCloudConfigured()) {
      const supabase = createSupabaseServerClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          return getProfileByIdInternal(data.user.id);
        }
      }
    }

    const cookieStore = cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawToken) return null;

    const verified = verifySignedSessionToken(rawToken);
    if (!verified) return null;

    return getProfileByIdInternal(verified.sub);
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(): Promise<UserProfile> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

async function getProfileByIdInternal(userId: string): Promise<UserProfile | null> {
  return withServiceRoleTransaction(async (tx) => {
    const res = await tx.query<
      UserProfile & { platform_role: string | null }
    >(
      `SELECT p.*, pr.role AS platform_role
       FROM public.profiles p
       LEFT JOIN public.platform_roles pr ON pr.user_id = p.id
       WHERE p.id = $1
       LIMIT 1;`,
      [userId]
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      display_name: row.display_name,
      bio: row.bio,
      avatar_url: row.avatar_url,
      location: row.location,
      profile_visibility: row.profile_visibility,
      is_platform_admin: Boolean(row.platform_role),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}
