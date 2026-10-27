'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Inbox,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Tag,
  User,
  X,
} from 'lucide-react';
import {
  CircleRole,
  ListingInquiryItem,
  MarketplaceListingItem,
  ServiceBookingItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';

export interface MarketplaceBoardProps {
  circleId: string;
  circleSlug?: string;
  initialListings: MarketplaceListingItem[];
  initialInquiries: ListingInquiryItem[];
  initialBookings: ServiceBookingItem[];
  isMember: boolean;
  currentUserId?: string | null;
  currentUserRole?: CircleRole | null;
}

export function MarketplaceBoard({
  circleId,
  initialListings,
  initialInquiries,
  initialBookings,
  isMember,
  currentUserId,
  currentUserRole,
}: MarketplaceBoardProps) {
  const [listings, setListings] = useState<MarketplaceListingItem[]>(initialListings);
  const [inquiries, setInquiries] = useState<ListingInquiryItem[]>(initialInquiries);
  const [bookings, setBookings] = useState<ServiceBookingItem[]>(initialBookings);

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<'browse' | 'saved' | 'activity'>('browse');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'reserved' | 'sold'>('all');

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);

  // Form Fields
  const [listingType, setListingType] = useState<
    'product' | 'service' | 'rental' | 'housing' | 'directory'
  >('product');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [pricingUnit, setPricingUnit] = useState<
    'fixed' | 'hourly' | 'daily' | 'monthly' | 'free' | 'negotiable'
  >('fixed');
  const [condition, setCondition] = useState<
    'new' | 'like_new' | 'good' | 'fair' | 'not_applicable'
  >('good');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrlsText, setImageUrlsText] = useState('');
  const [status, setStatus] = useState<'published' | 'draft' | 'reserved' | 'sold'>('published');

  // Detail Modal
  const [selectedListing, setSelectedListing] = useState<MarketplaceListingItem | null>(null);

  // Inquiry Modal
  const [inquiryListing, setInquiryListing] = useState<MarketplaceListingItem | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);

  // Booking Modal
  const [bookingListing, setBookingListing] = useState<MarketplaceListingItem | null>(null);
  const [bookingType, setBookingType] = useState<'service' | 'rental'>('service');
  const [bookingStartsAt, setBookingStartsAt] = useState('');
  const [bookingEndsAt, setBookingEndsAt] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Activity Drawer / Tab Filter
  const [activityRoleFilter, setActivityRoleFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [inquiryReplyText, setInquiryReplyText] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaff = currentUserRole ? ['owner', 'admin', 'moderator'].includes(currentUserRole) : false;

  // Open Create Modal
  function handleOpenCreate() {
    setEditingListingId(null);
    setTitle('');
    setDescription('');
    setCategory('general');
    setListingType('product');
    setPriceAmount('');
    setPriceCurrency('USD');
    setPricingUnit('fixed');
    setCondition('good');
    setLocation('');
    setImageUrlsText('');
    setStatus('published');
    setFormModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(item: MarketplaceListingItem) {
    setEditingListingId(item.id);
    setTitle(item.title);
    setDescription(item.description || '');
    setCategory(item.category);
    setListingType(item.listing_type);
    setPriceAmount(item.price_amount !== null ? String(item.price_amount) : '');
    setPriceCurrency(item.price_currency || 'USD');
    setPricingUnit(item.pricing_unit);
    setCondition((item.condition as typeof condition) || 'not_applicable');
    setLocation(item.location || '');
    setImageUrlsText((item.image_urls || []).join('\n'));
    setStatus(
      item.status === 'draft' || item.status === 'reserved' || item.status === 'sold'
        ? item.status
        : 'published'
    );
    setFormModalOpen(true);
  }

  function handleCloseFormModal() {
    setFormModalOpen(false);
    setEditingListingId(null);
    setError(null);
  }

  // Save Listing (Create or Update)
  async function handleSaveListing(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const isEdit = Boolean(editingListingId);
      const url = `/api/circles/${circleId}/marketplace`;
      const method = isEdit ? 'PATCH' : 'POST';

      const parsedImages = imageUrlsText
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

      const payload = {
        ...(isEdit ? { listingId: editingListingId } : {}),
        listingType,
        category,
        title,
        description,
        priceAmount: priceAmount ? Number(priceAmount) : null,
        priceCurrency: priceCurrency.toUpperCase(),
        pricingUnit,
        condition: listingType === 'product' || listingType === 'rental' ? condition : null,
        location: location.trim() ? location.trim() : null,
        imageUrls: parsedImages,
        status,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'publish'} listing.`);
      }

      if (isEdit) {
        setListings((prev) =>
          prev.map((l) => (l.id === editingListingId ? data.listing : l))
        );
      } else {
        setListings((prev) => [data.listing, ...prev]);
      }
      handleCloseFormModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save listing.');
    } finally {
      setLoading(false);
    }
  }

  // Quick Status Update (e.g. Mark Reserved, Mark Sold)
  async function handleQuickStatusUpdate(
    listingId: string,
    newStatus: 'published' | 'reserved' | 'sold' | 'archived'
  ) {
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status.');
      setListings((prev) => prev.map((l) => (l.id === listingId ? data.listing : l)));
      if (selectedListing?.id === listingId) {
        setSelectedListing(data.listing);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update listing status.');
    }
  }

  // Toggle Save / Bookmark
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
        if (selectedListing?.id === listingId) {
          setSelectedListing((prev) =>
            prev ? { ...prev, viewer_has_saved: data.saved } : null
          );
        }
      }
    } catch {
      // Ignore
    }
  }

  // Open Inquiry Modal
  function handleOpenInquiry(item: MarketplaceListingItem) {
    setInquiryListing(item);
    setInquiryMessage('');
  }

  // Send Inquiry
  async function handleSendInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiryListing || !inquiryMessage.trim()) return;
    setSendingInquiry(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'inquiry',
          listingId: inquiryListing.id,
          message: inquiryMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send inquiry.');
      setInquiries((prev) => [data.inquiry, ...prev]);
      setInquiryListing(null);
      setInquiryMessage('');
      alert('Your inquiry was sent to the seller.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send inquiry.');
    } finally {
      setSendingInquiry(false);
    }
  }

  // Open Booking Modal
  function handleOpenBooking(item: MarketplaceListingItem) {
    setBookingListing(item);
    setBookingType(item.listing_type === 'rental' ? 'rental' : 'service');
    const now = Date.now();
    setBookingStartsAt(new Date(now + 86400_000).toISOString().slice(0, 16));
    setBookingEndsAt(new Date(now + 93600_000).toISOString().slice(0, 16));
    setBookingNotes('');
  }

  // Submit Booking Request
  async function handleSendBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingListing) return;
    setSubmittingBooking(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'booking',
          listingId: bookingListing.id,
          bookingType,
          startsAt: new Date(bookingStartsAt).toISOString(),
          endsAt: new Date(bookingEndsAt).toISOString(),
          notes: bookingNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit booking request.');
      setBookings((prev) => [data.booking, ...prev]);
      setBookingListing(null);
      alert('Booking request submitted. The provider will be notified.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to schedule booking.');
    } finally {
      setSubmittingBooking(false);
    }
  }

  // Respond to Inquiry (Seller)
  async function handleRespondInquiry(
    inquiryId: string,
    nextStatus: 'responded' | 'accepted' | 'declined' | 'closed'
  ) {
    const responseText = inquiryReplyText[inquiryId]?.trim() || '';
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond_inquiry',
          inquiryId,
          status: nextStatus,
          sellerResponse: responseText || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update inquiry.');
      setInquiries((prev) => prev.map((inq) => (inq.id === inquiryId ? data.inquiry : inq)));
      setInquiryReplyText((prev) => {
        const next = { ...prev };
        delete next[inquiryId];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to respond to inquiry.');
    }
  }

  // Update Booking Status (Provider)
  async function handleUpdateBookingStatus(
    bookingId: string,
    nextStatus: 'approved' | 'rejected' | 'cancelled' | 'completed' | 'returned',
    providerNote?: string
  ) {
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_booking',
          bookingId,
          status: nextStatus,
          providerNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update booking status.');
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? data.booking : b)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Booking update failed.');
    }
  }

  // Filter & Sort Listings
  const visibleListings = useMemo(() => {
    let list = [...listings];

    // Saved tab filter
    if (activeTab === 'saved') {
      list = list.filter((l) => l.viewer_has_saved);
    }

    // Type filter
    if (filterType !== 'all') {
      list = list.filter((l) => l.listing_type === filterType);
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((l) => l.status === statusFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          (l.location || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortBy === 'price_asc') {
      list.sort((a, b) => (a.price_amount ?? 0) - (b.price_amount ?? 0));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (b.price_amount ?? 0) - (a.price_amount ?? 0));
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return list;
  }, [listings, activeTab, filterType, statusFilter, searchQuery, sortBy]);

  // Activity Filtered List
  const filteredInquiries = useMemo(() => {
    if (activityRoleFilter === 'received') {
      return inquiries.filter((inq) => inq.seller_id === currentUserId);
    }
    if (activityRoleFilter === 'sent') {
      return inquiries.filter((inq) => inq.buyer_id === currentUserId);
    }
    return inquiries;
  }, [inquiries, activityRoleFilter, currentUserId]);

  const filteredBookings = useMemo(() => {
    if (activityRoleFilter === 'received') {
      return bookings.filter((b) => b.provider_id === currentUserId);
    }
    if (activityRoleFilter === 'sent') {
      return bookings.filter((b) => b.requester_id === currentUserId);
    }
    return bookings;
  }, [bookings, activityRoleFilter, currentUserId]);

  const totalActivityCount = inquiries.length + bookings.length;

  return (
    <div className="space-y-6">
      {/* Platform Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-stone-900">
              Listings & Marketplace
            </h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-emerald-800 border border-emerald-200">
              {listings.length} LISTINGS
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Peer-to-peer commerce, tool & equipment rentals, appointments, and vetted housing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isMember && (
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>New Listing</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'browse'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
            }`}
          >
            Browse Listings
          </button>
          {isMember && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'saved'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
              }`}
            >
              <Bookmark className="h-3 w-3" />
              <span>Saved Items</span>
            </button>
          )}
          {isMember && (
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'activity'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
              }`}
            >
              <Inbox className="h-3 w-3" />
              <span>My Requests & Inquiries</span>
              {totalActivityCount > 0 && (
                <span className="rounded-full bg-emerald-700 px-1.5 py-0.2 text-[10px] font-mono text-white">
                  {totalActivityCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Search Bar & Sorter (Only when in browse / saved mode) */}
        {activeTab !== 'activity' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search listings, categories, locations..."
                className="w-48 sm:w-64 rounded-xl border border-stone-200 bg-white pl-8 pr-3 py-1 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-stone-400 ml-1" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 font-medium focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Format Filter Pills (When browsing) */}
      {activeTab !== 'activity' && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'all', label: 'All Listings' },
              { key: 'product', label: 'Products & Goods' },
              { key: 'service', label: 'Services & Tutoring' },
              { key: 'rental', label: 'Tool & Equipment Lending' },
              { key: 'housing', label: 'Housing & Sublets' },
              { key: 'directory', label: 'Directory' },
            ].map((tab) => {
              const active = filterType === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterType(tab.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    active
                      ? 'bg-stone-200 text-stone-900 font-bold'
                      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700 font-medium focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="all">All Statuses</option>
              <option value="published">Available Only</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold / Completed</option>
            </select>
          </div>
        </div>
      )}

      {/* TAB 1 & 2: LISTINGS GRID */}
      {activeTab !== 'activity' && (
        <>
          {visibleListings.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
              <ShoppingBag className="mx-auto h-8 w-8 text-stone-400" />
              <h3 className="mt-3 text-base font-bold text-stone-900">No Listings Found</h3>
              <p className="mt-1 text-xs text-stone-500">
                {activeTab === 'saved'
                  ? 'You have not saved any marketplace listings yet.'
                  : 'There are no active listings matching your filters.'}
              </p>
              {isMember && activeTab === 'browse' && (
                <Button size="sm" onClick={handleOpenCreate} className="mt-4">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Publish the First Listing
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleListings.map((item) => {
                const isSeller = currentUserId === item.seller_id;
                const canManage = isSeller || isStaff;
                const hasImage = item.image_urls && item.image_urls.length > 0;

                return (
                  <div
                    key={item.id}
                    className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-stone-400 hover:shadow-premium-hover transition-all duration-200 space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Image Thumbnail Preview (if present) */}
                      {hasImage && (
                        <div className="relative h-40 w-full overflow-hidden rounded-xl bg-stone-100 border border-stone-200/80">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image_urls[0]}
                            alt={item.title}
                            className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-300"
                          />
                          {item.image_urls.length > 1 && (
                            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white backdrop-blur-xs">
                              +{item.image_urls.length - 1} photos
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-900 border border-emerald-200">
                            {item.listing_type}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 font-mono">
                            <Tag className="h-3 w-3" />
                            {item.category}
                          </span>
                        </div>

                        {item.condition && item.condition !== 'not_applicable' && (
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-mono text-stone-600 border border-stone-200/60 uppercase">
                            {item.condition.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      {/* Title & Price */}
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3
                            onClick={() => setSelectedListing(item)}
                            className="text-base font-bold text-stone-900 group-hover:text-emerald-950 transition-colors cursor-pointer truncate"
                            title={item.title}
                          >
                            {item.title}
                          </h3>
                          <span className="text-sm font-black text-stone-900 font-mono shrink-0">
                            {item.pricing_unit === 'free'
                              ? 'FREE'
                              : item.price_amount !== null
                              ? `${item.price_currency} ${item.price_amount.toFixed(2)}${
                                  item.pricing_unit === 'hourly'
                                    ? '/hr'
                                    : item.pricing_unit === 'daily'
                                    ? '/day'
                                    : item.pricing_unit === 'monthly'
                                    ? '/mo'
                                    : ''
                                }`
                              : item.pricing_unit}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed font-normal">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer & Actions */}
                    <div className="space-y-3 border-t border-stone-100 pt-3">
                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <div className="flex items-center gap-1.5 truncate">
                          {item.seller?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.seller.avatar_url}
                              alt=""
                              className="h-4 w-4 rounded-full object-cover"
                            />
                          ) : (
                            <User className="h-3.5 w-3.5 text-stone-400" />
                          )}
                          <span className="truncate">{item.seller?.display_name || 'Member'}</span>
                        </div>

                        {item.location && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-stone-400 shrink-0">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[110px]">{item.location}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        {/* Status badge if not active */}
                        <div>
                          {item.status === 'reserved' && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 border border-amber-200">
                              RESERVED
                            </span>
                          )}
                          {item.status === 'sold' && (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-bold text-stone-600 border border-stone-200">
                              SOLD
                            </span>
                          )}
                          {item.status === 'published' && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setSelectedListing(item)}
                              className="text-stone-500 hover:text-stone-900 px-1"
                            >
                              Details
                            </Button>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {isMember && (
                            <Button
                              size="xs"
                              variant={item.viewer_has_saved ? 'secondary' : 'outline'}
                              onClick={() => handleToggleSave(item.id)}
                              title={item.viewer_has_saved ? 'Remove bookmark' : 'Bookmark listing'}
                            >
                              <Bookmark
                                className={`h-3 w-3 ${item.viewer_has_saved ? 'fill-current' : ''}`}
                              />
                            </Button>
                          )}

                          {!isSeller && isMember && item.status === 'published' && (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleOpenInquiry(item)}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                <span>Inquire</span>
                              </Button>

                              {(item.listing_type === 'service' ||
                                item.listing_type === 'rental') && (
                                <Button size="xs" onClick={() => handleOpenBooking(item)}>
                                  <Calendar className="h-3 w-3 mr-1" />
                                  <span>{item.listing_type === 'rental' ? 'Borrow' : 'Book'}</span>
                                </Button>
                              )}
                            </>
                          )}

                          {canManage && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => handleOpenEdit(item)}
                              title="Edit Listing"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 3: ACTIVITY DASHBOARD (INQUIRIES & BOOKINGS) */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          {/* Subfilter */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h3 className="text-sm font-bold text-stone-900 uppercase font-mono tracking-wider">
              Messages & Reservation Requests
            </h3>
            <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-0.5 text-xs">
              {(['all', 'received', 'sent'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActivityRoleFilter(mode)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${
                    activityRoleFilter === mode
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {mode === 'all'
                    ? 'All Requests'
                    : mode === 'received'
                    ? 'As Seller/Provider'
                    : 'Sent by Me'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Column 1: Inquiries & Messages */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-800" />
                  <h4 className="text-sm font-bold text-stone-900">
                    Listing Inquiries ({filteredInquiries.length})
                  </h4>
                </div>
              </div>

              {filteredInquiries.length === 0 ? (
                <p className="text-xs text-stone-400 py-6 text-center">No inquiries found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredInquiries.map((inq) => {
                    const isSeller = inq.seller_id === currentUserId;
                    const canReply = isSeller && inq.status === 'open';

                    return (
                      <div
                        key={inq.id}
                        className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-stone-900 truncate">
                            {inq.listing_title || 'Marketplace Item'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                              inq.status === 'open'
                                ? 'bg-amber-100 text-amber-900'
                                : inq.status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-900'
                                : inq.status === 'declined'
                                ? 'bg-red-100 text-red-900'
                                : 'bg-stone-200 text-stone-800'
                            }`}
                          >
                            {inq.status}
                          </span>
                        </div>

                        <div className="text-xs text-stone-700 bg-white rounded-lg p-2.5 border border-stone-200/60">
                          <div className="text-[10px] text-stone-400 mb-1 font-mono">
                            From @{inq.buyer?.username || 'member'} ·{' '}
                            {new Date(inq.created_at).toLocaleDateString()}
                          </div>
                          <p className="leading-relaxed">{inq.message}</p>
                        </div>

                        {inq.seller_response && (
                          <div className="text-xs text-emerald-950 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200/80">
                            <div className="text-[10px] text-emerald-700 mb-1 font-mono">
                              Seller Reply:
                            </div>
                            <p className="leading-relaxed">{inq.seller_response}</p>
                          </div>
                        )}

                        {canReply && (
                          <div className="space-y-2 pt-1 border-t border-stone-200/60">
                            <textarea
                              rows={2}
                              value={inquiryReplyText[inq.id] || ''}
                              onChange={(e) =>
                                setInquiryReplyText((prev) => ({
                                  ...prev,
                                  [inq.id]: e.target.value,
                                }))
                              }
                              placeholder="Type response to buyer (meeting spot, answer)..."
                              className="w-full rounded-lg border border-stone-200 bg-white p-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                            />
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleRespondInquiry(inq.id, 'declined')}
                              >
                                Decline
                              </Button>
                              <Button
                                size="xs"
                                onClick={() => handleRespondInquiry(inq.id, 'accepted')}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Reply & Accept
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column 2: Bookings & Tool Rentals */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-800" />
                  <h4 className="text-sm font-bold text-stone-900">
                    Appointments & Rentals ({filteredBookings.length})
                  </h4>
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <p className="text-xs text-stone-400 py-6 text-center">
                  No booking or rental requests found.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((b) => {
                    const isProvider = b.provider_id === currentUserId;
                    const canReview = isProvider && b.status === 'pending';
                    const isApprovedRental = isProvider && b.status === 'approved' && b.booking_type === 'rental';

                    return (
                      <div
                        key={b.id}
                        className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase text-stone-800">
                              {b.booking_type}
                            </span>
                            <span className="font-bold text-stone-900 truncate">
                              {b.listing_title || 'Listing'}
                            </span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${
                              b.status === 'pending'
                                ? 'bg-amber-100 text-amber-900'
                                : b.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-900'
                                : b.status === 'returned' || b.status === 'completed'
                                ? 'bg-stone-200 text-stone-800'
                                : 'bg-red-100 text-red-900'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>

                        <div className="text-xs text-stone-700 bg-white rounded-lg p-2.5 border border-stone-200/60 space-y-1">
                          <div className="flex items-center gap-1.5 font-medium text-stone-800">
                            <Clock className="h-3.5 w-3.5 text-stone-400" />
                            <span>
                              {new Date(b.starts_at).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}{' '}
                              –{' '}
                              {new Date(b.ends_at).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono">
                            Requester: @{b.requester?.username || 'member'}
                          </div>
                          {b.notes && (
                            <p className="text-xs text-stone-600 pt-1 font-normal italic">
                              &ldquo;{b.notes}&rdquo;
                            </p>
                          )}
                        </div>

                        {canReview && (
                          <div className="flex justify-end gap-1.5 pt-1 border-t border-stone-200/60">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleUpdateBookingStatus(b.id, 'rejected')}
                            >
                              Decline
                            </Button>
                            <Button
                              size="xs"
                              onClick={() => handleUpdateBookingStatus(b.id, 'approved')}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve Request
                            </Button>
                          </div>
                        )}

                        {isApprovedRental && (
                          <div className="flex justify-end pt-1 border-t border-stone-200/60">
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => handleUpdateBookingStatus(b.id, 'returned')}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-700" />
                              Mark Tool / Item Returned
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT LISTING */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  {editingListingId ? 'Edit Listing Details' : 'Create Community Listing'}
                </h3>
                <p className="text-xs text-stone-500">
                  Publish goods for sale, tool library loans, service appointments, or housing.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseFormModal}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveListing} className="space-y-4">
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
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="product">Product for Sale / Trade</option>
                    <option value="service">Service & Tutoring</option>
                    <option value="rental">Tool / Equipment Lending</option>
                    <option value="housing">Housing / Roommate</option>
                    <option value="directory">Directory Recommendation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Category *
                  </label>
                  <input
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="books, electronics, tools, math..."
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Price & Pricing Unit
                  </label>
                  <div className="mt-1.5 flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-2.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
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
                      className="w-1/2 rounded-xl border border-stone-200 bg-stone-50/60 px-2 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
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

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Title *
                  </label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. DeWalt Cordless Drill Kit (Tool Library)"
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                {(listingType === 'product' || listingType === 'rental') && (
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) =>
                        setCondition(
                          e.target.value as 'new' | 'like_new' | 'good' | 'fair' | 'not_applicable'
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                    >
                      <option value="new">Brand New</option>
                      <option value="like_new">Like New</option>
                      <option value="good">Good Condition</option>
                      <option value="fair">Fair / Functional</option>
                      <option value="not_applicable">N/A</option>
                    </select>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Meetup Location / Pickup Spot
                  </label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Science Library Room 102 or Student Union"
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Listing Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as 'published' | 'draft' | 'reserved' | 'sold'
                      )
                    }
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  >
                    <option value="published">Active / Published</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold / Completed</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Photo URLs (One per line)
                  </label>
                  <textarea
                    rows={2}
                    value={imageUrlsText}
                    onChange={(e) => setImageUrlsText(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-xyz&#10;https://example.com/item.jpg"
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs font-mono text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Description, Terms & Return Conditions
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detail item specifications, inclusions, rental terms, contact hours..."
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <Button type="button" variant="ghost" size="sm" onClick={handleCloseFormModal}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading
                    ? 'Saving...'
                    : editingListingId
                    ? 'Update Listing'
                    : 'Publish Listing'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAILED VIEW MODAL */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-900 border border-emerald-200">
                  {selectedListing.listing_type}
                </span>
                <span className="text-xs font-mono text-stone-500">
                  #{selectedListing.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Photos Carousel/Gallery */}
            {selectedListing.image_urls && selectedListing.image_urls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedListing.image_urls.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="h-48 w-full shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt={selectedListing.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-xl font-bold text-stone-900">{selectedListing.title}</h3>
                <span className="text-lg font-black text-stone-900 font-mono shrink-0">
                  {selectedListing.pricing_unit === 'free'
                    ? 'FREE'
                    : selectedListing.price_amount !== null
                    ? `${selectedListing.price_currency} ${selectedListing.price_amount.toFixed(2)} (${selectedListing.pricing_unit})`
                    : selectedListing.pricing_unit}
                </span>
              </div>

              {selectedListing.location && (
                <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-stone-400" />
                  <span>{selectedListing.location}</span>
                </div>
              )}
            </div>

            {selectedListing.description && (
              <div className="rounded-xl bg-stone-50 p-4 border border-stone-200/80 text-xs text-stone-700 leading-relaxed whitespace-pre-line">
                {selectedListing.description}
              </div>
            )}

            {/* Seller profile card */}
            <div className="flex items-center justify-between rounded-xl border border-stone-200/80 p-3 bg-stone-50/50">
              <div className="flex items-center gap-2.5">
                {selectedListing.seller?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedListing.seller.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover border border-stone-200"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center border border-emerald-200">
                    {(selectedListing.seller?.display_name || 'M')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    {selectedListing.seller?.display_name || 'Member'}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    @{selectedListing.seller?.username || 'member'} · Listing Author
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isMember && (
                  <Button
                    size="sm"
                    variant={selectedListing.viewer_has_saved ? 'secondary' : 'outline'}
                    onClick={() => handleToggleSave(selectedListing.id)}
                  >
                    <Bookmark
                      className={`h-3.5 w-3.5 mr-1 ${
                        selectedListing.viewer_has_saved ? 'fill-current' : ''
                      }`}
                    />
                    <span>{selectedListing.viewer_has_saved ? 'Saved' : 'Save'}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              {currentUserId === selectedListing.seller_id || isStaff ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const item = selectedListing;
                      setSelectedListing(null);
                      handleOpenEdit(item);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                    <span>Edit</span>
                  </Button>
                  {selectedListing.status === 'published' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleQuickStatusUpdate(selectedListing.id, 'reserved')}
                    >
                      Mark Reserved
                    </Button>
                  )}
                  {selectedListing.status === 'reserved' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleQuickStatusUpdate(selectedListing.id, 'sold')}
                    >
                      Mark Sold
                    </Button>
                  )}
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                {currentUserId !== selectedListing.seller_id && isMember && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const item = selectedListing;
                        setSelectedListing(null);
                        handleOpenInquiry(item);
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      <span>Inquire</span>
                    </Button>

                    {(selectedListing.listing_type === 'service' ||
                      selectedListing.listing_type === 'rental') && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const item = selectedListing;
                          setSelectedListing(null);
                          handleOpenBooking(item);
                        }}
                      >
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        <span>
                          {selectedListing.listing_type === 'rental'
                            ? 'Request Rental'
                            : 'Book Appointment'}
                        </span>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: INQUIRY MODAL */}
      {inquiryListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Contact Seller</h3>
                <p className="text-xs text-stone-500">
                  Inquiry on &ldquo;{inquiryListing.title}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInquiryListing(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendInquiry} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                  Your Message to {inquiryListing.seller?.display_name || 'Seller'} *
                </label>
                <textarea
                  required
                  rows={4}
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="Hi! Is this still available? Can we arrange pickup on campus this week?"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  The seller will receive a notification and can reply to your inquiry.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInquiryListing(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={sendingInquiry}>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {sendingInquiry ? 'Sending...' : 'Send Inquiry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BOOKING / RENTAL MODAL */}
      {bookingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Schedule {bookingType === 'rental' ? 'Equipment Lending' : 'Appointment'}
                </h3>
                <p className="text-xs text-stone-500">&ldquo;{bookingListing.title}&rdquo;</p>
              </div>
              <button
                type="button"
                onClick={() => setBookingListing(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendBooking} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Starts At *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={bookingStartsAt}
                    onChange={(e) => setBookingStartsAt(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                    Ends At *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={bookingEndsAt}
                    onChange={(e) => setBookingEndsAt(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 p-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                  Reservation Notes & Terms Agreement
                </label>
                <textarea
                  rows={3}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="e.g. Need this for the robotics hackathon. Will return fully charged by Sunday noon."
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Time conflicts are prevented at the database level. The provider will review your
                  request.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBookingListing(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submittingBooking}>
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  {submittingBooking ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
