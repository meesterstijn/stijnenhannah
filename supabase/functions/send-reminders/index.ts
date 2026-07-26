// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let sent = 0;
    let cleaned = 0;
    let checked = 0;

    async function sendToOwner(
      ownerId: string,
      title: string,
      body: string,
      url: string,
    ) {
      const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", ownerId);
      if (subsError) throw subsError;

      const payload = JSON.stringify({ title, body, url });

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
          sent++;
        } catch (err) {
          // 404/410 means the subscription is no longer valid on the browser's push service.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            cleaned++;
          } else {
            console.error("push send failed", ownerId, sub.id, err);
          }
        }
      }
    }

    const { data: dueNotes, error: notesError } = await supabase
      .from("notes")
      .select("id, title, created_by, remind_at")
      .lte("remind_at", new Date().toISOString())
      .is("reminder_sent_at", null)
      .not("remind_at", "is", null);
    if (notesError) throw notesError;
    checked += dueNotes?.length ?? 0;

    for (const note of dueNotes ?? []) {
      await sendToOwner(
        note.created_by,
        note.title?.trim() || "Herinnering",
        "Je hebt een herinnering voor deze notitie.",
        "/#/notities",
      );
      await supabase
        .from("notes")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", note.id);
    }

    const { data: dueTodos, error: todosError } = await supabase
      .from("todos")
      .select("id, text, created_by, remind_at")
      .lte("remind_at", new Date().toISOString())
      .is("reminder_sent_at", null)
      .not("remind_at", "is", null);
    if (todosError) throw todosError;
    checked += dueTodos?.length ?? 0;

    for (const todo of dueTodos ?? []) {
      await sendToOwner(
        todo.created_by,
        "Herinnering",
        todo.text?.trim() || "Je hebt een herinnering voor deze taak.",
        "/#/todo",
      );
      await supabase
        .from("todos")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", todo.id);
    }

    return new Response(JSON.stringify({ checked, sent, cleaned }), {
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
