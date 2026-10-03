-- Profile photo uploads from My Locker Room -> Basic Information.
-- profiles.avatar_url already existed as a column (unused until now).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Auth Avatar Upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

create policy "Auth Avatar Update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

create policy "Public Avatar View" on storage.objects
  for select
  using (bucket_id = 'avatars');
