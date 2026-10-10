-- Profile photos (Oliver, 2026-10-10 15:09Z). profiles.avatar_path already exists; what was missing is somewhere to
-- keep the file. A private bucket, one folder per user named after their id: only the owner can read, upload or
-- delete its own photos (the app shows the photo with a short-lived signed URL), and nobody else's photo can be
-- read or replaced. The photo only shows to its owner today, so the bucket doesn't need to be public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 3145728, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

create policy "avatars: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- a profile can only point at a photo in its own folder
alter table public.profiles add constraint profiles_avatar_own_folder
  check (avatar_path is null or (avatar_path like id::text || '/%' and char_length(avatar_path) <= 200));
