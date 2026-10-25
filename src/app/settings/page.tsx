import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { ProfileSettingsClient } from '@/components/platform/profile-settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <ProfileSettingsClient initialUser={user} />
    </div>
  );
}
