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

// Instance display name mirrors plantInstanceDisplayName() on the client:
// custom_name first, else the species name — e.g. "Koralik kas" instead of
// just "Cherrytomaat 'Koralik'", so a reminder always names a recognizable
// concrete plant, not just the species.
function instanceDisplayName(instance: { custom_name: string | null }, species: { name: string } | null): string {
  if (instance.custom_name && instance.custom_name.trim()) return instance.custom_name.trim();
  return species?.name ?? "Onbekende plant";
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

    // Reminders are computed per concrete plant_instances row (never per
    // species) — a dormant, archived, dead or removed instance is excluded
    // entirely by the `status = active` filter, so it never gets a normal
    // urgent reminder. Species-level advice (intervals, feeding months)
    // comes along via the `species:plants!plant_instances_species_id_fkey(...)`
    // join.
    const { data: instances, error: instancesError } = await supabase
      .from("plant_instances")
      .select(
        "id, custom_name, cultivation_type, last_watered_at, last_water_reminder_sent_at, water_skip_until, reminders_enabled, last_fed_at, last_feeding_reminder_sent_at, feeding_reminders_enabled, " +
          // Disambiguated: plant_instances now has two FKs into plants
          // (species_id and legacy_plant_id), so the embed must name which
          // relationship to follow — otherwise PostgREST errors with
          // PGRST201 ("more than one relationship was found") on every call.
          "species:plants!plant_instances_species_id_fkey(id, name, water_interval_days, pot_water_interval_days, feeding_interval_days, feeding_months)",
      )
      .eq("status", "active");
    if (instancesError) throw instancesError;

    // An active instance with no currently-active growing season (season
    // completed/failed and not yet replanted) has nothing growing in it
    // right now, so it should never get a watering/feeding reminder even
    // though the instance row itself is still `status = active`.
    const { data: activeSeasons, error: seasonsError } = await supabase
      .from("growing_seasons")
      .select("plant_instance_id")
      .eq("status", "active");
    if (seasonsError) throw seasonsError;
    const instanceIdsWithActiveSeason = new Set((activeSeasons ?? []).map((s) => s.plant_instance_id));

    const now = Date.now();
    const currentMonth = currentAmsterdamMonthName();
    const today = todayInAmsterdam();

    const eligible = (instances ?? []).filter((i) => i.species && instanceIdsWithActiveSeason.has(i.id));

    const dueWater = eligible.filter((i) => {
      const species = i.species;
      const intervalDays =
        i.cultivation_type === "pot" && species.pot_water_interval_days
          ? species.pot_water_interval_days
          : species.water_interval_days;
      if (!i.reminders_enabled || !intervalDays) return false;
      if (i.water_skip_until && today < i.water_skip_until) return false;
      if (isSameLocalDay(i.last_water_reminder_sent_at)) return false;
      if (!i.last_watered_at) return true;
      const dueAt = new Date(i.last_watered_at).getTime() + intervalDays * 24 * 60 * 60 * 1000;
      return dueAt <= now;
    });

    const dueFeeding = eligible.filter((i) => {
      const species = i.species;
      if (!i.feeding_reminders_enabled || !species.feeding_interval_days) return false;
      if (species.feeding_months?.length > 0 && !species.feeding_months.includes(currentMonth)) return false;
      if (isSameLocalDay(i.last_feeding_reminder_sent_at)) return false;
      if (!i.last_fed_at) return true;
      const dueAt = new Date(i.last_fed_at).getTime() + species.feeding_interval_days * 24 * 60 * 60 * 1000;
      return dueAt <= now;
    });

    if (dueWater.length === 0 && dueFeeding.length === 0) {
      return new Response(JSON.stringify({ skipped: "no plant instances due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marking last_*_reminder_sent_at prevents duplicate notifications for
    // the same event — one flag per instance, so two instances of the same
    // species are tracked (and de-duplicated) fully independently.
    if (dueWater.length > 0) {
      const { error: updateError } = await supabase
        .from("plant_instances")
        .update({ last_water_reminder_sent_at: new Date().toISOString() })
        .in("id", dueWater.map((i) => i.id));
      if (updateError) throw updateError;
    }

    if (dueFeeding.length > 0) {
      const { error: updateError } = await supabase
        .from("plant_instances")
        .update({ last_feeding_reminder_sent_at: new Date().toISOString() })
        .in("id", dueFeeding.map((i) => i.id));
      if (updateError) throw updateError;
    }

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    const bodyLines = [];
    if (dueWater.length > 0) {
      bodyLines.push(`💧 Water: ${namesList(dueWater.map((i) => instanceDisplayName(i, i.species)))}`);
    }
    if (dueFeeding.length > 0) {
      bodyLines.push(`🌿 Voeding: ${namesList(dueFeeding.map((i) => instanceDisplayName(i, i.species)))}`);
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
    return new Response(JSON.stringify({ error: String(err), detail: err instanceof Error ? err.message : JSON.stringify(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
