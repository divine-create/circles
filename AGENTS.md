# AGENTS.md — Circles Platform Engineering Guide

## 1. Product & Architecture Overview

**Circles** is a modular, multi-tenant community platform built on the principle:
> **One shared platform. Many types of communities. Each community configures its own experience.**

The application is implemented as a **Modular Monolith** using **Next.js (App Router, TypeScript strict mode)** backed by **Supabase PostgreSQL** with **PostgreSQL Row-Level Security (RLS)** and an embedded **PostgreSQL (`@electric-sql/pglite`)** local persistence & RLS execution engine when external Supabase cloud credentials are not configured.

### Directory Structure

```text
src/
  app/
    (public)/           # Landing page, public discovery, public circle previews
    (auth)/             # Sign in, sign up, password recovery, password reset
    (platform)/         # Authenticated shell: My Circles, notifications, profile, moderation
    circles/[slug]/     # Circle home, spaces, discussion feeds, members, Circle Studio
    api/                # Route handlers (health, auth, circles, capabilities, moderation)
  components/
    ui/                 # Accessible design system primitives (buttons, inputs, dialogs, badges, cards)
    layout/             # Navigation bars, sidebars, responsive drawers, headers
    shared/             # Status banners, empty states, confirmation modals
  features/
    auth/               # Authentication service, session verification, password flows
    profiles/           # User profile management, visibility controls, avatar handling
    circles/            # Circle lifecycle (create, update, visibility, slug validation)
    memberships/        # Memberships, join requests, invitations, role transitions, ownership protection
    capabilities/       # Authoritative capability registry, dependency resolution, enable/disable flows
    templates/          # Versioned Circle templates (University, Neighbourhood, Professional, etc.)
    spaces/             # Space CRUD, reordering, archival, capability association
    discussions/        # Posts, comments, reactions, saved items, chronological pagination
    notifications/      # In-app notifications, idempotent delivery logs, optional Resend email adapter
    moderation/         # Content reporting, moderation actions, member suspension, platform admin review
    discovery/          # Full-text & filtered search respecting Circle visibility rules
  lib/
    auth/               # Server session extraction & verification
    authorization/      # Centralized permission matrix & role/capability guards
    db/                 # Supabase SSR client & PostgreSQL (PGlite / Supabase) RLS query executor
    validation/         # Shared Zod schemas
    email/              # Resend transactional email service with graceful local fallback
    logging/            # Structured safe logger (redacts secrets and PII)
    errors/             # Typed domain errors (`AppError`, `UnauthorizedError`, `ForbiddenError`, etc.)
  types/                # Database and domain TypeScript definitions
supabase/
  migrations/           # Version-controlled PostgreSQL schema & RLS migrations
  seed.sql              # Development seed data
tests/
  unit/                 # Capability registry, permission matrix, validation tests
  integration/          # Real PostgreSQL + RLS vertical slice & security tests
  e2e/                  # Playwright end-to-end browser tests
docs/
  architecture.md       # System design & data flow
  security.md           # Authorization model, RLS policies, and threat mitigation
  capabilities.md       # Capability registry design & lifecycle rules
  implementation-status.md # Honest feature status report
```

---

## 2. Development Commands

- `npm run dev` — Start the Next.js development server
- `npm run build` — Run production build and type validation
- `npm run start` — Start the production server
- `npm run typecheck` — Run `tsc --noEmit`
- `npm run lint` — Run ESLint
- `npm test` — Run Vitest unit and PostgreSQL RLS integration suites
- `npm run test:e2e` — Run Playwright end-to-end tests

---

## 3. Security & Authorization Rules

1. **Never trust client identity**: Always resolve the active user from the verified server session (`getAuthenticatedUser()`).
2. **Defense in depth**: Enforce permissions both in the server-side domain service layer (`src/lib/authorization`) AND in PostgreSQL Row-Level Security (`supabase/migrations/0001_initial_schema.sql`).
3. **Cross-Circle isolation (Anti-IDOR)**: Every operation on a space, post, comment, join request, or capability checks that the target entity belongs to the specified Circle and that the actor holds the required Circle role or membership status.
4. **Last-owner protection**: The sole owner of a Circle cannot leave, be removed, or be demoted without transferring ownership first.
5. **Non-destructive capability disabling**: Disabling a capability hides its navigation and blocks mutations/reads in normal flows while preserving all underlying database records (`circle_capabilities`, `circle_spaces`, `posts`) and recording an `audit_logs` entry.
6. **Secret hygiene**: Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` to client components.

---

## 4. Coding Conventions

- **TypeScript Strict Mode**: Avoid `any`. Use Zod schemas at all input boundaries (Server Actions, Route Handlers, forms).
- **Explicit Domain Operations**: Keep business logic inside `src/features/<domain>/service.ts` rather than inside React components.
- **Visual Direction**: Forest-green primary palette (`#1B4332`, `#2D6A4F`, `#40916C`), warm neutral stone surfaces (`#FAF9F6`, `#F4F3EE`), clear typography, accessible contrast, and honest UI feedback.
