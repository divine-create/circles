import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { listUserNotifications } from '@/features/notifications/service';
import { NotificationsClient } from '@/components/platform/notifications-client';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const notifications = await listUserNotifications(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <NotificationsClient initialNotifications={notifications} />
    </div>
  );
}
