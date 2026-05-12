-- ============================================================
-- Saved Visualizations: AI-generated charts stored per program
-- ============================================================

create table if not exists saved_visualizations (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references programs(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete cascade,
  created_by_email text,
  title         text not null,
  description   text,
  prompt        text not null,
  config        jsonb not null,   -- full ChartConfig object
  created_at    timestamptz not null default now()
);

alter table saved_visualizations enable row level security;

-- All program members can view saved visualizations
create policy "saved_viz: members can read"
  on saved_visualizations for select
  using (
    is_super_admin()
    or is_program_admin_or_above(program_id)
    or exists (
      select 1 from program_memberships
      where user_id = auth.uid()
        and program_id = saved_visualizations.program_id
    )
  );

-- Any program member can save a visualization (as themselves)
create policy "saved_viz: members can insert"
  on saved_visualizations for insert
  with check (
    created_by = auth.uid()
    and (
      is_super_admin()
      or exists (
        select 1 from program_memberships
        where user_id = auth.uid()
          and program_id = saved_visualizations.program_id
      )
    )
  );

-- Creator or admin can delete
create policy "saved_viz: creator or admin can delete"
  on saved_visualizations for delete
  using (
    created_by = auth.uid()
    or is_super_admin()
    or is_program_admin_or_above(program_id)
  );
