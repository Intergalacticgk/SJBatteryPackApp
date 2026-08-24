import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (_req) => {
  try {
    const ahlFormatted: any[] = [];

    // 1. Fetch Barracuda Roster from AHL HockeyTech Endpoint
    try {
      const ahlUrl = 'https://lscluster.hockeytech.com/feed/index.php?feed=statviewfeed&view=roster&team_id=408&client_code=ahl&league_id=4&lang=en';
      const ahlRes = await fetch(ahlUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      
      const rawText = await ahlRes.text();
      if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        const ahlJson = JSON.parse(rawText);
        const ahlPlayers = ahlJson?.SiteKit?.Statviewfeed?.roster || [];
        
        ahlPlayers.forEach((p: any) => {
          ahlFormatted.push({
            player_id: String(p.player_id),
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            jersey_number: p.jersey_number || '00',
            position: p.position || 'F',
            games_played: parseInt(p.games_played || '0', 10),
            goals: parseInt(p.goals || '0', 10),
            assists: parseInt(p.assists || '0', 10),
            points: parseInt(p.points || '0', 10),
            updated_at: new Date().toISOString(),
          });
        });
      }
    } catch (e) {
      console.error('AHL fetch failed, skipping AHL portion:', e);
    }

    // 2. Fetch Sharks Roster from NHL Public API
    try {
      const nhlRosterRes = await fetch('https://api-web.nhle.com/v1/roster/SJS/current');
      const nhlJson = await nhlRosterRes.json();
      const allSkaters = [
        ...(nhlJson.forwards || []),
        ...(nhlJson.defensemen || []),
        ...(nhlJson.goalies || [])
      ];

      allSkaters.forEach((p: any) => {
        ahlFormatted.push({
          player_id: `nhl-${p.id}`,
          first_name: p.firstName?.default || '',
          last_name: p.lastName?.default || '',
          jersey_number: String(p.sweaterNumber || '00'),
          position: p.positionCode || 'F',
          games_played: p.gamesPlayed || 0,
          goals: p.goals || 0,
          assists: p.assists || 0,
          points: (p.goals || 0) + (p.assists || 0),
          updated_at: new Date().toISOString(),
        });
      });
    } catch (e) {
      console.error('NHL fetch error:', e);
    }

    // 3. Upsert formatted players into Supabase
    if (ahlFormatted.length > 0) {
      const { error: upsertError } = await supabase
        .from('barracuda_roster')
        .upsert(ahlFormatted, { onConflict: 'player_id' });

      if (upsertError) throw upsertError;
    }

    return new Response(
      JSON.stringify({ success: true, count: ahlFormatted.length }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});