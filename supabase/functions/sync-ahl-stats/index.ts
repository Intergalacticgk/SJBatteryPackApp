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

// Complete Barracuda Squad Baseline (Safe Fallback — only used if the table
// is completely empty AND the live roster fetch also failed).
const VERIFIED_CUDA_ROSTER = [
  { id: "cuda-1", jersey_number: "22", name: "Filip Bystedt", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Norrkoping, SWE", birthdate: "2004-02-04", image_url: "https://assets.nhle.com/mugs/nhl/latest/8483428.png", nhl_id: "8483428", season: "2026-2027" },
  { id: "cuda-2", jersey_number: "70", name: "Ethan Cardwell", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Courtice, CAN", birthdate: "2002-08-30", image_url: "https://assets.nhle.com/mugs/nhl/latest/8482705.png", nhl_id: "8482705", season: "2026-2027" },
  { id: "cuda-3", jersey_number: "27", name: "Quentin Musty", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Hamburg, USA", birthdate: "2005-07-06", image_url: "https://assets.nhle.com/mugs/nhl/latest/8484168.png", nhl_id: "8484168", season: "2026-2027" },
  { id: "cuda-4", jersey_number: "75", name: "Danil Gushchin", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Yekaterinburg, RUS", birthdate: "2002-02-06", image_url: "https://assets.nhle.com/mugs/nhl/latest/8482098.png", nhl_id: "8482098", season: "2026-2027" },
  { id: "cuda-5", jersey_number: "52", name: "Tristen Robins", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "London, GBR", birthdate: "2001-11-15", image_url: "https://assets.nhle.com/mugs/nhl/latest/8482159.png", nhl_id: "8482159", season: "2026-2027" },
  { id: "cuda-6", jersey_number: "79", name: "Kasper Halttunen", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Helsinki, FIN", birthdate: "2005-06-07", image_url: "https://assets.nhle.com/mugs/nhl/latest/8484213.png", nhl_id: "8484213", season: "2026-2027" },
  { id: "cuda-7", jersey_number: "16", name: "Luke Grainger", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Montreal, CAN", birthdate: "1999-09-03", image_url: "https://assets.leaguestat.com/ahl/240x240/10356.jpg", season: "2026-2027" },
  { id: "cuda-8", jersey_number: "63", name: "Brandon Coe", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Toronto, CAN", birthdate: "2001-12-01", image_url: "https://assets.nhle.com/mugs/nhl/latest/8482142.png", nhl_id: "8482142", season: "2026-2027" },
  { id: "cuda-9", jersey_number: "51", name: "Collin Graf", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Lincoln, USA", birthdate: "2002-09-21", image_url: "https://assets.nhle.com/mugs/nhl/latest/8484935.png", nhl_id: "8484935", season: "2026-2027" },
  { id: "cuda-10", jersey_number: "17", name: "Thomas Bordeleau", position: "F", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Houston, USA", birthdate: "2002-01-03", image_url: "https://assets.nhle.com/mugs/nhl/latest/8482121.png", nhl_id: "8482121", season: "2026-2027" },
  { id: "cuda-11", jersey_number: "76", name: "Luca Cagnoni", position: "D", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Burnaby, CAN", birthdate: "2004-12-21", image_url: "https://assets.nhle.com/mugs/nhl/latest/8484197.png", nhl_id: "8484197", season: "2026-2027" },
  { id: "cuda-12", jersey_number: "85", name: "Shakir Mukhamadullin", position: "D", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Ufa, RUS", birthdate: "2002-01-10", image_url: "https://assets.nhle.com/mugs/nhl/latest/8482092.png", nhl_id: "8482092", season: "2026-2027" },
  { id: "cuda-13", jersey_number: "6", name: "Jack Thompson", position: "D", gp: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Courtice, CAN", birthdate: "2002-03-19", image_url: "https://assets.nhle.com/mugs/nhl/latest/8482141.png", nhl_id: "8482141", season: "2026-2027" },
  { id: "cuda-14", jersey_number: "30", name: "Gabriel Carriere", position: "G", gp: 0, wins: 0, losses: 0, ot_losses: 0, gaa: "0.00", sv_pct: ".000", shutouts: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Ottawa, CAN", birthdate: "2000-11-05", image_url: "https://assets.leaguestat.com/ahl/240x240/10355.jpg", season: "2026-2027" },
  { id: "cuda-15", jersey_number: "31", name: "Georgi Romanov", position: "G", gp: 0, wins: 0, losses: 0, ot_losses: 0, gaa: "0.00", sv_pct: ".000", shutouts: 0, goals: 0, assists: 0, points: 0, plus_minus: 0, pim: 0, birthplace: "Yekaterinburg, RUS", birthdate: "1999-12-15", image_url: "https://assets.nhle.com/mugs/nhl/latest/8484351.png", nhl_id: "8484351", season: "2026-2027" }
];

// Pacific division, keyed by the SAME numeric HockeyTech team_id the live
// standings fetch below uses — so a fallback row and a later live row always
// upsert onto the same record instead of piling up as duplicates. (The old
// version of this file keyed these by abbreviation strings like "ont"/"col",
// which never matched the live feed's numeric ids — this function now also
// deletes those old stale abbreviation-keyed rows on first run.)
const OLD_ABBR_STANDINGS_IDS = ["ont", "col", "hsk", "cv", "bak", "sd", "tuc", "abb", "cgy"];
const VERIFIED_PACIFIC_STANDINGS = [
  { team_id: "403", team_name: "Ontario Reign", division: "Pacific", rank: 1, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "419", team_name: "Colorado Eagles", division: "Pacific", rank: 2, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "437", team_name: "Henderson Silver Knights", division: "Pacific", rank: 3, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "445", team_name: "Coachella Valley Firebirds", division: "Pacific", rank: 4, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "402", team_name: "Bakersfield Condors", division: "Pacific", rank: 5, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "405", team_name: "San Jose Barracuda", division: "Pacific", rank: 6, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "404", team_name: "San Diego Gulls", division: "Pacific", rank: 7, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "412", team_name: "Tucson Roadrunners", division: "Pacific", rank: 8, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "440", team_name: "Abbotsford Canucks", division: "Pacific", rank: 9, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
  { team_id: "444", team_name: "Calgary Wranglers", division: "Pacific", rank: 10, games_played: 0, wins: 0, losses: 0, ot_losses: 0, sol_losses: 0, points: 0, win_percentage: ".000", goals_for: 0, goals_against: 0, streak: "-" },
];

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
    try {
      const ahlUrl =
        `https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=roster&team_id=${BARRACUDA_TEAM_ID}` +
        `&season_id=${SEASON_ID}&key=${AHL_KEY}&client_code=${CLIENT_CODE}`;
      const res = await fetch(ahlUrl);
      if (res.ok) {
        const ahlJson = await res.json();
        const sections = ahlJson[0]?.sections || [];

        for (const section of sections) {
          const isGoalie = (section.title || "").toLowerCase().includes("goalie");
          for (const item of section.data || []) {
            const row = item.row;
            const name = row?.name?.trim();
            if (!name) continue;

            const jersey = row?.jersey_number;
            const gp = parseInt(row?.games_played || "0", 10);

            // Live roster feed sometimes exposes a player photo under one
            // of these names; normalize to an absolute https URL when found
            // so real AHL photos can replace stale/missing ones.
            const rawImage = row?.player_image || row?.image_url || row?.playerImageURL || null;
            const liveImageUrl = rawImage
              ? (String(rawImage).startsWith("http") ? String(rawImage) : `https://${rawImage}`)
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

            if (updErr) {
              console.warn("Roster update error for", name, updErr.message);
            } else if (!matched || matched.length === 0) {
              // No existing row (call-up / trade / first run) — add them
              // instead of silently dropping them.
              const { error: insErr } = await supabaseClient.from("barracuda_roster").insert({
                id: `ahl-${slugify(name)}`,
                name,
                position: isGoalie ? "G" : (row?.position || "F"),
                ...updatePayload,
              });
              if (insErr) console.warn("Roster insert error for", name, insErr.message);
            }

            liveRosterLoaded = true;
            liveRosterPlayerCount++;
          }
        }
      }
    } catch (e) {
      console.warn("HockeyTech live feed error, keeping database rows safe:", e);
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
    await supabaseClient.from("standings").delete().in("team_id", OLD_ABBR_STANDINGS_IDS);

    try {
      const standingsUrl =
        `https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=teams&season=${SEASON_ID}` +
        `&context=overall&groupTeamsBy=division&sort=points&special=false&conference_id=-1&division_id=-1` +
        `&key=${AHL_KEY}&client_code=${CLIENT_CODE}&site_id=3&league_id=4&lang=en`;
      const res = await fetch(standingsUrl);
      if (res.ok) {
        const json = await res.json();
        const sections = json[0]?.sections || [];
        const rows: any[] = [];

        for (const section of sections) {
          for (const item of section.data || []) {
            const row = item.row;
            if (!row) continue;

            const divisionName = String(row.division_name || row.division || "").toLowerCase();
            if (divisionName && !divisionName.includes("pacific")) continue;

            const teamId = String(row.team_id ?? row.id ?? "").trim();
            if (!teamId) continue;

            rows.push({
              team_id: teamId,
              team_name: row.name || row.team_name || "",
              division: "Pacific",
              rank: parseInt(row.rank || row.division_rank || "0", 10),
              games_played: parseInt(row.games_played || "0", 10),
              wins: parseInt(row.wins || "0", 10),
              losses: parseInt(row.losses || "0", 10),
              ot_losses: parseInt(row.ot_losses || row.overtime_losses || "0", 10),
              sol_losses: parseInt(row.shootout_losses || row.sol_losses || "0", 10),
              points: parseInt(row.points || "0", 10),
              win_percentage: row.percentage || row.win_percentage || ".000",
              goals_for: parseInt(row.goals_for || "0", 10),
              goals_against: parseInt(row.goals_against || "0", 10),
              streak: row.streak || "-",
              season: SEASON_LABEL,
              updated_at: new Date().toISOString(),
            });
          }
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
        const standingsRows = VERIFIED_PACIFIC_STANDINGS.map((s) => ({
          ...s,
          season: SEASON_LABEL,
          updated_at: new Date().toISOString(),
        }));
        await supabaseClient.from("standings").upsert(standingsRows, { onConflict: "team_id" });
        standingsWritten = standingsRows.length;
      }
    }

    // -------------------------------------------------------------
    // 3. FETCH SAN JOSE SHARKS NHL ROSTER
    // -------------------------------------------------------------
    let sharksRosterJson: any = null;
    try {
      const resCurrent = await fetch("https://api-web.nhle.com/v1/roster/SJS/current", { headers: nhlHeaders });
      if (resCurrent.ok) {
        const json = await resCurrent.json();
        const total = (json.forwards?.length || 0) + (json.defensemen?.length || 0) + (json.goalies?.length || 0);
        if (total > 0) sharksRosterJson = json;
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
          id: String(p.id || `nhl_${idx}`),
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
          updated_at: new Date().toISOString(),
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
    try {
      const pRes = await fetch("https://api-web.nhle.com/v1/prospects/SJS", { headers: nhlHeaders });
      const pJson = await pRes.json();
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

        if (AHL_PLAYERS.has(lower)) {
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
          id: String(p.id || `prospect_${idx}`),
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
          updated_at: new Date().toISOString(),
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
    if (allProspectRows.length > 0) {
      // FIXED: the app's prospects.tsx reads from `sharks_prospects`, not
      // `prospects` — this table name was wrong, so none of this data was
      // ever actually reaching the app.
      const { error: prospectsErr } = await supabaseClient
        .from("sharks_prospects")
        .upsert(allProspectRows, { onConflict: "id" });
      if (prospectsErr) console.warn("sharks_prospects upsert error:", prospectsErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        season_id_used: SEASON_ID,
        season_label: SEASON_LABEL,
        live_ahl_roster_synced: liveRosterLoaded,
        live_ahl_roster_player_count: liveRosterPlayerCount,
        live_standings_synced: liveStandingsLoaded,
        standings_rows_written: standingsWritten,
        sharks_nhl_count: sharksPlayers.length,
        total_prospects_count: allProspectRows.length,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
