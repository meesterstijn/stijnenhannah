import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const bucket = "game-night-player-faces";
const client = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

// No Supabase Auth account is required. Every action is authorized by the
// database against the invitation or the existing scoped guest credential.
export async function handleGuestFaceRequest(req: Request) {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return respond({ error: "Gebruik POST." }, 405);
  try {
    const body = await req.json();
    if (!body || !["read", "prepare-upload"].includes(body.action)) {
      return respond({ error: "Ongeldige fotoactie." }, 400);
    }
    if (
      body.action === "prepare-upload" &&
      !["jpg", "png", "webp"].includes(body.extension)
    ) {
      return respond({ error: "Ongeldig fotoformaat." }, 400);
    }
    const { data: access, error } = await client.rpc(
      "game_night_guest_face_access",
      {
        p_action: body.action === "read" ? "read" : "write",
        p_guest_token: body.guestToken ?? null,
        p_session_id: body.sessionId ?? null,
        p_join_token: body.action === "read" ? (body.joinToken ?? null) : null,
        p_asset_path: body.action === "read" ? (body.path ?? null) : null,
      },
    );
    if (error) return respond({ error: error.message }, 403);
    const storage = client.storage.from(bucket);
    if (body.action === "read") {
      const { data, error: signingError } = await storage.createSignedUrl(
        access.asset_path,
        3600,
      );
      if (signingError) throw signingError;
      return respond({ signedUrl: data.signedUrl });
    }
    // The caller cannot supply a target player, path, bucket or upsert flag.
    const directory = `${access.player_id}/${crypto.randomUUID()}`;
    const original = await storage.createSignedUploadUrl(
      `${directory}/original.${body.extension}`,
    );
    if (original.error) throw original.error;
    const face = await storage.createSignedUploadUrl(`${directory}/face.png`);
    if (face.error) throw face.error;
    return respond({
      original: { path: original.data.path, token: original.data.token },
      face: { path: face.data.path, token: face.data.token },
    });
  } catch {
    return respond(
      { error: "Foto verwerken mislukt. Probeer het opnieuw." },
      400,
    );
  }
}

Deno.serve(handleGuestFaceRequest);
