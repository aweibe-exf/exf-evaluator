-- ============================================================
-- Respondent Groups: named lists of emails for bulk invites
-- ============================================================

create table if not exists respondent_groups (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references programs(id) on delete cascade,
  name          text not null,
  emails        text[] not null default '{}',
  created_by    uuid not null references auth.users(id) on delete cascade,
  created_by_email text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table respondent_groups enable row level security;

-- Program admins and members can view groups for their program
create policy "respondent_groups: members can read"
  on respondent_groups for select
  using (
    is_super_admin()
    or is_program_admin_or_above(program_id)
    or exists (
      select 1 from program_memberships
      where user_id = auth.uid()
        and program_id = respondent_groups.program_id
    )
  );

-- Program admins can create groups
create policy "respondent_groups: admins can insert"
  on respondent_groups for insert
  with check (
    created_by = auth.uid()
    and (
      is_super_admin()
      or is_program_admin_or_above(program_id)
    )
  );

-- Creator or admin can update
create policy "respondent_groups: admins can update"
  on respondent_groups for update
  using (
    is_super_admin()
    or is_program_admin_or_above(program_id)
  );

-- Creator or admin can delete
create policy "respondent_groups: admins can delete"
  on respondent_groups for delete
  using (
    created_by = auth.uid()
    or is_super_admin()
    or is_program_admin_or_above(program_id)
  );
