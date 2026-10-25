import crypto from 'crypto';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import { signInSchema, signUpSchema, updateProfileSchema } from '@/lib/validation';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { UserProfile } from '@/types/domain';
import { clearSessionCookie, setSessionCookie } from '@/lib/auth/session';
import { sendTransactionalEmail } from '@/lib/email';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export async function registerUser(input: unknown): Promise<{ user: UserProfile; sessionToken: string }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid registration data.');
  }

  const { email, password, displayName, username } = parsed.data;
  const userId = crypto.randomUUID();
  const encryptedPassword = hashPassword(password);

  const user = await withServiceRoleTransaction(async (tx) => {
    const existingEmail = await tx.query<{ id: string }>(
      `SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1;`,
      [email]
    );
    if (existingEmail.rows.length > 0) {
      throw new ConflictError('An account with this email address already exists.');
    }

    const existingUsername = await tx.query<{ id: string }>(
      `SELECT id FROM public.profiles WHERE lower(username) = lower($1) LIMIT 1;`,
      [username]
    );
    if (existingUsername.rows.length > 0) {
      throw new ConflictError('This username is already taken.');
    }

    await tx.query(
      `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
       VALUES ($1, $2, $3, $4::jsonb);`,
      [userId, email, encryptedPassword, JSON.stringify({ display_name: displayName, username })]
    );

    const profileRes = await tx.query<UserProfile>(
      `INSERT INTO public.profiles (id, email, username, display_name, bio, profile_visibility)
       VALUES ($1, $2, $3, $4, '', 'public')
       RETURNING *;`,
      [userId, email, username, displayName]
    );

    return profileRes.rows[0];
  });

  const sessionToken = setSessionCookie(user.id, user.email);
  return { user, sessionToken };
}

export async function authenticateUser(input: unknown): Promise<{ user: UserProfile; sessionToken: string }> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid sign-in credentials.');
  }

  const { email, password } = parsed.data;

  const user = await withServiceRoleTransaction(async (tx) => {
    const authRes = await tx.query<{ id: string; email: string; encrypted_password: string }>(
      `SELECT id, email, encrypted_password FROM auth.users WHERE lower(email) = lower($1) LIMIT 1;`,
      [email]
    );
    const authRow = authRes.rows[0];
    if (!authRow || !verifyPassword(password, authRow.encrypted_password)) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const profileRes = await tx.query<UserProfile & { platform_role: string | null }>(
      `SELECT p.*, pr.role AS platform_role
       FROM public.profiles p
       LEFT JOIN public.platform_roles pr ON pr.user_id = p.id
       WHERE p.id = $1
       LIMIT 1;`,
      [authRow.id]
    );

    const profile = profileRes.rows[0];
    if (!profile) {
      throw new NotFoundError('User profile not found.');
    }

    return {
      ...profile,
      is_platform_admin: Boolean(profile.platform_role),
    };
  });

  const sessionToken = setSessionCookie(user.id, user.email);
  return { user, sessionToken };
}

export async function signOutUser(): Promise<void> {
  clearSessionCookie();
}

export async function requestPasswordRecovery(email: string): Promise<{ recoveryTokenIssued: boolean; previewToken?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new ValidationError('Please provide your account email address.');
  }

  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const found = await withServiceRoleTransaction(async (tx) => {
    const res = await tx.query<{ id: string }>(
      `UPDATE auth.users
       SET recovery_token = $1, recovery_sent_at = NOW(), updated_at = NOW()
       WHERE lower(email) = $2
       RETURNING id;`,
      [tokenHash, cleanEmail]
    );
    return res.rows.length > 0;
  });

  if (found) {
    await sendTransactionalEmail({
      to: cleanEmail,
      subject: 'Reset your Circles password',
      text: `Use this recovery token to reset your Circles password: ${rawToken}`,
      html: `<p>Use this recovery token to reset your Circles password: <strong>${rawToken}</strong></p>`,
    });
  }

  return {
    recoveryTokenIssued: true,
    previewToken: process.env.NODE_ENV !== 'production' && found ? rawToken : undefined,
  };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  if (!token || newPassword.length < 8) {
    throw new ValidationError('A valid recovery token and a password of at least 8 characters are required.');
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const newEncryptedPassword = hashPassword(newPassword);

  await withServiceRoleTransaction(async (tx) => {
    const res = await tx.query<{ id: string }>(
      `UPDATE auth.users
       SET encrypted_password = $1, recovery_token = NULL, recovery_sent_at = NULL, updated_at = NOW()
       WHERE recovery_token = $2
       RETURNING id;`,
      [newEncryptedPassword, tokenHash]
    );

    if (res.rows.length === 0) {
      throw new ValidationError('Invalid or expired password recovery token.');
    }
  });
}

export async function updateUserProfile(
  actorUserId: string,
  targetUserId: string,
  input: unknown
): Promise<UserProfile> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid profile data.');
  }

  const { displayName, username, bio, location, avatarUrl, profileVisibility } = parsed.data;

  // Execute via RLS transaction as `actorUserId`. If `actorUserId !== targetUserId`, PostgreSQL RLS blocks the update!
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<UserProfile>(
      `UPDATE public.profiles
       SET display_name = $1,
           username = $2,
           bio = $3,
           location = $4,
           avatar_url = $5,
           profile_visibility = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *;`,
      [
        displayName,
        username,
        bio,
        location || null,
        avatarUrl || null,
        profileVisibility,
        targetUserId,
      ]
    );

    if (res.rows.length === 0) {
      throw new UnauthorizedError('You are not authorized to modify this profile.');
    }

    return res.rows[0];
  });
}

export async function getUserProfile(
  actorUserId: string | null,
  targetUserId: string
): Promise<UserProfile | null> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<UserProfile>(
      `SELECT * FROM public.profiles WHERE id = $1 LIMIT 1;`,
      [targetUserId]
    );
    return res.rows[0] ?? null;
  });
}
