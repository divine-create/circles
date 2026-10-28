import { listCirclePosts } from '@/features/discussions/service';
import { listMarketplaceListings } from '@/features/marketplace/service';
import { listCircleEvents } from '@/features/events/service';
import { listCirclePolls } from '@/features/polls/service';
import {
  CircleEventItem,
  CirclePollItem,
  MarketplaceListingItem,
  PostItem,
} from '@/types/domain';

export type ActivityStreamItem =
  | {
      id: string;
      itemType: 'post';
      timestamp: string;
      data: PostItem;
    }
  | {
      id: string;
      itemType: 'listing';
      timestamp: string;
      data: MarketplaceListingItem;
    }
  | {
      id: string;
      itemType: 'event';
      timestamp: string;
      data: CircleEventItem;
    }
  | {
      id: string;
      itemType: 'poll';
      timestamp: string;
      data: CirclePollItem;
    };

export interface UnifiedStreamData {
  items: ActivityStreamItem[];
  upcomingEvents: CircleEventItem[];
  featuredListings: MarketplaceListingItem[];
  counts: {
    posts: number;
    listings: number;
    events: number;
    polls: number;
    all: number;
  };
}

/**
 * Aggregates posts, marketplace items (goods, services, rentals, housing), events,
 * and polls into a unified, chronological activity stream for the Circle Home.
 */
export async function getCircleActivityStream(
  actorUserId: string | null,
  circleId: string,
  enabledCapabilityKeys: string[]
): Promise<UnifiedStreamData> {
  const isEnabled = (key: string) => enabledCapabilityKeys.includes(key);

  const [postsRes, listingsRes, eventsRes, pollsRes] = await Promise.all([
    isEnabled('discussions')
      ? listCirclePosts(actorUserId, circleId, { limit: 20 }).catch(() => [])
      : Promise.resolve([]),
    isEnabled('marketplace') || isEnabled('listings_discovery') || isEnabled('rentals_sharing')
      ? listMarketplaceListings(actorUserId, circleId, { limit: 20 }).catch(() => [])
      : Promise.resolve([]),
    isEnabled('events') || isEnabled('events_activities')
      ? listCircleEvents(actorUserId, circleId).catch(() => [])
      : Promise.resolve([]),
    isEnabled('polls_decisions') || isEnabled('polls')
      ? listCirclePolls(actorUserId, circleId).catch(() => [])
      : Promise.resolve([]),
  ]);

  const streamItems: ActivityStreamItem[] = [];

  // 1. Add Discussion Posts
  for (const post of postsRes) {
    streamItems.push({
      id: `post-${post.id}`,
      itemType: 'post',
      timestamp: post.created_at,
      data: post,
    });
  }

  // 2. Add Marketplace & Housing Listings
  for (const listing of listingsRes) {
    streamItems.push({
      id: `listing-${listing.id}`,
      itemType: 'listing',
      timestamp: listing.created_at,
      data: listing,
    });
  }

  // 3. Add Events
  for (const event of eventsRes) {
    streamItems.push({
      id: `event-${event.id}`,
      itemType: 'event',
      timestamp: event.created_at,
      data: event,
    });
  }

  // 4. Add Polls
  for (const poll of pollsRes) {
    streamItems.push({
      id: `poll-${poll.id}`,
      itemType: 'poll',
      timestamp: poll.created_at,
      data: poll,
    });
  }

  // Sort chronological descending (newest activity first)
  streamItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter upcoming events for right-rail spotlight
  const now = Date.now();
  const upcomingEvents = eventsRes
    .filter((e) => new Date(e.starts_at).getTime() >= now - 3600_000)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 4);

  // Filter featured marketplace listings for right-rail spotlight
  const featuredListings = listingsRes
    .filter((l) => l.status === 'published')
    .slice(0, 4);

  return {
    items: streamItems,
    upcomingEvents,
    featuredListings,
    counts: {
      posts: postsRes.length,
      listings: listingsRes.length,
      events: eventsRes.length,
      polls: pollsRes.length,
      all: streamItems.length,
    },
  };
}
