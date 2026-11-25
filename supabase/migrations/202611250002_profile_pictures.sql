insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-pictures', 'profile-pictures', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can view their profile picture"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can upload their profile picture"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can update their profile picture"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-pictures' and (storage.foldername(name))[1] = (select auth.uid())::text);
