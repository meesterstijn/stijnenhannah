import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { optimizeGrowthPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";
import {
  deleteR6MediaFromStorage,
  deleteR6SessionMediaRow,
  fetchR6SessionMedia,
  insertR6SessionMediaRow,
  uploadR6SessionMedia,
} from "@/features/rainbow-six-siege/lib/media";
import type { R6SessionMedia } from "@/features/rainbow-six-siege/types";

export function useR6SessionMedia(sessionId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["r6_session_media", sessionId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchR6SessionMedia(sessionId),
    enabled: !!sessionId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (input: { file: File; caption: string | null; matchId: string | null }) => {
      const optimized = await optimizeGrowthPhoto(input.file);
      const storagePath = await uploadR6SessionMedia(sessionId, optimized);
      await insertR6SessionMediaRow({
        session_id: sessionId,
        match_id: input.matchId,
        storage_path: storagePath,
        caption: input.caption,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (media: R6SessionMedia) => {
      // Storage eerst (best-effort), dan pas de DB-rij — zelfde volgorde als
      // useGrowthPhotos.ts, zodat nooit een DB-rij zonder opruimpoging blijft staan.
      await deleteR6MediaFromStorage(media.storage_path);
      await deleteR6SessionMediaRow(media.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    media: query.data ?? [],
    isLoading: query.isLoading,
    uploadMedia: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error as Error | null,
    deleteMedia: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
