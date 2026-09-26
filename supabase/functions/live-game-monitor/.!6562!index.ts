import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verified key for the GameCenter (feed=gc) live endpoint
const AHL_KEY = '50c2cd9a7702e48e';

async function sendPushNotification(title: string, body: string, dataPayload: Record<string, any> = {}) {
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq("notify_live_scores", true);

  if (error || !tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title,
    body,
    data: dataPayload,
  }));

  const chunks = [];
  while (messages.length > 0) {
    chunks.push(messages.splice(0, 100));
  }

  for (const chunk of chunks) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
    } catch (e) {
      console.error('Failed to dispatch push chunk:', e);
    }
  }
}

Deno.serve(async (_req) => {
  try {
    // 1. Fetch today's game directly from YOUR database to bypass HockeyTech schedule blocks
    const { data: games, error: schedError } = await supabase.from('schedule').select('*');
    if (schedError) throw schedError;

    // Calculate today's date in Pacific Time (San Jose)
    const pacificDate = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()); 
    const [month, day, year] = pacificDate.split('/');
    const todayStr = `${year}-${month}-${day}`;

    // Find a game matching today's date
    const todayGame = games?.find((g: any) => g.game_date && g.game_date.startsWith(todayStr));

    if (!todayGame) {
      return new Response(JSON.stringify({ message: 'No active game today in local schedule', date: todayStr }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const gameId = todayGame.game_id;
    if (!gameId) {
      return new Response(JSON.stringify({ error: `Game found for ${todayStr}, but missing 'game_id' in Supabase schedule table.` }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const opponent = todayGame.opponent || 'Opponent';

    // 2. Fetch live play-by-play feed
    const liveUrl = `https://lscluster.hockeytech.com/feed/index.php?feed=gc&key=${AHL_KEY}&client_code=ahl&game_id=${gameId}&tab=pxpverbose`;
    const liveRes = await fetch(liveUrl);
    const rawLiveText = await liveRes.text();

    let liveData: any;
    try {
      liveData = JSON.parse(rawLiveText);
    } catch {
      return new Response(JSON.stringify({ warning: 'Upstream live feed non-JSON', raw: rawLiveText }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const gcData = liveData?.GC;
    const gameStatus = String(gcData?.Parameters?.game_status || '1'); // 1: upcoming, 2: in-progress, 3: final
    const period = parseInt(gcData?.Parameters?.period || '0', 10);
    const homeTeam = gcData?.Parameters?.home_team_name || '';
    const isHome = homeTeam.toLowerCase().includes('barracuda');
    const cudaScore = isHome
      ? parseInt(gcData?.Parameters?.home_goals || '0', 10)
      : parseInt(gcData?.Parameters?.visiting_goals || '0', 10);
    const oppScore = isHome
      ? parseInt(gcData?.Parameters?.visiting_goals || '0', 10)
      : parseInt(gcData?.Parameters?.home_goals || '0', 10);

    // 3. Load or initialize database state
    let { data: state } = await supabase.from('active_game_state').select('*').eq('game_id', gameId).single();

    if (!state) {
      const initial = {
        game_id: gameId,
        status: 'pregame',
        current_period: 0,
        home_score: 0,
        visitor_score: 0,
      };
      await supabase.from('active_game_state').insert(initial);
      state = initial;
    }

