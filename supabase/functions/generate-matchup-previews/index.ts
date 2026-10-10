import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Generates a short "matchup preview" blurb for each of the next several
// scheduled (not yet FINAL) games, based on how San Jose has done against
// that specific opponent so far THIS SEASON (regular season only; schedule
// rows already synced by sync-scores). No HockeyTech calls here — it's a pure
// read/summarize over our own `schedule` table.
//
// Regeneration runs during the Pacific midnight hour (hourly cron, JS-side
// Pacific check so it stays correct across DST). `?force=1` regenerates now.

function cleanOpponentName(raw: string): string {
  return (raw || "")
    .replace(
      /(San Jose|San Diego|Colorado|Ontario|Bakersfield|Calgary|Abbotsford|Tucson|Coachella Valley|Henderson|Texas|Chicago)\s+/i,
      ""
    )
    .trim() || raw || "Opponent";
}

interface ScheduleRow {
  id: string;
  game_id: string | null;
  game_date: string;
  date_display: string | null;
  opponent: string;
  home_away: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  theme_night: string | null;
}

function buildPreview(opponentRaw: string, pastMeetings: ScheduleRow[]): string {
  const opponentName = cleanOpponentName(opponentRaw);

  if (pastMeetings.length === 0) {
    return `First meeting of the season between the Barracuda and the ${opponentName}.`;
  }

  let sjWins = 0;
  let sjLosses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const g of pastMeetings) {
    const isHome = g.home_away === "HOME";
    const sjScore = Number((isHome ? g.home_score : g.away_score) ?? 0);
    const oppScore = Number((isHome ? g.away_score : g.home_score) ?? 0);
    goalsFor += sjScore;
    goalsAgainst += oppScore;
    if (sjScore > oppScore) sjWins++;
    else sjLosses++;
  }

  const last = pastMeetings[pastMeetings.length - 1];
  const lastIsHome = last.home_away === "HOME";
  const lastSjScore = Number((lastIsHome ? last.home_score : last.away_score) ?? 0);
  const lastOppScore = Number((lastIsHome ? last.away_score : last.home_score) ?? 0);
  const lastWasWin = lastSjScore > lastOppScore;
  const lastDate = last.date_display || last.game_date;

  // Scores read winner-first ("7-4"), and the wording follows who actually
  // scored more: outscoring / getting outscored / even.
  const hi = Math.max(goalsFor, goalsAgainst);
  const lo = Math.min(goalsFor, goalsAgainst);
  const goalsLine =
    goalsFor > goalsAgainst
      ? `outscoring them ${hi}-${lo}`
      : goalsFor < goalsAgainst
      ? `getting outscored ${hi}-${lo}`
      : `with goals even at ${goalsFor}-${goalsAgainst}`;
  const recordLine = `San Jose is ${sjWins}-${sjLosses} this season against the ${opponentName}, ${goalsLine}.`;

  const lastHi = Math.max(lastSjScore, lastOppScore);
  const lastLo = Math.min(lastSjScore, lastOppScore);
  const lastLine = ` They last met on ${lastDate}, with the Barracuda ${
    lastWasWin ? "winning" : "falling"
  } ${lastHi}-${lastLo}.`;

  return recordLine + lastLine;
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const pacificNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
    );
    const pacificHour = pacificNow.getHours();
    const todayStr = pacificNow.toLocaleDateString("sv-SE");

    const url = new URL(_req.url);
    const force = url.searchParams.get("force") === "1";

    if (pacificHour !== 0 && !force) {
      return new Response(
        JSON.stringify({ success: true, skipped: "not the midnight Pacific hour", pacificHour }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { data: allGames, error } = await supabase
      .from("schedule")
      .select("id, game_id, game_date, date_display, opponent, home_away, status, home_score, away_score, theme_night")
      .order("game_date", { ascending: true });

    if (error) throw error;

    const rows = (allGames || []) as ScheduleRow[];

    const upcoming = rows
      .filter((g) => String(g.status || "").toUpperCase() !== "FINAL" && g.game_date >= todayStr)
      .slice(0, 8); // buffer beyond the 4 shown on the Home screen

    const results: any[] = [];

    for (const game of upcoming) {
      // Regular-season meetings only: preseason games must not count toward
      // the "this season" record or goal totals.
      const pastMeetings = rows.filter(
        (g) =>
          g.opponent === game.opponent &&
          String(g.status || "").toUpperCase() === "FINAL" &&
          g.game_date < game.game_date &&
          !/preseason/i.test(String(g.theme_night || ""))
      );

      const previewText = buildPreview(game.opponent, pastMeetings);

      const { error: updateError } = await supabase
        .from("schedule")
        .update({ preview_text: previewText, preview_generated_at: new Date().toISOString() })
        .eq("id", game.id);

      results.push({
        id: game.id,
        opponent: game.opponent,
        game_date: game.game_date,
        pastMeetings: pastMeetings.length,
        updated: !updateError,
        error: updateError?.message,
      });
    }

    return new Response(
      JSON.stringify({ success: true, generated: results.length, results }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
