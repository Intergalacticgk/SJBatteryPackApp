alter table public.barracuda_roster add column if not exists on_roster boolean not null default true;
comment on column public.barracuda_roster.on_roster is 'false when the player is no longer on the live HockeyTech AHL roster (called up / sent down); hidden in the app. Maintained by sync-roster-bios.';
