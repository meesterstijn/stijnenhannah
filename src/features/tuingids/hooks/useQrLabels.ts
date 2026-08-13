import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type PlantInstance, type QrLabel } from "@/lib/supabase";
import { fetchQrLabels, fetchQrAssignments } from "../lib/qrLabels";
import { generateQrLabelCode, parseQrScanText } from "../lib/qrCode";
import { fetchPlantInstance } from "../lib/plantInstances";

const LABELS_KEY = ["qr_labels"];
const ASSIGNMENTS_KEY = ["plant_instance_qr_assignments"];

// ─── Resolver-laag ──────────────────────────────────────────────────────────
// Vertaalt ruwe scan-tekst (van QrScanner, of van de ?qr=-deeplink) naar een
// concrete plant_instance — zonder dat de aanroeper zelf getLabelByCode/
// getActiveAssignmentForLabel hoeft te combineren. Dit is bewust de ENIGE
// plek die "geldige/vrije/actieve QR-code" interpreteert; QrScanner zelf
// blijft puur camera+decodering (retourneert alleen ruwe tekst), en elke
// caller (algemene "QR scannen"-knop → detail openen; "Groeifoto maken" →
// camera openen) roept deze resolver zelf aan en bepaalt zelf wat er met het
// resultaat gebeurt.
export type QrScanResolution =
  | { status: "invalid" }
  | { status: "deleted"; label: QrLabel }
  | { status: "unlinked"; label: QrLabel }
  | { status: "inactive"; label: QrLabel; instance: PlantInstance }
  | { status: "resolved"; label: QrLabel; instance: PlantInstance };

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
  // "labels" blijft ALLE labels (ook verwijderde) — nodig zodat
  // resolveQrScan/getLabelByCode een verwijderd label nog kan herkennen (en
  // dus expliciet kan afwijzen) i.p.v. het als "onbekende code" te
  // behandelen. "activeLabels" is de afgeleide lijst voor de normale
  // beheerweergave, die verwijderde labels bewust niet toont.
  const activeLabels = labels.filter((l) => l.deleted_at === null);

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

  // Alleen de gebruiksvriendelijke naam/notitie — nooit de code (die is en
  // blijft de permanente identiteit van de fysieke sticker, alleen via
  // createLabel gezet, verder nergens in de UI wijzigbaar). Een gewone
  // update onder de bestaande owner-only RLS-policy op qr_labels volstaat
  // hier volledig — dit is geen constraint-gevoelige operatie zoals
  // koppelen/ontkoppelen, dus geen RPC nodig.
  const updateLabelNote = useMutation({
    mutationFn: async (args: { labelId: string; note: string | null }) => {
      const { error } = await supabase.from("qr_labels").update({ note: args.note }).eq("id", args.labelId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // "Verwijderen" in de UI = archiveren (deleted_at) via de archive_qr_label
  // RPC, nooit een DELETE — zie migratie voor de volledige motivatie. De RPC
  // is de enige plek die controleert of het label nog een actieve koppeling
  // heeft; deze hook voegt daar bewust geen eigen (omzeilbare) frontend-only
  // check aan toe.
  const archiveLabel = useMutation({
    mutationFn: async (labelId: string) => {
      const { error } = await supabase.rpc("archive_qr_label", { p_label_id: labelId });
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

  // `knownInstances` is de instance-lijst die de aanroeper toch al geladen
  // heeft (bv. actieve exemplaren in de groeifoto-flow, of alle exemplaren
  // in de algemene "QR scannen"-flow) — voorkomt een extra fetch in het
  // normale geval. Alleen als de gekoppelde instance daar niet in voorkomt
  // (bv. omdat de aanroeper alleen actieve exemplaren laadde en de instance
  // inmiddels niet-actief is) valt dit terug op één live opzoeking, puur om
  // een correcte "niet-actief"-melding te kunnen tonen i.p.v. 'm ten
  // onrechte als "onbekende QR-code" te behandelen.
  const resolveQrScan = useCallback(
    async (
      rawText: string,
      knownInstances: PlantInstance[] | Map<string, PlantInstance>,
    ): Promise<QrScanResolution> => {
      const code = parseQrScanText(rawText);
      if (!code) return { status: "invalid" };

      const label = getLabelByCode(code);
      if (!label) return { status: "invalid" };

      // Een verwijderd/gearchiveerd label bestaat nog als rij (soft-delete —
      // zie 20260907000000_qr_label_management.sql) maar mag nooit meer als
      // "vrij, dus koppelbaar" worden behandeld, ook al heeft het toevallig
      // geen actieve assignment (meestal juist wél de reden dát het
      // gearchiveerd kon worden).
      if (label.deleted_at) return { status: "deleted", label };

      const assignment = getActiveAssignmentForLabel(label.id);
      if (!assignment) return { status: "unlinked", label };

      const instancesById =
        knownInstances instanceof Map ? knownInstances : new Map(knownInstances.map((i) => [i.id, i]));
      let instance = instancesById.get(assignment.plant_instance_id);
      if (!instance) {
        try {
          instance = (await fetchPlantInstance(assignment.plant_instance_id)) ?? undefined;
        } catch {
          instance = undefined;
        }
      }
      // FK-gegarandeerd om te bestaan (plant_instance_qr_assignments.
      // plant_instance_id verwijst met on delete cascade) — als de live
      // opzoeking 'm alsnog niet vindt is er iets fundamenteel mis; val dan
      // terug op "invalid" i.p.v. een instance-loze "resolved" te retourneren.
      if (!instance) return { status: "invalid" };
      if (instance.status !== "active") return { status: "inactive", label, instance };
      return { status: "resolved", label, instance };
    },
    [getLabelByCode, getActiveAssignmentForLabel],
  );

  return {
    labels,
    activeLabels,
    assignments,
    activeAssignments,
    isLoadingLabels,
    isLoadingAssignments,
    getLabelByCode,
    getLabelById,
    getActiveAssignmentForInstance,
    getActiveAssignmentForLabel,
    isLabelFree,
    resolveQrScan,

    createLabel: (note: string | null) => createLabel.mutateAsync(note),
    isCreatingLabel: createLabel.isPending,
    createLabelError: createLabel.error as Error | null,

    assignLabel: (args: { code: string; instanceId: string }) => assignLabel.mutateAsync(args),
    isAssigningLabel: assignLabel.isPending,
    assignLabelError: assignLabel.error as Error | null,

    releaseLabel: (instanceId: string) => releaseLabel.mutateAsync(instanceId),
    isReleasingLabel: releaseLabel.isPending,

    updateLabelNote: (args: { labelId: string; note: string | null }) => updateLabelNote.mutateAsync(args),
    isUpdatingLabelNote: updateLabelNote.isPending,
    updateLabelNoteError: updateLabelNote.error as Error | null,

    archiveLabel: (labelId: string) => archiveLabel.mutateAsync(labelId),
    isArchivingLabel: archiveLabel.isPending,
    archiveLabelError: archiveLabel.error as Error | null,
  };
}
