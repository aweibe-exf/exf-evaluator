-- Program narratives: award/grant context documents tied to a date range
-- Used to ground AI reports with the actual program narrative and goals

create table if not exists program_narratives (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references programs(id) on delete cascade,
  title         text not null,
  description   text,
  -- Extracted text content (from PDF or manual entry)
  content       text not null,
  -- Original file reference (optional)
  file_name     text,
  -- Date range this narrative covers (used for matching to reporting periods)
  starts_at     date not null,
  ends_at       date not null,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint narratives_dates_check check (ends_at >= starts_at)
);

create index on program_narratives (program_id, starts_at, ends_at);

-- RLS: same pattern as other program-scoped tables
alter table program_narratives enable row level security;

create policy "Program members can read narratives"
  on program_narratives for select
  using (
    exists (
      select 1 from program_memberships
      where program_memberships.program_id = program_narratives.program_id
        and program_memberships.user_id = auth.uid()
    )
  );

create policy "Admins can manage narratives"
  on program_narratives for all
  using (
    exists (
      select 1 from program_memberships
      where program_memberships.program_id = program_narratives.program_id
        and program_memberships.user_id = auth.uid()
        and program_memberships.role in ('super_admin', 'program_admin')
    )
  );
