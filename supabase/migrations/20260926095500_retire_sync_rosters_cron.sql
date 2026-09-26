-- sync-rosters (the function, not sync-ahl-stats) turned out to be dead/
-- broken code: it fetches team_id=408, which isn't a valid AHL team in
-- HockeyTech's own id scheme (San Jose Barracuda is 405), and it merges NHL
-- Sharks players directly into barracuda_roster (an AHL-only table) using a
-- column schema (player_id/first_name/last_name/games_played) that doesn't
-- match what roster.tsx actually reads (id/name/gp/season). sync-ahl-stats
-- already does the correct version of this job. Un-scheduling it here.
--
-- Run this in SQL Editor the same way as the original setup script.

select cron.unschedule('sync-rosters-daily');

-- Verify: select * from cron.job; -- should now show 3 jobs, not 4.
