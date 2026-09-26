-- Schedules the data-sync edge functions to run automatically via pg_cron + pg_net.
--
-- HOW TO RUN THIS:
--   1. Replace the two placeholders below:
--        <YOUR_PROJECT_REF>        e.g. esagmbctmupjijkcexht
--        <YOUR_SERVICE_ROLE_KEY>   Settings -> API -> service_role key (NOT the publishable/anon key)
--   2. Paste the whole file into Supabase Dashboard -> SQL Editor -> New query, and run it.
--   3. Confirm the jobs exist: select * from cron.job;
--
-- This can't be run from here — I don't have network access to your Supabase
-- project or your service_role key, so this is prepared for you to run once.
--
-- Alternative: Supabase Dashboard -> Edge Functions -> (pick a function) -> Cron
-- tab lets you schedule a function through the UI instead of SQL, if you'd
-- rather skip this file entirely. Same end result.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- live-game-monitor: drives push notifications, needs to be frequent during
-- games. Runs every 2 minutes, every day (cheap no-op on non-game days —
-- it just returns "Game ID not found in schedule table.").
select cron.schedule(
  'live-game-monitor-every-2-min',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/live-game-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- sync-scores: reconciliation pass over the last 3 days / next 1 day of
-- games, keyed by game_id. Every 10 minutes is plenty since live-game-monitor
-- already handles real-time updates for today's game.
select cron.schedule(
  'sync-scores-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/sync-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- sync-rosters: roster/points update, doesn't need to be frequent. Daily at
-- 09:00 UTC (~2am Pacific).
select cron.schedule(
  'sync-rosters-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/sync-rosters',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- sync-ahl-stats: roster + standings + Sharks/prospects. Daily at 09:10 UTC,
-- staggered 10 min after sync-rosters so they don't hammer HockeyTech at
-- the exact same second.
select cron.schedule(
  'sync-ahl-stats-daily',
  '10 9 * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/sync-ahl-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To remove a schedule later:
--   select cron.unschedule('live-game-monitor-every-2-min');
-- To see run history:
--   select * from cron.job_run_details order by start_time desc limit 20;
