import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createSupabaseServerClient, isSupabaseCloudConfigured } from '@/lib/db/supabase';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { UserProfile } from '@/types/domain';
import { UnauthorizedError } from '@/lib/errors';
import { getVerifiedSessionSecret } from '@/lib/config/env';

export const SESSION_COOKIE_NAME = 'circles_session_token';

export interface SignedSessionPayload {
  jti: string;
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createSignedSessionToken(
  userId: string,
  email: string,
  ttlSeconds = 60 * 60 * 24 * 7,
  jti = crypto.randomUUID()
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SignedSessionPayload = {
    jti,
    sub: userId,
    email,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getVerifiedSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySignedSessionToken(token: string): SignedSessionPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, providedSig] = parts;
    if (!encoded || !providedSig) return null;

    const expectedSig = crypto
      .createHmac('sha256', getVerifiedSessionSecret())
      .update(encoded)
      .digest('base64url');

    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedSessionPayload;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.sub || !payload.jti || !payload.exp || payload.exp < nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function issuePersistedSession(
  userId: string,
  email: string,
  ttlSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  const jti = crypto.randomUUID();
  const token = createSignedSessionToken(userId, email, ttlSeconds, jti);
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await withServiceRoleTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO auth.sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4);`,
      [jti, userId, tokenHash, expiresAt]
    );
  });

  try {
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ttlSeconds,
    });
  } catch {
    // Ignored outside Next.js request context (e.g. unit/integration tests)
  }

  return token;
}

export async function revokeSessionToken(rawToken?: string | null): Promise<void> {
  let tokenToRevoke = rawToken ?? null;
  if (!tokenToRevoke) {
    try {
      const cookieStore = cookies();
      tokenToRevoke = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
    } catch {
      tokenToRevoke = null;
    }
  }

  if (tokenToRevoke) {
    const tokenHash = hashSessionToken(tokenToRevoke);
    await withServiceRoleTransaction(async (tx) => {
      await tx.query(
        `UPDATE auth.sessions
         SET revoked_at = NOW()
         WHERE token_hash = $1 AND revoked_at IS NULL;`,
        [tokenHash]
      );
    });
  }

  clearSessionCookie();
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await withServiceRoleTransaction(async (tx) => {
    await tx.query(
      `UPDATE auth.sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL;`,
      [userId]
    );
  });
}

export function clearSessionCookie(): void {
  try {
    const cookieStore = cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Ignored outside Next.js request context
  }
}

export async function verifyAndResolveSessionUser(rawToken: string): Promise<UserProfile | null> {
  const verified = verifySignedSessionToken(rawToken);
  if (!verified) return null;

  const tokenHash = hashSessionToken(rawToken);

  return withServiceRoleTransaction(async (tx) => {
    const sessionRes = await tx.query<{ id: string }>(
      `SELECT id FROM auth.sessions
       WHERE id = $1
         AND user_id = $2
         AND token_hash = $3
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1;`,
      [verified.jti, verified.sub, tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      return null;
    }

    return getProfileByIdWithTx(tx, verified.sub);
  });
}

export async function getAuthenticatedUser(): Promise<UserProfile | null> {
  try {
    if (isSupabaseCloudConfigured()) {
      const supabase = createSupabaseServerClient();
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          return withServiceRoleTransaction((tx) => getProfileByIdWithTx(tx, data.user.id));
        }
      }
    }

    const cookieStore = cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawToken) return null;

    return verifyAndResolveSessionUser(rawToken);
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

async function getProfileByIdWithTx(
  tx: { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> },
  userId: string
): Promise<UserProfile | null> {
  const res = await tx.query<UserProfile & { platform_role: string | null }>(
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
}
