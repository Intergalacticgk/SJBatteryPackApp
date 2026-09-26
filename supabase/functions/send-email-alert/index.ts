import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const NOTIFICATION_EMAIL = 'sjbatterypack@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { table, record } = payload;

    let emailSubject = '';
    let emailHtml = '';

    // 1. ROAD TRIP INTEREST SUBMISSION
    if (table === 'road_trip_interest') {
      const fanName = record.fan_name || record.full_name || 'A Supporter';
      const eventTitle = record.trip_name || record.event_name || 'Away Road Trip';
      const ticketCount = record.party_size || record.ticket_count || 1;
      const hotelInterest = record.hotel_interest || record.hotel_needed ? 'Yes' : 'No';
      const email = record.email || 'None provided';
      const phone = record.phone || 'None provided';
      const notes = record.notes || 'None';

      emailSubject = `🚌 New Road Trip Sign-up: ${fanName} (${eventTitle})`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #004D57; border-radius: 10px;">
          <h2 style="color: #00373E; border-bottom: 2px solid #FFB800; padding-bottom: 8px;">
            🏒 New Road Trip Interest Received!
          </h2>
          <p>A new fan signed up to receive away game travel & ticket details:</p>
          <ul style="line-height: 1.8; color: #333;">
            <li><strong>Fan Name:</strong> ${fanName}</li>
            <li><strong>Road Trip:</strong> ${eventTitle}</li>
            <li><strong>Party Size / Tickets:</strong> ${ticketCount}</li>
            <li><strong>Hotel Block Interest:</strong> ${hotelInterest}</li>
            <li><strong>Email:</strong> <a href="mailto:${email}">${email}</a></li>
            <li><strong>Phone:</strong> ${phone}</li>
            <li><strong>Notes / Travel Mode:</strong> ${notes}</li>
          </ul>
          <p style="font-size: 11px; color: #888; margin-top: 20px;">Sent automatically by the SJ Battery Pack App engine.</p>
        </div>
      `;
    }

    // 2. CHANT IDEA SUBMISSION
    else if (table === 'chant_submissions') {
      const submitterName = record.submitter_name || 'Supporter 108';
      const contactEmail = record.contact_email || 'None provided';
      const chantTitle = record.chant_title || 'Untitled Chant';
      const tempo = record.melody_inspiration || 'Not specified';
      const lyrics = (record.chant_lyrics || '').replace(/\n/g, '<br/>');

      emailSubject = `📢 New Chant Submission: "${chantTitle}" by ${submitterName}`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #004D57; border-radius: 10px;">
          <h2 style="color: #00373E; border-bottom: 2px solid #FF671F; padding-bottom: 8px;">
            🥁 New Chant Idea for Section 108!
          </h2>
          <p>A fan submitted a rally chant or taunt idea:</p>
          <ul style="line-height: 1.8; color: #333;">
            <li><strong>Chant Title:</strong> ${chantTitle}</li>
            <li><strong>Submitter:</strong> ${submitterName}</li>
            <li><strong>Contact Email:</strong> <a href="mailto:${contactEmail}">${contactEmail}</a></li>
            <li><strong>Tempo / Drum Beat:</strong> ${tempo}</li>
          </ul>
          <div style="background-color: #F4F6F9; border-left: 4px solid #004D57; padding: 12px; margin-top: 15px;">
            <strong>Lyrics & Cues:</strong><br/>
            <p style="font-family: monospace; font-size: 13px; color: #111; margin-top: 8px;">${lyrics}</p>
          </div>
          <p style="font-size: 11px; color: #888; margin-top: 20px;">Sent automatically by the SJ Battery Pack App engine.</p>
        </div>
      `;
    } else {
      return new Response(JSON.stringify({ message: 'Table ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Send the email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SJ Battery Pack App <onboarding@resend.dev>',
        to: [NOTIFICATION_EMAIL],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const resData = await res.json();
    return new Response(JSON.stringify(resData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});