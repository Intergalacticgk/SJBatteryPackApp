create table if not exists public.app_update_config (
  platform text primary key check (platform in ('ios','android')),
  latest_version text not null,
  store_url text,
  title text not null default 'A New Update Is Here! 🦈',
  message text not null default 'You''re missing out on the latest Battery Pack features, fixes and Reef upgrades. Update now to get the best gameday experience!',
  updated_at timestamptz not null default now()
);

alter table public.app_update_config enable row level security;

drop policy if exists "app_update_config readable by everyone" on public.app_update_config;
create policy "app_update_config readable by everyone"
  on public.app_update_config for select
  to anon, authenticated
  using (true);

-- latest_version = the newest build live in the store. Bump it after each store release.
insert into public.app_update_config (platform, latest_version, store_url) values
  ('android', '2.1.21', 'https://play.google.com/store/apps/details?id=com.sjbatterypack.myapp'),
  ('ios', '2.1.21', null)
on conflict (platform) do nothing;
