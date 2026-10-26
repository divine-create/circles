import { NextResponse } from 'next/server';
import { getActiveDatabaseBackend, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  assertProductionDatabaseConfigured,
  getVerifiedSessionSecret,
  isSupabaseConfigured,
} from '@/lib/config/env';
import { logger } from '@/lib/logging';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getVerifiedSessionSecret();
    assertProductionDatabaseConfigured();

    if (process.env.CIRCLES_SIMULATE_DB_UNAVAILABLE === 'true') {
      throw new Error('Simulated database outage');
    }

    const dbCheck = await withServiceRoleTransaction(async (tx) => {
      const res = await tx.query<{ ok: number }>(`SELECT 1 AS ok;`);
      return res.rows[0]?.ok === 1;
    });

    if (!dbCheck) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          code: 'DATABASE_UNREACHABLE',
          database: 'unreachable',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    const backend = getActiveDatabaseBackend();

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      backend,
      mode: isSupabaseConfigured() ? 'supabase_configured' : 'embedded_pglite_rls',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown health check error',
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        code: 'SERVICE_UNAVAILABLE',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
