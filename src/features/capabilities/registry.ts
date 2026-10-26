import { CapabilityDefinition } from '@/types/domain';
import { ValidationError } from '@/lib/errors';

export const CAPABILITY_REGISTRY: Record<string, CapabilityDefinition> = {
  discussions: {
    key: 'discussions',
    name: 'Discussions & Posts',
    description: 'Persistent community discussions, comments, reactions, and saved posts.',
    version: '1.0.0',
    category: 'community',
    default_enabled: true,
    release_stage: 'stable',
    dependencies: [],
    default_settings: {
      allowMemberPosts: true,
      allowReactions: true,
      moderationMode: 'post_publish',
    },
    required_permissions: ['discussions.read', 'discussions.post'],
    navigation_config: {
      label: 'Discussions',
      path: 'discussions',
      icon: 'message-square',
    },
  },
  spaces: {
    key: 'spaces',
    name: 'Spaces & Subgroups',
    description: 'Organize community participation into dedicated topical channels and spaces.',
    version: '1.0.0',
    category: 'community',
    default_enabled: true,
    release_stage: 'stable',
    dependencies: [],
    default_settings: {
      maxSpaces: 25,
      allowMemberDirectoryPerSpace: true,
    },
    required_permissions: ['spaces.read', 'spaces.manage'],
    navigation_config: {
      label: 'Spaces',
      path: 'spaces',
      icon: 'layout-grid',
    },
  },
  member_directory: {
    key: 'member_directory',
    name: 'Member Directory',
    description: 'Searchable directory of active Circle members, roles, and profiles.',
    version: '1.0.0',
    category: 'community',
    default_enabled: true,
    release_stage: 'stable',
    dependencies: [],
    default_settings: {
      showRoleBadges: true,
      showBio: true,
    },
    required_permissions: ['members.read'],
    navigation_config: {
      label: 'Members',
      path: 'members',
      icon: 'users',
    },
  },
  shared_resources: {
    key: 'shared_resources',
    name: 'Shared Resources',
    description: 'Curated knowledge links, guides, and reference materials for members.',
    version: '1.0.0',
    category: 'community',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['spaces'],
    default_settings: {
      allowMemberSubmissions: true,
    },
    required_permissions: ['resources.read'],
    navigation_config: {
      label: 'Resources',
      path: 'resources',
      icon: 'book-open',
    },
  },
  polls_decisions: {
    key: 'polls_decisions',
    name: 'Polls & Decisions',
    description: 'Structured community polls and proposal voting inside discussions.',
    version: '1.0.0',
    category: 'community',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['discussions'],
    default_settings: {
      allowAnonymousVotes: false,
    },
    required_permissions: ['discussions.post'],
    navigation_config: {
      label: 'Polls',
      path: 'polls',
      icon: 'bar-chart-2',
    },
  },
  governance_committees: {
    key: 'governance_committees',
    name: 'Governance & Committees',
    description: 'Working groups, bylaws, and committee leadership workflows.',
    version: '1.0.0',
    category: 'community',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['member_directory'],
    default_settings: {},
    required_permissions: ['governance.read'],
    navigation_config: {
      label: 'Governance',
      path: 'community?tab=governance',
      icon: 'shield',
    },
  },
  challenges_rewards: {
    key: 'challenges_rewards',
    name: 'Challenges & Rewards',
    description: 'Community milestones, streaks, and recognition badges.',
    version: '1.0.0',
    category: 'community',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['member_directory'],
    default_settings: {},
    required_permissions: ['challenges.read'],
    navigation_config: {
      label: 'Challenges',
      path: 'community?tab=challenges',
      icon: 'award',
    },
  },
  help_desk: {
    key: 'help_desk',
    name: 'Help Desk & Requests',
    description: 'Community support requests, Q&A triage, and mutual aid.',
    version: '1.0.0',
    category: 'community',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['discussions'],
    default_settings: {
      requireResolutionStatus: true,
    },
    required_permissions: ['discussions.post'],
    navigation_config: {
      label: 'Help Desk',
      path: 'community?tab=support',
      icon: 'life-buoy',
    },
  },
  events: {
    key: 'events',
    name: 'Events',
    description: 'Community calendars, in-person gatherings, and virtual sessions.',
    version: '1.0.0',
    category: 'events_activities',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['spaces'],
    default_settings: {
      allowMemberEvents: true,
    },
    required_permissions: ['events.read'],
    navigation_config: {
      label: 'Events',
      path: 'events',
      icon: 'calendar',
    },
  },
  rsvps: {
    key: 'rsvps',
    name: 'RSVPs',
    description: 'Event registration, capacity limits, and guest lists.',
    version: '1.0.0',
    category: 'events_activities',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['events'],
    default_settings: {
      enableWaitlist: true,
    },
    required_permissions: ['events.rsvp'],
    navigation_config: {
      label: 'RSVPs',
      path: 'events',
      icon: 'check-circle',
    },
  },
  attendance: {
    key: 'attendance',
    name: 'Attendance',
    description: 'Check-in tracking and participation verification for events.',
    version: '1.0.0',
    category: 'events_activities',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['rsvps'],
    default_settings: {},
    required_permissions: ['events.manage'],
    navigation_config: {
      label: 'Attendance',
      path: 'events',
      icon: 'user-check',
    },
  },
  activities_meetups: {
    key: 'activities_meetups',
    name: 'Activities & Meetups',
    description: 'Recurring casual meetups, study groups, and hobby sessions.',
    version: '1.0.0',
    category: 'events_activities',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['events'],
    default_settings: {},
    required_permissions: ['events.read'],
    navigation_config: {
      label: 'Meetups',
      path: 'events?type=meetup',
      icon: 'compass',
    },
  },
  marketplace: {
    key: 'marketplace',
    name: 'Marketplace',
    description: 'Peer-to-peer buying, selling, and community exchange spaces.',
    version: '1.0.0',
    category: 'commerce_discovery',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['spaces'],
    default_settings: {},
    required_permissions: ['marketplace.read'],
    navigation_config: {
      label: 'Marketplace',
      path: 'marketplace',
      icon: 'shopping-bag',
    },
  },
  listings_discovery: {
    key: 'listings_discovery',
    name: 'Listings & Discovery',
    description: 'Local directory of vetted community listings and recommendations.',
    version: '1.0.0',
    category: 'commerce_discovery',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['spaces'],
    default_settings: {},
    required_permissions: ['listings.read'],
    navigation_config: {
      label: 'Listings',
      path: 'marketplace?type=directory',
      icon: 'map-pin',
    },
  },
  services_bookings: {
    key: 'services_bookings',
    name: 'Services & Bookings',
    description: 'Local service providers, tutoring, and appointment requests.',
    version: '1.0.0',
    category: 'commerce_discovery',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['listings_discovery'],
    default_settings: {},
    required_permissions: ['services.read'],
    navigation_config: {
      label: 'Services',
      path: 'marketplace?type=service',
      icon: 'briefcase',
    },
  },
  rentals_sharing: {
    key: 'rentals_sharing',
    name: 'Rentals & Sharing',
    description: 'Tool libraries, equipment lending, and community resource sharing.',
    version: '1.0.0',
    category: 'commerce_discovery',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['listings_discovery'],
    default_settings: {},
    required_permissions: ['rentals.read'],
    navigation_config: {
      label: 'Rentals',
      path: 'marketplace?type=rental',
      icon: 'repeat',
    },
  },
  jobs_opportunities: {
    key: 'jobs_opportunities',
    name: 'Jobs & Opportunities',
    description: 'Career boards, internships, volunteer roles, and collaborations.',
    version: '1.0.0',
    category: 'commerce_discovery',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['spaces'],
    default_settings: {
      allowMemberJobPosts: true,
    },
    required_permissions: ['jobs.read'],
    navigation_config: {
      label: 'Opportunities',
      path: 'jobs',
      icon: 'briefcase',
    },
  },
  housing_property: {
    key: 'housing_property',
    name: 'Housing & Property',
    description: 'Roommate matching, sublets, and campus/neighbourhood housing.',
    version: '1.0.0',
    category: 'commerce_discovery',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['listings_discovery'],
    default_settings: {},
    required_permissions: ['housing.read'],
    navigation_config: {
      label: 'Housing',
      path: 'marketplace?type=housing',
      icon: 'home',
    },
  },
  learning_resources: {
    key: 'learning_resources',
    name: 'Learning & Resources',
    description: 'Structured cohorts, study modules, and curriculum discussions.',
    version: '1.0.0',
    category: 'knowledge_collaboration',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['spaces'],
    default_settings: {
      enableCohortSpaces: true,
    },
    required_permissions: ['learning.read'],
    navigation_config: {
      label: 'Learning',
      path: 'resources',
      icon: 'graduation-cap',
    },
  },
  projects_collaboration: {
    key: 'projects_collaboration',
    name: 'Projects & Collaboration',
    description: 'Team project updates, build logs, and milestone coordination.',
    version: '1.0.0',
    category: 'knowledge_collaboration',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['spaces'],
    default_settings: {
      enableBuildLogs: true,
    },
    required_permissions: ['projects.read'],
    navigation_config: {
      label: 'Projects',
      path: 'projects',
      icon: 'folder-kanban',
    },
  },
  media_publishing: {
    key: 'media_publishing',
    name: 'Media & Publishing',
    description: 'Long-form newsletters, podcasts, and community publications.',
    version: '1.0.0',
    category: 'knowledge_collaboration',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['discussions'],
    default_settings: {},
    required_permissions: ['media.read'],
    navigation_config: {
      label: 'Publishing',
      path: 'resources?type=media_publishing',
      icon: 'newspaper',
    },
  },
  fundraising_causes: {
    key: 'fundraising_causes',
    name: 'Fundraising & Causes',
    description: 'Community drives, non-profit pledges, and impact tracking.',
    version: '1.0.0',
    category: 'organization_finance',
    default_enabled: false,
    release_stage: 'stable',
    dependencies: ['member_directory'],
    default_settings: {},
    required_permissions: ['fundraising.read'],
    navigation_config: {
      label: 'Causes',
      path: 'community?tab=causes',
      icon: 'heart',
    },
  },
  payments_finances: {
    key: 'payments_finances',
    name: 'Payments & Finances',
    description: 'Membership dues and treasury reporting (requires payment architecture review).',
    version: '0.1.0',
    category: 'organization_finance',
    default_enabled: false,
    release_stage: 'planned',
    dependencies: ['member_directory'],
    default_settings: {},
    required_permissions: ['finance.manage'],
    navigation_config: {
      label: 'Finances',
      path: 'finances',
      icon: 'credit-card',
    },
  },
};

export function getAllCapabilityDefinitions(): CapabilityDefinition[] {
  return Object.values(CAPABILITY_REGISTRY);
}

export function getCapabilityDefinition(key: string): CapabilityDefinition {
  const def = CAPABILITY_REGISTRY[key];
  if (!def) {
    throw new ValidationError(`Unknown capability key: "${key}"`);
  }
  return def;
}

export function getDefaultEnabledCapabilityKeys(): string[] {
  return Object.values(CAPABILITY_REGISTRY)
    .filter((cap) => cap.default_enabled)
    .map((cap) => cap.key);
}

/**
 * Validates whether a capability can be enabled or disabled given the currently enabled set.
 */
export function validateCapabilityTransition(
  capabilityKey: string,
  targetEnabled: boolean,
  currentlyEnabledKeys: Set<string>
): { valid: boolean; reason?: string } {
  const def = getCapabilityDefinition(capabilityKey);

  if (targetEnabled) {
    for (const dep of def.dependencies) {
      if (!currentlyEnabledKeys.has(dep)) {
        const depDef = CAPABILITY_REGISTRY[dep];
        return {
          valid: false,
          reason: `Cannot enable "${def.name}" until its required dependency "${depDef?.name ?? dep}" is enabled.`,
        };
      }
    }
    return { valid: true };
  } else {
    // Check if any currently enabled capability depends on `capabilityKey`
    for (const enabledKey of currentlyEnabledKeys) {
      if (enabledKey === capabilityKey) continue;
      const enabledDef = CAPABILITY_REGISTRY[enabledKey];
      if (enabledDef && enabledDef.dependencies.includes(capabilityKey)) {
        return {
          valid: false,
          reason: `Cannot disable "${def.name}" because "${enabledDef.name}" is currently enabled and depends on it. Disable "${enabledDef.name}" first.`,
        };
      }
    }
    return { valid: true };
  }
}
