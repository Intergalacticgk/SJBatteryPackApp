-- Default Live Goals & Score Updates to OFF for new push_tokens rows.
-- The in-app opt-in prompt (app/_layout.tsx) is the only way it gets
-- turned on from here.
alter table public.push_tokens alter column notify_live_scores set default false;

-- Reset existing rows to off too, since a client-side bug (fixed alongside
-- this migration) was force-resetting this column to true on every app
-- launch, meaning no existing installs actually had a real "off" choice yet.
update public.push_tokens set notify_live_scores = false;

-- Idempotency log so the gameday/tabling cron (every 5 min) can check
-- "have I already sent this one" without double-sending a notification
-- for the same game.
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  notif_type text not null,
  sent_at timestamptz not null default now(),
  unique (game_id, notif_type)
);
alter table public.notification_log enable row level security;

-- Drives both the Gameday Morning Reminder (9:00-9:04 AM Pacific, any
-- game day) and Events & Tabling Alerts (home games only, +10/+30 min
-- after puck drop, only when a "tabling" category supporter_events row
-- exists for that date) via the gameday-notifications edge function.
select cron.schedule(
  'gameday-notifications-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://esagmbctmupjijkcexht.supabase.co/functions/v1/gameday-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'),
    body := '{}'::jsonb
  );
  $$
);
