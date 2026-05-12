-- ============================================================
-- Pulse Notes: real-time qualitative field observations
-- ============================================================

create table if not exists pulse_notes (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references programs(id) on delete cascade,
  author_id     uuid not null references auth.users(id) on delete cascade,
  content       text not null default '',
  source        text not null default 'typed',  -- 'typed' | 'voice' | 'google_doc' | 'attachment'
  note_date     date not null default current_date,
  google_doc_url text,
  attachments   jsonb not null default '[]',    -- [{name, url, size, type}]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table pulse_notes enable row level security;

-- Staff see only their own notes; admins see all in their program
create policy "pulse_notes: authors see own"
  on pulse_notes for select
  using (
    author_id = auth.uid()
    or is_super_admin()
    or is_program_admin_or_above(program_id)
  );

-- Any program member can create a note (as themselves)
create policy "pulse_notes: members can insert"
  on pulse_notes for insert
  with check (
    author_id = auth.uid()
    and (
      is_super_admin()
      or exists (
        select 1 from program_memberships
        where user_id = auth.uid()
          and program_id = pulse_notes.program_id
      )
    )
  );

-- Authors update their own; admins update any in their program
create policy "pulse_notes: authors can update own"
  on pulse_notes for update
  using (
    author_id = auth.uid()
    or is_super_admin()
    or is_program_admin_or_above(program_id)
  );

-- Authors delete their own; admins delete any in their program
create policy "pulse_notes: authors can delete own"
  on pulse_notes for delete
  using (
    author_id = auth.uid()
    or is_super_admin()
    or is_program_admin_or_above(program_id)
  );

-- updated_at auto-maintenance
create or replace function touch_pulse_note()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pulse_notes_updated_at
  before update on pulse_notes
  for each row execute function touch_pulse_note();
