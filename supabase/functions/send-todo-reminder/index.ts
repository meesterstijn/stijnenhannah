// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE = "Europe/Amsterdam";
const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { dateStr, hour, minute } = nowInAmsterdam();
    const dueNow = hour > REMINDER_HOUR || (hour === REMINDER_HOUR && minute >= REMINDER_MINUTE);
    if (!dueNow) {
      return new Response(JSON.stringify({ skipped: "not due yet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingRun } = await supabase
      .from("todo_reminder_runs")
      .select("id")
      .eq("run_date", dateStr)
      .maybeSingle();
    if (existingRun) {
      return new Response(JSON.stringify({ skipped: "already ran today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertRunError } = await supabase
      .from("todo_reminder_runs")
      .insert({ run_date: dateStr });
    if (insertRunError) throw insertRunError;

    const { data: openTodos, error: todosError } = await supabase
      .from("todos")
      .select("text")
      .eq("done", false)
      .order("created_at", { ascending: true });
    if (todosError) throw todosError;

    if (!openTodos || openTodos.length === 0) {
      return new Response(JSON.stringify({ skipped: "no open todos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxListed = 5;
    const listed = openTodos.slice(0, maxListed).map((t) => `• ${t.text}`).join("\n");
    const extra = openTodos.length - maxListed;
    const body = extra > 0 ? `${listed}\n en ${extra} meer` : listed;

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    const payload = JSON.stringify({
      title: `To-do: ${openTodos.length} ${openTodos.length === 1 ? "taak" : "taken"} open`,
      body,
      url: "/stijnenhannah/#/todo",
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

    return new Response(JSON.stringify({ openTodos: openTodos.length, sent }), {
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
