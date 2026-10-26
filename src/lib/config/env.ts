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

export function hasSufficientSecretEntropy(secret: string): boolean {
  const trimmed = secret.trim();
  if (trimmed.length < 32) return false;
  const uniqueChars = new Set(trimmed.split('')).size;
  return uniqueChars >= 10;
}

export function getVerifiedSessionSecret(): string {
  const secret = process.env.CIRCLES_SESSION_SECRET;

  if (isProductionEnv() && process.env.NEXT_PHASE !== 'phase-production-build') {
    if (
      !secret ||
      secret === DEFAULT_DEV_SECRET ||
      !hasSufficientSecretEntropy(secret)
    ) {
      throw new ConfigurationError(
        'Production security error: CIRCLES_SESSION_SECRET must be explicitly configured with a high-entropy secret of at least 32 characters (minimum 10 distinct characters).'
      );
    }
  }

  return secret && secret.trim().length > 0 ? secret : DEFAULT_DEV_SECRET;
}

export type DatabaseBackendMode = 'remote_pg' | 'embedded_pglite';

export function getRemoteDatabaseUrl(): string | null {
  const raw = (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '').trim();
  if (!raw) {
    return null;
  }

  if (!raw.startsWith('postgres://') && !raw.startsWith('postgresql://')) {
    throw new ConfigurationError(
      'Database configuration error: DATABASE_URL / SUPABASE_DB_URL must be a valid PostgreSQL connection string starting with postgres:// or postgresql://.'
    );
  }

  return raw;
}

export function isSupabaseConfigured(): boolean {
  const remoteUrl = getRemoteDatabaseUrl();
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      publicKey &&
      remoteUrl &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
  );
}

export function isEmbeddedPostgresAllowedInProduction(): boolean {
  return process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION === 'true';
}

/**
 * Ensures production deployments do not silently route traffic to an unconfigured
 * or partial embedded development database unless explicitly opted in.
 */
export function assertProductionDatabaseConfigured(): void {
  // Always validate connection string format if DATABASE_URL / SUPABASE_DB_URL is set
  getRemoteDatabaseUrl();

  if (isProductionEnv() && process.env.NEXT_PHASE !== 'phase-production-build') {
    if (isEmbeddedPostgresAllowedInProduction()) {
      return;
    }

    if (!isSupabaseConfigured()) {
      throw new ConfigurationError(
        'Production database error: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and DATABASE_URL are required in production unless ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true is explicitly set.'
      );
    }
  }
}

/**
 * Determines which PostgreSQL backend executor should handle transactions:
 * - 'remote_pg' when a valid DATABASE_URL or SUPABASE_DB_URL is configured (unless PGLITE_IN_MEMORY='true' in local tests without CIRCLES_FORCE_REMOTE_PG='true')
 * - 'embedded_pglite' for local development/tests or when ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION='true'
 */
export function getDatabaseBackendMode(): DatabaseBackendMode {
  assertProductionDatabaseConfigured();

  if (
    process.env.PGLITE_IN_MEMORY === 'true' &&
    process.env.CIRCLES_FORCE_REMOTE_PG !== 'true' &&
    !isProductionEnv()
  ) {
    return 'embedded_pglite';
  }

  const remoteUrl = getRemoteDatabaseUrl();
  if (remoteUrl) {
    return 'remote_pg';
  }

  return 'embedded_pglite';
}
