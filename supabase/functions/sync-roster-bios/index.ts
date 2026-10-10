import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fills in / refreshes Barracuda player bio info (birthdate, birthplace, height,
// weight, shoots/catches) from the HockeyTech AHL roster feed, matched by the
// feed's own player_id (barracuda_roster.hockeytech_player_id). Also adds any
// player who is on the live roster but missing from the table. Stats are owned
// by sync-ahl-stats. Add ?debug=1 to preview without writing.
// Confirmed live row shape: { player_id, name, tp_jersey_number, position,
// shoots|catches, birthplace ("Laval, QC"), birthdate (ISO), height_hyphenated
// ("6-0"), w (weight, lbs) }.
const CLIENT_CODE = "ahl";
const AHL_KEY = "ccb91f29d6744675";
const BARRACUDA_TEAM_ID = "405";
const SEASON_IDS = ["94", "93"];
const SEASON_LABEL = "2026-2027";

function parseFeed(text: string): any {
  const t = text.trim();
  return JSON.parse(t.startsWith("(") && t.endsWith(")") ? t.slice(1, -1) : t);
}

const clean = (v: unknown) => {
  const s = v == null ? "" : String(v).trim();
  return s && s !== "0" && s.toLowerCase() !== "null" ? s : "";
};

serve(async (req) => {
  try {
    const debug = new URL(req.url).searchParams.get("debug") === "1";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let rows: any[] = [];
    let seasonUsed = "";
    for (const sid of SEASON_IDS) {
      const url =
        `https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=roster&team_id=${BARRACUDA_TEAM_ID}` +
        `&season_id=${sid}&key=${AHL_KEY}&client_code=${CLIENT_CODE}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = parseFeed(await res.text());
      const sections = json?.roster?.[0]?.sections || [];
      const found: any[] = [];
      for (const section of sections) {
        if ((section.title || "").toLowerCase().includes("personnel")) continue;
        for (const item of section.data || []) {
          if (item?.row?.player_id) found.push(item.row);
        }
      }
      if (found.length >= 10) { rows = found; seasonUsed = sid; break; }
    }

    if (debug) {
      return new Response(JSON.stringify({ season: seasonUsed, count: rows.length, sample: rows.slice(0, 3) }), { headers: { "Content-Type": "application/json" } });
    }
    if (rows.length < 10) {
      return new Response(JSON.stringify({ success: false, reason: "roster feed returned too few players; nothing written", count: rows.length }), { status: 200 });
    }

    let updated = 0;
    const added: string[] = [];
    const errors: string[] = [];
    for (const r of rows) {
      const pid = String(r.player_id).trim();
      const payload: Record<string, unknown> = {};
      const birthdate = clean(r.birthdate) || clean(r.birth_date);
      const birthplace = clean(r.birthplace);
      const height = clean(r.height_hyphenated) || clean(r.height);
      const weight = clean(r.w) || clean(r.weight);
      const shoots = clean(r.shoots) || clean(r.catches);
      if (birthdate) payload.birthdate = birthdate;
      if (birthplace) payload.birthplace = birthplace;
      if (height) payload.height = height;
      if (weight) payload.weight = weight;
      if (shoots) payload.shoots_catches = shoots;

      const { data, error } = await supabase
        .from("barracuda_roster")
        .update(payload)
        .eq("hockeytech_player_id", pid)
        .neq("season", "2026-2027-duplicate-pending-removal")
        .select("id");
      if (error) { if (errors.length < 3) errors.push(`${r.name}: ${error.message}`); continue; }
      if (data && data.length) { updated += data.length; continue; }

      // Not in the table yet (new call-up / signing): add them.
      const rawPos = String(r.position || "").toUpperCase();
      const position = rawPos.startsWith("G") ? "G" : rawPos.startsWith("D") ? "D" : "F";
      const { error: insErr } = await supabase.from("barracuda_roster").insert({
        name: clean(r.name),
        position,
        jersey_number: clean(r.tp_jersey_number),
        season: SEASON_LABEL,
        hockeytech_player_id: pid,
        image_url: `https://assets.leaguestat.com/ahl/240x240/${pid}.jpg`,
        ...payload,
      });
      if (insErr) { if (errors.length < 3) errors.push(`insert ${r.name}: ${insErr.message}`); }
      else added.push(`${r.name} (${pid})`);
    }

    return new Response(JSON.stringify({ success: true, season: seasonUsed, feedPlayers: rows.length, rowsUpdated: updated, playersAdded: added, errors }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
