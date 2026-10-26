'use client';

import React, { useState } from 'react';
import {
  Bookmark,
  Calendar,
  MapPin,
  MessageSquare,
  Plus,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import {
  ListingInquiryItem,
  MarketplaceListingItem,
  ServiceBookingItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';

export function MarketplaceBoard({
  circleId,
  initialListings,
  initialInquiries,
  initialBookings,
  isMember,
}: {
  circleId: string;
  initialListings: MarketplaceListingItem[];
  initialInquiries: ListingInquiryItem[];
  initialBookings: ServiceBookingItem[];
  isMember: boolean;
}) {
  const [listings, setListings] = useState<MarketplaceListingItem[]>(initialListings);
  const [inquiries, setInquiries] = useState<ListingInquiryItem[]>(initialInquiries);
  const [bookings, setBookings] = useState<ServiceBookingItem[]>(initialBookings);
  const [filterType, setFilterType] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

  const [listingType, setListingType] = useState<
    'product' | 'service' | 'rental' | 'housing' | 'directory'
  >('product');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [priceAmount, setPriceAmount] = useState('');
  const [pricingUnit, setPricingUnit] = useState<
    'fixed' | 'hourly' | 'daily' | 'monthly' | 'free' | 'negotiable'
  >('fixed');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingType,
          category,
          title,
          description,
          priceAmount: priceAmount ? Number(priceAmount) : null,
          pricingUnit,
          location: location || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish listing.');
      setListings((prev) => [data.listing, ...prev]);
      setTitle('');
      setDescription('');
      setPriceAmount('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create listing.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleSave(listingId: string) {
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_save', listingId }),
      });
      const data = await res.json();
      if (res.ok) {
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, viewer_has_saved: data.saved } : l))
        );
      }
    } catch {
      // ignore
    }
  }

  async function handleQuickInquiry(listingId: string) {
    const message = window.prompt('Enter your inquiry message for the seller:');
    if (!message) return;
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'inquiry', listingId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send inquiry.');
      setInquiries((prev) => [data.inquiry, ...prev]);
      alert('Inquiry sent to listing author.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send inquiry.');
    }
  }

  async function handleQuickBooking(listingId: string, bookingType: 'service' | 'rental') {
    const startsAtStr = window.prompt(
      'Enter start date/time (YYYY-MM-DDTHH:MM):',
      new Date(Date.now() + 86400_000).toISOString().slice(0, 16)
    );
    if (!startsAtStr) return;
    const endsAtStr = window.prompt(
      'Enter end date/time (YYYY-MM-DDTHH:MM):',
      new Date(Date.now() + 93600_000).toISOString().slice(0, 16)
    );
    if (!endsAtStr) return;

    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'book',
          listingId,
          bookingType,
          startsAt: new Date(startsAtStr).toISOString(),
          endsAt: new Date(endsAtStr).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule booking.');
      setBookings((prev) => [data.booking, ...prev]);
      alert('Booking request submitted.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Booking conflict or error.');
    }
  }

  const visibleListings =
    filterType === 'all' ? listings : listings.filter((l) => l.listing_type === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Marketplace & Bookings</h2>
            <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-forest-800 border border-forest-200/60">
              {listings.length} LISTINGS
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Goods for trade, equipment rentals, service appointments, and housing listings.
          </p>
        </div>
        {isMember && (
          <Button
            size="sm"
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showCreate ? 'Cancel' : 'New Listing'}</span>
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'all', label: 'All Items' },
          { key: 'product', label: 'Products' },
          { key: 'service', label: 'Services' },
          { key: 'rental', label: 'Rentals & Tools' },
          { key: 'housing', label: 'Housing' },
          { key: 'directory', label: 'Directory' },
        ].map((tab) => {
          const active = filterType === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterType(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'bg-black text-white shadow-xs font-semibold'
                  : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateListing}
          className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-premium space-y-4"
        >
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Create Community Listing
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Listing Type
              </label>
              <select
                value={listingType}
                onChange={(e) =>
                  setListingType(
                    e.target.value as
                      | 'product'
                      | 'service'
                      | 'rental'
                      | 'housing'
                      | 'directory'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              >
                <option value="product">Product for Sale / Trade</option>
                <option value="service">Service & Appointment</option>
                <option value="rental">Tool / Equipment Rental</option>
                <option value="housing">Housing / Roommate</option>
                <option value="directory">Directory Recommendation</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Category
              </label>
              <input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="books, electronics, tools..."
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Price & Unit
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
                <select
                  value={pricingUnit}
                  onChange={(e) =>
                    setPricingUnit(
                      e.target.value as
                        | 'fixed'
                        | 'hourly'
                        | 'daily'
                        | 'monthly'
                        | 'free'
                        | 'negotiable'
                    )
                  }
                  className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                >
                  <option value="fixed">Fixed</option>
                  <option value="hourly">/ Hour</option>
                  <option value="daily">/ Day</option>
                  <option value="monthly">/ Month</option>
                  <option value="free">Free</option>
                  <option value="negotiable">Negotiable</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Title *
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bosch Cordless Drill Library Loan"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                Location
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Campus North / Workshop Room 4"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Details & Conditions
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide item specs, return condition terms, or booking details..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Publishing...' : 'Publish Listing'}
            </Button>
          </div>
        </form>
      )}

      {visibleListings.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <ShoppingBag className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">No Listings Found</h3>
          <p className="mt-1 text-xs text-stone-500">
            Post an item, service, equipment rental, or housing opening for members.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleListings.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-forest-800 border border-forest-200/60">
                      {item.listing_type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-stone-400 font-mono">
                      <Tag className="h-3 w-3" />
                      {item.category}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-forest-800 font-mono">
                    {item.pricing_unit === 'free'
                      ? 'FREE'
                      : item.price_amount !== null
                        ? `${item.price_currency} ${item.price_amount.toFixed(2)} (${item.pricing_unit})`
                        : item.pricing_unit}
                  </span>
                </div>

                <h3 className="text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed font-normal">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="space-y-3 border-t border-stone-100 pt-3">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>By {item.seller?.display_name || 'Member'}</span>
                  {item.location && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                      <MapPin className="h-3 w-3" />
                      {item.location}
                    </span>
                  )}
                </div>

                {isMember && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      size="xs"
                      variant={item.viewer_has_saved ? 'secondary' : 'outline'}
                      onClick={() => handleToggleSave(item.id)}
                    >
                      <Bookmark className="h-3 w-3" />
                      <span>{item.viewer_has_saved ? 'Saved' : 'Save'}</span>
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleQuickInquiry(item.id)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Inquire</span>
                    </Button>
                    {(item.listing_type === 'service' || item.listing_type === 'rental') && (
                      <Button
                        size="xs"
                        onClick={() =>
                          handleQuickBooking(
                            item.id,
                            item.listing_type === 'rental' ? 'rental' : 'service'
                          )
                        }
                      >
                        <Calendar className="h-3 w-3" />
                        <span>{item.listing_type === 'rental' ? 'Rent' : 'Book'}</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(inquiries.length > 0 || bookings.length > 0) && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
            Activity & Requests ({inquiries.length + bookings.length})
          </h3>
          <div className="divide-y divide-stone-100 text-xs">
            {inquiries.map((inq) => (
              <div key={inq.id} className="py-2.5 flex justify-between gap-4">
                <div>
                  <span className="font-semibold text-stone-900">
                    Inquiry on {inq.listing_title || 'Listing'}:
                  </span>{' '}
                  <span className="text-stone-600">{inq.message}</span>
                </div>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-stone-700">
                  {inq.status}
                </span>
              </div>
            ))}
            {bookings.map((b) => (
              <div key={b.id} className="py-2.5 flex justify-between gap-4">
                <div>
                  <span className="font-semibold text-stone-900">
                    {b.booking_type.toUpperCase()} Booking ({b.listing_title || 'Listing'}):
                  </span>{' '}
                  <span className="text-stone-600">
                    {new Date(b.starts_at).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}{' '}
                    –{' '}
                    {new Date(b.ends_at).toLocaleTimeString([], {
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-forest-800">
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
