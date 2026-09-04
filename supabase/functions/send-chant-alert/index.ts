import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record; // The newly inserted row from chant_submissions

    if (!record) {
      return new Response(JSON.stringify({ error: "No record found" }), { status: 400 });
    }

    const {
      submitter_name,
      contact_email,
      chant_title,
      chant_lyrics,
      melody_inspiration,
      created_at,
    } = record;

    // Send email alert via Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SJ Battery Pack App <alerts@sjbatterypack.com>",
        to: ["info@sjbatterypack.com"],
        subject: `📢 New Chant Idea: ${chant_title}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #111;">
            <h2 style="color: #00424A;">🥁 New Chant Submission Received!</h2>
            <p><strong>Title:</strong> ${chant_title}</p>
            <p><strong>Submitter:</strong> ${submitter_name || "Anonymous"} (${contact_email || "No email provided"})</p>
            <p><strong>Tempo / Beat Cues:</strong> ${melody_inspiration || "Standard rhythm"}</p>
            <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
            <h3 style="color: #DD8943;">Lyrics / Breakdown:</h3>
            <pre style="background: #f4f4f4; padding: 15px; border-radius: 8px; font-family: monospace; white-space: pre-wrap;">${chant_lyrics}</pre>
            <p style="font-size: 11px; color: #888; margin-top: 30px;">Submitted at: ${new Date(created_at).toLocaleString()}</p>
          </div>
        `,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});