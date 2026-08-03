// Supabase Storage helpers voor de cocktail-photos-bucket — mirrort
// growthPhotoStorage.ts. Pad: <cocktail_id>/<uuid>.<ext>.
// Upload/verwijderen komen erbij in fase 4 (beheer-wizard); voor nu alleen
// de publieke-URL-afleiding die de kaarten/detailweergave al nodig hebben.

import { supabase } from "@/lib/supabase";

export const COCKTAIL_PHOTOS_BUCKET = "cocktail-photos";

export function getCocktailPhotoUrl(storagePath: string): string {
  return supabase.storage.from(COCKTAIL_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
