import React from 'react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { listUserNotifications } from '@/features/notifications/service';
import { NavbarClient } from './navbar-client';

export async function Navbar() {
  const user = await getAuthenticatedUser();
  let unreadCount = 0;

  if (user) {
    try {
      const notifications = await listUserNotifications(user.id);
      unreadCount = notifications.filter((n) => !n.is_read).length;
    } catch {
      unreadCount = 0;
    }
  }

  return <NavbarClient user={user} unreadCount={unreadCount} />;
}
