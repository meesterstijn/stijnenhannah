// Supabase Storage helpers voor de cocktail-photos-bucket — mirrort
// growthPhotoStorage.ts exact (pad, upload-opties, non-throwing delete).
// Pad: <cocktail_id>/<uuid>.<ext>.

import { supabase } from "@/lib/supabase";
import type { OptimizedPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";

export const COCKTAIL_PHOTOS_BUCKET = "cocktail-photos";

export function getCocktailPhotoUrl(storagePath: string): string {
  return supabase.storage.from(COCKTAIL_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export type UploadedCocktailPhoto = {
  storagePath: string;
  publicUrl: string;
};

// Verwacht een al door optimizeGrowthPhoto() gecomprimeerde foto (hergebruikt
// dezelfde generieke, feature-onafhankelijke optimalisatiestap als Tuingids
// — geen tweede compressie-implementatie). WebP behoudt transparantie, dus
// een transparante PNG blijft in de normale (niet-JPEG-fallback) route
// gewoon "zwevend" zonder witte achtergrond.
export async function uploadCocktailPhoto(cocktailId: string, photo: OptimizedPhoto): Promise<UploadedCocktailPhoto> {
  const photoId = crypto.randomUUID();
  const storagePath = `${cocktailId}/${photoId}.${photo.extension}`;

  const { error } = await supabase.storage.from(COCKTAIL_PHOTOS_BUCKET).upload(storagePath, photo.blob, {
    contentType: photo.mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Foto uploaden mislukt: ${error.message}`);

  return { storagePath, publicUrl: getCocktailPhotoUrl(storagePath) };
}

export async function deleteCocktailPhotoFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(COCKTAIL_PHOTOS_BUCKET).remove([storagePath]);
  if (error) {
    // Niet-fataal, zelfde reden als growthPhotoStorage.ts: een verweesd
    // Storage-bestand is acceptabel, een verweesde DB-rij niet.
    console.error("[cocktailPhotoStorage] Storage verwijderen mislukt:", storagePath, error.message);
  }
}
