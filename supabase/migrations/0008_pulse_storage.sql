-- ============================================================
-- Pulse Notes: Storage bucket for PDF / image attachments
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pulse-note-attachments',
  'pulse-note-attachments',
  true,
  20971520,  -- 20 MB
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
  ]
)
on conflict (id) do nothing;

-- Authenticated users can upload to their own folder (user_id/program_id/...)
create policy "pulse attachments: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pulse-note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read (URLs are non-guessable UUIDs)
create policy "pulse attachments: public read"
  on storage.objects for select
  using (bucket_id = 'pulse-note-attachments');

-- Authors can delete their own files
create policy "pulse attachments: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'pulse-note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
