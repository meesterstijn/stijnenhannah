import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type GrowthLogPhoto } from "@/lib/supabase";
import { deleteGrowthPhotoFromStorage } from "../lib/growthPhotoStorage";

const QUERY_KEY = ["growth_log_photos"];

async function fetchGrowthPhotos(): Promise<GrowthLogPhoto[]> {
  const { data, error } = await supabase
    .from("growth_log_photos")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useGrowthPhotos() {
  const queryClient = useQueryClient();
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  const { data: photos = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchGrowthPhotos,
  });

  const addMutation = useMutation({
    mutationFn: async (photo: {
      growth_log_entry_id: string;
      plant_instance_id: string; // NOT NULL: must mirror the parent entry's plant_instance_id
      storage_path: string;
      photo_url: string;
      original_filename: string | null;
      mime_type: string | null;
      file_size_bytes: number | null;
    }) => {
      const { error } = await supabase.from("growth_log_photos").insert(photo);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (photo: GrowthLogPhoto) => {
      // Delete from Storage first (non-fatal if it fails — see growthPhotoStorage.ts)
      await deleteGrowthPhotoFromStorage(photo.storage_path);
      // Then remove the DB row
      const { error } = await supabase
        .from("growth_log_photos")
        .delete()
        .eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const getPhotosForEntry = useCallback(
    (entryId: string) => photos.filter((p) => p.growth_log_entry_id === entryId),
    [photos],
  );

  const getPhotosForInstance = useCallback(
    (instanceId: string) => photos.filter((p) => p.plant_instance_id === instanceId),
    [photos],
  );

  // Deletes all Storage files for an entry's photos. The DB rows are cleaned
  // up automatically via ON DELETE CASCADE when the growth_log_entry is
  // deleted. Call this BEFORE deleting the entry to avoid orphaned files.
  const deleteStorageFilesForEntry = useCallback(
    async (entryId: string) => {
      const entryPhotos = photos.filter((p) => p.growth_log_entry_id === entryId);
      for (const photo of entryPhotos) {
        await deleteGrowthPhotoFromStorage(photo.storage_path);
      }
    },
    [photos],
  );

  return {
    photos,
    addPhoto: (photo: Parameters<typeof addMutation.mutate>[0]) =>
      addMutation.mutateAsync(photo),
    deletePhoto: (photo: GrowthLogPhoto) => deleteMutation.mutateAsync(photo),
    deleteStorageFilesForEntry,
    getPhotosForEntry,
    getPhotosForInstance,
    isAddingPhoto: addMutation.isPending,
    isDeletingPhoto: deleteMutation.isPending,
    photoAddError: addMutation.error as Error | null,
  };
}
