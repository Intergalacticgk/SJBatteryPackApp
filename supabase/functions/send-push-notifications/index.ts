import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

// Chat rooms -> label/emoji and the push_tokens column that toggles them.
// 'prospects' is the legacy id of the room that is now 'sharks'.
const SHARKS_ROOM = { label: 'Sharks', emoji: '🦈', column: 'notify_chat_sharks' };
const CHAT_ROOMS: Record<string, { label: string; emoji: string; column: string }> = {
  general: { label: 'General', emoji: '🗣️', column: 'notify_chat_general' },
  'watch-parties': { label: 'Watch Parties', emoji: '🍻', column: 'notify_chat_watch_parties' },
  merch: { label: 'Merch & Tickets', emoji: '🎟️', column: 'notify_chat_merch' },
  sharks: SHARKS_ROOM,
  prospects: SHARKS_ROOM,
};

async function sendExpoPush(messages: any[]) {
  const dead: string[] = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => null);
      const tickets: any[] = json?.data ?? [];
      tickets.forEach((t, idx) => {
        if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered') {
          dead.push(chunk[idx].to);
        }
      });
    } catch (e) {
      console.error('Expo push send failed:', e);
    }
  }
  return dead;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, type } = payload; // Triggered by Database Webhook or Cron

    // 💬 A. CHAT MESSAGE NOTIFICATION
    // Fires from the on_new_chat_message trigger for every new chat_messages row.
    const messageText = (record?.message || record?.content || '').toString().trim();
    const mediaType = record?.media_type as string | undefined;
    const hasMedia = !!record?.media_url;

    if (record && (messageText || hasMedia) && payload.table !== 'profiles') {
      const roomId: string = record.room || 'general';
      const cfg = CHAT_ROOMS[roomId] ?? { label: roomId, emoji: '💬', column: '' };
      const senderName = record.username || 'Supporter';
      const senderId: string | undefined = record.user_id;

      // Devices that have this room's toggle ON (rooms without a toggle notify nobody).
      let rows: { token: string; user_id: string | null }[] = [];
      if (cfg.column) {
        const { data, error } = await supabase
          .from('push_tokens')
          .select('token, user_id')
          .eq(cfg.column, true);
        if (error) console.error('push_tokens query error:', error.message);
        rows = data ?? [];
      }

      // Never notify the author of the message on their own device(s).
      let senderLegacyToken: string | null = null;
      if (senderId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('expo_push_token')
          .eq('id', senderId)
          .maybeSingle();
        senderLegacyToken = prof?.expo_push_token ?? null;
      }

      const tokens = Array.from(
        new Set(
          rows
            .filter((r) => !senderId || r.user_id !== senderId)
            .map((r) => r.token)
            .filter((t) => t && TOKEN_RE.test(t) && t !== senderLegacyToken),
        ),
      );

      if (tokens.length > 0) {
        let body = messageText;
        if (!body) body = mediaType === 'GIF' ? 'sent a GIF 🎞️' : 'sent a photo 📷';
        if (body.length > 100) body = `${body.substring(0, 97)}...`;

        const messages = tokens.map((token) => ({
          to: token,
          sound: 'default',
          channelId: 'default',
          priority: 'high',
          ttl: 3600,
          title: `${cfg.emoji} ${cfg.label} • ${senderName}`,
          body,
          data: {
            screen: '/(drawer)/chat',
            roomId: roomId === 'prospects' ? 'sharks' : roomId,
            messageId: record.id,
          },
        }));

        const dead = await sendExpoPush(messages);
        if (dead.length > 0) {
          await supabase.from('push_tokens').delete().in('token', dead);
        }
      }
    }

    // 🏒 B. GAMEDAY MORNING NOTIFICATION (legacy; the live gameday reminders run
    // from the gameday-notifications function)
    if (type === 'GAMEDAY_ALERT') {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .not('expo_push_token', 'is', null);

      const tokens = (profiles || [])
        .map((p: any) => p.expo_push_token)
        .filter((t: string) => t && t.startsWith('ExponentPushToken'));

      if (tokens.length > 0) {
        const gamedayMessages = tokens.map((token: string) => ({
          to: token,
          sound: 'default',
          title: "🚨 IT'S GAMEDAY IN CUDA COUNTRY!",
          body: 'Check the Know Before You Go guide and rally with Section 108 tonight at Tech CU Arena.',
          data: { screen: '/(drawer)/fanzone' },
        }));
        await sendExpoPush(gamedayMessages);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
