'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { NotificationItem } from '@/types/domain';

export function NotificationsClient({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  async function handleMarkRead(notificationId: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    router.refresh();
  }

  async function handleMarkAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
            Inbox & Alerts
          </p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">Notifications</h1>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sand-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-sand-100"
          >
            <CheckCheck className="h-4 w-4 text-forest-700" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-sand-200 bg-white p-12 text-center">
          <Bell className="mx-auto h-9 w-9 text-stone-400" />
          <h2 className="mt-3 text-base font-bold text-stone-900">You&apos;re all caught up</h2>
          <p className="mt-1 text-xs text-stone-600">
            Invitations, membership approvals, and discussion replies will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-sand-200 rounded-2xl border border-sand-200 bg-white shadow-sm">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center ${
                !n.is_read ? 'bg-zinc-50' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {!n.is_read && (
                    <span className="h-2 w-2 rounded-full bg-black" />
                  )}
                  <span className="text-sm font-bold text-stone-900">{n.title}</span>
                  <span className="text-xs text-stone-400">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-600">{n.body}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={n.link_url}
                  onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  <span>Open</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className="rounded-lg border border-sand-300 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-sand-100"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
