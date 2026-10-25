# Circles Platform — Independent Verification & Production-Readiness Audit

> See root [`production-readiness-audit.md`](../production-readiness-audit.md) for the complete audit report. This copy is maintained in `docs/` for documentation index completeness.

## Summary of Audit Remediations Applied

1. **Fail-Closed Production Environment Guards (`src/lib/config/env.ts`)**:
   - Blocks startup/requests in `NODE_ENV=production` if `CIRCLES_SESSION_SECRET` is missing, shorter than 32 characters, or set to the development fallback.
   - Blocks silent fallback to embedded PGlite in `NODE_ENV=production` unless `ALLOW_EMBEDDED_POSTGRES_IN_PRODUCTION=true` is explicitly configured.
2. **Stateful Session Tracking & Revocation (`supabase/migrations/0002_security_hardening.sql`, `src/lib/auth/session.ts`)**:
   - Persists every issued session in `auth.sessions` (`id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`).
   - Immediately revokes session tokens on logout (`POST /api/auth/logout` / `signOutUser`) and revokes all user sessions on password reset (`resetPasswordWithToken`).
3. **PostgreSQL Trigger & RLS Hardening (`supabase/migrations/0002_security_hardening.sql`)**:
   - `trg_protect_profile_identity`: Prevents mutating `profiles.id` or `profiles.email` to block email-invitation hijacking.
   - `trg_protect_circle_ownership`: Prevents Circle `admin` users from overwriting `circles.owner_id` via direct SQL.
   - `trg_enforce_membership_transitions`: Enforces strict role hierarchy on `public.circle_memberships` updates (moderators cannot modify admins/owners; admins cannot promote to admin/owner; suspended members cannot self-restore).
   - `notifications_insert` & `notification_deliveries_insert`: Restricts client inserts so users cannot spoof system or other-actor notifications.
4. **Expiring Single-Use Password Recovery Tokens (`src/features/auth/service.ts`)**:
   - Enforces a 1-hour expiration window (`recovery_sent_at > NOW() - INTERVAL '1 hour'`) and single-use clearing, and never exposes `previewToken` in production responses.
5. **Private Profile Safe Joins & Capability Settings Enforcement (`src/features/discussions/service.ts`, `src/features/memberships/service.ts`)**:
   - Uses `LEFT JOIN public.profiles` with safe fallback display names so private profiles (`profile_visibility = 'private'`) remain hidden under RLS without hiding public Circle posts.
   - Enforces `allowMemberPosts` and `allowReactions` capability settings in `createPost` and `toggleReaction`.
