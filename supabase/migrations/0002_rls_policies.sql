-- EXF Evaluator — Row Level Security Policies

-- Enable RLS on all tables
alter table programs enable row level security;
alter table program_memberships enable row level security;
alter table form_templates enable row level security;
alter table forms enable row level security;
alter table submission_tokens enable row level security;
alter table submissions enable row level security;
alter table ai_summaries enable row level security;
alter table reports enable row level security;
alter table import_jobs enable row level security;
alter table audit_log enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns the role of the current user in a given program (null if not a member)
create or replace function my_role_in(p_program_id uuid)
returns user_role language sql security definer stable as $$
  select role from program_memberships
  where user_id = auth.uid() and program_id = p_program_id
  limit 1;
$$;

-- Returns true if the current user is a super_admin in any program
create or replace function is_super_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from program_memberships
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

-- Returns true if user is admin or above in a program
create or replace function is_program_admin_or_above(p_program_id uuid)
returns boolean language sql security definer stable as $$
  select my_role_in(p_program_id) in ('super_admin', 'program_admin');
$$;

-- ============================================================
-- PROGRAMS
-- ============================================================

create policy "programs: super_admin sees all"
  on programs for select
  using (is_super_admin());

create policy "programs: members see their programs"
  on programs for select
  using (
    exists (
      select 1 from program_memberships
      where user_id = auth.uid() and program_id = programs.id
    )
  );

create policy "programs: super_admin can insert"
  on programs for insert
  with check (is_super_admin());

create policy "programs: super_admin can update"
  on programs for update
  using (is_super_admin());

-- ============================================================
-- PROGRAM MEMBERSHIPS
-- ============================================================

create policy "memberships: users see own"
  on program_memberships for select
  using (user_id = auth.uid() or is_super_admin() or is_program_admin_or_above(program_id));

create policy "memberships: super_admin or program_admin can insert"
  on program_memberships for insert
  with check (is_super_admin() or is_program_admin_or_above(program_id));

create policy "memberships: super_admin or program_admin can update"
  on program_memberships for update
  using (is_super_admin() or is_program_admin_or_above(program_id));

create policy "memberships: super_admin or program_admin can delete"
  on program_memberships for delete
  using (is_super_admin() or is_program_admin_or_above(program_id));

-- ============================================================
-- FORM TEMPLATES
-- ============================================================

create policy "templates: members can view program templates"
  on form_templates for select
  using (
    is_global = true
    or is_super_admin()
    or (program_id is not null and exists (
      select 1 from program_memberships
      where user_id = auth.uid() and program_id = form_templates.program_id
    ))
  );

create policy "templates: program_admin can insert"
  on form_templates for insert
  with check (is_super_admin() or is_program_admin_or_above(program_id));

create policy "templates: program_admin can update"
  on form_templates for update
  using (is_super_admin() or is_program_admin_or_above(program_id));

-- ============================================================
-- FORMS
-- ============================================================

create policy "forms: members can view"
  on forms for select
  using (
    is_super_admin()
    or exists (
      select 1 from program_memberships
      where user_id = auth.uid() and program_id = forms.program_id
    )
  );

create policy "forms: program_admin can insert"
  on forms for insert
  with check (is_super_admin() or is_program_admin_or_above(program_id));

create policy "forms: program_admin can update"
  on forms for update
  using (is_super_admin() or is_program_admin_or_above(program_id));

create policy "forms: program_admin can delete"
  on forms for delete
  using (is_super_admin() or is_program_admin_or_above(program_id));

-- ============================================================
-- SUBMISSION TOKENS
-- ============================================================

create policy "tokens: program members can view"
  on submission_tokens for select
  using (
    is_super_admin()
    or exists (
      select 1 from forms f
      join program_memberships pm on pm.program_id = f.program_id
      where f.id = submission_tokens.form_id and pm.user_id = auth.uid()
    )
  );

create policy "tokens: program_admin can insert"
  on submission_tokens for insert
  with check (
    is_super_admin()
    or exists (
      select 1 from forms f
      where f.id = form_id and is_program_admin_or_above(f.program_id)
    )
  );

-- ============================================================
-- SUBMISSIONS
-- ============================================================

create policy "submissions: program members (staff+) can view"
  on submissions for select
  using (
    is_super_admin()
    or submitted_by = auth.uid()
    or exists (
      select 1 from forms f
      join program_memberships pm on pm.program_id = f.program_id
      where f.id = submissions.form_id
        and pm.user_id = auth.uid()
        and pm.role in ('super_admin', 'program_admin', 'staff', 'viewer')
    )
  );

-- External submitters insert via service role (API route), so no policy needed for anon insert.
-- Authenticated staff can insert their own submissions.
create policy "submissions: authenticated users can insert own"
  on submissions for insert
  with check (submitted_by = auth.uid() or submitted_by is null);

create policy "submissions: program_admin can update status"
  on submissions for update
  using (
    is_super_admin()
    or exists (
      select 1 from forms f
      where f.id = submissions.form_id and is_program_admin_or_above(f.program_id)
    )
  );

-- ============================================================
-- AI SUMMARIES
-- ============================================================

create policy "ai_summaries: program members can view"
  on ai_summaries for select
  using (
    is_super_admin()
    or exists (
      select 1 from program_memberships
      where user_id = auth.uid() and program_id = ai_summaries.program_id
    )
  );

create policy "ai_summaries: program_admin can insert"
  on ai_summaries for insert
  with check (is_super_admin() or is_program_admin_or_above(program_id));

-- ============================================================
-- REPORTS
-- ============================================================

create policy "reports: program members can view"
  on reports for select
  using (
    is_super_admin()
    or exists (
      select 1 from program_memberships
      where user_id = auth.uid() and program_id = reports.program_id
    )
  );

create policy "reports: program_admin can insert/update"
  on reports for insert
  with check (is_super_admin() or is_program_admin_or_above(program_id));

create policy "reports: program_admin can update"
  on reports for update
  using (is_super_admin() or is_program_admin_or_above(program_id));

-- ============================================================
-- IMPORT JOBS
-- ============================================================

create policy "import_jobs: program_admin can view"
  on import_jobs for select
  using (is_super_admin() or is_program_admin_or_above(program_id));

create policy "import_jobs: program_admin can insert"
  on import_jobs for insert
  with check (is_super_admin() or is_program_admin_or_above(program_id));

create policy "import_jobs: program_admin can update"
  on import_jobs for update
  using (is_super_admin() or is_program_admin_or_above(program_id));

-- ============================================================
-- AUDIT LOG
-- ============================================================

create policy "audit_log: program_admin can view"
  on audit_log for select
  using (is_super_admin() or is_program_admin_or_above(program_id));

-- Audit log inserts go through service role only (API routes)
