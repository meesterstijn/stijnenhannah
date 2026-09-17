import { createContext } from "react";
import { supabase } from "@/lib/supabase";
import { PLAYER_FACES_BUCKET } from "./gameNightFaceStorage";
import type { PreparedFacePhoto } from "../components/FacePhotoEditor";

export type GuestFaceAccess = {
  guestToken?: string | null;
  sessionId?: string;
  joinToken?: string;
};

export const GuestFaceAccessContext = createContext<GuestFaceAccess | null>(
  null,
);

async function faceRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "game-night-guest-faces",
    { body },
  );
  if (error) {
    let message =
      "Je foto kon niet worden geladen of opgeslagen. Probeer het opnieuw.";
    if (error.context instanceof Response) {
      const details = await error.context.json().catch(() => null);
      // A missing deployment is rejected by the gateway before our function
      // runs. Its response uses { code, message }, not our { error } format.
      if (error.context.status === 404 && details?.code === "NOT_FOUND") {
        message =
          "Gezichtsfoto’s zijn nog niet beschikbaar. Vraag de host om dit te activeren en probeer daarna opnieuw.";
      } else if (typeof details?.error === "string") {
        message = details.error;
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export async function readGuestFace(access: GuestFaceAccess, path: string) {
  const result = await faceRequest<{ signedUrl: string }>({
    ...access,
    action: "read",
    path,
  });
  return result.signedUrl;
}

export async function saveGuestFace(
  guestToken: string,
  sessionId: string,
  photo: PreparedFacePhoto,
) {
  const uploads = await faceRequest<{
    original: { path: string; token: string };
    face: { path: string; token: string };
  }>({
    action: "prepare-upload",
    guestToken,
    sessionId,
    extension: photo.original.extension,
  });
  // New paths per attempt: an interrupted upload cannot damage the old avatar.
  for (const [target, blob, contentType] of [
    [uploads.original, photo.original.blob, photo.original.mimeType],
    [uploads.face, photo.faceBlob, "image/png"],
  ] as const) {
    const { error } = await supabase.storage
      .from(PLAYER_FACES_BUCKET)
      .uploadToSignedUrl(target.path, target.token, blob, { contentType });
    if (error) throw new Error("Foto uploaden mislukt. Probeer het opnieuw.");
  }
  const { error } = await supabase.rpc("game_night_update_guest_face", {
    p_guest_token: guestToken,
    p_session_id: sessionId,
    p_face_original_path: uploads.original.path,
    p_face_asset_path: uploads.face.path,
    p_face_crop: photo.faceCrop,
  });
  if (error) throw error;
}
