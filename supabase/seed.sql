-- Extension Pulse — seed data
--
-- This file runs automatically during `supabase db reset` (local dev only).
-- It is NOT pushed to production via `supabase db push`.
--
-- For a new production instance, the first super_admin is created manually
-- after deployment. See DEPLOY.md → Step 7 for instructions.
--
-- Local dev only: create a placeholder program so the app isn't blank.

insert into programs (id, name, slug, description, brand_color)
values (
  gen_random_uuid(),
  'Demo Program',
  'demo',
  'Local development program.',
  '#ea580c'
) on conflict (slug) do nothing;
