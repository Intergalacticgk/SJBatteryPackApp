import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The AHL "Gamecenter" feed (feed=gc&tab=gamesummary) — confirmed live
// against a real finished game. It's the same feed live-game-monitor
// already uses for live score tracking, and it carries the box score AND
// the three-stars picks (mvps) in one response.
const AHL_KEY = "ccb91f29d6744675";
const CLIENT_CODE = "ahl";

// --- Ported from components/LastEncounter.tsx (mapGamecenterSummary) ---
// Keep these two in sync if the feed shape ever changes.
function formatPlayerName(player: any): string {
  if (!player) return "";
  const first = (player.firstName || player.first_name || "").trim();
  const last = (player.lastName || player.last_name || "").trim();
  if (!first && !last) return (player.name || "").trim();
  const initial = first ? `${first.charAt(0).toUpperCase()}.` : "";
  return `${initial} ${last}`.trim();
}

// Pure mapper — no fetch calls, easy to reuse and test.
// Parses the AHL "Gamecenter" feed (feed=gc&tab=gamesummary), the source
// confirmed live against real data — including its native "mvps" array,
// which is the three stars of the game.
function mapGamecenterSummary(
  gc: any,
  isSJHome: boolean,
  oppAbbr: string
): any | null {
  if (!gc || !gc.periods || !gc.home || !gc.visitor) return null;

  const homeTeamId = String(gc.home.id ?? gc.meta?.home_team ?? '');
  const visTeamId = String(gc.visitor.id ?? gc.meta?.visiting_team ?? '');

  const homeSog = Number(gc.totalShots?.home || 0);
  const visSog = Number(gc.totalShots?.visitor || 0);

  const homePP = `${gc.powerPlayGoals?.home || 0}/${gc.powerPlayCount?.home || 0}`;
  const visPP = `${gc.powerPlayGoals?.visitor || 0}/${gc.powerPlayCount?.visitor || 0}`;

  const homePim = Number(gc.pimTotal?.home || 0);
  const visPim = Number(gc.pimTotal?.visitor || 0);

  // Faceoff totals are present on this feed but come back all-zero on games
  // where the stat wasn't tracked — show "—" rather than a fake 0.0%/50%.
  const homeFo = gc.totalFaceoffs?.home;
  const visFo = gc.totalFaceoffs?.visitor;
  const foPctHome = homeFo?.att ? `${((homeFo.won / homeFo.att) * 100).toFixed(1)}%` : '—';
  const foPctVis = visFo?.att ? `${((visFo.won / visFo.att) * 100).toFixed(1)}%` : '—';

  // goalsByPeriod is keyed "1".."4" (4 = OT, only present if the game went
  // past regulation). A shootout is tracked separately (shootoutDetail /
  // meta.shootout), not as an extra period.
  const homeGoalsByP = gc.goalsByPeriod?.home || {};
  const visGoalsByP = gc.goalsByPeriod?.visitor || {};

  const homeP1 = Number(homeGoalsByP['1'] || 0);
  const visP1 = Number(visGoalsByP['1'] || 0);
  const homeP2 = Number(homeGoalsByP['2'] || 0);
  const visP2 = Number(visGoalsByP['2'] || 0);
  const homeP3 = Number(homeGoalsByP['3'] || 0);
  const visP3 = Number(visGoalsByP['3'] || 0);
  const hasOT = homeGoalsByP['4'] != null || visGoalsByP['4'] != null;
  const homeOT = Number(homeGoalsByP['4'] || 0);
  const visOT = Number(visGoalsByP['4'] || 0);

  const periodInfo: Record<string, any> = gc.periods || {};

  const plays = (gc.goals || []).map((g: any) => {
    const scorerName = formatPlayerName(g.goal_scorer) || 'Goal';
    const assists = [g.assist1_player, g.assist2_player].filter(Boolean);
    const assistNames = assists.map((a: any) => formatPlayerName(a)).filter(Boolean).join(', ');
    // Each goal carries its own home/visitor flag directly — no need to
    // cross-reference team ids.
    const scoredByHome = String(g.home) === '1';
    const isSJGoal = isSJHome ? scoredByHome : !scoredByHome;
    const pInfo = periodInfo[String(g.period_id)];

    return {
      period: pInfo?.short_name || pInfo?.long_name || '—',
      time: g.time || '—',
      team: isSJGoal ? 'SJ' : oppAbbr,
      scorer: scorerName,
      assists: assistNames || 'Unassisted',
      type: g.goal_type || (g.short_handed === '1' ? 'SH' : g.empty_net === '1' ? 'EN' : 'EV'),
    };
  });

  const threeStars = (gc.mvps || []).map((m: any, idx: number) => {
    const isSJStar = isSJHome ? Number(m.home) === 1 : Number(m.home) === 0;
    return {
      rank: idx + 1,
      name: formatPlayerName(m),
      team: isSJStar ? 'SJ' : oppAbbr,
    };
  });

  return {
    sog: isSJHome ? [homeSog, visSog] : [visSog, homeSog],
    pp: isSJHome ? [homePP, visPP] : [visPP, homePP],
    pim: isSJHome ? [homePim, visPim] : [visPim, homePim],
    foPct: isSJHome ? [foPctHome, foPctVis] : [foPctVis, foPctHome],
    periods: {
      p1: isSJHome ? [homeP1, visP1] : [visP1, homeP1],
      p2: isSJHome ? [homeP2, visP2] : [visP2, homeP2],
      p3: isSJHome ? [homeP3, visP3] : [visP3, homeP3],
      ot: hasOT ? (isSJHome ? [homeOT, visOT] : [visOT, homeOT]) : undefined,
    },
    scoringPlays: plays,
    threeStars,
  };
}
// Extracts the San Jose Barracuda's own per-player box score line from a
// FINAL game's gamecenter feed — the authoritative, verified source
// (confirmed live against the Oct 3 2026 home opener, game_id 1029087)
// used by sync-ahl-stats to rebuild `barracuda_roster` stats from scratch
// every run, instead of trusting HockeyTech's cumulative (preseason-
// included) "roster" statviewfeed. Only SJ's own players are kept — the
// opponent's lineup isn't needed here.
function extractSJPlayerStats(gc: any, isSJHome: boolean): any[] {
  const lineup = isSJHome ? gc.home_team_lineup : gc.visitor_team_lineup;
  const goalieDecisions = isSJHome ? gc.goalies?.home : gc.goalies?.visitor;
  const decisionByPlayerId = new Map<string, any>(
    (goalieDecisions || []).map((g: any) => [String(g.player_id || ""), g])
  );

  const skaters = (lineup?.players || []).map((p: any) => ({
    player_id: String(p.player_id || ""),
    name: formatPlayerName(p),
    jersey_number: p.jersey_number || "",
    position: p.position_str || "",
    is_goalie: false,
    goals: Number(p.goals || 0),
    assists: Number(p.assists || 0),
    // plusminus — confirmed live field name, no underscore.
    plus_minus: Number(p.plusminus || 0),
    pim: Number(p.pim || 0),
  }));

  const goalies = (lineup?.goalies || []).map((g: any) => {
    const dec = decisionByPlayerId.get(String(g.player_id || "")) || {};
    return {
      player_id: String(g.player_id || ""),
      name: formatPlayerName(g),
      jersey_number: g.jersey_number || "",
      position: "G",
      is_goalie: true,
      seconds: Number(g.seconds || 0),
      shots_against: Number(g.shots_against || 0),
      goals_against: Number(g.goals_against || 0),
      saves: Number(g.saves || 0),
      win: dec.win === "1",
      loss: dec.loss === "1",
      ot_loss: dec.ot_loss === "1",
      shootout_loss: dec.shootout_loss === "1",
    };
  });

  return [...skaters, ...goalies];
}
// --- end ported block ---

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Only touch games in a tight window around "now": yesterday through
    // tomorrow (Pacific). Keeps this from re-fetching HockeyTech for every
    // non-final game in the whole season on every run.
    const pacificNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
    );
    const windowStart = new Date(pacificNow);
    windowStart.setDate(windowStart.getDate() - 3);
    const windowEnd = new Date(pacificNow);
    windowEnd.setDate(windowEnd.getDate() + 1);

    const fmt = (d: Date) => d.toLocaleDateString("sv-SE");

    const { data: games, error } = await supabase
      .from("schedule")
      .select("*")
      .neq("status", "FINAL")
      .not("game_id", "is", null)
      .gte("game_date", fmt(windowStart))
      .lte("game_date", fmt(windowEnd));

    if (error) throw error;

    const results: any[] = [];

    for (const game of games || []) {
      try {
        const url =
          "https://lscluster.hockeytech.com/feed/index.php?feed=gc&tab=gamesummary&game_id=" +
          game.game_id +
          "&key=" +
          AHL_KEY +
          "&client_code=" +
          CLIENT_CODE;

        const res = await fetch(url);
        const json = await res.json().catch(() => null);
        const gc = json?.GC?.Gamesummary;

        if (!gc || !gc.periods || !gc.home || !gc.visitor) {
          results.push({ game_id: game.game_id, skipped: "no gamecenter data yet" });
          continue;
        }

        const homeGoals = Number(gc.totalGoals?.home ?? 0);
        const visGoals = Number(gc.totalGoals?.visitor ?? 0);

        // Confirmed live fields: meta.status "4" / meta.final "1" /
        // status_value "Final" | "Final OT" | "Final SO".
        const statusText = String(gc.status_value || "").toLowerCase();
        const metaFinal = String(gc.meta?.final || "") === "1";
        const gameDateTime = new Date(`${game.game_date}T${game.game_time || "19:00"}`);
        const hoursSinceStart = (Date.now() - gameDateTime.getTime()) / 3_600_000;

        const isFinal = statusText.includes("final") || metaFinal || hoursSinceStart > 5;

        const status = isFinal ? "FINAL" : hoursSinceStart > 0 ? "IN_PROGRESS" : "SCHEDULED";

        const updatePayload: Record<string, unknown> = {
          home_score: homeGoals,
          away_score: visGoals,
          status,
        };

        if (isFinal) {
          const isSJHome = game.home_away === "HOME";
          const oppAbbr = game.opponent_abbr || "OPP";
          const mapped = mapGamecenterSummary(gc, isSJHome, oppAbbr);
          if (mapped) {
            mapped.playerStats = extractSJPlayerStats(gc, isSJHome);
            updatePayload.stats = mapped;
          }
        }

        // Matched by game_id (our own schedule table's key), not a fuzzy
        // text match against date_display — fixes missed/duplicate updates.
        const { error: updateError } = await supabase
          .from("schedule")
          .update(updatePayload)
          .eq("game_id", game.game_id);

        if (updateError) throw updateError;

        results.push({
          game_id: game.game_id,
          status,
          home_score: homeGoals,
          away_score: visGoals,
          statsWritten: Boolean(isFinal && updatePayload.stats),
        });
      } catch (gameErr: any) {
        results.push({ game_id: game.game_id, error: gameErr.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
