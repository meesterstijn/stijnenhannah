// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getDeepLKey(): Promise<string> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "deepl_api_key")
    .single();
  if (error || !data?.value) throw new Error("DeepL sleutel niet ingesteld");
  return data.value as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const apiKey = await getDeepLKey();
    const baseUrl = apiKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2"
      : "https://api.deepl.com/v2";
    const authHeader = { "Authorization": `DeepL-Auth-Key ${apiKey}` };

    if (body.action === "usage") {
      const res = await fetch(`${baseUrl}/usage`, { headers: authHeader });
      const json = await res.json();
      return new Response(JSON.stringify(json), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, source_lang, target_lang } = body;
    const res = await fetch(`${baseUrl}/translate`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text], source_lang, target_lang }),
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `DeepL fout (${res.status})` }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await res.json();
    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
