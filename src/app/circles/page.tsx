import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Compass,
  Layers,
  Lock,
  PlusCircle,
  Sliders,
  Users,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { listMyCircles } from '@/features/circles/service';

export const dynamic = 'force-dynamic';

export default async function MyCirclesPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const circles = await listMyCircles(user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
            Your Communities
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">My Circles</h1>
          <p className="mt-1.5 text-sm text-stone-600">
            Communities you own, moderate, or participate in as an active member.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-sand-100"
          >
            <Compass className="h-4 w-4" />
            <span>Explore Directory</span>
          </Link>
          <Link
            href="/circles/new"
            className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-forest-800"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create a Circle</span>
          </Link>
        </div>
      </div>

      {circles.length === 0 ? (
        <div className="rounded-2xl border border-sand-200 bg-white p-12 text-center">
          <Layers className="mx-auto h-10 w-10 text-stone-400" />
          <h2 className="mt-3 text-lg font-bold text-stone-900">You haven&apos;t joined any Circles yet</h2>
          <p className="mt-1 text-sm text-stone-600 max-w-md mx-auto">
            Discover public communities in the directory or launch a new Circle tailored to your
            group.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/explore"
              className="rounded-xl border border-sand-300 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-sand-100"
            >
              Explore Circles
            </Link>
            <Link
              href="/circles/new"
              className="rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
            >
              Start a Circle
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {circles.map((circle) => {
            const isStaff =
              circle.current_user_role === 'owner' || circle.current_user_role === 'admin';

            return (
              <div
                key={circle.id}
                className="flex flex-col justify-between rounded-2xl border border-sand-200 bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-forest-800">
                      {circle.category.replace('_', ' ')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-stone-800">
                      {circle.visibility === 'private' && <Lock className="h-3 w-3 text-stone-500" />}
                      Role: {circle.current_user_role}
                    </span>
                  </div>

                  <Link href={`/circles/${circle.slug}`} className="group block mt-4">
                    <h2 className="text-lg font-bold text-stone-900 group-hover:text-forest-700">
                      {circle.name}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm text-stone-600">
                      {circle.description}
                    </p>
                  </Link>
                </div>

                <div className="mt-6 space-y-3 border-t border-sand-100 pt-4">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                      <Users className="h-3.5 w-3.5 text-forest-700" />
                      {circle.member_count ?? 1} members
                    </span>
                    <span className="capitalize">{circle.visibility.replace('_', ' ')}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/circles/${circle.slug}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-forest-700 py-2.5 text-xs font-semibold text-white hover:bg-forest-800"
                    >
                      <span>Open Circle</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    {isStaff && (
                      <Link
                        href={`/circles/${circle.slug}/studio`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sand-300 bg-sand-50 px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-sand-100"
                        title="Configure in Circle Studio"
                      >
                        <Sliders className="h-3.5 w-3.5 text-forest-700" />
                        <span>Studio</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
