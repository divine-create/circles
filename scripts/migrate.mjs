#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const { Pool } = pg;

function computeChecksum(sql) {
  return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

function loadMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    .map((filename) => {
      const match = /^(\d+)_/.exec(filename);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }
      const fullPath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(fullPath, 'utf8');
      return {
        version: match[1],
        filename,
        sql,
        checksum: computeChecksum(sql),
      };
    });
}

async function applyMigrationsWithExecutor(executor, migrations) {
  await executor.exec(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRes = await executor.query(
    `SELECT version, filename, checksum FROM public.schema_migrations ORDER BY version ASC;`
  );
  const appliedMap = new Map(appliedRes.rows.map((r) => [r.version, r]));

  const circlesCheck = await executor.query(`SELECT to_regclass('public.circles') AS reg;`);
  const hasPreExistingInitialSchema = Boolean(circlesCheck.rows[0]?.reg);

  const applied = [];
  const skipped = [];

  for (const m of migrations) {
    const existing = appliedMap.get(m.version);
    if (existing) {
      skipped.push(m.filename);
      continue;
    }

    if (m.version === '0001' && hasPreExistingInitialSchema) {
      await executor.query(
        `INSERT INTO public.schema_migrations (version, filename, checksum)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING;`,
        [m.version, m.filename, m.checksum]
      );
      skipped.push(m.filename);
      continue;
    }

    console.log(`[db:migrate] Applying ${m.filename}...`);
    await executor.exec(m.sql);
    await executor.query(
      `INSERT INTO public.schema_migrations (version, filename, checksum)
       VALUES ($1, $2, $3)
       ON CONFLICT (version) DO UPDATE
         SET filename = EXCLUDED.filename,
             checksum = EXCLUDED.checksum,
             applied_at = NOW();`,
      [m.version, m.filename, m.checksum]
    );
    applied.push(m.filename);
  }

  return { applied, skipped };
}

function loadEnvFileIfNeeded() {
  for (const envFilename of ['.env.local', '.env']) {
    const envPath = path.join(process.cwd(), envFilename);
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  loadEnvFileIfNeeded();
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const migrations = loadMigrations(migrationsDir);
  const connectionString = (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '').trim();

  if (connectionString) {
    if (
      !connectionString.startsWith('postgres://') &&
      !connectionString.startsWith('postgresql://')
    ) {
      console.error(
        '[db:migrate] ERROR: DATABASE_URL / SUPABASE_DB_URL must start with postgres:// or postgresql://'
      );
      process.exit(1);
    }

    const isLocalhost =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1') ||
      connectionString.includes('sslmode=disable');

    console.log('[db:migrate] Connecting to remote PostgreSQL via DATABASE_URL...');
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 15000,
      ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: false } }),
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const executor = {
        query: (sql, params = []) => client.query(sql, params),
        exec: (sql) => client.query(sql),
      };
      const result = await applyMigrationsWithExecutor(executor, migrations);
      await client.query('COMMIT');
      console.log(
        `[db:migrate] Complete on remote PostgreSQL. Applied: ${result.applied.length}, Skipped: ${result.skipped.length}`
      );
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
      await pool.end();
    }
    return;
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION !== 'true'
  ) {
    console.error(
      '[db:migrate] ERROR: DATABASE_URL is required in production unless ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true is set.'
    );
    process.exit(1);
  }

  const dataDir =
    process.env.PGLITE_DATA_DIR || path.join(process.cwd(), '.pgdata', 'circles-db');
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  console.log(`[db:migrate] Applying migrations to embedded PGlite (${dataDir})...`);
  const db = new PGlite(dataDir);
  const executor = {
    query: (sql, params = []) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
  };
  const result = await applyMigrationsWithExecutor(executor, migrations);
  await db.close();
  console.log(
    `[db:migrate] Complete on embedded PGlite. Applied: ${result.applied.length}, Skipped: ${result.skipped.length}`
  );
}

main().catch((err) => {
  console.error('[db:migrate] Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
