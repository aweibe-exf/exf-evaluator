-- Add optional title field to pulse notes
alter table pulse_notes
  add column if not exists title text;
