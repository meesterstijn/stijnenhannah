import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type CultivationType, type IndoorOutdoorType, type PlantInstanceStatus, type GrowingSeasonStatus, type TrackingMode, type PlantHealthStatus } from "@/lib/supabase";

/** Shape returned by the create_plant_instance_with_season RPC. */
type CreateInstanceRpcResult = {
  instance_id: string;
  season_id: string;
  entry_id: string;
};

/** Shape returned by the update_plant_instance_quantity RPC. */
type UpdateQuantityRpcResult = {
  entry_id: string;
};

// Mutations for the species/instance/season split. Reads live in
// plantInstances.ts (fetch-only, consumed via useQuery); this hook centralizes
// the write operations so components never issue ad-hoc Supabase calls for
// instance/season lifecycle changes (create, complete, start new, archive,
// set dormant) — the same "single source of truth" pattern already used by
// useRecordInstanceCare / useGrowthLog elsewhere in this feature.

const INSTANCES_KEY = ["plant_instances"];
const SEASONS_KEY = ["growing_seasons"];
const GROWTH_LOG_KEY = ["growth_log_entries"];

export type CreatePlantInstanceInput = {
  speciesId: string;
  customName: string | null;
  /** Display name written to growth_log_entries.plant_name (species name). */
  plantName: string;
  location: string | null;
  cultivationType: CultivationType | null;
  indoorOutdoor: IndoorOutdoorType | null;
  potSizeLiters: number | null;
  potMaterial: string | null;
  potColor: string | null;
  soilType: string | null;
  soilMixNotes: string | null;
  plantedAt: string | null;
  acquiredAt: string | null;
  source: string | null;
  price: number | null;
  seasonStartedAt: string;
  seasonLabel: string | null;
  /** Starting height in cm; 0 when the field was left empty. Never null. */
  startHeightCm: number;
  /** Defaults server-side to "individual" when omitted — matches every
   *  call site that predates batch tracking. */
  trackingMode?: TrackingMode;
  /** Physical plant count for this registration. Ignored/forced to 1 by the
   *  RPC when trackingMode is "individual". null = batch, nog niet geteld. */
  quantity?: number | null;
  /** Expliciete initiële status; laat leeg om de bestaande centrale regel
   *  (hoogte leeg/0 -> "Zaailing") zijn werk te laten doen. */
  healthStatus?: PlantHealthStatus | null;
};

export function usePlantInstances() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: INSTANCES_KEY });
    queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
    queryClient.invalidateQueries({ queryKey: GROWTH_LOG_KEY });
    // Elke statuswijziging kan server-side (via de trigger in
    // 20260906000000_qr_labels_and_photo_lineage.sql) een QR-koppeling
    // hebben vrijgegeven — invalideer die cache hier ook centraal, zodat
    // geen enkele losse mutatie dat zelf hoeft te onthouden.
    queryClient.invalidateQueries({ queryKey: ["plant_instance_qr_assignments"] });
  }

  const createInstanceWithSeason = useMutation({
    mutationFn: async (input: CreatePlantInstanceInput) => {
      // Single RPC call — all three inserts (plant_instance, growing_season,
      // growth_log_entry) run inside one PostgreSQL transaction and roll back
      // together on any failure. No partial state is ever left behind.
      const { data, error } = await supabase.rpc(
        "create_plant_instance_with_season",
        {
          p_species_id:        input.speciesId,
          p_plant_name:        input.plantName,
          p_season_started_at: input.seasonStartedAt,
          p_custom_name:       input.customName,
          p_location:          input.location,
          p_cultivation_type:  input.cultivationType,
          p_indoor_outdoor:    input.indoorOutdoor,
          p_pot_size_liters:   input.potSizeLiters,
          p_pot_material:      input.potMaterial,
          p_pot_color:         input.potColor,
          p_soil_type:         input.soilType,
          p_soil_mix_notes:    input.soilMixNotes,
          p_planted_at:        input.plantedAt,
          p_acquired_at:       input.acquiredAt,
          p_source:            input.source,
          p_price:             input.price,
          p_season_label:      input.seasonLabel,
          p_start_height_cm:   input.startHeightCm,
          p_tracking_mode:     input.trackingMode ?? "individual",
          p_quantity:          input.quantity ?? 1,
          p_health_status:     input.healthStatus ?? null,
        },
      );
      if (error) throw new Error(error.message);
      const result = data as CreateInstanceRpcResult | null;
      if (!result) throw new Error("RPC returned geen data");
      return result;
    },
    onSuccess: invalidate,
  });

  const completeSeason = useMutation({
    mutationFn: async (args: {
      seasonId: string;
      status: Extract<GrowingSeasonStatus, "completed" | "failed">;
      endedAt: string;
      closingReason: string | null;
      closingNotes: string | null;
    }) => {
      const { error } = await supabase
        .from("growing_seasons")
        .update({
          status: args.status,
          ended_at: args.endedAt,
          closing_reason: args.closingReason,
          closing_notes: args.closingNotes,
        })
        .eq("id", args.seasonId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const startNewSeason = useMutation({
    mutationFn: async (args: { plantInstanceId: string; startedAt: string; label: string | null }) => {
      const year = new Date(args.startedAt).getFullYear();
      const { error } = await supabase.from("growing_seasons").insert({
        plant_instance_id: args.plantInstanceId,
        year,
        label: args.label?.trim() || `Seizoen ${year}`,
        started_at: args.startedAt,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setInstanceStatus = useMutation({
    mutationFn: async (args: { id: string; status: PlantInstanceStatus }) => {
      const { error } = await supabase.from("plant_instances").update({ status: args.status }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const patchInstance = useMutation({
    mutationFn: async (args: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("plant_instances").update(args.patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Enige schrijfpad voor "aantal bijwerken" op een batch — atomisch via de
  // update_plant_instance_quantity RPC (plant_instances.quantity + een
  // growth_log_entries-historierij slagen of falen samen), zodat er nooit
  // een aantalswijziging zonder geschiedenis-spoor kan ontstaan. Wordt zowel
  // door de compacte "Aantal bijwerken"-actie als door het aantalveld in
  // InstanceSettingsSection aangeroepen — geen tweede opslagroute.
  const updateInstanceQuantity = useMutation({
    mutationFn: async (args: {
      instanceId: string;
      quantity: number | null;
      entryDate?: string;
      notes?: string | null;
      growingSeasonId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("update_plant_instance_quantity", {
        p_instance_id:       args.instanceId,
        p_quantity:          args.quantity,
        p_entry_date:        args.entryDate ?? new Date().toISOString().slice(0, 10),
        p_notes:             args.notes ?? null,
        p_growing_season_id: args.growingSeasonId ?? null,
      });
      if (error) throw new Error(error.message);
      return data as UpdateQuantityRpcResult;
    },
    onSuccess: invalidate,
  });

  const convertSeedling = useMutation({
    mutationFn: async (args: {
      seedlingId: string;
      customNames: string[];
      plantName: string;
      seasonStartedAt: string;
      startHeightCm: number;
    }) => {
      const { data, error } = await supabase.rpc("plant_seedling_to_instances", {
        p_seedling_id:       args.seedlingId,
        p_custom_names:      args.customNames,
        p_plant_name:        args.plantName,
        p_season_started_at: args.seasonStartedAt,
        p_start_height_cm:   args.startHeightCm,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["plant_inspection_logs"] });
      queryClient.invalidateQueries({ queryKey: ["cultivation_plan_items"] });
    },
  });

  return {
    createInstanceWithSeason: (input: CreatePlantInstanceInput) => createInstanceWithSeason.mutateAsync(input),
    isCreating: createInstanceWithSeason.isPending,
    createError: createInstanceWithSeason.error as Error | null,

    completeSeason: (args: {
      seasonId: string;
      status: Extract<GrowingSeasonStatus, "completed" | "failed">;
      endedAt: string;
      closingReason: string | null;
      closingNotes: string | null;
    }) => completeSeason.mutateAsync(args),
    isCompletingSeason: completeSeason.isPending,

    startNewSeason: (args: { plantInstanceId: string; startedAt: string; label: string | null }) =>
      startNewSeason.mutateAsync(args),
    isStartingSeason: startNewSeason.isPending,

    archiveInstance: (id: string) => setInstanceStatus.mutateAsync({ id, status: "archived" }),
    setInstanceDormant: (id: string) => setInstanceStatus.mutateAsync({ id, status: "dormant" }),
    reactivateInstance: (id: string) => setInstanceStatus.mutateAsync({ id, status: "active" }),
    isUpdatingStatus: setInstanceStatus.isPending,

    patchInstance: (args: { id: string; patch: Record<string, unknown> }) => patchInstance.mutateAsync(args),

    updateInstanceQuantity: (args: {
      instanceId: string;
      quantity: number | null;
      entryDate?: string;
      notes?: string | null;
      growingSeasonId?: string | null;
    }) => updateInstanceQuantity.mutateAsync(args),
    isUpdatingQuantity: updateInstanceQuantity.isPending,

    convertSeedling: (args: {
      seedlingId: string;
      customNames: string[];
      plantName: string;
      seasonStartedAt: string;
      startHeightCm: number;
    }) => convertSeedling.mutateAsync(args),
    isConverting: convertSeedling.isPending,
  };
}
