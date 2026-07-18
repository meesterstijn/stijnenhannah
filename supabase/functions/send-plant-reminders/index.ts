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

const MONTH_NAMES = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

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

function currentAmsterdamMonthName(): string {
  const monthNum = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, month: "numeric" }).format(new Date()),
  );
  return MONTH_NAMES[monthNum - 1];
}

function namesList(names: string[]): string {
  return names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")} en ${names.length - 5} meer`;
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
      .select(
        "id, name, growing_method, water_interval_days, pot_water_interval_days, last_watered_at, last_water_reminder_sent_at, reminders_enabled, feeding_interval_days, last_fed_at, last_feeding_reminder_sent_at, feeding_reminders_enabled, feeding_months",
      )
      .eq("planted", true)
      .or("water_interval_days.not.is.null,pot_water_interval_days.not.is.null,feeding_interval_days.not.is.null");
    if (plantsError) throw plantsError;

    const now = Date.now();
    const currentMonth = currentAmsterdamMonthName();

    const dueWater = (plants ?? []).filter((p) => {
      const intervalDays =
        p.growing_method === "Pot" && p.pot_water_interval_days
          ? p.pot_water_interval_days
          : p.water_interval_days;
      if (!p.reminders_enabled || !intervalDays) return false;
      if (isSameLocalDay(p.last_water_reminder_sent_at)) return false;
      if (!p.last_watered_at) return true;
      const dueAt = new Date(p.last_watered_at).getTime() + intervalDays * 24 * 60 * 60 * 1000;
      return dueAt <= now;
    });

    const dueFeeding = (plants ?? []).filter((p) => {
      if (!p.feeding_reminders_enabled || !p.feeding_interval_days) return false;
      if (p.feeding_months?.length > 0 && !p.feeding_months.includes(currentMonth)) return false;
      if (isSameLocalDay(p.last_feeding_reminder_sent_at)) return false;
      if (!p.last_fed_at) return true;
      const dueAt = new Date(p.last_fed_at).getTime() + p.feeding_interval_days * 24 * 60 * 60 * 1000;
      return dueAt <= now;
    });

    if (dueWater.length === 0 && dueFeeding.length === 0) {
      return new Response(JSON.stringify({ skipped: "no plants due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dueWater.length > 0) {
      const { error: updateError } = await supabase
        .from("plants")
        .update({ last_water_reminder_sent_at: new Date().toISOString() })
        .in("id", dueWater.map((p) => p.id));
      if (updateError) throw updateError;
    }

    if (dueFeeding.length > 0) {
      const { error: updateError } = await supabase
        .from("plants")
        .update({ last_feeding_reminder_sent_at: new Date().toISOString() })
        .in("id", dueFeeding.map((p) => p.id));
      if (updateError) throw updateError;
    }

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    const bodyLines = [];
    if (dueWater.length > 0) {
      bodyLines.push(`💧 Water: ${namesList(dueWater.map((p) => p.name))}`);
    }
    if (dueFeeding.length > 0) {
      bodyLines.push(`🌿 Voeding: ${namesList(dueFeeding.map((p) => p.name))}`);
    }
    const totalCount = dueWater.length + dueFeeding.length;
    const payload = JSON.stringify({
      title: `Tuinieren: ${totalCount} ${totalCount === 1 ? "plant" : "planten"} verzorgen`,
      body: bodyLines.join("\n"),
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

    return new Response(
      JSON.stringify({ dueWater: dueWater.length, dueFeeding: dueFeeding.length, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
