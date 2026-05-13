# Extension Pulse — New Instance Deployment Runbook

Use this guide each time you spin up a new university instance.
End-to-end time: **~30–45 minutes** on first run, ~15 minutes once you have the process memorised.

---

## Prerequisites (one-time setup)

- [ ] Supabase CLI installed: `brew install supabase/tap/supabase`
- [ ] Vercel CLI installed: `npm i -g vercel`
- [ ] Access to the Extension Pulse GitHub repo
- [ ] A Mailgun account with a verified sending domain (or the client's SMTP details)
- [ ] An Anthropic API key (yours, or the client's)

---

## Step 1 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose the organisation (yours, or one you've created for the client).
4. Settings:
   - **Name**: `[University Short Name] Extension Pulse` e.g. `OSU Extension Pulse`
   - **Database password**: generate a strong one and save it in your password manager
   - **Region**: choose the region closest to the university (US East, US West, EU, etc.)
5. Click **Create new project** and wait ~2 minutes for provisioning.
6. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Run database migrations

From your local clone of the Extension Pulse repo:

```bash
# Link the CLI to the new Supabase project
supabase link --project-ref <project-ref>
# (project-ref is the ID in the Supabase dashboard URL, e.g. abcdefghijklmnop)

# Push all migrations — creates tables, RLS policies, storage bucket, and triggers
supabase db push
```

You should see each migration file listed and confirmed. If any fail, check the error — usually a duplicate object from re-running, which is safe to ignore due to `if not exists` guards.

> **Note:** `supabase db push` does NOT run `seed.sql`. The seed is for local dev only.

---

## Step 3 — Configure Supabase Auth

In the Supabase dashboard → **Authentication → Settings**:

- **Site URL**: set to the final public URL, e.g. `https://pulse.osu.edu`
  *(You can use a temporary Vercel URL now and update it after Step 5)*
- **Redirect URLs**: add `https://pulse.osu.edu/auth/callback`
- **Email provider**: confirm it's enabled
- **Magic Link**: enabled (users click a link to sign in — no passwords)
- Optionally disable "Confirm email" if you want to streamline first login

For **SSO (university identity provider)** — requires Supabase Pro or Enterprise:
- Go to Authentication → SSO Providers → Add provider
- Protocol: SAML 2.0
- Coordinate with the university IT department for their IdP metadata URL

---

## Step 4 — Configure Mailgun (or client SMTP)

**Using your Mailgun account (default):**
- Use your existing `MAILGUN_API_KEY` and `MAILGUN_DOMAIN`
- Update `MAILGUN_FROM_EMAIL` to match, e.g. `Extension Pulse <noreply@mg.yourdomain.com>`

**Using the university's email infrastructure:**
- Get their SMTP host, port, username, and password from their IT team
- You'll need to adapt `src/lib/email.ts` to use nodemailer with SMTP instead of Mailgun
  (one-time change per client — see note in that file)

---

## Step 5 — Deploy to Vercel

```bash
# From the repo root — deploy to production
vercel --prod
```

When prompted:
- Link to your Vercel account
- Create a new project (name it e.g. `osu-extension-pulse`)
- Set the root directory to `.` (default)
- Framework: Next.js (auto-detected)

Then in the **Vercel dashboard → Project → Settings → Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From Step 1 | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Step 1 | |
| `SUPABASE_SERVICE_ROLE_KEY` | From Step 1 | Mark as **Sensitive** |
| `ANTHROPIC_API_KEY` | Your key or client's | Mark as **Sensitive** |
| `MAILGUN_API_KEY` | From Step 4 | Mark as **Sensitive** |
| `MAILGUN_DOMAIN` | From Step 4 | |
| `MAILGUN_FROM_EMAIL` | e.g. `Extension Pulse <noreply@mg.yourdomain.com>` | |
| `NEXT_PUBLIC_APP_URL` | Final public URL (Step 6) or temp Vercel URL | |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Optional | |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Optional | Mark as **Sensitive** |

After adding variables, trigger a **redeploy** from the Vercel dashboard.

---

## Step 6 — Set up a custom domain (optional but recommended)

Universities will want their own domain (e.g. `pulse.osu.edu`).

In **Vercel → Project → Settings → Domains**:
1. Add the domain, e.g. `pulse.osu.edu`
2. Vercel will give you a CNAME record to add
3. Send the university IT team the CNAME record — they add it to their DNS
4. Vercel auto-provisions an SSL certificate once DNS propagates (~5–30 min)

After the domain is live:
- Update `NEXT_PUBLIC_APP_URL` in Vercel env vars to the custom domain
- Update **Supabase Auth → Site URL** and **Redirect URLs** to match
- Redeploy

---

## Step 7 — Create the first admin account

The database is empty — no users or programs yet. Do this:

1. Open the app URL and sign in with your email via magic link.
2. In the **Supabase dashboard → Table Editor → programs**, insert the first program:
   - `name`: e.g. `Ohio State Extension`
   - `slug`: e.g. `osu-extension`
   - `brand_color`: the university's brand hex colour e.g. `#bb0000`
3. Copy the `id` of the new program row.
4. In **Table Editor → program_memberships**, insert a row:
   - `user_id`: your user ID (find it in Authentication → Users)
   - `program_id`: the ID from above
   - `role`: `super_admin`
5. Refresh the app — you now have full admin access.
6. Use **Settings → Users & Roles** inside the app to invite the university's admin user.
7. Once they've signed in, you can remove yourself from the membership if needed.

---

## Step 8 — Handoff checklist

Before handing off to the client:

- [ ] Magic link sign-in works (send yourself a test link)
- [ ] Invitation email sends and token link opens the form correctly
- [ ] PDF upload in Pulse extracts text (upload a test PDF, check Files page for green badge)
- [ ] Sidekick responds correctly (ask it something about the program)
- [ ] Custom domain resolves over HTTPS with no certificate warning
- [ ] Client admin user can sign in and access their program
- [ ] Remove your own `super_admin` membership if the client shouldn't see your access

---

## Infrastructure options cheat sheet

| Concern | Default (simplest) | Client-owned option |
|---|---|---|
| Database | Your Supabase org | Their Supabase org — same CLI steps, they own billing |
| AI | Your Anthropic key | Their `ANTHROPIC_API_KEY` env var |
| Email | Your Mailgun | Their SMTP — update `src/lib/email.ts` |
| Auth | Supabase magic link | SAML SSO via Supabase Pro (coordinate with their IdP) |
| AI provider | Anthropic Claude | Azure OpenAI — requires SDK swap in `src/app/api/ai/` |
| Hosting | Vercel (your account) | Vercel (their account) — transfer project in Vercel dashboard |

---

## Keeping instances up to date

When you push a new release to the GitHub repo:

1. **App code**: Vercel auto-deploys from the main branch if connected. Or run `vercel --prod` manually.
2. **New migrations**: Run `supabase link --project-ref <ref> && supabase db push` for each instance that needs the migration.

Consider keeping a simple spreadsheet with one row per client instance:

| Client | Supabase project ref | Vercel project | Domain | Supabase org | Notes |
|---|---|---|---|---|---|
| OSU | `abcdef...` | `osu-extension-pulse` | pulse.osu.edu | yours | SSO pending |
