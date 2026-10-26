import { NextRequest, NextResponse } from 'next/server';
import {
  createListingInquiry,
  createMarketplaceListing,
  createServiceOrRentalBooking,
  listCircleBookings,
  listCircleInquiries,
  listMarketplaceListings,
  respondToListingInquiry,
  toggleSavedListing,
  updateMarketplaceListing,
  updateServiceOrRentalBookingStatus,
} from '@/features/marketplace/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const listingTypeParam = searchParams.get('listingType') ?? searchParams.get('type');
    const listingType =
      listingTypeParam === 'product' ||
      listingTypeParam === 'service' ||
      listingTypeParam === 'rental' ||
      listingTypeParam === 'housing' ||
      listingTypeParam === 'directory'
        ? listingTypeParam
        : undefined;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortByParam = searchParams.get('sortBy');
    const sortBy =
      sortByParam === 'price_asc' || sortByParam === 'price_desc' ? sortByParam : 'newest';

    const listings = await listMarketplaceListings(user?.id ?? null, params.circleId, {
      listingType,
      category,
      search,
      sortBy,
    });

    const inquiries = user
      ? await listCircleInquiries(user.id, params.circleId)
      : [];
    const bookings = user
      ? await listCircleBookings(user.id, params.circleId)
      : [];

    return NextResponse.json({ listings, inquiries, bookings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();

    if (body.action === 'toggle_save') {
      if (!body.listingId) throw new ValidationError('listingId is required.');
      const saved = await toggleSavedListing(user.id, params.circleId, String(body.listingId));
      return NextResponse.json(saved);
    }

    if (body.action === 'inquiry') {
      if (!body.listingId) throw new ValidationError('listingId is required.');
      const inquiry = await createListingInquiry(
        user.id,
        params.circleId,
        String(body.listingId),
        { message: body.message }
      );
      return NextResponse.json({ inquiry }, { status: 201 });
    }

    if (body.action === 'booking') {
      if (!body.listingId) throw new ValidationError('listingId is required.');
      const booking = await createServiceOrRentalBooking(
        user.id,
        params.circleId,
        String(body.listingId),
        {
          bookingType: body.bookingType,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          notes: body.notes,
        }
      );
      return NextResponse.json({ booking }, { status: 201 });
    }

    const listing = await createMarketplaceListing(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();

    if (body.action === 'respond_inquiry') {
      if (!body.inquiryId) throw new ValidationError('inquiryId is required.');
      const inquiry = await respondToListingInquiry(
        user.id,
        params.circleId,
        String(body.inquiryId),
        {
          status: body.status,
          sellerResponse: body.sellerResponse,
        }
      );
      return NextResponse.json({ inquiry });
    }

    if (body.action === 'update_booking') {
      if (!body.bookingId) throw new ValidationError('bookingId is required.');
      const booking = await updateServiceOrRentalBookingStatus(
        user.id,
        params.circleId,
        String(body.bookingId),
        {
          status: body.status,
          providerNote: body.providerNote,
        }
      );
      return NextResponse.json({ booking });
    }

    if (!body.listingId) throw new ValidationError('listingId is required.');
    const listing = await updateMarketplaceListing(
      user.id,
      params.circleId,
      String(body.listingId),
      body
    );
    return NextResponse.json({ listing });
  } catch (error) {
    return handleApiError(error);
  }
}
