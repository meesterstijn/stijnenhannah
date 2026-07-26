// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE = "Europe/Amsterdam";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

function nowInAmsterdam(): { dateStr: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY ontbreekt");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini fout (${res.status}): ${errBody}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini gaf geen tekst terug");
  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: config, error: configError } = await supabase
      .from("daily_prompt")
      .select("prompt, hour, minute")
      .limit(1)
      .maybeSingle();
    if (configError) throw configError;
    if (!config || !config.prompt.trim()) {
      return new Response(JSON.stringify({ skipped: "no prompt configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dateStr, hour, minute } = nowInAmsterdam();
    const dueNow = hour > config.hour || (hour === config.hour && minute >= config.minute);
    if (!dueNow) {
      return new Response(JSON.stringify({ skipped: "not due yet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRun } = await supabase
      .from("daily_prompt_runs")
      .select("id")
      .eq("run_date", dateStr)
      .maybeSingle();
    if (existingRun) {
      return new Response(JSON.stringify({ skipped: "already ran today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseText = await callGemini(config.prompt);

    const { error: insertError } = await supabase.from("daily_prompt_runs").insert({
      run_date: dateStr,
      prompt: config.prompt,
      response: responseText,
    });
    if (insertError) throw insertError;

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    const preview = responseText.length > 140 ? `${responseText.slice(0, 140)}…` : responseText;
    const payload = JSON.stringify({
      title: "Dagvraag",
      body: preview,
      url: "/#/dagvraag",
    });

    let sent = 0;
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("push send failed", sub.id, err);
        }
      }
    }

    return new Response(JSON.stringify({ generated: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
