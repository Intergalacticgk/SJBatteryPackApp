import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, type } = payload; // Triggered by Database Webhook or Cron

    // 💬 A. CHAT MESSAGE NOTIFICATION
    if (record?.message && record?.room) {
      // Get all active push tokens except the sender
      const { data: profiles } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .neq('id', record.user_id)
        .not('expo_push_token', 'is', null);

      const tokens = profiles?.map((p: any) => p.expo_push_token).filter(Boolean) || [];

      if (tokens.length > 0) {
        const messages = tokens.map((token: string) => ({
          to: token,
          sound: 'default',
          title: `💬 #${record.room} • ${record.username}`,
          body: record.message,
          data: { screen: '/(drawer)/chat', room: record.room },
        }));

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
      }
    }

    // 🏒 B. GAMEDAY MORNING NOTIFICATION (Triggered via Cron at 9:00 AM)
    if (type === 'GAMEDAY_ALERT') {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .not('expo_push_token', 'is', null);

      const tokens = profiles?.map((p: any) => p.expo_push_token).filter(Boolean) || [];

      if (tokens.length > 0) {
        const messages = tokens.map((token: string) => ({
          to: token,
          sound: 'default',
          title: "🚨 IT'S GAMEDAY IN CUDA COUNTRY!",
          body: 'Check the Know Before You Go guide and rally with Section 108 tonight at Tech CU Arena.',
          data: { screen: '/(drawer)/fanzone' },
        }));

        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
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