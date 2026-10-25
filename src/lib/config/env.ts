import { AppError } from '@/lib/errors';

const DEFAULT_DEV_SECRET = 'dev-only-replace-in-production-with-32-byte-secret-key';

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.name = 'ConfigurationError';
  }
}

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getVerifiedSessionSecret(): string {
  const secret = process.env.CIRCLES_SESSION_SECRET;

  if (isProductionEnv() && process.env.NEXT_PHASE !== 'phase-production-build') {
    if (!secret || secret === DEFAULT_DEV_SECRET || secret.trim().length < 32) {
      throw new ConfigurationError(
        'Production security error: CIRCLES_SESSION_SECRET must be explicitly configured with a high-entropy secret of at least 32 characters.'
      );
    }
  }

  return secret && secret.trim().length > 0 ? secret : DEFAULT_DEV_SECRET;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
  );
}

/**
 * Ensures production deployments do not silently route traffic to an unconfigured
 * embedded development database unless explicitly opted in.
 */
export function assertProductionDatabaseConfigured(): void {
  if (
    isProductionEnv() &&
    process.env.NEXT_PHASE !== 'phase-production-build' &&
    !isSupabaseConfigured() &&
    process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION !== 'true'
  ) {
    throw new ConfigurationError(
      'Production database error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required in production. Refusing to silently fall back to embedded development storage.'
    );
  }
}
