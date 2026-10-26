import React from 'react';
import { notFound } from 'next/navigation';
import { Lock, ShoppingBag } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import {
  listCircleBookings,
  listCircleInquiries,
  listMarketplaceListings,
} from '@/features/marketplace/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { MarketplaceBoard } from '@/components/circles/marketplace-board';
import {
  ListingInquiryItem,
  MarketplaceListingItem,
  ServiceBookingItem,
} from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleMarketplacePage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const canRead = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  if (!canRead) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
        <Lock className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Marketplace</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to browse community listings, services, and rentals.
        </p>
      </div>
    );
  }

  let listings: MarketplaceListingItem[] = [];
  let inquiries: ListingInquiryItem[] = [];
  let bookings: ServiceBookingItem[] = [];
  try {
    listings = await listMarketplaceListings(user?.id ?? null, circle.id);
    if (user && circle.current_user_membership_status === 'active') {
      inquiries = await listCircleInquiries(user.id, circle.id);
      bookings = await listCircleBookings(user.id, circle.id);
    }
  } catch {
    return (
      <div className="rounded-2xl border border-sand-200 bg-white p-10 text-center shadow-sm">
        <ShoppingBag className="mx-auto h-8 w-8 text-stone-400" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">
          Marketplace & Commerce Capabilities Disabled
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Enable Marketplace, Listings, Services, Rentals, or Housing in Circle Studio.
        </p>
      </div>
    );
  }

  const isMember = circle.current_user_membership_status === 'active';

  return (
    <MarketplaceBoard
      circleId={circle.id}
      initialListings={listings}
      initialInquiries={inquiries}
      initialBookings={bookings}
      isMember={isMember}
    />
  );
}
