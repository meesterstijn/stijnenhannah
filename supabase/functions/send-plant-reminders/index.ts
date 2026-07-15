// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE = "Europe/Amsterdam";
const REMINDER_HOUR = 18;
const REMINDER_MINUTE = 0;

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

function todayInAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

function isSameLocalDay(iso: string | null): boolean {
  if (!iso) return false;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(iso)) === todayInAmsterdam();
}

function currentAmsterdamTime(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { hour: get("hour"), minute: get("minute") };
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
    const { hour, minute } = currentAmsterdamTime();
    const dueNow = hour > REMINDER_HOUR || (hour === REMINDER_HOUR && minute >= REMINDER_MINUTE);
    if (!dueNow) {
      return new Response(JSON.stringify({ skipped: "not due yet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, name, water_interval_days, last_watered_at, last_water_reminder_sent_at")
      .eq("reminders_enabled", true)
      .not("water_interval_days", "is", null);
    if (plantsError) throw plantsError;

    const now = Date.now();
    const due = (plants ?? []).filter((p) => {
      if (isSameLocalDay(p.last_water_reminder_sent_at)) return false;
      if (!p.last_watered_at) return true;
      const dueAt = new Date(p.last_watered_at).getTime() + p.water_interval_days * 24 * 60 * 60 * 1000;
      return dueAt <= now;
    });

    if (due.length === 0) {
      return new Response(JSON.stringify({ skipped: "no plants due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("plants")
      .update({ last_water_reminder_sent_at: new Date().toISOString() })
      .in("id", due.map((p) => p.id));
    if (updateError) throw updateError;

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    const names = due.map((p) => p.name);
    const body = names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")} en ${names.length - 5} meer`;
    const payload = JSON.stringify({
      title: `Tuinieren: ${due.length} ${due.length === 1 ? "plant" : "planten"} water geven`,
      body,
      url: "/stijnenhannah/#/tuinieren",
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

    return new Response(JSON.stringify({ due: due.length, sent }), {
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
