-- ============================================================================
-- CIRCLES PLATFORM — SUPABASE HOSTED STAGING COMPATIBILITY & MIGRATION TRACKING
-- Migration: 0004_supabase_staging_compatibility.sql
-- ============================================================================

-- 1. Schema Migrations Tracking Table
-- Tracks applied SQL migrations in order with SHA-256 checksums for deterministic staging/production rollouts.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE public.schema_migrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.schema_migrations TO postgres, service_role;

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schema_migrations_service_only ON public.schema_migrations;
CREATE POLICY schema_migrations_service_only ON public.schema_migrations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Dedicated Application Session Registry (public.user_sessions)
-- Placed in public schema with strict service_role-only RLS so it never collides with
-- Supabase GoTrue's internal auth.sessions table on hosted Supabase PostgreSQL.
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(token_hash);

REVOKE ALL ON TABLE public.user_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_sessions TO postgres, service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sessions_service_only ON public.user_sessions;
CREATE POLICY user_sessions_service_only ON public.user_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Migrate any existing local sessions from auth.sessions if the legacy column structure exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'sessions'
      AND column_name = 'token_hash'
  ) THEN
    INSERT INTO public.user_sessions (id, user_id, token_hash, expires_at, revoked_at, created_at)
    SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
    FROM auth.sessions
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END
$$;

-- 3. Ensure auth.users has required columns & service_role permissions when running on self-hosted or hosted Postgres
DO $$
BEGIN
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password TEXT DEFAULT '';
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_token TEXT;
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMPTZ;
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;

DO $$
BEGIN
  GRANT USAGE ON SCHEMA auth TO postgres, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth.users TO postgres, service_role;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL;
END
$$;
