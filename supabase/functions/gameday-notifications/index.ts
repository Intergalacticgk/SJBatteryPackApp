import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Everything below works in Pacific "minutes since midnight" terms on both
// sides of the comparison (current time AND puck-drop time), so there's no
// UTC offset / DST math to get wrong.

function pacificNowParts() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  // hour comes back as "24" at midnight instead of "00" in some runtimes
  const hour = parts.hour === '24' ? 0 : parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  return { dateStr, nowMinutes: hour * 60 + minute };
}

// "7:00 PM" / "10:30 AM" -> minutes since midnight
function parseGameTime(gameTime: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((gameTime || '').trim());
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const isPM = m[3].toUpperCase() === 'PM';
  if (hour === 12) hour = isPM ? 12 : 0;
  else if (isPM) hour += 12;
  return hour * 60 + minute;
}

async function sendToAudience(column: 'notify_gameday_reminders' | 'notify_events', title: string, body: string, data: Record<string, unknown>) {
  const { data: tokens, error } = await supabase.from('push_tokens').select('token').eq(column, true);
  if (error || !tokens || tokens.length === 0) return { sent: 0 };

  const messages = tokens.map((t) => ({ to: t.token, sound: 'default', title, body, data }));
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(chunk),
    });
  }
  return { sent: messages.length };
}

// Returns true the first time it's called for this (game_id, notif_type)
// pair, false on every subsequent call (already sent) — makes the whole
// thing safe to run on a 5-minute cron without double-sending.
async function claimOnce(gameId: string, notifType: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_log')
    .insert({ game_id: gameId, notif_type: notifType })
    .select('id');
  if (error) return false; // unique violation = already sent, or a real error — either way, don't send
  return !!data && data.length > 0;
}

Deno.serve(async (_req) => {
  try {
    const { dateStr: todayStr, nowMinutes } = pacificNowParts();
    const results: Record<string, unknown> = {};

    const { data: games, error: schedError } = await supabase.from('schedule').select('*').eq('game_date', todayStr);
    if (schedError) throw schedError;
    const todayGame = (games || [])[0];

    if (!todayGame) {
      return new Response(JSON.stringify({ message: 'No game today', todayStr, nowMinutes }), { status: 200 });
    }

    // --- Gameday Morning Reminder: once, at 9:00-9:04 AM Pacific, for any game (home or away) ---
    if (nowMinutes >= 9 * 60 && nowMinutes < 9 * 60 + 5) {
      if (await claimOnce(todayGame.game_id, 'gameday_morning')) {
        results.gamedayMorning = await sendToAudience(
          'notify_gameday_reminders',
          "🚨 IT'S GAMEDAY IN CUDA COUNTRY!",
          'Check the Know Before You Go guide and rally with Section 108 tonight at Tech CU Arena.',
          { screen: '/(drawer)/fanzone' }
        );
      } else {
        results.gamedayMorning = 'already sent or no claim';
      }
    }

    // --- Events & Tabling Alerts: only for HOME games with a tabling event scheduled today ---
    if (todayGame.home_away === 'HOME') {
      const puckDropMinutes = parseGameTime(todayGame.game_time);
      if (puckDropMinutes != null) {
        const { data: tablingEvents } = await supabase
          .from('supporter_events')
          .select('id, location, event_time')
          .eq('event_date', todayStr)
          .ilike('category', '%tabling%')
          .limit(1);
        const tablingEvent = (tablingEvents || [])[0];

        if (tablingEvent) {
          const location = tablingEvent.location || 'outside Section 108';

          // +10 min after puck drop (1st intermission is coming up)
          if (nowMinutes >= puckDropMinutes + 10 && nowMinutes < puckDropMinutes + 15) {
            if (await claimOnce(todayGame.game_id, 'tabling_10')) {
              results.tabling10 = await sendToAudience(
                'notify_events',
                '🦈 Booster Table is OPEN!',
                `Swing by ${location} during the 1st intermission for free stickers, pins, and friendship bracelets!`,
                { screen: '/(drawer)/fanzone' }
              );
            } else {
              results.tabling10 = 'already sent or no claim';
            }
          }

          // +30 min after puck drop (2nd intermission window)
          if (nowMinutes >= puckDropMinutes + 30 && nowMinutes < puckDropMinutes + 35) {
            if (await claimOnce(todayGame.game_id, 'tabling_30')) {
              results.tabling30 = await sendToAudience(
                'notify_events',
                '🦈 Still at the Booster Table!',
                `We're still set up at ${location} — come say hi during the 2nd intermission before it wraps up.`,
                { screen: '/(drawer)/fanzone' }
              );
            } else {
              results.tabling30 = 'already sent or no claim';
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, todayStr, nowMinutes, gameId: todayGame.game_id, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
