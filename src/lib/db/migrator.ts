import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface MigrationExecutor {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  exec: (sql: string) => Promise<void>;
}

export interface MigrationFile {
  version: string;
  filename: string;
  fullPath: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigrationRecord {
  version: string;
  filename: string;
  checksum: string;
  applied_at: string;
}

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}

export function computeMigrationChecksum(sql: string): string {
  // Normalize CRLF to LF so checksums are deterministic across Windows and Linux
  const normalized = sql.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function loadMigrationFiles(
  migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const entries = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return entries.map((filename) => {
    const versionMatch = /^(\d+)_/.exec(filename);
    if (!versionMatch) {
      throw new Error(
        `Invalid migration filename "${filename}". Expected prefix like "0001_description.sql".`
      );
    }
    const version = versionMatch[1];
    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const checksum = computeMigrationChecksum(sql);

    return {
      version,
      filename,
      fullPath,
      sql,
      checksum,
    };
  });
}

export async function ensureMigrationTrackingTable(executor: MigrationExecutor): Promise<void> {
  const existing = await executor.query<{ reg: string | null }>(
    `SELECT to_regclass('public.schema_migrations') AS reg;`
  );
  if (existing.rows[0]?.reg) {
    return;
  }

  await executor.exec(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function getAppliedMigrations(
  executor: MigrationExecutor
): Promise<AppliedMigrationRecord[]> {
  await ensureMigrationTrackingTable(executor);
  const res = await executor.query<AppliedMigrationRecord>(
    `SELECT version, filename, checksum, applied_at
     FROM public.schema_migrations
     ORDER BY version ASC;`
  );
  return res.rows;
}

/**
 * Applies all unapplied migrations in lexicographical version order and records
 * each in `public.schema_migrations`. Fails visibly and halts immediately if any
 * migration fails.
 */
export async function runPendingMigrations(
  executor: MigrationExecutor,
  migrationsDir?: string
): Promise<MigrationRunResult> {
  const files = loadMigrationFiles(migrationsDir);
  await ensureMigrationTrackingTable(executor);

  const existingRows = await getAppliedMigrations(executor);
  const appliedMap = new Map<string, AppliedMigrationRecord>(
    existingRows.map((row) => [row.version, row])
  );

  // Detect pre-existing 0001 schema on legacy local databases created prior to 0004 migration tracking
  const circlesTableCheck = await executor.query<{ reg: string | null }>(
    `SELECT to_regclass('public.circles') AS reg;`
  );
  const hasPreExistingInitialSchema = Boolean(circlesTableCheck.rows[0]?.reg);

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of files) {
    const recorded = appliedMap.get(migration.version);
    if (recorded) {
      skipped.push(migration.filename);
      continue;
    }

    if (migration.version === '0001' && hasPreExistingInitialSchema) {
      await executor.query(
        `INSERT INTO public.schema_migrations (version, filename, checksum)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING;`,
        [migration.version, migration.filename, migration.checksum]
      );
      skipped.push(migration.filename);
      continue;
    }

    await executor.exec(migration.sql);
    await executor.query(
      `INSERT INTO public.schema_migrations (version, filename, checksum)
       VALUES ($1, $2, $3)
       ON CONFLICT (version) DO UPDATE
         SET filename = EXCLUDED.filename,
             checksum = EXCLUDED.checksum,
             applied_at = NOW();`,
      [migration.version, migration.filename, migration.checksum]
    );
    applied.push(migration.filename);
  }

  return { applied, skipped };
}
