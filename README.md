# Extension Pulse

Program evaluation and reporting platform for extension education. Supports multi-program data collection, AI-powered analysis, Pulse field notes, impact dashboards, and automated report drafting.

## Tech Stack

- **Frontend/API**: Next.js 16 (App Router, TypeScript)
- **Database/Auth/Storage**: Supabase (PostgreSQL, RLS, Storage)
- **AI**: Anthropic Claude API
- **Email**: Mailgun
- **Hosting**: Vercel

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd extension-pulse
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
| `MAILGUN_FROM_EMAIL` | From address, e.g. `Extension Pulse <noreply@yourdomain.com>` |
| `NEXT_PUBLIC_APP_URL` | Public URL, e.g. `https://pulse.youruniversity.edu` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | (Optional) Google service account for Docs import |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | (Optional) Google service account private key |

### 3. Set up Supabase

Create a new Supabase project, then run migrations:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The migrations in `supabase/migrations/` create all tables, enums, indexes, RLS policies, storage buckets, and triggers in order.

### 4. Configure Supabase Auth

In the Supabase dashboard → Authentication → Settings:
- Enable **Email** provider
- Enable **Magic Link** (disable password sign-in if desired)
- Set **Site URL** to your `NEXT_PUBLIC_APP_URL`
- Add `<NEXT_PUBLIC_APP_URL>/auth/callback` to **Redirect URLs**

### 5. Create the first admin account

After deploying, sign in with your email via magic link. Then in the Supabase dashboard, manually insert a row into `program_memberships` with `role = 'super_admin'` for your user ID and any program ID. This gives you full access to create programs and invite other users from within the app.

### 6. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

See `supabase/migrations/` for the full schema. Key tables:

- `programs` — top-level program containers
- `program_memberships` — user roles per program (`super_admin`, `program_admin`, `staff`, `viewer`)
- `forms` — form definitions with JSONB schema
- `submission_tokens` — time-limited unique URLs for external respondents
- `submissions` — collected response data
- `pulse_notes` — qualitative field notes with file attachments
- `ai_summaries` — cached Claude-generated summaries
- `reports` — assembled narrative reports
- `program_narratives` — award context documents (grant narratives, logic models)
- `import_jobs` — CSV data import pipeline
- `audit_log` — admin action log

## Architecture Notes

- All AI calls go through `/api/ai/[action]` server-side routes — the Anthropic API key is never exposed to the client.
- External respondents receive a signed token URL and do not need a Supabase account.
- Row-Level Security is enforced at the database level for all tables.
- PDF text extraction uses Claude Haiku via the Anthropic document API (more reliable than pdf-parse in serverless environments).
- Each customer deployment is a separate Vercel project + Supabase project for complete data isolation.

## Deployment to Vercel

```bash
npx vercel --prod
```

Add all environment variables in the Vercel project settings. Mark `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` as sensitive (disable preview exposure).

Set a custom domain in Vercel project settings if the customer requires one (e.g. `pulse.theiruniversity.edu` via a CNAME).
