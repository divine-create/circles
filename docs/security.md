# Circles Platform — Security & Authorization Model

## 1. Defense-in-Depth Authorization

Circles enforces authorization at three distinct layers:

1. **Verified Server Session (`src/lib/auth/session.ts`)**: Client-supplied user IDs are never trusted as proof of identity. Every Server Component and Route Handler resolves the authenticated user from an HMAC-SHA256 signed HTTP-only cookie (`circles_session_token`) or verified Supabase SSR session.
2. **Centralized Permission Matrix (`src/lib/authorization/permissions.ts`)**: Before any mutation or sensitive query executes, `assertCirclePermission` validates the actor's Circle role (`owner`, `admin`, `moderator`, `member`), membership status (`active`, `suspended`, `left`), and Circle visibility (`public`, `discoverable_approval`, `private`).
3. **PostgreSQL Row-Level Security (`supabase/migrations/0001_initial_schema.sql`)**: Every user-data table has `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` enabled with explicit `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies.

---

## 2. Permission Matrix

| Action / Permission | Owner | Admin | Moderator | Active Member | Pending / Non-Member | Platform Admin |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Discover Public / Approval Circle | Yes | Yes | Yes | Yes | Yes | Yes |
| Discover Private Circle | Yes | Yes | Yes | Yes | Invitees Only | Yes |
| Read Public Circle Content | Yes | Yes | Yes | Yes | Yes | Yes |
| Read Approval / Private Content | Yes | Yes | Yes | Yes | **No** | Yes |
| Create Posts & Comments | Yes | Yes | Yes | Yes | **No** | If Member |
| Moderate Posts / Review Reports | Yes | Yes | Yes | **No** | **No** | Yes |
| Update Circle Settings & Spaces | Yes | Yes | **No** | **No** | **No** | **No** |
| Enable / Disable Capabilities | Yes | Yes | **No** | **No** | **No** | **No** |
| Approve / Reject Join Requests | Yes | Yes | **No** | **No** | **No** | **No** |
| Promote Member to Admin | Yes | **No** | **No** | **No** | **No** | **No** |
| Transfer Circle Ownership | Yes | **No** | **No** | **No** | **No** | **No** |

---

## 3. Database Integrity & Anti-IDOR Controls

- **Cross-Circle Space Isolation**: `public.posts` defines a composite foreign key `FOREIGN KEY (space_id, circle_id) REFERENCES public.circle_spaces(id, circle_id)`. It is impossible at the database constraint level to attach a post to a space belonging to another Circle.
- **Cross-Circle Comment Isolation**: `public.comments` defines `FOREIGN KEY (post_id, circle_id) REFERENCES public.posts(id, circle_id)`.
- **Duplicate Request Prevention**: A partial unique index `idx_unique_pending_join_request ON public.circle_join_requests (circle_id, user_id) WHERE status = 'pending'` prevents duplicate pending requests.
- **Last-Owner Protection Trigger**: The PostgreSQL trigger `trg_prevent_last_owner_loss` prevents deleting or demoting the last active `owner` of a Circle unless ownership has been transferred first.
- **Hashed Invitation & Recovery Tokens**: Raw invitation and password recovery tokens are hashed with SHA-256 (`token_hash`) before storage in PostgreSQL.
- **Safe `SECURITY DEFINER` Functions**: All RLS helper functions (`is_active_circle_member`, `has_circle_staff_role`, `can_discover_circle`, `can_read_circle_content`, `is_capability_enabled`) specify `STABLE SECURITY DEFINER SET search_path = public` to prevent `search_path` hijacking and RLS recursion.
