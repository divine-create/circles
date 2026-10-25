import { CircleCategory, CircleVisibility, MembershipPolicy } from '@/types/domain';

export interface CircleTemplateSpec {
  key: string;
  name: string;
  version: number;
  category: CircleCategory;
  summary: string;
  defaultVisibility: CircleVisibility;
  defaultMembershipPolicy: MembershipPolicy;
  enabledCapabilities: string[];
  suggestedSpaces: Array<{
    name: string;
    slug: string;
    description: string;
    icon: string;
    capabilityKey: string | null;
    postingPolicy: 'members' | 'moderators' | 'admins';
  }>;
}

export const CIRCLE_TEMPLATES: Record<string, CircleTemplateSpec> = {
  university: {
    key: 'university',
    name: 'University & Campus Hub',
    version: 1,
    category: 'university',
    summary:
      'Designed for universities, faculties, and student unions with study spaces, campus announcements, events, and opportunities.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'events',
      'rsvps',
      'learning_resources',
      'jobs_opportunities',
    ],
    suggestedSpaces: [
      {
        name: 'Campus Announcements',
        slug: 'announcements',
        description: 'Official updates, academic deadlines, and campus news.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'moderators',
      },
      {
        name: 'General Commons',
        slug: 'general',
        description: 'Open campus conversation and student introductions.',
        icon: 'message-square',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
      {
        name: 'Study Groups & Courses',
        slug: 'study-groups',
        description: 'Course cohorts, exam prep, and shared lecture notes.',
        icon: 'graduation-cap',
        capabilityKey: 'learning_resources',
        postingPolicy: 'members',
      },
      {
        name: 'Campus Events',
        slug: 'events',
        description: 'Societies, guest lectures, and student meetups.',
        icon: 'calendar',
        capabilityKey: 'events',
        postingPolicy: 'members',
      },
      {
        name: 'Internships & Roles',
        slug: 'opportunities',
        description: 'Research assistantships, internships, and graduate roles.',
        icon: 'briefcase',
        capabilityKey: 'jobs_opportunities',
        postingPolicy: 'members',
      },
    ],
  },
  neighbourhood: {
    key: 'neighbourhood',
    name: 'Neighbourhood Association',
    version: 1,
    category: 'neighbourhood',
    summary:
      'Connect residents with local announcements, mutual aid requests, neighbourhood events, and shared resources.',
    defaultVisibility: 'discoverable_approval',
    defaultMembershipPolicy: 'approval',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'events',
      'help_desk',
      'shared_resources',
    ],
    suggestedSpaces: [
      {
        name: 'Neighbourhood Notices',
        slug: 'notices',
        description: 'Civic updates, street works, and association alerts.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'moderators',
      },
      {
        name: 'Resident Forum',
        slug: 'general',
        description: 'Everyday conversation with neighbours on your block.',
        icon: 'message-square',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
      {
        name: 'Mutual Aid & Requests',
        slug: 'requests',
        description: 'Ask for a hand, borrow tools, or coordinate local support.',
        icon: 'life-buoy',
        capabilityKey: 'help_desk',
        postingPolicy: 'members',
      },
      {
        name: 'Block Gatherings',
        slug: 'events',
        description: 'Clean-up days, town halls, and seasonal socials.',
        icon: 'calendar',
        capabilityKey: 'events',
        postingPolicy: 'members',
      },
    ],
  },
  professional: {
    key: 'professional',
    name: 'Professional Network',
    version: 1,
    category: 'professional',
    summary:
      'Curated industry network with topical discussions, member directory, job opportunities, and peer mentorship.',
    defaultVisibility: 'discoverable_approval',
    defaultMembershipPolicy: 'approval',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'jobs_opportunities',
      'events',
      'shared_resources',
    ],
    suggestedSpaces: [
      {
        name: 'Introductions & Wins',
        slug: 'introductions',
        description: 'Meet fellow practitioners and share recent milestones.',
        icon: 'users',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
      {
        name: 'Industry Craft',
        slug: 'general',
        description: 'Deep dives into architecture, strategy, and practice.',
        icon: 'message-square',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
      {
        name: 'Career & Hiring Board',
        slug: 'opportunities',
        description: 'Open roles, advisory requests, and referrals.',
        icon: 'briefcase',
        capabilityKey: 'jobs_opportunities',
        postingPolicy: 'members',
      },
    ],
  },
  creator: {
    key: 'creator',
    name: 'Creator Community',
    version: 1,
    category: 'creator',
    summary:
      'Gather supporters and collaborators around discussions, behind-the-scenes updates, and creative feedback spaces.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: ['discussions', 'spaces', 'member_directory', 'events', 'polls_decisions'],
    suggestedSpaces: [
      {
        name: 'Studio Releases',
        slug: 'announcements',
        description: 'New episodes, essays, and behind-the-scenes drops.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'moderators',
      },
      {
        name: 'Community Lounge',
        slug: 'general',
        description: 'Discuss topics, share feedback, and connect with peers.',
        icon: 'message-square',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
      {
        name: 'Work-in-Progress Feedback',
        slug: 'feedback',
        description: 'Share drafts and vote on upcoming topics.',
        icon: 'bar-chart-2',
        capabilityKey: 'polls_decisions',
        postingPolicy: 'members',
      },
    ],
  },
  learning: {
    key: 'learning',
    name: 'Learning & Cohort Community',
    version: 1,
    category: 'learning',
    summary:
      'Run structured study groups, curriculum spaces, Q&A help desks, and shared resource libraries.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'learning_resources',
      'shared_resources',
      'help_desk',
    ],
    suggestedSpaces: [
      {
        name: 'Syllabus & Announcements',
        slug: 'announcements',
        description: 'Weekly modules, reading lists, and session links.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'moderators',
      },
      {
        name: 'Cohort Discussions',
        slug: 'general',
        description: 'Reflections, study notes, and peer synthesis.',
        icon: 'graduation-cap',
        capabilityKey: 'learning_resources',
        postingPolicy: 'members',
      },
      {
        name: 'Office Hours & Q&A',
        slug: 'help-desk',
        description: 'Unblock technical or conceptual questions together.',
        icon: 'life-buoy',
        capabilityKey: 'help_desk',
        postingPolicy: 'members',
      },
    ],
  },
  sports: {
    key: 'sports',
    name: 'Sports & Athletics Club',
    version: 1,
    category: 'sports',
    summary:
      'Coordinate training sessions, match schedules, RSVPs, and club announcements.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: ['discussions', 'spaces', 'member_directory', 'events', 'rsvps'],
    suggestedSpaces: [
      {
        name: 'Club Notices',
        slug: 'announcements',
        description: 'Fixture updates, pitch changes, and kit notices.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'moderators',
      },
      {
        name: 'Clubhouse Chat',
        slug: 'general',
        description: 'Post-match recaps and training plans.',
        icon: 'message-square',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
      {
        name: 'Training & Matches',
        slug: 'events',
        description: 'Weekly sessions, tournaments, and squad RSVPs.',
        icon: 'calendar',
        capabilityKey: 'events',
        postingPolicy: 'members',
      },
    ],
  },
  project: {
    key: 'project',
    name: 'Startup & Project Team',
    version: 1,
    category: 'project',
    summary:
      'Organize builders around project tracks, release discussions, help desks, and shared specs.',
    defaultVisibility: 'private',
    defaultMembershipPolicy: 'invite_only',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'projects_collaboration',
      'shared_resources',
      'polls_decisions',
    ],
    suggestedSpaces: [
      {
        name: 'Ship Log & Releases',
        slug: 'announcements',
        description: 'Milestone updates, changelogs, and architecture decisions.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
      {
        name: 'Core Engineering & Product',
        slug: 'general',
        description: 'Day-to-day coordination, specs, and design reviews.',
        icon: 'folder-kanban',
        capabilityKey: 'projects_collaboration',
        postingPolicy: 'members',
      },
    ],
  },
  local_business: {
    key: 'local_business',
    name: 'Local Business Collective',
    version: 1,
    category: 'local_business',
    summary:
      'Unite local merchants, chambers of commerce, and community partners for events and collaborative initiatives.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'approval',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'events',
      'shared_resources',
    ],
    suggestedSpaces: [
      {
        name: 'Merchant Bulletins',
        slug: 'announcements',
        description: 'District news, seasonal markets, and policy updates.',
        icon: 'megaphone',
        capabilityKey: 'discussions',
        postingPolicy: 'moderators',
      },
      {
        name: 'Business Owners Forum',
        slug: 'general',
        description: 'Collaborate with fellow shop owners and local founders.',
        icon: 'message-square',
        capabilityKey: 'discussions',
        postingPolicy: 'members',
      },
    ],
  },
};

export function getAllCircleTemplates(): CircleTemplateSpec[] {
  return Object.values(CIRCLE_TEMPLATES);
}
