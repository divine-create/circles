'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle as CircleIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  ArrowRight,
  PartyPopper,
  Compass,
  MessageSquare,
  UserCheck,
  Sliders,
  Users,
} from 'lucide-react';
import { Circle, UserProfile } from '@/types/domain';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  icon: React.ComponentType<{ className?: string }>;
  isAutoCompleted?: boolean;
}

interface CircleOnboardingChecklistProps {
  circle: Circle;
  currentUser: UserProfile | null;
  hasPosts: boolean;
  enabledCapabilityKeys: string[];
}

export function CircleOnboardingChecklist({
  circle,
  currentUser,
  hasPosts,
  enabledCapabilityKeys,
}: CircleOnboardingChecklistProps) {
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const userId = currentUser?.id ?? null;
  const isOwnerOrAdmin =
    circle.current_user_role === 'owner' || circle.current_user_role === 'admin';
  const isActiveMember = circle.current_user_membership_status === 'active';

  const storageKey = `circles_onboarding_${circle.id}_${userId ?? 'guest'}`;
  const dismissedKey = `circles_onboarding_dismissed_${circle.id}_${userId ?? 'guest'}`;

  // Define steps dynamically based on role
  const steps: OnboardingStep[] = isOwnerOrAdmin
    ? [
        {
          id: 'studio_config',
          title: 'Fine-tune Circle Capabilities in Studio',
          description:
            'Enable or customize module settings (discussions, bookings, events, finances) to fit your community.',
          actionLabel: 'Open Studio',
          actionHref: `/circles/${circle.slug}/studio`,
          icon: Sliders,
        },
        {
          id: 'spaces_setup',
          title: 'Organize Community Spaces',
          description:
            'Create dedicated channels and topic spaces so members know where to share and ask questions.',
          actionLabel: 'Manage Spaces',
          actionHref: `/circles/${circle.slug}/spaces`,
          icon: Compass,
        },
        {
          id: 'welcome_post',
          title: 'Publish an Announcement or Welcome Post',
          description:
            'Share an introductory greeting or guidelines to orient new members when they join.',
          actionLabel: 'Post to Discussions',
          actionHref: `/circles/${circle.slug}/discussions`,
          icon: MessageSquare,
          isAutoCompleted: hasPosts,
        },
        {
          id: 'invite_members',
          title: 'Invite Your First Members',
          description:
            'Grow your Circle by sharing direct invitation links with collaborators and peers.',
          actionLabel: 'View Member Directory',
          actionHref: `/circles/${circle.slug}/members`,
          icon: Users,
          isAutoCompleted: (circle.member_count ?? 1) > 1,
        },
      ]
    : [
        {
          id: 'profile_setup',
          title: 'Complete Your Member Profile',
          description:
            'Add your avatar, display name, and short bio so other circle members recognize you.',
          actionLabel: 'Edit Profile',
          actionHref: '/profile',
          icon: UserCheck,
          isAutoCompleted: Boolean(currentUser?.avatar_url && currentUser?.bio),
        },
        {
          id: 'introduce_self',
          title: 'Say Hello to the Community',
          description:
            'Introduce yourself in the discussion feed with a quick hello or your background.',
          actionLabel: 'Join the Discussion',
          actionHref: `/circles/${circle.slug}/discussions`,
          icon: MessageSquare,
          isAutoCompleted: hasPosts,
        },
        {
          id: 'explore_capabilities',
          title: 'Explore Circle Capabilities',
          description: enabledCapabilityKeys.includes('services_bookings')
            ? 'Discover bookable services, upcoming events, and resource libraries in this Circle.'
            : 'Browse discussions, view fellow members, and discover shared resources.',
          actionLabel: enabledCapabilityKeys.includes('services_bookings')
            ? 'Explore Marketplace'
            : 'View Members',
          actionHref: enabledCapabilityKeys.includes('services_bookings')
            ? `/circles/${circle.slug}/marketplace`
            : `/circles/${circle.slug}/members`,
          icon: Compass,
        },
        {
          id: 'direct_messaging',
          title: 'Connect via Direct Messages',
          description:
            'Reach out to Circle members or hosts directly with private 1-on-1 messaging.',
          actionLabel: 'Open Messages',
          actionHref: `/circles/${circle.slug}/messages`,
          icon: MessageSquare,
        },
      ];

  // Sync state from localStorage upon mounting
  useEffect(() => {
    setMounted(true);
    try {
      const dismissed = localStorage.getItem(dismissedKey);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
      const savedCompleted = localStorage.getItem(storageKey);
      if (savedCompleted) {
        setCompletedSteps(JSON.parse(savedCompleted));
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [storageKey, dismissedKey]);

  if (!mounted || isDismissed || !isActiveMember) {
    return null;
  }

  const isStepDone = (step: OnboardingStep) => {
    return step.isAutoCompleted || Boolean(completedSteps[step.id]);
  };

  const toggleStep = (stepId: string) => {
    const next = { ...completedSteps, [stepId]: !completedSteps[stepId] };
    setCompletedSteps(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage write errors
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(dismissedKey, 'true');
    } catch {
      // Ignore storage write errors
    }
  };

  const completedCount = steps.filter(isStepDone).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isAllComplete = completedCount === steps.length;

  return (
    <section
      aria-label="Circle onboarding checklist"
      className="relative overflow-hidden rounded-2xl border border-stone-200 bg-linear-to-b from-stone-50/80 to-white p-5 shadow-xs transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs">
            {isAllComplete ? (
              <PartyPopper className="h-5 w-5 text-amber-300" />
            ) : (
              <Sparkles className="h-5 w-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-stone-900">
                {isOwnerOrAdmin
                  ? 'Circle Owner Setup Checklist'
                  : `Welcome to ${circle.name}! Getting Started`}
              </h2>
              {isAllComplete && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  Ready to Go!
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              {isAllComplete
                ? 'You have completed all initial setup steps. Enjoy your community!'
                : `${completedCount} of ${steps.length} steps completed (${progressPercent}%)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/60 hover:text-stone-800"
            aria-label={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-200/60 hover:text-stone-700"
            title="Dismiss checklist"
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full bg-zinc-900 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist items */}
      {!isCollapsed && (
        <div className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
          {steps.map((step) => {
            const done = isStepDone(step);
            const IconComponent = step.icon;
            return (
              <div
                key={step.id}
                className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${
                  done ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="mt-0.5 text-stone-400 hover:text-stone-700 focus:outline-hidden"
                    aria-label={`Mark "${step.title}" as ${done ? 'incomplete' : 'complete'}`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <CircleIcon className="h-5 w-5 text-stone-300 hover:text-stone-500" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <IconComponent className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                      <p
                        className={`text-xs font-semibold ${
                          done ? 'text-stone-500 line-through' : 'text-stone-900'
                        }`}
                      >
                        {step.title}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500 line-clamp-1">
                      {step.description}
                    </p>
                  </div>
                </div>

                {step.actionHref && (
                  <Link
                    href={step.actionHref}
                    className="inline-flex items-center gap-1 self-start rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:text-stone-900 sm:self-auto"
                  >
                    <span>{step.actionLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
