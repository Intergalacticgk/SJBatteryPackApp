import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AHL_API_KEY = "50c2cd9b5e18e390";
const BARRACUDA_TEAM_ID = 407;

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = `https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=schedule&team_id=${BARRACUDA_TEAM_ID}&key=${AHL_API_KEY}&client_code=ahl&season_id=84&league_id=4`;
    const res = await fetch(url);
    const rawData = await res.json();
    const games = rawData[0]?.sections?.[0]?.data || [];

    for (const g of games) {
      const gData = g.row;
      if (!gData) continue;

      const gameDate = gData.date_with_day;
      const isFinal = gData.final === "1";
      const isInProgress = gData.started === "1" && !isFinal;

      const homeScore = parseInt(gData.home_goal_count, 10);
      const awayScore = parseInt(gData.visiting_goal_count, 10);

      const status = isFinal ? "FINAL" : isInProgress ? "IN_PROGRESS" : "SCHEDULED";

      await supabase
        .from("schedule")
        .update({
          home_score: isNaN(homeScore) ? null : homeScore,
          away_score: isNaN(awayScore) ? null : awayScore,
          status: status,
        })
        .ilike("date_display", `%${gameDate}%`);
    }

    return new Response(JSON.stringify({ success: true, updated: games.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});