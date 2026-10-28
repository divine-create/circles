'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Home,
  MapPin,
  MessageSquare,
  Pin,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  User,
  Users,
  Vote,
} from 'lucide-react';
import {
  Circle,
  CircleEventItem,
  MarketplaceListingItem,
} from '@/types/domain';
import { ActivityStreamItem } from '@/features/circles/activity-stream';
import { Button } from '@/components/ui/button';
import { DirectMessageDrawer } from '@/components/messages/direct-message-drawer';

export interface CommunityActivityStreamProps {
  circle: Circle;
  initialItems: ActivityStreamItem[];
  upcomingEvents: CircleEventItem[];
  featuredListings: MarketplaceListingItem[];
  enabledCapabilityKeys: string[];
  currentUserId?: string | null;
  isMember: boolean;
}

export function CommunityActivityStream({
  circle,
  initialItems,
  upcomingEvents,
  featuredListings,
  enabledCapabilityKeys,
  currentUserId,
  isMember,
}: CommunityActivityStreamProps) {
  const [items] = useState<ActivityStreamItem[]>(initialItems);
  const [activeFilter, setActiveFilter] = useState<'all' | 'posts' | 'marketplace' | 'events' | 'polls'>('all');
  const [dmDrawerOpen, setDmDrawerOpen] = useState(false);
  const [activeDmConvoId, setActiveDmConvoId] = useState<string | null>(null);

  // Poll voting state
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [votingLoading, setVotingLoading] = useState<Record<string, boolean>>({});

  // RSVP state
  const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, string>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({});

  // Filter items
  const visibleItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    if (activeFilter === 'posts') return items.filter((i) => i.itemType === 'post');
    if (activeFilter === 'marketplace') return items.filter((i) => i.itemType === 'listing');
    if (activeFilter === 'events') return items.filter((i) => i.itemType === 'event');
    if (activeFilter === 'polls') return items.filter((i) => i.itemType === 'poll');
    return items;
  }, [items, activeFilter]);

  // Handle direct inquiry on a listing
  async function handleInquireListing(listing: MarketplaceListingItem) {
    if (!currentUserId || !isMember) return;
    if (listing.seller_id === currentUserId) return;

    try {
      const res = await fetch(`/api/circles/${circle.id}/messages/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: listing.seller_id,
          listingId: listing.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDmConvoId(data.conversation.id);
        setDmDrawerOpen(true);
      }
    } catch (err) {
      console.error('Failed to start listing inquiry conversation:', err);
    }
  }

  // Handle poll vote
  async function handleVotePoll(pollId: string, optionId: string) {
    if (!currentUserId || !isMember) return;
    setVotingLoading((prev) => ({ ...prev, [pollId]: true }));
    try {
      const res = await fetch(`/api/circles/${circle.id}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          pollId,
          optionId,
        }),
      });
      if (res.ok) {
        setVotedPolls((prev) => ({ ...prev, [pollId]: optionId }));
      }
    } catch (err) {
      console.error('Failed to vote in poll:', err);
    } finally {
      setVotingLoading((prev) => ({ ...prev, [pollId]: false }));
    }
  }

  // Handle event RSVP
  async function handleRsvp(eventId: string, status: 'going' | 'interested' | 'declined') {
    if (!currentUserId || !isMember) return;
    setRsvpLoading((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch(`/api/circles/${circle.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rsvp',
          eventId,
          status,
        }),
      });
      if (res.ok) {
        setRsvpStatuses((prev) => ({ ...prev, [eventId]: status }));
      }
    } catch (err) {
      console.error('Failed to RSVP:', err);
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Center Activity Stream (8 cols) */}
      <div className="space-y-6 lg:col-span-8">
        {/* Stream Filter Pills & Header */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'all', label: 'All Activity', icon: Sparkles },
              { key: 'posts', label: 'Discussions', icon: MessageSquare },
              { key: 'marketplace', label: 'Goods & Housing', icon: ShoppingBag },
              { key: 'events', label: 'Events & Meetups', icon: Calendar },
              { key: 'polls', label: 'Polls & Votes', icon: Vote },
            ].map((tab) => {
              const active = activeFilter === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key as typeof activeFilter)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-400' : 'text-stone-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {isMember && (
            <Link
              href={`/circles/${circle.slug}/discussions`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Post</span>
            </Link>
          )}
        </div>

        {/* Polymorphic Stream Feed */}
        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
            <Flame className="mx-auto h-8 w-8 text-stone-300" />
            <h3 className="mt-3 text-base font-bold text-stone-900">No Stream Activity Yet</h3>
            <p className="mt-1 text-xs text-stone-500">
              Be the first to share an update, publish a listing, or schedule a gathering!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <StreamCard
                key={item.id}
                item={item}
                circle={circle}
                currentUserId={currentUserId}
                isMember={isMember}
                onInquire={handleInquireListing}
                onVote={handleVotePoll}
                votedOption={votedPolls[item.data.id]}
                votingLoading={votingLoading[item.data.id]}
                onRsvp={handleRsvp}
                rsvpStatus={rsvpStatuses[item.data.id]}
                rsvpLoading={rsvpLoading[item.data.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right-Rail Widgets: Community Pulse & Highlights (4 cols) */}
      <div className="space-y-6 lg:col-span-4">
        {/* Widget 1: Upcoming Events Spotlight */}
        {enabledCapabilityKeys.includes('events') && (
          <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-800" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                  Upcoming Events
                </h3>
              </div>
              <Link
                href={`/circles/${circle.slug}/events`}
                className="text-[11px] font-semibold text-emerald-800 hover:underline"
              >
                All Events →
              </Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-stone-400 py-3 text-center">No upcoming events scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((evt) => {
                  const date = new Date(evt.starts_at);
                  return (
                    <div
                      key={evt.id}
                      className="flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 transition-all hover:bg-stone-50 hover:border-stone-200"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-900 text-white shadow-2xs">
                        <span className="text-[9px] font-mono font-bold uppercase leading-none">
                          {date.toLocaleString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-xs font-black leading-none mt-0.5">
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-stone-900 truncate">
                          {evt.title}
                        </h4>
                        <p className="mt-0.5 text-[10px] text-stone-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-stone-400" />
                          <span>
                            {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Widget 2: Marketplace & Housing Spotlight */}
        {(enabledCapabilityKeys.includes('marketplace') || enabledCapabilityKeys.includes('listings_discovery')) && (
          <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-emerald-800" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                  Market & Housing
                </h3>
              </div>
              <Link
                href={`/circles/${circle.slug}/marketplace`}
                className="text-[11px] font-semibold text-emerald-800 hover:underline"
              >
                Explore Market →
              </Link>
            </div>

            {featuredListings.length === 0 ? (
              <p className="text-xs text-stone-400 py-3 text-center">No active listings.</p>
            ) : (
              <div className="space-y-3">
                {featuredListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 transition-all hover:bg-stone-50 hover:border-stone-200"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-emerald-800 border border-emerald-200">
                          {listing.category}
                        </span>
                        {listing.listing_type === 'housing' && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-amber-800 border border-amber-200">
                            Housing
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-stone-900 truncate mt-1">
                        {listing.title}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black font-mono text-stone-900 block">
                        {listing.price_amount !== null
                          ? `$${Number(listing.price_amount).toFixed(2)}`
                          : 'Free / Trade'}
                      </span>
                      {isMember && listing.seller_id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleInquireListing(listing)}
                          className="mt-0.5 text-[10px] font-bold text-emerald-800 hover:underline"
                        >
                          Message
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Widget 3: Circle Vitals Card */}
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
            About {circle.name}
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            {circle.description}
          </p>

          <div className="border-t border-stone-100 pt-3 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-stone-50 p-2.5">
              <span className="text-base font-extrabold text-stone-900 block">
                {circle.member_count ?? 1}
              </span>
              <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                Members
              </span>
            </div>
            <div className="rounded-xl bg-stone-50 p-2.5">
              <span className="text-base font-extrabold text-stone-900 block">
                {enabledCapabilityKeys.length}
              </span>
              <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                Active Modules
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Direct Message Slide-Over Drawer */}
      <DirectMessageDrawer
        circleId={circle.id}
        isOpen={dmDrawerOpen}
        onClose={() => setDmDrawerOpen(false)}
        currentUserId={currentUserId}
        activeConversationId={activeDmConvoId}
        onSelectConversation={(id) => setActiveDmConvoId(id)}
      />
    </div>
  );
}

// -------------------------------------------------------------
// POLYMORPHIC STREAM CARD COMPONENT
// -------------------------------------------------------------
interface StreamCardProps {
  item: ActivityStreamItem;
  circle: Circle;
  currentUserId?: string | null;
  isMember: boolean;
  onInquire: (listing: MarketplaceListingItem) => void;
  onVote: (pollId: string, optionId: string) => void;
  votedOption?: string;
  votingLoading?: boolean;
  onRsvp: (eventId: string, status: 'going' | 'interested' | 'declined') => void;
  rsvpStatus?: string;
  rsvpLoading?: boolean;
}

function StreamCard({
  item,
  circle,
  currentUserId,
  isMember,
  onInquire,
  onVote,
  votedOption,
  votingLoading,
  onRsvp,
  rsvpStatus,
  rsvpLoading,
}: StreamCardProps) {
  const formattedTime = new Date(item.timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // CARD A: DISCUSSION POST
  if (item.itemType === 'post') {
    const post = item.data;
    return (
      <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3.5 transition-all hover:border-stone-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-700 font-bold text-xs">
              {post.author?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={post.author.avatar_url}
                  alt={post.author.display_name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <User className="h-4 w-4 text-stone-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900">
                  {post.author?.display_name || 'Member'}
                </span>
                {post.space?.name && (
                  <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[10px] font-mono font-medium text-stone-600">
                    #{post.space.name}
                  </span>
                )}
                {post.is_pinned && (
                  <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 border border-amber-200">
                    <Pin className="h-2.5 w-2.5" /> Pinned
                  </span>
                )}
              </div>
              <span className="text-[10px] text-stone-400">{formattedTime}</span>
            </div>
          </div>

          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-blue-800 border border-blue-200">
            Discussion
          </span>
        </div>

        <div>
          <h3 className="text-sm font-bold text-stone-900">{post.title}</h3>
          <p className="mt-1 text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">
            {post.body}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-500">
          <Link
            href={`/circles/${circle.slug}/discussions/${post.id}`}
            className="flex items-center gap-1.5 font-medium hover:text-stone-900"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{post.comment_count ?? 0} Comments</span>
          </Link>
          <Link
            href={`/circles/${circle.slug}/discussions/${post.id}`}
            className="text-[11px] font-semibold text-stone-700 hover:underline"
          >
            View Thread →
          </Link>
        </div>
      </article>
    );
  }

  // CARD B: MARKETPLACE & HOUSING LISTING
  if (item.itemType === 'listing') {
    const listing = item.data;
    const isHousing = listing.listing_type === 'housing';
    const isRental = listing.listing_type === 'rental';
    const isService = listing.listing_type === 'service';

    return (
      <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3.5 transition-all hover:border-stone-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              {isHousing ? <Home className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-900">
                  {listing.seller?.display_name || 'Member'}
                </span>
                <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[10px] font-mono text-stone-600">
                  {listing.category}
                </span>
              </div>
              <span className="text-[10px] text-stone-400">{formattedTime}</span>
            </div>
          </div>

          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border ${
              isHousing
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : isRental
                ? 'bg-purple-50 text-purple-800 border-purple-200'
                : isService
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-stone-100 text-stone-800 border-stone-200'
            }`}
          >
            {isHousing ? 'Housing / Sublet' : isRental ? 'Equipment Rental' : isService ? 'Service' : 'Item for Sale'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="text-sm font-bold text-stone-900">{listing.title}</h3>
            <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
              {listing.description}
            </p>
            {listing.location && (
              <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 mt-1">
                <MapPin className="h-3 w-3 text-stone-400" />
                {listing.location}
              </span>
            )}
          </div>

          <div className="flex flex-col justify-between items-start sm:items-end shrink-0">
            <span className="text-base font-black font-mono text-stone-900">
              {listing.price_amount !== null
                ? `$${Number(listing.price_amount).toFixed(2)}`
                : 'Free'}
              {listing.pricing_unit && listing.pricing_unit !== 'fixed' && (
                <span className="text-xs font-normal text-stone-500">/{listing.pricing_unit}</span>
              )}
            </span>

            {isMember && listing.seller_id !== currentUserId && (
              <Button
                size="sm"
                onClick={() => onInquire(listing)}
                className="mt-2 bg-emerald-800 hover:bg-emerald-700 text-white shadow-2xs text-xs"
              >
                <Send className="h-3 w-3 mr-1" />
                <span>Message Seller</span>
              </Button>
            )}
          </div>
        </div>
      </article>
    );
  }

  // CARD C: COMMUNITY EVENT
  if (item.itemType === 'event') {
    const event = item.data;
    const date = new Date(event.starts_at);
    const isGoing = rsvpStatus === 'going';

    return (
      <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3.5 transition-all hover:border-stone-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-900 text-white shadow-2xs">
              <span className="text-[9px] font-mono font-bold uppercase leading-none">
                {date.toLocaleString('en-US', { month: 'short' })}
              </span>
              <span className="text-sm font-black leading-none mt-0.5">
                {date.getDate()}
              </span>
            </div>
            <div>
              <span className="text-xs font-bold text-stone-900">
                {event.organizer?.display_name || 'Community Gathering'}
              </span>
              <p className="text-[10px] text-stone-400">
                {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} • {event.location_type}
              </p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-emerald-800 border border-emerald-200">
            Event & Gathering
          </span>
        </div>

        <div>
          <h3 className="text-sm font-bold text-stone-900">{event.title}</h3>
          <p className="mt-1 text-xs text-stone-600 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
            <Users className="h-3.5 w-3.5 text-stone-400" />
            <span>
              {event.going_count ?? 0}
              {event.capacity ? ` / ${event.capacity}` : ''} attending
            </span>
          </div>

          {isMember && (
            <Button
              size="sm"
              variant={isGoing ? 'secondary' : 'primary'}
              disabled={rsvpLoading}
              onClick={() => onRsvp(event.id, isGoing ? 'declined' : 'going')}
              className={isGoing ? 'border-emerald-300 text-emerald-800 bg-emerald-50 text-xs' : 'text-xs'}
            >
              {isGoing ? (
                <>
                  <Check className="h-3 w-3 mr-1 text-emerald-700" />
                  <span>RSVP&apos;d Going</span>
                </>
              ) : (
                <span>RSVP to Attend</span>
              )}
            </Button>
          )}
        </div>
      </article>
    );
  }

  // CARD D: COMMUNITY POLL & VOTE
  if (item.itemType === 'poll') {
    const poll = item.data;
    const hasVoted = Boolean(votedOption);

    return (
      <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3.5 transition-all hover:border-stone-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-800">
              <Vote className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-stone-900">Community Poll</span>
              <p className="text-[10px] text-stone-400">{formattedTime}</p>
            </div>
          </div>

          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-purple-800 border border-purple-200">
            Decision / Poll
          </span>
        </div>

        <h3 className="text-sm font-bold text-stone-900">{poll.question}</h3>

        <div className="space-y-2 pt-1">
          {poll.options.map((opt) => {
            const isSelected = votedOption === opt.id || opt.viewer_voted;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={hasVoted || votingLoading || !isMember}
                onClick={() => onVote(poll.id, opt.id)}
                className={`w-full text-left rounded-xl p-3 border transition-all text-xs flex items-center justify-between ${
                  isSelected
                    ? 'border-purple-300 bg-purple-50 font-bold text-purple-900'
                    : 'border-stone-200 bg-stone-50/60 hover:bg-stone-100 text-stone-800'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-purple-700" />}
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
          <span>{poll.total_votes ?? 0} votes recorded</span>
          <span>Single-choice vote</span>
        </div>
      </article>
    );
  }

  return null;
}
