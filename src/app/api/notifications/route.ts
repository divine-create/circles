import { NextRequest, NextResponse } from 'next/server';
import {
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const notifications = await listUserNotifications(user.id);
    return NextResponse.json({ notifications });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    if (body.markAll) {
      await markAllNotificationsRead(user.id);
    } else if (body.notificationId) {
      await markNotificationRead(user.id, body.notificationId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
