-- Migration: Respondent accounts
-- Respondents authenticate via Supabase auth but have no program_membership row.
-- They can read their own submissions via submitted_by = auth.uid().

-- Add RLS policy: respondents can see their own submissions
-- (The existing RLS on submissions already has program staff policies;
-- we add a self-read policy here.)

create policy "respondents_read_own_submissions"
  on submissions for select
  using (submitted_by = auth.uid());

-- Allow respondents to update their own draft submissions
create policy "respondents_update_own_draft"
  on submissions for update
  using (submitted_by = auth.uid() and status = 'draft');

-- Index to support the submitted_by lookup efficiently
create index if not exists idx_submissions_submitted_by on submissions(submitted_by);
