import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, type } = payload; // Triggered by Database Webhook or Cron

    // 💬 A. CHAT MESSAGE NOTIFICATION
    // Handles various possible column names: message / message_text / content, room / room_name / channel
    const messageContent = record?.message || record?.message_text || record?.content;
    const roomName = record?.room || record?.room_name || record?.channel || 'General';
    const senderName = record?.username || record?.user_name || 'Supporter';
    const senderId = record?.user_id;

    if (messageContent) {
      // 1. Get all active push tokens except the sender
      let query = supabase
        .from('profiles')
        .select('expo_push_token, id')
        .not('expo_push_token', 'is', null);

      if (senderId) {
        query = query.neq('id', senderId);
      }

      const { data: profiles } = await query;

      const tokens = (profiles || [])
        .map((p: any) => p.expo_push_token)
        .filter((t: string) => t && t.startsWith('ExponentPushToken'));

      if (tokens.length > 0) {
        const preview = messageContent.length > 90
          ? `${messageContent.substring(0, 87)}...`
          : messageContent;

        const messages = tokens.map((token: string) => ({
          to: token,
          sound: 'default',
          title: `💬 #${roomName} • ${senderName}`,
          body: preview,
          data: {
            screen: '/(drawer)/chat',
            room: roomName,
            roomId: record?.room_id || record?.room || 'general',
            messageId: record?.id,
          },
        }));

        // Chunk into batches of 100 for Expo Push API limits
        for (let i = 0; i < messages.length; i += 100) {
          const chunk = messages.slice(i, i + 100);
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(chunk),
          });
        }
      }
    }

    // 🏒 B. GAMEDAY MORNING NOTIFICATION (Triggered via Cron at 9:00 AM)
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

        for (let i = 0; i < gamedayMessages.length; i += 100) {
          const chunk = gamedayMessages.slice(i, i + 100);
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(chunk),
          });
        }
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