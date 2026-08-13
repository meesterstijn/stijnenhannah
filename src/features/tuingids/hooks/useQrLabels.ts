import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchQrLabels, fetchQrAssignments } from "../lib/qrLabels";
import { generateQrLabelCode } from "../lib/qrCode";

const LABELS_KEY = ["qr_labels"];
const ASSIGNMENTS_KEY = ["plant_instance_qr_assignments"];

// Centrale plek voor alles rond QR-labels: lijst + afgeleide vrij/in-gebruik-
// status, aanmaken, koppelen en ontkoppelen. Koppelen/ontkoppelen loopt
// altijd via de assign_qr_label/release_qr_label RPC's (nooit een directe
// insert/update op plant_instance_qr_assignments vanaf de client) zodat de
// databaseconstraints (twee partiële unique-indexen, zie migratie
// 20260906000000_qr_labels_and_photo_lineage.sql) de enige echte garantie
// tegen dubbele actieve koppelingen blijven — deze hook voegt daar alleen
// nette foutmeldingen en cache-invalidatie aan toe, geen eigen
// validatielogica die die garantie zou kunnen ondermijnen.
export function useQrLabels() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: LABELS_KEY });
    queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY });
  }

  const { data: labels = [], isLoading: isLoadingLabels } = useQuery({ queryKey: LABELS_KEY, queryFn: fetchQrLabels });
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({ queryKey: ASSIGNMENTS_KEY, queryFn: fetchQrAssignments });

  const activeAssignments = assignments.filter((a) => a.released_at === null);

  const createLabel = useMutation({
    mutationFn: async (note: string | null) => {
      const code = generateQrLabelCode();
      const { data, error } = await supabase
        .from("qr_labels")
        .insert({ code, note: note?.trim() || null })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const assignLabel = useMutation({
    mutationFn: async (args: { code: string; instanceId: string }) => {
      const { data, error } = await supabase.rpc("assign_qr_label", {
        p_code: args.code,
        p_instance_id: args.instanceId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });

  const releaseLabel = useMutation({
    mutationFn: async (instanceId: string) => {
      const { error } = await supabase.rpc("release_qr_label", { p_instance_id: instanceId });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const getLabelByCode = useCallback(
    (code: string) => labels.find((l) => l.code === code) ?? null,
    [labels],
  );

  const getLabelById = useCallback(
    (id: string) => labels.find((l) => l.id === id) ?? null,
    [labels],
  );

  const getActiveAssignmentForInstance = useCallback(
    (instanceId: string) => activeAssignments.find((a) => a.plant_instance_id === instanceId) ?? null,
    [activeAssignments],
  );

  const getActiveAssignmentForLabel = useCallback(
    (labelId: string) => activeAssignments.find((a) => a.qr_label_id === labelId) ?? null,
    [activeAssignments],
  );

  const isLabelFree = useCallback(
    (labelId: string) => !activeAssignments.some((a) => a.qr_label_id === labelId),
    [activeAssignments],
  );

  return {
    labels,
    assignments,
    activeAssignments,
    isLoadingLabels,
    isLoadingAssignments,
    getLabelByCode,
    getLabelById,
    getActiveAssignmentForInstance,
    getActiveAssignmentForLabel,
    isLabelFree,

    createLabel: (note: string | null) => createLabel.mutateAsync(note),
    isCreatingLabel: createLabel.isPending,
    createLabelError: createLabel.error as Error | null,

    assignLabel: (args: { code: string; instanceId: string }) => assignLabel.mutateAsync(args),
    isAssigningLabel: assignLabel.isPending,
    assignLabelError: assignLabel.error as Error | null,

    releaseLabel: (instanceId: string) => releaseLabel.mutateAsync(instanceId),
    isReleasingLabel: releaseLabel.isPending,
  };
}
