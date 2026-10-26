import crypto from 'crypto';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  CAPABILITY_REGISTRY,
  getAllCapabilityDefinitions,
  getCapabilityDefinition,
  validateCapabilityTransition,
} from '@/features/capabilities/registry';
import {
  CircleCapabilityState,
  CircleNavigationItem,
  CircleRole,
  CircleSpace,
  CircleVisibility,
  MembershipStatus,
} from '@/types/domain';
import { CapabilityDisabledError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCirclePermission } from '@/lib/authorization/permissions';

export async function getCircleCapabilities(
  actorUserId: string | null,
  circleId: string
): Promise<CircleCapabilityState[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<CircleCapabilityState>(
      `SELECT * FROM public.circle_capabilities
       WHERE circle_id = $1
       ORDER BY capability_key ASC;`,
      [circleId]
    );

    const existingMap = new Map(res.rows.map((r) => [r.capability_key, r]));

    return getAllCapabilityDefinitions().map((def) => {
      const existing = existingMap.get(def.key);
      if (existing) {
        return {
          ...existing,
          definition: def,
        };
      }
      return {
        id: `virtual-${circleId}-${def.key}`,
        circle_id: circleId,
        capability_key: def.key,
        enabled: false,
        settings: def.default_settings,
        enabled_by: null,
        enabled_at: null,
        disabled_at: null,
        updated_at: new Date().toISOString(),
        definition: def,
      };
    });
  });
}

export async function isCapabilityEnabledForCircle(
  actorUserId: string | null,
  circleId: string,
  capabilityKey: string
): Promise<boolean> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = $2
       LIMIT 1;`,
      [circleId, capabilityKey]
    );
    return Boolean(res.rows[0]?.enabled);
  });
}

export async function requireEnabledCapability(
  actorUserId: string | null,
  circleId: string,
  capabilityKey: string
): Promise<void> {
  const enabled = await isCapabilityEnabledForCircle(actorUserId, circleId, capabilityKey);
  if (!enabled) {
    throw new CapabilityDisabledError(capabilityKey);
  }
}

export async function updateCircleCapability(
  actorUserId: string,
  circleId: string,
  capabilityKey: string,
  enabled: boolean,
  settingsUpdate?: Record<string, unknown>
): Promise<CircleCapabilityState> {
  const def = getCapabilityDefinition(capabilityKey);

  return withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const memberRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];

    assertCirclePermission('circle.manage_capabilities', circle.visibility, {
      userId: actorUserId,
      circleRole: membership?.role ?? null,
      membershipStatus: membership?.status ?? null,
    });

    const currentRows = await tx.query<{ capability_key: string; enabled: boolean; settings: Record<string, unknown> }>(
      `SELECT capability_key, enabled, settings
       FROM public.circle_capabilities
       WHERE circle_id = $1;`,
      [circleId]
    );

    const enabledSet = new Set(
      currentRows.rows.filter((r) => r.enabled).map((r) => r.capability_key)
    );

    const transition = validateCapabilityTransition(capabilityKey, enabled, enabledSet);
    if (!transition.valid) {
      throw new ValidationError(transition.reason ?? 'Invalid capability state transition.');
    }

    const existingRow = currentRows.rows.find((r) => r.capability_key === capabilityKey);
    const mergedSettings = {
      ...def.default_settings,
      ...(existingRow?.settings ?? {}),
      ...(settingsUpdate ?? {}),
    };

    const upserted = await tx.query<CircleCapabilityState>(
      `INSERT INTO public.circle_capabilities (
         id, circle_id, capability_key, enabled, settings, enabled_by, enabled_at, disabled_at, updated_at
       ) VALUES (
         $1, $2, $3, $4::boolean, $5::jsonb, $6,
         CASE WHEN $4::boolean = true THEN NOW() ELSE NULL END,
         CASE WHEN $4::boolean = false THEN NOW() ELSE NULL END,
         NOW()
       )
       ON CONFLICT (circle_id, capability_key)
       DO UPDATE SET
         enabled = EXCLUDED.enabled,
         settings = EXCLUDED.settings,
         enabled_by = EXCLUDED.enabled_by,
         enabled_at = CASE WHEN EXCLUDED.enabled = true THEN NOW() ELSE public.circle_capabilities.enabled_at END,
         disabled_at = CASE WHEN EXCLUDED.enabled = false THEN NOW() ELSE public.circle_capabilities.disabled_at END,
         updated_at = NOW()
       RETURNING *;`,
      [
        crypto.randomUUID(),
        circleId,
        capabilityKey,
        enabled,
        JSON.stringify(mergedSettings),
        actorUserId,
      ]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, 'circle_capability', $5, $6::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        enabled ? 'capability.enabled' : 'capability.disabled',
        capabilityKey,
        JSON.stringify({ capabilityKey, enabled, settings: mergedSettings }),
      ]
    );

    const row = upserted.rows[0];
    if (!row) {
      throw new ForbiddenError('Unable to update capability settings.');
    }

    return {
      ...row,
      definition: def,
    };
  });
}

export async function requireAnyEnabledCapability(
  actorUserId: string | null,
  circleId: string,
  capabilityKeys: string[]
): Promise<string[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<{ capability_key: string }>(
      `SELECT capability_key FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = ANY($2::text[]) AND enabled = true;`,
      [circleId, capabilityKeys]
    );
    if (res.rows.length === 0) {
      throw new CapabilityDisabledError(capabilityKeys[0] ?? 'capability');
    }
    return res.rows.map((r) => r.capability_key);
  });
}

/**
 * Generates safe navigation items for a Circle, filtering out spaces and links
 * whose backing capability is currently disabled.
 */
export async function getCircleNavigation(
  actorUserId: string | null,
  circleId: string,
  circleSlug: string
): Promise<{
  enabledCapabilityKeys: string[];
  visibleSpaces: CircleSpace[];
  navigationItems: CircleNavigationItem[];
}> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ capability_key: string }>(
      `SELECT capability_key FROM public.circle_capabilities
       WHERE circle_id = $1 AND enabled = true;`,
      [circleId]
    );
    const enabledKeys = new Set(capRes.rows.map((r) => r.capability_key));

    const spacesRes = await tx.query<CircleSpace>(
      `SELECT * FROM public.circle_spaces
       WHERE circle_id = $1 AND is_archived = false
       ORDER BY sort_order ASC, created_at ASC;`,
      [circleId]
    );

    // Filter out spaces attached to a disabled capability (preserving data while hiding navigation)
    const visibleSpaces = enabledKeys.has('spaces')
      ? spacesRes.rows.filter(
          (sp) => !sp.capability_key || enabledKeys.has(sp.capability_key)
        )
      : [];

    const navItems: CircleNavigationItem[] = [
      {
        id: `nav-overview-${circleId}`,
        circle_id: circleId,
        label: 'Overview',
        href: `/circles/${circleSlug}`,
        icon: 'compass',
        capability_key: null,
        space_id: null,
        visibility: 'public',
        sort_order: 0,
        is_enabled: true,
      },
    ];

    const orderedNavCapabilityKeys = [
      'discussions',
      'spaces',
      'member_directory',
      'events',
      'activities_meetups',
      'polls_decisions',
      'marketplace',
      'listings_discovery',
      'services_bookings',
      'rentals_sharing',
      'housing_property',
      'jobs_opportunities',
      'learning_resources',
      'shared_resources',
      'media_publishing',
      'projects_collaboration',
      'governance_committees',
      'fundraising_causes',
      'challenges_rewards',
      'help_desk',
    ];

    let order = 1;
    const seenBaseRoutes = new Set<string>();
    for (const key of orderedNavCapabilityKeys) {
      if (enabledKeys.has(key)) {
        const def = CAPABILITY_REGISTRY[key];
        if (def) {
          const baseRoute = def.navigation_config.path.split('?')[0];
          // Avoid duplicate top-level tabs if primary module route is already added (e.g., events + rsvps + attendance)
          if (
            seenBaseRoutes.has(baseRoute) &&
            ['events', 'resources'].includes(baseRoute)
          ) {
            continue;
          }
          seenBaseRoutes.add(baseRoute);
          navItems.push({
            id: `nav-cap-${key}`,
            circle_id: circleId,
            label: def.navigation_config.label,
            href: `/circles/${circleSlug}/${def.navigation_config.path}`,
            icon: def.navigation_config.icon,
            capability_key: key,
            space_id: null,
            visibility: 'members',
            sort_order: order++,
            is_enabled: true,
          });
        }
      }
    }

    return {
      enabledCapabilityKeys: Array.from(enabledKeys),
      visibleSpaces,
      navigationItems: navItems,
    };
  });
}
