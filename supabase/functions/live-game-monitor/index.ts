import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const AHL_KEY = 'ccb91f29d6744675';

function formatPlayerName(player: any): string {
  if (!player) return '';
  const first = (player.firstName || player.first_name || '').trim();
  const last = (player.lastName || player.last_name || '').trim();
  if (!first && !last) return (player.name || '').trim();
  const initial = first ? `${first.charAt(0).toUpperCase()}.` : '';
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

async function sendPushNotification(title: string, body: string, dataPayload: Record<string, unknown> = {}) {
  const { data: tokens, error } = await supabase.from('push_tokens').select('token').eq('notify_live_scores', true);
  if (error || !tokens || tokens.length === 0) return { success: false, reason: 'No tokens found' };

  const messages = tokens.map((t) => ({ to: t.token, sound: 'default', title: title, body: body, data: dataPayload }));
  const chunks = [];
  while (messages.length > 0) chunks.push(messages.splice(0, 100));

  let lastExpoResponse = null;
  for (const chunk of chunks) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      lastExpoResponse = await res.json();
    } catch (e: any) {
      return { success: false, expoFetchError: e.message };
    }
  }
  return { success: true, expoResponse: lastExpoResponse };
}

Deno.serve(async (_req) => {
  try {
    const { data: games, error: schedError } = await supabase.from('schedule').select('*');
    if (schedError) throw schedError;

    const pacificDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); 
    const parts = pacificDate.split('/');
    const todayStr = parts[2] + '-' + parts[0] + '-' + parts[1];

    const todayGame = games?.find((g: any) => g.game_date && g.game_date.startsWith(todayStr));

    if (!todayGame) return new Response(JSON.stringify({ message: 'No game scheduled for today in the schedule table.' }), { status: 200 });

    const gameId = todayGame.game_id;
    const opponent = todayGame.opponent || 'Opponent';

    // Single fetch of the Gamecenter feed drives BOTH the live score
    // tracking below AND the full box score / three-stars once it's final
    // — no second fetch against a different feed needed.
    const liveUrl = 'https://lscluster.hockeytech.com/feed/index.php?feed=gc&key=' + AHL_KEY + '&client_code=ahl&game_id=' + gameId + '&tab=gamesummary';
    const liveRes = await fetch(liveUrl);
    const rawLiveText = await liveRes.text();

    let liveData: any;
    try { liveData = JSON.parse(rawLiveText); } catch { return new Response(JSON.stringify({ warning: 'Upstream feed non-JSON' }), { status: 200 }); }

    const summary = liveData?.GC?.Gamesummary || {};
    const meta = summary?.meta || {};
    
    const gameStatus = String(meta?.status || '1'); 
    const period = parseInt(meta?.period || '0', 10);
    
    const homeName = ((summary?.home?.name || '') + ' ' + (summary?.home?.code || '') + ' ' + (summary?.home?.team_code || '')).toLowerCase();
    const isHomeCuda = homeName.includes('barracuda') || homeName.includes('sj') || homeName.includes('san jose');
    
    const homeScore = parseInt(summary?.totalGoals?.home || '0', 10);
    const visScore = parseInt(summary?.totalGoals?.visitor || '0', 10);
    
    const cudaScore = isHomeCuda ? homeScore : visScore;
    const oppScore = isHomeCuda ? visScore : homeScore;

    let { data: state } = await supabase.from('active_game_state').select('*').eq('game_id', gameId).single();

    if (!state) {
      const initial = { game_id: gameId, status: 'pregame', current_period: 0, home_score: 0, visitor_score: 0 };
      await supabase.from('active_game_state').insert(initial);
      state = initial;
    }

    const previousCudaScore = isHomeCuda ? (state.home_score || 0) : (state.visitor_score || 0);
    let pushResult = null;

    if (cudaScore > previousCudaScore) {
      pushResult = await sendPushNotification('🚨 BARRACUDA GOAL! 🚨', 'SJ ' + cudaScore + ', ' + opponent + ' ' + oppScore + '!');
    }

    // Accept status '3' or '4' as final game states
    const isFinal = gameStatus === '3' || gameStatus === '4';
    let statsWritten = false;

    if (isFinal && state.status !== 'final') {
      const won = cudaScore > oppScore;
      pushResult = await sendPushNotification(won ? '🎉 BARRACUDA WIN! 🦈⚡️' : '🏒 FINAL BUZZER', 'FINAL: Barracuda ' + cudaScore + ', ' + opponent + ' ' + oppScore + '.');
      state.status = 'final';
    }

    await supabase.from('active_game_state').update({ status: state.status, current_period: period, home_score: homeScore, visitor_score: visScore, updated_at: new Date().toISOString() }).eq('game_id', gameId);

    // Keep the `schedule` table (what the app's screens actually read)
    // current every run, not just `active_game_state`.
    const scheduleUpdate: Record<string, unknown> = {
      home_score: homeScore,
      away_score: visScore,
      status: isFinal ? 'FINAL' : period > 0 ? 'IN_PROGRESS' : 'SCHEDULED',
    };

    // On the final transition, build the full box score (with three stars)
    // straight from the Gamecenter summary already fetched above — no
    // second network call, and no separate feed/key to keep in sync.
    if (isFinal && state.status === 'final') {
      const mapped = mapGamecenterSummary(summary, isHomeCuda, todayGame.opponent_abbr || 'OPP');
      if (mapped) {
        // Keep the per-player box score sync-scores already stored on this
        // game (stats.playerStats). This mapper doesn't produce it, and
        // overwriting stats without it every 2 minutes would intermittently
        // wipe it — which zeroes Barracuda player stats on the next hourly
        // sync-ahl-stats recompute.
        const existingPlayerStats = (todayGame as any).stats?.playerStats;
        if (existingPlayerStats) (mapped as any).playerStats = existingPlayerStats;
        scheduleUpdate.stats = mapped;
        statsWritten = true;
      }
    }

    await supabase.from('schedule').update(scheduleUpdate).eq('game_id', gameId);

    return new Response(JSON.stringify({ success: true, gameId: gameId, gameStatus: gameStatus, period: period, cudaScore: cudaScore, oppScore: oppScore, isFinal: isFinal, statsWritten: statsWritten, pushResult: pushResult }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
