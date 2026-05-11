# EXF Evaluator

Full-stack evaluation and reporting platform for the Extension Foundation. Supports multi-program data collection, AI-powered analysis, impact dashboards, and automated report drafting.

## Tech Stack

- **Frontend/API**: Next.js 16 (App Router, TypeScript)
- **Database/Auth/Storage**: Supabase (PostgreSQL, RLS, Storage, Realtime)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Email**: Mailgun
- **Hosting**: Vercel

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd exf-evaluator
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `ANTHROPIC_API_KEY` | Anthropic API key (server-only) |
| `MAILGUN_API_KEY` | Mailgun private API key |
| `MAILGUN_DOMAIN` | Mailgun sending domain |
| `MAILGUN_FROM_EMAIL` | From address for transactional email |
| `NEXT_PUBLIC_APP_URL` | Public URL (e.g. `https://evaluator.example.org`) |

### 3. Set up Supabase

Create a new Supabase project, then run migrations:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The migrations in `supabase/migrations/` create all tables, enums, indexes, RLS policies, and triggers.

### 4. Configure Supabase Auth

In the Supabase dashboard:
- Enable **Email** provider with "Magic Link" (disable password sign-in)
- Set Site URL to your `NEXT_PUBLIC_APP_URL`
- Add `<NEXT_PUBLIC_APP_URL>/auth/callback` to allowed redirect URLs

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

See `supabase/migrations/` for the full schema. Key tables:

- `programs` — NTAE, EXCITE, etc.
- `program_memberships` — user roles per program (`super_admin`, `program_admin`, `staff`, `viewer`)
- `forms` — form definitions with JSONB schema
- `submission_tokens` — time-limited unique URLs for external respondents
- `submissions` — collected response data
- `ai_summaries` — cached Claude-generated summaries
- `reports` — assembled quarterly/annual reports
- `import_jobs` — CSV/Excel data import pipeline
- `audit_log` — admin action log

## Architecture Notes

- All AI calls go through `/api/ai/[action]` server-side routes — the Anthropic API key is never exposed to the client.
- External respondents receive a signed token URL and do not need a Supabase account.
- Row-Level Security is enforced at the database level for all tables.
- The `proxy.ts` file (Next.js 16's replacement for `middleware.ts`) handles session refresh and route protection.

## Deployment to Vercel

```bash
npx vercel --prod
```

Add all environment variables in the Vercel project settings. The `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` must be added as **sensitive** (non-preview-exposed) variables.

## Build Phases

| Phase | Status | Modules |
|---|---|---|
| 1 — Foundation | Complete | Scaffold, DB schema, Auth, Sidebar layout |
| 2 — Form Builder | Pending | Drag-and-drop builder, all field types, conditional logic, templates |
| 3 — Submissions | Pending | Token delivery, public renderer, inbox, Mailgun |
| 4 — AI & Dashboard | Pending | AI summaries, Impact Dashboard, Report Generator |
| 5 — Importer & Polish | Pending | CSV import, user management, audit log viewer |
