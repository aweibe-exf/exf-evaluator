# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

There are no automated tests. Validate changes by running the dev server and exercising the affected feature manually.

Database schema changes go through Supabase migrations:

```bash
supabase link --project-ref <ref>   # Link CLI to a project
supabase db push                     # Apply all pending migrations
```

## Architecture

**Extension Pulse** is a multi-tenant program evaluation SaaS for university extension programs. Each tenant is a separate Vercel + Supabase deployment.

### Route groups

- `src/app/(app)/` — authenticated admin area (sidebar layout, `ProgramProvider` context)
- `src/app/f/[slug]/` — public token-gated form renderer (no auth required)
- `src/app/my/` — respondent portal for users with no `program_memberships`
- `src/app/auth/` — login, callback, password reset
- `src/app/api/` — all server-side API routes

### Page pattern

Every admin page follows the same split: a thin async server component (`page.tsx`) that authenticates and fetches initial data, and a `*-client.tsx` component that owns all interactivity. Client components call API routes for mutations; they do not call Supabase directly for writes.

### Supabase client helpers (`src/lib/supabase/`)

- `createClient()` — async, cookie-based, RLS-enforcing. Use in server components and API routes for user-scoped reads/writes.
- `createServiceClient()` — synchronous, service role, bypasses RLS. Use in API routes only when RLS would block a legitimate admin action (e.g. reading `auth.users`, cross-program operations). Never use on the client side.

### Program context (`src/contexts/program-context.tsx`)

`ProgramProvider` wraps the entire `(app)` layout. All client components use `useProgram()` to get `currentProgram`, `currentRole`, and `programs`. The selected program is persisted to `localStorage` under the key `exf_program_id`.

Role hierarchy: `super_admin` > `program_admin` > `staff` > `viewer`. `super_admin` is platform-wide (any membership with that role grants it everywhere). All others are per-program.

**Access gating pattern used throughout the app:**

```ts
const isRestricted = currentRole === 'staff' || currentRole === 'viewer'
```

Staff and viewers land on `/submissions` after login (not `/dashboard`). They only see their own submissions and cannot flag, review, or export.

### Forms

Form schemas are stored as JSONB in `forms.schema`. Types live in `src/types/forms.ts`:

- `FormSchema` → `FormPage[]` → `FormField[]`
- `FormSettings` is a separate JSONB column (`forms.settings`)
- The form builder (`src/app/(app)/forms/[id]/edit/`) uses `@dnd-kit` for drag-to-reorder within pages
- The public renderer (`src/app/f/[slug]/`) is fully unauthenticated and uses a `?token=` query parameter

### Submission tokens

`submission_tokens` rows are the mechanism for inviting external respondents. When a token is created (`POST /api/tokens`), the API:

1. Inserts the token row
2. Looks up whether the email already has a Supabase auth account
3. If yes → upserts a `viewer` `program_membership`
4. If no → calls `generateLink({ type: 'invite' })` to create an auth account + membership, and includes the setup URL in the invite email

This means every form invitee appears in Users & Roles as a `viewer`.

### Email (`src/lib/email.ts`)

All email goes through Mailgun via the REST API. If `MAILGUN_API_KEY` is not set, emails are logged to the console instead (dev-friendly fallback). Supabase's built-in `inviteUserByEmail()` is intentionally not used — it is rate-limited to 3/hour. Instead, `service.auth.admin.generateLink()` is used to produce magic links that are then sent via Mailgun.

### AI routes (`src/app/api/ai/`)

- `/api/ai/summarize` — generates narrative summaries from submissions + optional Pulse notes using Claude claude-opus-4-5
- `/api/ai/sidekick` — conversational assistant with access to program context
- `/api/ai/visualizer` — generates chart configurations from submission data

The Anthropic API key is server-only and never reaches the client.

### Key database tables

| Table | Purpose |
|---|---|
| `programs` | Top-level tenant containers |
| `program_memberships` | User ↔ program with role |
| `forms` | Form definitions (JSONB schema + settings) |
| `submission_tokens` | Time-limited token URLs for external respondents |
| `submissions` | Collected response data (JSONB) |
| `pulse_notes` | Qualitative field notes with optional file attachments |
| `ai_summaries` | Cached Claude-generated summaries |
| `reports` | Tiptap rich-text reports (JSONB content) |
| `program_narratives` | Uploaded grant narratives / logic models used as AI context |
| `audit_log` | Admin action log — write with `logAudit()` from `src/lib/audit.ts` |

### Routing after login

`src/app/auth/callback/route.ts` handles post-login redirects:

- No `program_memberships` → `/my` (respondent portal)
- `staff` or `viewer` → `/submissions`
- Everyone else → `/dashboard` (or the `next` query param)

`src/app/page.tsx` redirects `/` → `/dashboard`.
