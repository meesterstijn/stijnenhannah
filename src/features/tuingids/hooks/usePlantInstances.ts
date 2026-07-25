import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type CultivationType, type IndoorOutdoorType, type PlantInstanceStatus, type GrowingSeasonStatus } from "@/lib/supabase";

/** Shape returned by the create_plant_instance_with_season RPC. */
type CreateInstanceRpcResult = {
  instance_id: string;
  season_id: string;
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
};

export function usePlantInstances() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: INSTANCES_KEY });
    queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
    queryClient.invalidateQueries({ queryKey: GROWTH_LOG_KEY });
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
