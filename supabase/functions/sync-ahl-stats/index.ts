import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_CODE = "ahl";

// Verified against a public HockeyTech AHL team_id_map (San Jose Barracuda = 405,
// code "SJ"). The other function that used to write this table (sync-rosters,
// team_id=408) was pointed at a team_id that doesn't exist in that map at all —
// that function is now retired, see README note below.
const BARRACUDA_TEAM_ID = "405";

// AHL league key confirmed against a public open-source AHL/HockeyTech
// integration. This repo has THREE different "AHL key" values floating around
// (this one, 50c2cd9a7702e48e, 50c2cd9b5e18e390) — they may all be valid
// per-integration keys, but this is the one independently verified, so it's
// used here. If live fetches in this function start failing, try swapping in
// the other two keys used by sync-scores/live-game-monitor.
const AHL_KEY = "ccb91f29d6744675";

// Confirmed LIVE against a real Sept 25, 2026 gameSummary response
// (seasonId: "93"), so 93 is the correct 2026-27 AHL season_id.
const SEASON_ID = "93";
const SEASON_LABEL = "2026-2027";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// HockeyTech's statviewfeed endpoints (roster, teams/standings) wrap their
// JSON body in a bare `(...)`, unlike the gamesummary feed used elsewhere
// in this codebase which returns plain JSON. res.json() throws on the
// wrapped form, which the surrounding try/catch was silently swallowing —
// confirmed live via curl against the real roster endpoint.
function parseHockeyTechFeed(text: string): any {
  const trimmed = text.trim();
  const unwrapped =
    trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1) : trimmed;
  return JSON.parse(unwrapped);
}

// Complete Barracuda Squad Baseline (Safe Fallback — only used if the table
// is completely empty AND the live roster fetch also failed).
const VERIFIED_CUDA_ROSTER = [
  { id: "cuda-1", jersey_number: "22", name: "Filip Bystedt", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Norrkoping, SWE", birthdate: "2004-02-04", season: "2026-2027" },
  { id: "cuda-2", jersey_number: "70", name: "Ethan Cardwell", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Courtice, CAN", birthdate: "2002-08-30", season: "2026-2027" },
  { id: "cuda-3", jersey_number: "27", name: "Quentin Musty", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Hamburg, USA", birthdate: "2005-07-06", season: "2026-2027" },
  { id: "cuda-4", jersey_number: "75", name: "Danil Gushchin", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Yekaterinburg, RUS", birthdate: "2002-02-06", season: "2026-2027" },
  { id: "cuda-5", jersey_number: "52", name: "Tristen Robins", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "London, GBR", birthdate: "2001-11-15", season: "2026-2027" },
  { id: "cuda-6", jersey_number: "79", name: "Kasper Halttunen", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Helsinki, FIN", birthdate: "2005-06-07", season: "2026-2027" },
  { id: "cuda-7", jersey_number: "16", name: "Luke Grainger", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Montreal, CAN", birthdate: "1999-09-03", image_url: "https://assets.leaguestat.com/ahl/240x240/10356.jpg", season: "2026-2027" },
  { id: "cuda-8", jersey_number: "63", name: "Brandon Coe", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Toronto, CAN", birthdate: "2001-12-01", season: "2026-2027" },
  { id: "cuda-9", jersey_number: "51", name: "Collin Graf", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Lincoln, USA", birthdate: "2002-09-21", season: "2026-2027" },
  { id: "cuda-10", jersey_number: "17", name: "Thomas Bordeleau", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Houston, USA", birthdate: "2002-01-03", season: "2026-2027" },
  { id: "cuda-11", jersey_number: "76", name: "Luca Cagnoni", position: "D", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Burnaby, CAN", birthdate: "2004-12-21", season: "2026-2027" },
  { id: "cuda-12", jersey_number: "85", name: "Shakir Mukhamadullin", position: "D", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Ufa, RUS", birthdate: "2002-01-10", season: "2026-2027" },
  { id: "cuda-13", jersey_number: "6", name: "Jack Thompson", position: "D", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Courtice, CAN", birthdate: "2002-03-19", season: "2026-2027" },
  { id: "cuda-14", jersey_number: "30", name: "Gabriel Carriere", position: "G", gp: 0, wins: 0, losses: 0, ot_losses: 0, gaa: "0.00", sv_pct: ".000", shutouts: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Ottawa, CAN", birthdate: "2000-11-05", image_url: "https://assets.leaguestat.com/ahl/240x240/10355.jpg", season: "2026-2027" },
  { id: "cuda-15", jersey_number: "31", name: "Georgi Romanov", position: "G", gp: 0, wins: 0, losses: 0, ot_losses: 0, gaa: "0.00", sv_pct: ".000", shutouts: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Yekaterinburg, RUS", birthdate: "1999-12-15", season: "2026-2027" }
];

// Pacific division, keyed by the SAME numeric HockeyTech team_id the live
// standings fetch below uses — so a fallback row and a later live row always
// upsert onto the same record instead of piling up as duplicates. (The old
// version of this file keyed these by abbreviation strings like "ont"/"col",
// which never matched the live feed's numeric ids — this function now also
// deletes those old stale abbreviation-keyed rows on first run.)
const OLD_ABBR_STANDINGS_IDS = ["ont", "col", "hsk", "cv", "bak", "sd", "tuc", "abb", "cgy"];
// The numeric team_ids below (403, 419, etc.) were guessed for the static
// baseline and never confirmed against a live response. The live standings
// feed doesn't expose a team_id field at all — only "team_code" (e.g. "SJ",
// "ONT") — so that's the real key going forward. These numeric ones are now
// orphaned and get cleaned up alongside the old abbreviation-keyed rows.
const OLD_NUMERIC_STANDINGS_IDS = ["403", "419", "437", "445", "402", "405", "404", "412", "440", "444"];

// Every AHL franchise code the live standings feed can return, confirmed
// live across all four divisions (Pacific, Central, Atlantic, North) —
// anything outside this set is skipped defensively (All-Star teams, etc).
// Division is NOT hardcoded per team here: it's read directly off each
// section's own header label in the live feed below, so a division
// realignment is picked up automatically without editing this file.
const ALL_AHL_TEAM_CODES = new Set([
  // Pacific
  "ONT", "COL", "HSK", "CV", "BAK", "SJ", "SD", "TUC", "ABB", "CGY",
  // Central
  "GR", "RFD", "IA", "TEX", "MB", "CHI", "MIL",
  // Atlantic
  "WBS", "PRO", "LV", "SPR", "HER", "HFD", "CLT",
  // North
  "ROC", "TOR", "HAM", "UTC", "CLE", "BEL", "LAV", "SYR",
]);

// FALLBACK ONLY (cold start / total feed outage) — all 32 teams, all-zero,
// correctly divisioned so a first-ever run (or a feed that's down) still
// renders a complete, correctly-grouped league table instead of just
// Pacific.
const VERIFIED_LEAGUE_STANDINGS = [
  { team_id: "ONT", team_name: "Ontario Reign", division: "Pacific" },
  { team_id: "COL", team_name: "Colorado Eagles", division: "Pacific" },
  { team_id: "HSK", team_name: "Henderson Silver Knights", division: "Pacific" },
  { team_id: "CV", team_name: "Coachella Valley Firebirds", division: "Pacific" },
  { team_id: "BAK", team_name: "Bakersfield Condors", division: "Pacific" },
  { team_id: "SJ", team_name: "San Jose Barracuda", division: "Pacific" },
  { team_id: "SD", team_name: "San Diego Gulls", division: "Pacific" },
  { team_id: "TUC", team_name: "Tucson Roadrunners", division: "Pacific" },
  { team_id: "ABB", team_name: "Abbotsford Canucks", division: "Pacific" },
  { team_id: "CGY", team_name: "Calgary Wranglers", division: "Pacific" },
  { team_id: "GR", team_name: "Grand Rapids Griffins", division: "Central" },
  { team_id: "RFD", team_name: "Rockford IceHogs", division: "Central" },
  { team_id: "IA", team_name: "Iowa Wild", division: "Central" },
  { team_id: "TEX", team_name: "Texas Stars", division: "Central" },
  { team_id: "MB", team_name: "Manitoba Moose", division: "Central" },
  { team_id: "CHI", team_name: "Chicago Wolves", division: "Central" },
  { team_id: "MIL", team_name: "Milwaukee Admirals", division: "Central" },
  { team_id: "WBS", team_name: "Wilkes-Barre/Scranton Penguins", division: "Atlantic" },
  { team_id: "PRO", team_name: "Providence Bruins", division: "Atlantic" },
  { team_id: "LV", team_name: "Lehigh Valley Phantoms", division: "Atlantic" },
  { team_id: "SPR", team_name: "Springfield Thunderbirds", division: "Atlantic" },
  { team_id: "HER", team_name: "Hershey Bears", division: "Atlantic" },
  { team_id: "HFD", team_name: "Hartford Wolf Pack", division: "Atlantic" },
  { team_id: "CLT", team_name: "Charlotte Checkers", division: "Atlantic" },
  { team_id: "ROC", team_name: "Rochester Americans", division: "North" },
  { team_id: "TOR", team_name: "Toronto Marlies", division: "North" },
  { team_id: "HAM", team_name: "Hamilton Hammers", division: "North" },
  { team_id: "UTC", team_name: "Utica Comets", division: "North" },
  { team_id: "CLE", team_name: "Cleveland Monsters", division: "North" },
  { team_id: "BEL", team_name: "Belleville Senators", division: "North" },
  { team_id: "LAV", team_name: "Laval Rocket", division: "North" },
  { team_id: "SYR", team_name: "Syracuse Crunch", division: "North" },
].map((t, idx) => ({
  ...t,
  rank: idx + 1,
  games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0,
  points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-",
}));

// FALLBACK ONLY: used to classify a prospect as AHL/Barracuda only if the
// live Barracuda roster fetch above (liveAhlRosterNames) comes back empty
// (feed down). Whenever the live fetch succeeds, that live roster is the
// source of truth instead, so a call-up to the Sharks or a send-down to the
// Barracuda is picked up automatically on the next sync without editing
// this list by hand.
const AHL_PLAYERS = new Set([
  "filip bystedt", "ethan cardwell", "luca cagnoni", "kasper halttunen",
  "quentin musty", "danil gushchin", "shakir mukhamadullin", "jack thompson",
  "tristen robins", "brandon coe", "georgy romanov", "magnus chrona",
  "gabriel carriere", "mitchell russell", "valteri pulli", "gannon laroque"
]);

const ECHL_PLAYERS = new Set([
  "anthony vincent", "mark liwiski", "jeremy mckenna", "beck warm"
]);

serve(async (_req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const nhlHeaders = {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
    };

    // -------------------------------------------------------------
    // 1. SYNC BARRACUDA ROSTER (live HockeyTech, update-existing +
    //    insert-new so call-ups/trades show up without a manual pull;
    //    falls back to the static baseline only if the table is empty)
    // -------------------------------------------------------------
    let liveRosterLoaded = false;
    let liveRosterPlayerCount = 0;
    // Previously this counted every player the feed returned as a
    // "success," even if the actual DB write failed — surfacing a real
    // count plus a few sample error messages instead, so a silent DB
    // failure (like the standings "season column" bug) can't hide behind
    // a healthy-looking player count again.
    let liveRosterWriteErrors: string[] = [];
    // Names pulled from the LIVE Barracuda roster fetch below, used later
    // to classify prospects as AHL (rather than a static, easily-stale list)
    // so a call-up/send-down is reflected automatically on the next sync.
    const liveAhlRosterNames = new Set<string>();
    try {
      const ahlUrl =
        `https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=roster&team_id=${BARRACUDA_TEAM_ID}` +
        `&season_id=${SEASON_ID}&key=${AHL_KEY}&client_code=${CLIENT_CODE}`;
      const res = await fetch(ahlUrl);
      if (res.ok) {
        const ahlJson = parseHockeyTechFeed(await res.text());
        // CONFIRMED LIVE shape: the top-level object has a "roster" array,
        // not the bare array this used to assume (that mismatch, combined
        // with the (...) -wrapping above, meant this fetch has likely never
        // actually populated anything).
        const sections = ahlJson?.roster?.[0]?.sections || [];

        for (const section of sections) {
          const sectionTitle = (section.title || "").toLowerCase();
          // Skip the "Team Personnel" section (GM/coaches) — real player
          // rows are identified below by requiring a player_id anyway, but
          // this avoids wasting cycles on rows that were never players.
          if (sectionTitle.includes("personnel")) continue;
          const isGoalie = sectionTitle.includes("goalie");
          for (const item of section.data || []) {
            const row = item.row;
            const name = row?.name?.trim();
            // player_id is what confirms this is an actual roster row (and
            // is what the live HockeyTech photo URL below is keyed on) —
            // Team Personnel rows and anything malformed won't have one.
            if (!name || !row?.player_id) continue;

            liveAhlRosterNames.add(name.toLowerCase());

            // CONFIRMED LIVE: this roster view uses "tp_jersey_number", not
            // "jersey_number". It also doesn't carry live stat totals at
            // all (goals/assists/gp/etc. below all default to 0 here) —
            // this endpoint is bio/roster info only. Stats stay blanked in
            // the UI until the season actually starts, so that's fine for
            // now; a real season stats feed is a separate follow-up once
            // games are being played.
            const jersey = row?.tp_jersey_number || row?.jersey_number;
            const gp = parseInt(row?.games_played || "0", 10);

            // CONFIRMED LIVE (curl -I returned 200/image-jpeg for a real
            // player_id from this exact feed): HockeyTech serves headshots
            // from this CDN keyed by the feed's own numeric player_id, not
            // NHL.com's id. The feed itself has no image/photo field at all
            // (verified against a live response), so this is the only real
            // photo source for a player who's actually on the AHL roster —
            // always applied when a player_id is present, replacing any
            // previously-guessed NHL.com photo.
            const hockeytechPlayerId = row?.player_id ? String(row.player_id).trim() : "";
            const liveImageUrl = hockeytechPlayerId
              ? `https://assets.leaguestat.com/ahl/240x240/${hockeytechPlayerId}.jpg`
              : undefined;

            const statFields = isGoalie
              ? {
                  wins: parseInt(row?.wins || "0", 10),
                  losses: parseInt(row?.losses || "0", 10),
                  ot_losses: parseInt(row?.ot_losses || "0", 10),
                  gaa: row?.goals_against_average || "0.00",
                  sv_pct: row?.save_percentage || ".000",
                  shutouts: parseInt(row?.shutouts || "0", 10),
                }
              : {
                  goals: parseInt(row?.goals || "0", 10),
                  assists: parseInt(row?.assists || "0", 10),
                  points: parseInt(row?.points || "0", 10),
                  plus_minus: parseInt(row?.plus_minus || "0", 10),
                  pim: parseInt(row?.penalty_minutes || "0", 10),
                };

            const updatePayload = {
              jersey_number: jersey,
              gp,
              ...statFields,
              season: SEASON_LABEL,
              ...(liveImageUrl ? { image_url: liveImageUrl } : {}),
            };

            const { data: matched, error: updErr } = await supabaseClient
              .from("barracuda_roster")
              .update(updatePayload)
              .ilike("name", `%${name}%`)
              .select("id");

            let writeOk = true;
            if (updErr) {
              writeOk = false;
              console.warn("Roster update error for", name, updErr.message);
              if (liveRosterWriteErrors.length < 3) liveRosterWriteErrors.push(`${name}: ${updErr.message}`);
            } else if (!matched || matched.length === 0) {
              // No existing row (call-up / trade / first run) — add them
              // instead of silently dropping them. Previously this set an
              // explicit non-UUID string id ("ahl-andre-gasseau"), but the
              // id column is a real uuid type — every single insert was
              // failing with "invalid input syntax for type uuid." Letting
              // the column's own default generate the id instead.
              const { error: insErr } = await supabaseClient.from("barracuda_roster").insert({
                name,
                position: isGoalie ? "G" : (row?.position || "F"),
                ...updatePayload,
              });
              if (insErr) {
                writeOk = false;
                console.warn("Roster insert error for", name, insErr.message);
                if (liveRosterWriteErrors.length < 3) liveRosterWriteErrors.push(`${name}: ${insErr.message}`);
              }
            }

            liveRosterLoaded = true;
            if (writeOk) liveRosterPlayerCount++;
          }
        }
      }
    } catch (e) {
      console.warn("HockeyTech live feed error, keeping database rows safe:", e);
    }

    // Remove players who are no longer on the live AHL roster (called up to
    // the Sharks, sent to another affiliate, released, traded, etc.) so the
    // Roster tab reflects the CURRENT team without anyone having to manually
    // delete stale rows. Guarded by a minimum roster size so a partial or
    // flaky fetch can never wipe the table — only a real, full roster fetch
    // triggers cleanup.
    // PAUSED (dry-run only), same as the prospects cleanup below — after
    // today's incident, this stays log-only until confirmed safe on a
    // clean run, rather than deleting on the very first live roster fetch
    // that's ever actually succeeded.
    let staleRosterRemoved = 0;
    if (liveRosterLoaded && liveAhlRosterNames.size >= 10) {
      const { data: existingRoster } = await supabaseClient
        .from("barracuda_roster")
        .select("id, name");

      const staleIds = (existingRoster || [])
        .filter((r: any) => {
          const stored = String(r.name || "").toLowerCase();
          if (!stored) return false;
          for (const liveName of liveAhlRosterNames) {
            if (stored.includes(liveName) || liveName.includes(stored)) return false;
          }
          return true;
        })
        .map((r: any) => r.id);

      if (staleIds.length > 0) {
        console.warn(`[dry-run] Would remove ${staleIds.length} stale roster rows:`, staleIds);
      }
    }

    // Only populate baseline if database is completely empty (no destructive delete)
    const { count } = await supabaseClient.from("barracuda_roster").select("*", { count: "exact", head: true });
    if (!count || count === 0) {
      const { error: baselineErr } = await supabaseClient
        .from("barracuda_roster")
        .upsert(VERIFIED_CUDA_ROSTER, { onConflict: "id" });
      if (baselineErr) console.warn("Baseline roster upsert error:", baselineErr.message);
    }

    // -------------------------------------------------------------
    // 2. SYNC PACIFIC STANDINGS — real live fetch (previously this
    //    unconditionally re-wrote the same all-zero baseline every run,
    //    which is why the app was stuck showing "2025-2026 TOTALS":
    //    Standings.tsx only flips to the current-season label once average
    //    games_played across the division is > 0).
    // -------------------------------------------------------------
    let liveStandingsLoaded = false;
    let standingsWritten = 0;

    // Clean up the old abbreviation-keyed rows from the previous buggy
    // version, so they don't sit alongside the correctly-keyed ones.
    await supabaseClient
      .from("standings")
      .delete()
      .in("team_id", [...OLD_ABBR_STANDINGS_IDS, ...OLD_NUMERIC_STANDINGS_IDS]);

    // HockeyTech's "teams/overall" endpoint for this season_id is cumulative
    // across EVERY game tagged with it — including preseason exhibition
    // games, which this installation keys under the same season_id as the
    // real regular season (confirmed live: a Sept 25 "EX" game carried
    // season_id "93", the same id used below). Those exhibition games are
    // all final and will never change, so a one-time snapshot of them
    // (seeded into standings_baseline before the season opener) can be
    // subtracted from every future live pull to recover the real
    // regular-season record automatically, with no nightly manual step.
    const { data: baselineRows } = await supabaseClient
      .from("standings_baseline")
      .select("*");
    const baselineByTeam = new Map<string, any>(
      (baselineRows || []).map((b: any) => [String(b.team_id).toUpperCase(), b])
    );

    try {
      const standingsUrl =
        `https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=teams&season=${SEASON_ID}` +
        `&context=overall&groupTeamsBy=division&sort=points&special=false&conference_id=-1&division_id=-1` +
        `&key=${AHL_KEY}&client_code=${CLIENT_CODE}&site_id=3&league_id=4&lang=en`;
      const res = await fetch(standingsUrl);
      if (res.ok) {
        const json = parseHockeyTechFeed(await res.text());
        const sections = json[0]?.sections || [];
        const rows: any[] = [];

        for (const section of sections) {
          // CONFIRMED LIVE: there's no division field on a row itself, but
          // each section IS correctly scoped to one division, and its own
          // header's "team_code" column label carries that division's name
          // verbatim ("Atlantic" / "North" / "Central" / "Pacific") — used
          // directly instead of a hardcoded Pacific-only team list, so all
          // four divisions sync the same way and a future division
          // realignment doesn't require a code change here.
          const divisionLabel = String(
            section.headers?.team_code?.properties?.label || ""
          ).trim();
          if (!divisionLabel) continue;

          for (const item of section.data || []) {
            const row = item.row;
            if (!row) continue;

            const teamCode = String(row.team_code || "").trim().toUpperCase();
            if (!ALL_AHL_TEAM_CODES.has(teamCode)) continue;

            // Raw cumulative totals straight from HockeyTech — still
            // includes the frozen preseason baseline at this point.
            const rawGp = parseInt(row.games_played || "0", 10);
            const rawWins = parseInt(row.wins || "0", 10);
            const rawLosses = parseInt(row.losses || "0", 10);
            const rawOtLosses = parseInt(row.ot_losses || row.overtime_losses || "0", 10);
            const rawSolLosses = parseInt(row.shootout_losses || row.sol_losses || "0", 10);
            const rawPoints = parseInt(row.points || "0", 10);
            const rawGoalsFor = parseInt(row.goals_for || "0", 10);
            const rawGoalsAgainst = parseInt(row.goals_against || "0", 10);

            // Subtract the one-time preseason baseline (see note above) —
            // Math.max(0, ...) guards against a team that somehow has fewer
            // live games than its own baseline (feed hiccup, re-seeded
            // baseline, etc.) ever going negative in the app.
            const base = baselineByTeam.get(teamCode) || {};
            const gp = Math.max(0, rawGp - (base.games_played || 0));
            const wins = Math.max(0, rawWins - (base.wins || 0));
            const losses = Math.max(0, rawLosses - (base.losses || 0));
            const otLosses = Math.max(0, rawOtLosses - (base.ot_losses || 0));
            const solLosses = Math.max(0, rawSolLosses - (base.sol_losses || 0));
            const points = Math.max(0, rawPoints - (base.points || 0));
            const goalsFor = Math.max(0, rawGoalsFor - (base.goals_for || 0));
            const goalsAgainst = Math.max(0, rawGoalsAgainst - (base.goals_against || 0));
            // Recomputed, not taken from the feed — HockeyTech's own
            // "percentage" field is cumulative over the raw (preseason-
            // included) totals, so it has to be rebuilt from the
            // baseline-adjusted numbers using the AHL's standard 2-points-
            // per-game-played formula.
            const winPercentage = gp > 0 ? (points / (gp * 2)).toFixed(3) : ".000";

            rows.push({
              team_id: teamCode,
              team_name: row.name || row.team_name || "",
              division: divisionLabel,
              // Placeholder — HockeyTech's own rank reflects the raw
              // (preseason-included) ordering, so it's recomputed below
              // from the baseline-adjusted numbers instead of used as-is.
              rank: 0,
              games_played: gp,
              wins,
              losses,
              ot_losses: otLosses,
              sol_losses: solLosses,
              points,
              win_percentage: winPercentage,
              goals_for: goalsFor,
              goals_against: goalsAgainst,
              streak: row.streak || "-",
              updated_at: new Date().toISOString(),
            });
          }
        }

        // Recompute rank from the adjusted (baseline-subtracted) standings
        // — WITHIN each division, not across the whole league, since
        // Standings.tsx's DIVISION view trusts `rank` directly as each
        // team's position inside its own division. Same tiebreak as the
        // AHL standard and as the client-side sort Standings.tsx already
        // applies for its CONFERENCE/LEAGUE views (points, then win pct).
        const byDivision = new Map<string, any[]>();
        for (const r of rows) {
          if (!byDivision.has(r.division)) byDivision.set(r.division, []);
          byDivision.get(r.division)!.push(r);
        }
        for (const divisionRows of byDivision.values()) {
          divisionRows.sort((a, b) => b.points - a.points || parseFloat(b.win_percentage) - parseFloat(a.win_percentage));
          divisionRows.forEach((r, idx) => { r.rank = idx + 1; });
        }

        if (rows.length > 0) {
          const { error: standingsErr } = await supabaseClient
            .from("standings")
            .upsert(rows, { onConflict: "team_id" });
          if (!standingsErr) {
            liveStandingsLoaded = true;
            standingsWritten = rows.length;
          } else {
            console.warn("Standings upsert error:", standingsErr.message);
          }
        }
      }
    } catch (e) {
      console.warn("Live standings fetch failed, will fall back if table is empty:", e);
    }

    if (!liveStandingsLoaded) {
      const { count: standingsCount } = await supabaseClient.from("standings").select("*", { count: "exact", head: true });
      if (!standingsCount || standingsCount === 0) {
        const standingsRows = VERIFIED_LEAGUE_STANDINGS.map((s) => ({
          ...s,
          updated_at: new Date().toISOString(),
        }));
        const { error: baselineStandingsErr } = await supabaseClient
          .from("standings")
          .upsert(standingsRows, { onConflict: "team_id" });
        // Previously this was set unconditionally, regardless of whether
        // the write actually succeeded — the response could (and did)
        // claim rows were written when the upsert had silently failed.
        if (baselineStandingsErr) {
          console.warn("Baseline standings upsert error:", baselineStandingsErr.message);
        } else {
          standingsWritten = standingsRows.length;
        }
      }
    }

    // -------------------------------------------------------------
    // 3. FETCH SAN JOSE SHARKS NHL ROSTER
    // -------------------------------------------------------------
    let sharksRosterJson: any = null;
    let sharksFetchOk = false;
    try {
      const resCurrent = await fetch("https://api-web.nhle.com/v1/roster/SJS/current", { headers: nhlHeaders });
      if (resCurrent.ok) {
        const json = await resCurrent.json();
        const total = (json.forwards?.length || 0) + (json.defensemen?.length || 0) + (json.goalies?.length || 0);
        if (total > 0) {
          sharksRosterJson = json;
          sharksFetchOk = true;
        }
      }
    } catch { /* left sharksRosterJson null, sharksPlayers stays empty below */ }

    const sharksPlayers: any[] = [];
    if (sharksRosterJson) {
      const rawNHL = [
        ...(sharksRosterJson.forwards || []),
        ...(sharksRosterJson.defensemen || []),
        ...(sharksRosterJson.goalies || []),
      ];

      rawNHL.forEach((p: any, idx: number) => {
        const fName = p.firstName?.default || p.firstName || "";
        const lName = p.lastName?.default || p.lastName || "";
        const fullName = `${fName} ${lName}`.trim() || `Sharks Player ${idx + 1}`;
        let pos = (p.positionCode || p.position || "F").toUpperCase();
        if (pos === "RW" || pos === "LW" || pos === "C") pos = "F";

        sharksPlayers.push({
          nhl_id: String(p.id || `nhl_${idx}`),
          name: fullName,
          position: pos,
          current_team: "San Jose Sharks",
          league: "NHL",
          region: "SHARKS",
          draft_year: p.draftDetails?.year ?? null,
          draft_round: p.draftDetails?.round ?? 0,
          draft_pick: p.draftDetails?.overallPick ?? p.draftDetails?.pickInRound ?? 0,
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          plus_minus: 0,
          pim: 0,
          height: p.heightInInches ? `${Math.floor(p.heightInInches / 12)}'${p.heightInInches % 12}"` : (p.height || ""),
          weight: p.weightInPounds ? `${p.weightInPounds} lbs` : (p.weight ? `${p.weight} lbs` : ""),
          shoots_catches: p.shootsCatches || "",
          birthplace: [p.birthCity?.default || p.birthCity, p.birthCountry].filter(Boolean).join(", "),
          birthdate: p.birthDate || "",
          image_url: p.headshot || `https://assets.nhle.com/mugs/nhl/latest/${p.id}.png`,
          season: SEASON_LABEL,
        });
      });
    }

    // -------------------------------------------------------------
    // 4. FETCH SYSTEM PROSPECTS (AHL, ECHL, Juniors, Europe)
    //
    // NOTE ON region CLASSIFICATION: the NHL prospects endpoint doesn't
    // reliably expose the player's current amateur team/league (no network
    // path was available to verify this live). Anyone already turning pro
    // in the org (AHL_PLAYERS/ECHL_PLAYERS above) gets region "SHARKS" —
    // that part is solid. For everyone else, JUNIORS vs NCAA can't be told
    // apart with the fields this endpoint gives us, so this defaults North
    // American players to "JUNIORS" and everyone else to "EUROPE" as a
    // best guess. If NCAA prospects show up under the wrong tab, that's
    // this heuristic — worth revisiting with a per-player detail fetch if
    // it matters.
    // -------------------------------------------------------------
    let prospectsRes: any[] = [];
    let prospectsFetchOk = false;
    try {
      const pRes = await fetch("https://api-web.nhle.com/v1/prospects/SJS", { headers: nhlHeaders });
      const pJson = await pRes.json();
      prospectsFetchOk = true;
      const rawProspects = [
        ...(pJson?.forwards || []),
        ...(pJson?.defensemen || []),
        ...(pJson?.goalies || []),
      ];

      prospectsRes = rawProspects.map((p: any, idx: number) => {
        const fName = p.firstName?.default || p.firstName || "";
        const lName = p.lastName?.default || p.lastName || "";
        const fullName = `${fName} ${lName}`.trim() || `Prospect ${idx + 1}`;
        const lower = fullName.toLowerCase();

        let assignedTeam = "NCAA / Juniors / Europe";
        let assignedLeague = "Development";
        let region: "SHARKS" | "JUNIORS" | "NCAA" | "EUROPE";

        const ahlRosterNames = liveAhlRosterNames.size > 0 ? liveAhlRosterNames : AHL_PLAYERS;
        if (ahlRosterNames.has(lower)) {
          assignedTeam = "San Jose Barracuda";
          assignedLeague = "AHL";
          region = "SHARKS";
        } else if (ECHL_PLAYERS.has(lower)) {
          assignedTeam = "Wichita Thunder";
          assignedLeague = "ECHL";
          region = "SHARKS";
        } else {
          const country = String(p.birthCountry || "").toUpperCase();
          region = country === "CAN" || country === "USA" ? "JUNIORS" : "EUROPE";
        }

        let pos = (p.positionCode || p.position || "F").toUpperCase();
        if (pos === "RW" || pos === "LW" || pos === "C") pos = "F";

        return {
          nhl_id: String(p.id || `prospect_${idx}`),
          name: fullName,
          position: pos,
          current_team: assignedTeam,
          league: assignedLeague,
          region,
          draft_year: p.draftDetails?.year ?? null,
          draft_round: p.draftDetails?.round ?? 0,
          draft_pick: p.draftDetails?.overallPick ?? p.draftDetails?.pickInRound ?? 0,
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          plus_minus: 0,
          pim: 0,
          height: p.heightInInches ? `${Math.floor(p.heightInInches / 12)}'${p.heightInInches % 12}"` : "",
          weight: p.weightInPounds ? `${p.weightInPounds} lbs` : "",
          shoots_catches: p.shootsCatches || "",
          birthplace: [p.birthCity?.default || p.birthCity, p.birthCountry].filter(Boolean).join(", "),
          birthdate: p.birthDate || "",
          image_url: p.headshot || `https://assets.nhle.com/mugs/nhl/latest/${p.id}.png`,
          season: SEASON_LABEL,
        };
      });
    } catch { /* leaves prospectsRes as whatever was built before the failure */ }

    const combinedProspectsMap = new Map();
    sharksPlayers.forEach((p) => combinedProspectsMap.set(p.name.toLowerCase(), p));
    prospectsRes.forEach((p) => {
      if (!combinedProspectsMap.has(p.name.toLowerCase())) {
        combinedProspectsMap.set(p.name.toLowerCase(), p);
      }
    });

    const allProspectRows = Array.from(combinedProspectsMap.values());
    let staleProspectsRemoved = 0;
    // Previously reported as allProspectRows.length regardless of whether
    // the upsert actually succeeded — now reflects the real write result,
    // with the error message surfaced if it failed.
    let prospectsWriteError: string | null = null;
    let prospectsWritten = 0;
    if (allProspectRows.length > 0) {
      // FIXED: the app's prospects.tsx reads from `sharks_prospects`, not
      // `prospects` — this table name was wrong, so none of this data was
      // ever actually reaching the app.
      const { error: prospectsErr } = await supabaseClient
        .from("sharks_prospects")
        .upsert(allProspectRows, { onConflict: "nhl_id" });
      if (prospectsErr) {
        prospectsWriteError = prospectsErr.message;
        console.warn("sharks_prospects upsert error:", prospectsErr.message);
      } else {
        prospectsWritten = allProspectRows.length;
      }

      // PAUSED (dry-run only): a first live run of this deleted 35 rows in
      // one shot (some of it from a partial-fetch cascade — see
      // sharksFetchOk/prospectsFetchOk below), and given the roster feed
      // had a real, previously-hidden parsing bug (see parseHockeyTechFeed
      // above), that's not something to trust yet. Logs what it WOULD
      // remove instead of deleting, until explicitly re-enabled.
      // Also now REQUIRES both NHL fetches to have actually succeeded this
      // run — a partial failure (only one of roster/prospects coming back)
      // used to make everything from the missing side look "stale" and get
      // wiped, which is almost certainly what emptied the table earlier.
      if (sharksFetchOk && prospectsFetchOk) {
        const liveProspectNhlIds = new Set(allProspectRows.map((p: any) => p.nhl_id));
        const { data: existingProspects } = await supabaseClient
          .from("sharks_prospects")
          .select("nhl_id");
        const staleProspectNhlIds = (existingProspects || [])
          .map((r: any) => r.nhl_id)
          .filter((nhlId: string) => !liveProspectNhlIds.has(nhlId));
        if (staleProspectNhlIds.length > 0) {
          console.warn(`[dry-run] Would remove ${staleProspectNhlIds.length} stale prospects:`, staleProspectNhlIds);
        }
      } else {
        console.warn("Skipping prospects cleanup check — one of the NHL fetches didn't fully succeed this run.");
      }
      staleProspectsRemoved = 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        season_id_used: SEASON_ID,
        season_label: SEASON_LABEL,
        live_ahl_roster_synced: liveRosterLoaded,
        live_ahl_roster_player_count: liveRosterPlayerCount,
        live_ahl_roster_write_errors: liveRosterWriteErrors,
        live_standings_synced: liveStandingsLoaded,
        standings_rows_written: standingsWritten,
        sharks_nhl_count: sharksPlayers.length,
        prospects_seen_count: allProspectRows.length,
        prospects_written_count: prospectsWritten,
        prospects_write_error: prospectsWriteError,
        stale_roster_rows_removed: staleRosterRemoved,
        stale_prospect_rows_removed: staleProspectsRemoved,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
