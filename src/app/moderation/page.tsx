import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { listModerationReports } from '@/features/moderation/service';
import { ModerationClient } from '@/components/platform/moderation-client';

export const dynamic = 'force-dynamic';

export default async function ModerationPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const reports = await listModerationReports(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <ModerationClient
        initialReports={reports}
        isPlatformAdmin={Boolean(user.is_platform_admin)}
      />
    </div>
  );
}
