import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SEASON_LABEL = '2026-2027';

const AHL_KEY = 'ccb91f29d6744675';
const BARRACUDA_TEAM_ID = '405';
// HockeyTech runs preseason ("93") and the regular season ("94") as two
// separate season_ids. This used to point at 93 (frozen preseason totals).
// Confirmed live Oct 4 2026: season 94 returns clean regular-season-only
// player rows (1 GP each after the Oct 3 opener).
const AHL_SEASON_ID = '94';

const ZERO_NHL = { gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, nhl_gp: 0, nhl_goals: 0, nhl_assists: 0, nhl_points: 0, nhl_plus_minus: 0, nhl_pim: 0 };
const ZERO_AHL = { gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, ahl_gp: 0, ahl_goals: 0, ahl_assists: 0, ahl_points: 0, ahl_plus_minus: 0, ahl_pim: 0 };

Deno.serve(async (_req) => {
  const summary = {
    nhl_feed_players: 0,
    nhl_updated: 0,
    nhl_zeroed: 0,
    nhl_banked_updated: 0,
    ahl_feed_players: 0,
    ahl_updated: 0,
    ahl_zeroed: 0,
    errors: [] as string[],
  };

  try {
    const { data: prospects, error: prospectsError } = await supabase
      .from('sharks_prospects')
      .select('id, name, league, region, nhl_id')
      .eq('region', 'SHARKS')
      .eq('season', SEASON_LABEL);

    if (prospectsError) throw prospectsError;
    const rows = prospects || [];

    // ---------------- NHL (Sharks club stats, regular season) ----------------
    try {
      const nhlRes = await fetch('https://api-web.nhle.com/v1/club-stats/SJS/now');
      if (!nhlRes.ok) throw new Error(`HTTP ${nhlRes.status}`);
      const nhlJson = await nhlRes.json();

      const byPlayerId = new Map<string, any>();
      for (const s of nhlJson?.skaters || []) {
        byPlayerId.set(String(s.playerId), {
          gp: Number(s.gamesPlayed || 0),
          goals: Number(s.goals || 0),
          assists: Number(s.assists || 0),
          points: Number(s.points || 0),
          plus_minus: Number(s.plusMinus || 0),
          pim: Number(s.penaltyMinutes || 0),
        });
      }
      for (const g of nhlJson?.goalies || []) {
        byPlayerId.set(String(g.playerId), {
          gp: Number(g.gamesPlayed || 0),
          goals: Number(g.goals || 0),
          assists: Number(g.assists || 0),
          points: Number(g.points || 0),
          plus_minus: 0,
          pim: Number(g.penaltyMinutes || 0),
        });
      }
      summary.nhl_feed_players = byPlayerId.size;

      for (const row of rows) {
        if (!row.nhl_id) continue;
        const stat = byPlayerId.get(String(row.nhl_id));

        if (!stat) {
          // Rostered NHL player with no games yet this season: make sure no
          // stale number sits there. Only done when the feed itself returned
          // data, so a blank/failed fetch can never wipe real stats.
          if (byPlayerId.size > 0 && row.league === 'NHL') {
            const { error: zErr } = await supabase.from('sharks_prospects').update(ZERO_NHL).eq('id', row.id);
            if (zErr) summary.errors.push(`NHL zero ${row.name}: ${zErr.message}`);
            else summary.nhl_zeroed++;
          }
          continue;
        }

        const { error: updErr } = await supabase
          .from('sharks_prospects')
          .update({
            current_team: 'San Jose Sharks',
            league: 'NHL',
            gp: stat.gp,
            goals: stat.goals,
            assists: stat.assists,
            points: stat.points,
            plus_minus: stat.plus_minus,
            pim: stat.pim,
            nhl_gp: stat.gp,
            nhl_goals: stat.goals,
            nhl_assists: stat.assists,
            nhl_points: stat.points,
            nhl_plus_minus: stat.plus_minus,
            nhl_pim: stat.pim,
          })
          .eq('id', row.id);

        if (updErr) summary.errors.push(`NHL update ${row.name}: ${updErr.message}`);
        else summary.nhl_updated++;
      }

      // AHL-assigned prospects who have also appeared in an NHL game this
      // season: bank their NHL totals separately.
      const ahlLeagueRowsWithNhlId = rows.filter((r) => r.league === 'AHL' && r.nhl_id);
      for (const row of ahlLeagueRowsWithNhlId) {
        if (byPlayerId.has(String(row.nhl_id))) continue;
        try {
          const landingRes = await fetch(`https://api-web.nhle.com/v1/player/${row.nhl_id}/landing`);
          const landing = await landingRes.json();
          const season = landing?.featuredStats?.season;
          const sub = landing?.featuredStats?.regularSeason?.subSeason;
          if (season === 20262027 && sub && Number(sub.gamesPlayed || 0) > 0) {
            const { error: bankErr } = await supabase
              .from('sharks_prospects')
              .update({
                nhl_gp: Number(sub.gamesPlayed || 0),
                nhl_goals: Number(sub.goals || 0),
                nhl_assists: Number(sub.assists || 0),
                nhl_points: Number(sub.points || 0),
                nhl_plus_minus: Number(sub.plusMinus || 0),
                nhl_pim: Number(sub.pim || 0),
              })
              .eq('id', row.id);
            if (bankErr) summary.errors.push(`NHL banked ${row.name}: ${bankErr.message}`);
            else summary.nhl_banked_updated++;
          }
        } catch (e) {
          summary.errors.push(`NHL banked fetch ${row.name}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      summary.errors.push(`NHL fetch failed: ${(e as Error).message}`);
    }

    // ---------------- AHL (Barracuda player stats, regular season) ----------------
    try {
      const statsUrl =
        'https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=players&team=' +
        BARRACUDA_TEAM_ID +
        '&season=' +
        AHL_SEASON_ID +
        '&client_code=ahl&league_id=4&key=' +
        AHL_KEY +
        '&lang=en';
      const statsRes = await fetch(statsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      const rawText = await statsRes.text();
      const jsonText = rawText.trim().startsWith('(') ? rawText.trim().slice(1, -1) : rawText;
      const parsed = JSON.parse(jsonText);
      const sections = (Array.isArray(parsed) ? parsed[0]?.sections : parsed?.sections) || [];
      const dataRows = sections.flatMap((s: any) => s.data || []);

      const byName = new Map<string, any>();
      for (const entry of dataRows) {
        const r = entry.row || {};
        const key = String(r.name || '').trim().toLowerCase();
        if (!key) continue;
        byName.set(key, {
          gp: parseInt(r.games_played || '0', 10),
          goals: parseInt(r.goals || '0', 10),
          assists: parseInt(r.assists || '0', 10),
          points: parseInt(r.points || '0', 10),
          plus_minus: parseInt(r.plus_minus || '0', 10),
          pim: parseInt(r.penalty_minutes || '0', 10),
        });
      }
      summary.ahl_feed_players = byName.size;

      const ahlLeagueRows = rows.filter((r) => r.league === 'AHL');
      for (const row of ahlLeagueRows) {
        const stat = byName.get(row.name.trim().toLowerCase());
        if (!stat) {
          // Same guard as NHL: only zero stale values when the feed returned
          // data, so an outage never wipes real numbers.
          if (byName.size > 0) {
            const { error: zErr } = await supabase.from('sharks_prospects').update(ZERO_AHL).eq('id', row.id);
            if (zErr) summary.errors.push(`AHL zero ${row.name}: ${zErr.message}`);
            else summary.ahl_zeroed++;
          }
          continue;
        }

        const { error: updErr } = await supabase
          .from('sharks_prospects')
          .update({
            gp: stat.gp,
            goals: stat.goals,
            assists: stat.assists,
            points: stat.points,
            plus_minus: stat.plus_minus,
            pim: stat.pim,
            ahl_gp: stat.gp,
            ahl_goals: stat.goals,
            ahl_assists: stat.assists,
            ahl_points: stat.points,
            ahl_plus_minus: stat.plus_minus,
            ahl_pim: stat.pim,
          })
          .eq('id', row.id);

        if (updErr) summary.errors.push(`AHL update ${row.name}: ${updErr.message}`);
        else summary.ahl_updated++;
      }
    } catch (e) {
      summary.errors.push(`AHL fetch failed: ${(e as Error).message}`);
    }

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message, ...summary }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
