-- Store author email directly on pulse_notes so we don't need a
-- cross-schema join to auth.users (which PostgREST can't traverse).
alter table pulse_notes
  add column if not exists author_email text;
