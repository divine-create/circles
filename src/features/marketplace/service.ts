import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  CircleRole,
  CircleVisibility,
  ListingInquiryItem,
  MarketplaceListingItem,
  MembershipStatus,
  ServiceBookingItem,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { createNotification } from '@/features/notifications/service';

const COMMERCE_CAPABILITY_KEYS = [
  'marketplace',
  'listings_discovery',
  'services_bookings',
  'rentals_sharing',
  'housing_property',
];

export const createListingSchema = z.object({
  circleId: z.string().uuid(),
  listingType: z.enum(['product', 'service', 'rental', 'housing', 'directory']).default('product'),
  category: z.string().trim().min(1).max(60).default('general'),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(8000).default(''),
  priceAmount: z.number().min(0).max(100000000).nullable().optional(),
  priceCurrency: z.string().trim().length(3).default('USD'),
  pricingUnit: z
    .enum(['fixed', 'hourly', 'daily', 'monthly', 'free', 'negotiable'])
    .default('fixed'),
  condition: z
    .enum(['new', 'like_new', 'good', 'fair', 'not_applicable'])
    .nullable()
    .optional(),
  location: z.string().trim().max(200).nullable().optional(),
  contactPreference: z.enum(['in_app_inquiry', 'email', 'both']).default('in_app_inquiry'),
  imageUrls: z.array(z.string().trim().min(1).max(1000)).max(8).default([]),
  serviceDurationMinutes: z.number().int().min(15).max(1440).nullable().optional(),
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'published']).default('published'),
});

export const updateListingSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(8000).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  priceAmount: z.number().min(0).max(100000000).nullable().optional(),
  pricingUnit: z.enum(['fixed', 'hourly', 'daily', 'monthly', 'free', 'negotiable']).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'not_applicable']).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  imageUrls: z.array(z.string().trim().min(1).max(1000)).max(8).optional(),
  status: z.enum(['draft', 'published', 'reserved', 'sold', 'archived', 'removed']).optional(),
});

export const createInquirySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const respondInquirySchema = z.object({
  status: z.enum(['responded', 'accepted', 'declined', 'closed']),
  sellerResponse: z.string().trim().min(1).max(2000).optional(),
});

export const createBookingSchema = z.object({
  bookingType: z.enum(['service', 'rental']).default('service'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().trim().max(2000).default(''),
});

export const updateBookingSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled', 'completed', 'returned']),
  providerNote: z.string().trim().max(2000).optional(),
});

async function assertCommerceCapability(
  tx: { query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  circleId: string,
  actorUserId: string | null
): Promise<{
  circle: { id: string; slug: string; visibility: CircleVisibility };
  membership: { role: CircleRole; status: MembershipStatus } | null;
  enabledKeys: Set<string>;
}> {
  const circleRes = await tx.query<{
    id: string;
    slug: string;
    visibility: CircleVisibility;
  }>(`SELECT id, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
  const circle = circleRes.rows[0];
  if (!circle) {
    throw new NotFoundError('Circle not found.');
  }

  const capRes = await tx.query<{ capability_key: string }>(
    `SELECT capability_key FROM public.circle_capabilities
     WHERE circle_id = $1 AND capability_key = ANY($2::text[]) AND enabled = true;`,
    [circleId, COMMERCE_CAPABILITY_KEYS]
  );

  if (capRes.rows.length === 0) {
    throw new CapabilityDisabledError('marketplace');
  }

  let membership: { role: CircleRole; status: MembershipStatus } | null = null;
  if (actorUserId) {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    membership = memRes.rows[0] ?? null;
  }

  return {
    circle,
    membership,
    enabledKeys: new Set(capRes.rows.map((r) => r.capability_key)),
  };
}

function normalizeListingRow(
  row: MarketplaceListingItem & {
    seller_username?: string;
    seller_display_name?: string;
    seller_avatar_url?: string | null;
    viewer_has_saved?: boolean;
  }
): MarketplaceListingItem {
  return {
    id: row.id,
    circle_id: row.circle_id,
    seller_id: row.seller_id,
    listing_type: row.listing_type,
    category: row.category,
    title: row.title,
    description: row.description,
    price_amount: row.price_amount !== null && row.price_amount !== undefined ? Number(row.price_amount) : null,
    price_currency: row.price_currency,
    pricing_unit: row.pricing_unit,
    condition: row.condition ?? null,
    location: row.location ?? null,
    contact_preference: row.contact_preference,
    image_urls: Array.isArray(row.image_urls) ? (row.image_urls as string[]) : [],
    service_duration_minutes: row.service_duration_minutes ?? null,
    available_from: row.available_from ?? null,
    available_until: row.available_until ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    seller: row.seller_username
      ? {
          id: row.seller_id,
          username: row.seller_username,
          display_name: row.seller_display_name ?? row.seller_username,
          avatar_url: row.seller_avatar_url ?? null,
        }
      : undefined,
    viewer_has_saved: Boolean(row.viewer_has_saved),
  };
}

export async function createMarketplaceListing(
  actorUserId: string,
  input: z.input<typeof createListingSchema>
): Promise<MarketplaceListingItem> {
  const parsed = createListingSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertCommerceCapability(tx, parsed.circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can publish marketplace listings.');
    }

    const listingId = crypto.randomUUID();
    const res = await tx.query<MarketplaceListingItem>(
      `INSERT INTO public.marketplace_listings (
         id, circle_id, seller_id, listing_type, category, title, description,
         price_amount, price_currency, pricing_unit, condition, location,
         contact_preference, image_urls, service_duration_minutes,
         available_from, available_until, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14::jsonb, $15,
         $16, $17, $18
       ) RETURNING *;`,
      [
        listingId,
        parsed.circleId,
        actorUserId,
        parsed.listingType,
        parsed.category,
        parsed.title,
        parsed.description,
        parsed.priceAmount ?? null,
        parsed.priceCurrency.toUpperCase(),
        parsed.pricingUnit,
        parsed.condition ?? null,
        parsed.location ?? null,
        parsed.contactPreference,
        JSON.stringify(parsed.imageUrls),
        parsed.serviceDurationMinutes ?? null,
        parsed.availableFrom ?? null,
        parsed.availableUntil ?? null,
        parsed.status,
      ]
    );

    return normalizeListingRow(res.rows[0]);
  });
}

export async function listMarketplaceListings(
  actorUserId: string | null,
  circleId: string,
  options?: {
    listingType?: 'product' | 'service' | 'rental' | 'housing' | 'directory';
    category?: string;
    search?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'newest' | 'price_asc' | 'price_desc';
    limit?: number;
    offset?: number;
  }
): Promise<MarketplaceListingItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view listings in this Circle.');
    }

    const res = await tx.query<
      MarketplaceListingItem & {
        seller_username: string;
        seller_display_name: string;
        seller_avatar_url: string | null;
        viewer_has_saved: boolean;
      }
    >(
      `SELECT l.*,
         COALESCE(u.username, 'member') AS seller_username,
         COALESCE(u.display_name, 'Member') AS seller_display_name,
         u.avatar_url AS seller_avatar_url,
         EXISTS (
           SELECT 1 FROM public.marketplace_saved_listings s
           WHERE s.listing_id = l.id AND s.user_id = $2
         ) AS viewer_has_saved
       FROM public.marketplace_listings l
       LEFT JOIN public.profiles u ON u.id = l.seller_id
       WHERE l.circle_id = $1
       ORDER BY l.created_at DESC;`,
      [circleId, actorUserId]
    );

    let items = res.rows.map(normalizeListingRow);

    if (options?.listingType) {
      items = items.filter((item) => item.listing_type === options.listingType);
    }
    if (options?.category) {
      items = items.filter(
        (item) => item.category.toLowerCase() === options.category!.toLowerCase()
      );
    }
    if (options?.status) {
      items = items.filter((item) => item.status === options.status);
    }
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.location ?? '').toLowerCase().includes(q)
      );
    }
    if (options?.minPrice !== undefined) {
      items = items.filter(
        (item) => item.price_amount !== null && item.price_amount >= options.minPrice!
      );
    }
    if (options?.maxPrice !== undefined) {
      items = items.filter(
        (item) => item.price_amount !== null && item.price_amount <= options.maxPrice!
      );
    }

    if (options?.sortBy === 'price_asc') {
      items.sort((a, b) => (a.price_amount ?? 0) - (b.price_amount ?? 0));
    } else if (options?.sortBy === 'price_desc') {
      items.sort((a, b) => (b.price_amount ?? 0) - (a.price_amount ?? 0));
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return items.slice(offset, offset + limit);
  });
}

export async function updateMarketplaceListing(
  actorUserId: string,
  circleId: string,
  listingId: string,
  input: z.input<typeof updateListingSchema>
): Promise<MarketplaceListingItem> {
  const parsed = updateListingSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<MarketplaceListingItem>(
      `SELECT * FROM public.marketplace_listings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [listingId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Listing not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (existing.seller_id !== actorUserId && !isStaff) {
      throw new ForbiddenError('Only the listing owner or a Circle moderator can modify this listing.');
    }

    await tx.query(
      `UPDATE public.marketplace_listings
       SET title = $1,
           description = $2,
           category = $3,
           price_amount = $4,
           pricing_unit = $5,
           condition = $6,
           location = $7,
           status = $8,
           image_urls = CASE WHEN $9::text IS NOT NULL THEN $9::jsonb ELSE image_urls END,
           updated_at = NOW()
       WHERE id = $10 AND circle_id = $11;`,
      [
        parsed.title ?? existing.title,
        parsed.description ?? existing.description,
        parsed.category ?? existing.category,
        parsed.priceAmount !== undefined ? parsed.priceAmount : existing.price_amount,
        parsed.pricingUnit ?? existing.pricing_unit,
        parsed.condition !== undefined ? parsed.condition : existing.condition,
        parsed.location !== undefined ? parsed.location : existing.location,
        parsed.status ?? existing.status,
        parsed.imageUrls ? JSON.stringify(parsed.imageUrls) : null,
        listingId,
        circleId,
      ]
    );

    const fullRes = await tx.query<
      MarketplaceListingItem & {
        seller_username: string;
        seller_display_name: string;
        seller_avatar_url: string | null;
        viewer_has_saved: boolean;
      }
    >(
      `SELECT l.*,
         COALESCE(u.username, 'member') AS seller_username,
         COALESCE(u.display_name, 'Member') AS seller_display_name,
         u.avatar_url AS seller_avatar_url,
         EXISTS (
           SELECT 1 FROM public.marketplace_saved_listings s
           WHERE s.listing_id = l.id AND s.user_id = $2
         ) AS viewer_has_saved
       FROM public.marketplace_listings l
       LEFT JOIN public.profiles u ON u.id = l.seller_id
       WHERE l.id = $1 AND l.circle_id = $3
       LIMIT 1;`,
      [listingId, actorUserId, circleId]
    );

    return normalizeListingRow(fullRes.rows[0]);
  });
}

export async function toggleSavedListing(
  actorUserId: string,
  circleId: string,
  listingId: string
): Promise<{ saved: boolean }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertCommerceCapability(tx, circleId, actorUserId);

    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM public.marketplace_saved_listings
       WHERE listing_id = $1 AND circle_id = $2 AND user_id = $3 LIMIT 1;`,
      [listingId, circleId, actorUserId]
    );

    if (existing.rows[0]) {
      await tx.query(`DELETE FROM public.marketplace_saved_listings WHERE id = $1;`, [
        existing.rows[0].id,
      ]);
      return { saved: false };
    }

    await tx.query(
      `INSERT INTO public.marketplace_saved_listings (id, circle_id, listing_id, user_id)
       VALUES ($1, $2, $3, $4);`,
      [crypto.randomUUID(), circleId, listingId, actorUserId]
    );
    return { saved: true };
  });
}

export async function createListingInquiry(
  actorUserId: string,
  circleId: string,
  listingId: string,
  input: z.input<typeof createInquirySchema>
): Promise<ListingInquiryItem> {
  const parsed = createInquirySchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can contact listing sellers.');
    }

    const listingRes = await tx.query<MarketplaceListingItem>(
      `SELECT * FROM public.marketplace_listings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [listingId, circleId]
    );
    const listing = listingRes.rows[0];
    if (!listing) {
      throw new NotFoundError('Listing not found in this Circle.');
    }

    if (listing.seller_id === actorUserId) {
      throw new ValidationError('You cannot submit an inquiry on your own listing.');
    }

    if (listing.status !== 'published' && listing.status !== 'reserved') {
      throw new ValidationError(`This listing is currently ${listing.status} and not accepting inquiries.`);
    }

    const inquiryRes = await tx.query<ListingInquiryItem>(
      `INSERT INTO public.listing_inquiries (
         id, circle_id, listing_id, buyer_id, seller_id, message, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING *;`,
      [crypto.randomUUID(), circleId, listingId, actorUserId, listing.seller_id, parsed.message]
    );

    return {
      inquiry: inquiryRes.rows[0],
      listingTitle: listing.title,
      sellerId: listing.seller_id,
      circleSlug: circle.slug,
    };
  });

  await createNotification({
    recipientId: outcome.sellerId,
    actorId: actorUserId,
    circleId,
    eventType: 'listing_inquiry',
    title: `New Inquiry: ${outcome.listingTitle}`,
    body: parsed.message.slice(0, 140),
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return outcome.inquiry;
}

export async function respondToListingInquiry(
  actorUserId: string,
  circleId: string,
  inquiryId: string,
  input: z.input<typeof respondInquirySchema>
): Promise<ListingInquiryItem> {
  const parsed = respondInquirySchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<ListingInquiryItem>(
      `SELECT * FROM public.listing_inquiries WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [inquiryId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Inquiry not found.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (existing.seller_id !== actorUserId && !isStaff) {
      throw new ForbiddenError('Only the listing seller or a moderator can respond to this inquiry.');
    }

    const updated = await tx.query<ListingInquiryItem>(
      `UPDATE public.listing_inquiries
       SET status = $1,
           seller_response = COALESCE($2, seller_response),
           updated_at = NOW()
       WHERE id = $3 AND circle_id = $4
       RETURNING *;`,
      [parsed.status, parsed.sellerResponse ?? null, inquiryId, circleId]
    );

    return {
      inquiry: updated.rows[0],
      circleSlug: circle.slug,
    };
  });

  await createNotification({
    recipientId: outcome.inquiry.buyer_id,
    actorId: actorUserId,
    circleId,
    eventType: 'listing_inquiry',
    title: `Inquiry Update (${outcome.inquiry.status})`,
    body: outcome.inquiry.seller_response ?? `Your inquiry status changed to ${outcome.inquiry.status}.`,
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return outcome.inquiry;
}

export async function listCircleInquiries(
  actorUserId: string,
  circleId: string
): Promise<ListingInquiryItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertCommerceCapability(tx, circleId, actorUserId);

    const res = await tx.query<
      ListingInquiryItem & {
        listing_title: string;
        buyer_username: string;
        buyer_display_name: string;
        seller_username: string;
        seller_display_name: string;
      }
    >(
      `SELECT i.*,
         l.title AS listing_title,
         COALESCE(bu.username, 'buyer') AS buyer_username,
         COALESCE(bu.display_name, 'Buyer') AS buyer_display_name,
         COALESCE(su.username, 'seller') AS seller_username,
         COALESCE(su.display_name, 'Seller') AS seller_display_name
       FROM public.listing_inquiries i
       LEFT JOIN public.marketplace_listings l ON l.id = i.listing_id
       LEFT JOIN public.profiles bu ON bu.id = i.buyer_id
       LEFT JOIN public.profiles su ON su.id = i.seller_id
       WHERE i.circle_id = $1
       ORDER BY i.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      listing_id: r.listing_id,
      listing_title: r.listing_title,
      buyer_id: r.buyer_id,
      seller_id: r.seller_id,
      message: r.message,
      seller_response: r.seller_response,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      buyer: {
        id: r.buyer_id,
        username: r.buyer_username,
        display_name: r.buyer_display_name,
      },
      seller: {
        id: r.seller_id,
        username: r.seller_username,
        display_name: r.seller_display_name,
      },
    }));
  });
}

export async function createServiceOrRentalBooking(
  actorUserId: string,
  circleId: string,
  listingId: string,
  input: z.input<typeof createBookingSchema>
): Promise<ServiceBookingItem> {
  const parsed = createBookingSchema.parse(input);
  if (new Date(parsed.endsAt).getTime() <= new Date(parsed.startsAt).getTime()) {
    throw new ValidationError('Booking end time must be after start time.');
  }

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can request bookings or rentals.');
    }

    const listingRes = await tx.query<MarketplaceListingItem>(
      `SELECT * FROM public.marketplace_listings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [listingId, circleId]
    );
    const listing = listingRes.rows[0];
    if (!listing) {
      throw new NotFoundError('Listing not found in this Circle.');
    }

    if (listing.seller_id === actorUserId) {
      throw new ValidationError('You cannot book or borrow your own listing.');
    }

    if (listing.status !== 'published') {
      throw new ValidationError(`This listing is currently ${listing.status} and unavailable for booking.`);
    }

    // Check if an approved booking already conflicts with the requested time window
    const conflictRes = await tx.query<{ id: string }>(
      `SELECT id FROM public.service_bookings
       WHERE listing_id = $1
         AND circle_id = $2
         AND status = 'approved'
         AND $3::timestamptz < ends_at
         AND $4::timestamptz > starts_at
       LIMIT 1;`,
      [listingId, circleId, parsed.startsAt, parsed.endsAt]
    );
    if (conflictRes.rows[0]) {
      throw new ConflictError(
        'Booking conflict: another approved booking or rental already overlaps this time window.'
      );
    }

    const bookingRes = await tx.query<ServiceBookingItem>(
      `INSERT INTO public.service_bookings (
         id, circle_id, listing_id, requester_id, provider_id,
         booking_type, starts_at, ends_at, notes, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        circleId,
        listingId,
        actorUserId,
        listing.seller_id,
        parsed.bookingType,
        parsed.startsAt,
        parsed.endsAt,
        parsed.notes,
      ]
    );

    return {
      booking: bookingRes.rows[0],
      listingTitle: listing.title,
      circleSlug: circle.slug,
    };
  });

  await createNotification({
    recipientId: outcome.booking.provider_id,
    actorId: actorUserId,
    circleId,
    eventType: 'booking_status',
    title: `New ${parsed.bookingType === 'rental' ? 'Rental' : 'Service Booking'} Request: ${outcome.listingTitle}`,
    body: `A member requested ${outcome.listingTitle} from ${new Date(parsed.startsAt).toISOString().slice(0, 16)}.`,
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return outcome.booking;
}

export async function updateServiceOrRentalBookingStatus(
  actorUserId: string,
  circleId: string,
  bookingId: string,
  input: z.input<typeof updateBookingSchema>
): Promise<ServiceBookingItem> {
  const parsed = updateBookingSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<ServiceBookingItem>(
      `SELECT * FROM public.service_bookings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [bookingId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Booking not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    const isProvider = existing.provider_id === actorUserId;
    const isRequester = existing.requester_id === actorUserId;

    if (parsed.status === 'cancelled') {
      if (!isRequester && !isProvider && !isStaff) {
        throw new ForbiddenError('Not authorized to cancel this booking.');
      }
    } else if (!isProvider && !isStaff) {
      throw new ForbiddenError(
        'Only the service/rental provider or a Circle moderator can approve, reject, complete, or mark returned.'
      );
    }

    try {
      const updatedRes = await tx.query<ServiceBookingItem>(
        `UPDATE public.service_bookings
         SET status = $1,
             provider_note = COALESCE($2, provider_note),
             returned_at = CASE WHEN $1 = 'returned' THEN NOW() ELSE returned_at END,
             updated_at = NOW()
         WHERE id = $3 AND circle_id = $4
         RETURNING *;`,
        [parsed.status, parsed.providerNote ?? null, bookingId, circleId]
      );

      return {
        booking: updatedRes.rows[0],
        circleSlug: circle.slug,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Booking conflict')) {
        throw new ConflictError(msg);
      }
      throw err;
    }
  });

  const targetRecipient =
    actorUserId === outcome.booking.provider_id
      ? outcome.booking.requester_id
      : outcome.booking.provider_id;

  await createNotification({
    recipientId: targetRecipient,
    actorId: actorUserId,
    circleId,
    eventType: 'booking_status',
    title: `Booking ${outcome.booking.status.toUpperCase()}`,
    body:
      outcome.booking.provider_note ??
      `Your ${outcome.booking.booking_type} request status is now ${outcome.booking.status}.`,
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return outcome.booking;
}

export async function listCircleBookings(
  actorUserId: string,
  circleId: string
): Promise<ServiceBookingItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertCommerceCapability(tx, circleId, actorUserId);

    const res = await tx.query<
      ServiceBookingItem & {
        listing_title: string;
        requester_username: string;
        requester_display_name: string;
        provider_username: string;
        provider_display_name: string;
      }
    >(
      `SELECT b.*,
         l.title AS listing_title,
         COALESCE(ru.username, 'requester') AS requester_username,
         COALESCE(ru.display_name, 'Requester') AS requester_display_name,
         COALESCE(pu.username, 'provider') AS provider_username,
         COALESCE(pu.display_name, 'Provider') AS provider_display_name
       FROM public.service_bookings b
       LEFT JOIN public.marketplace_listings l ON l.id = b.listing_id
       LEFT JOIN public.profiles ru ON ru.id = b.requester_id
       LEFT JOIN public.profiles pu ON pu.id = b.provider_id
       WHERE b.circle_id = $1
       ORDER BY b.starts_at ASC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      listing_id: r.listing_id,
      listing_title: r.listing_title,
      requester_id: r.requester_id,
      provider_id: r.provider_id,
      booking_type: r.booking_type,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      notes: r.notes,
      status: r.status,
      provider_note: r.provider_note,
      returned_at: r.returned_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      requester: {
        id: r.requester_id,
        username: r.requester_username,
        display_name: r.requester_display_name,
      },
      provider: {
        id: r.provider_id,
        username: r.provider_username,
        display_name: r.provider_display_name,
      },
    }));
  });
}
