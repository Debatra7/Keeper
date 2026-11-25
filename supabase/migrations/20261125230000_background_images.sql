insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('background-images', 'background-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their background images"
  on storage.objects for select to authenticated
  using (bucket_id = 'background-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their background images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'background-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their background images"
  on storage.objects for update to authenticated
  using (bucket_id = 'background-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'background-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their background images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'background-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
