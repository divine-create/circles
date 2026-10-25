import { NextResponse } from 'next/server';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { getVerifiedSessionSecret, isSupabaseConfigured } from '@/lib/config/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getVerifiedSessionSecret();

    const dbCheck = await withServiceRoleTransaction(async (tx) => {
      const res = await tx.query<{ ok: number }>(`SELECT 1 AS ok;`);
      return res.rows[0]?.ok === 1;
    });

    if (!dbCheck) {
      return NextResponse.json(
        { status: 'unhealthy', database: 'unreachable' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      mode: isSupabaseConfigured() ? 'supabase_cloud' : 'embedded_pglite_rls',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed.',
      },
      { status: 503 }
    );
  }
}
