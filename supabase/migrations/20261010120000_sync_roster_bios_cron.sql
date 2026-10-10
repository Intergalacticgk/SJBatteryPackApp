-- Hourly (:15) Barracuda bio sync from the HockeyTech roster feed.
select cron.schedule(
  'sync-roster-bios-hourly',
  '15 * * * *',
  $$ select net.http_post(
       url := 'https://esagmbctmupjijkcexht.supabase.co/functions/v1/sync-roster-bios',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 30000
     ); $$
);
