import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, type CultivationType, type IndoorOutdoorType, type PlantInstanceStatus, type GrowingSeasonStatus } from "@/lib/supabase";

// Mutations for the species/instance/season split. Reads live in
// plantInstances.ts (fetch-only, consumed via useQuery); this hook centralizes
// the write operations so components never issue ad-hoc Supabase calls for
// instance/season lifecycle changes (create, complete, start new, archive,
// set dormant) — the same "single source of truth" pattern already used by
// useRecordInstanceCare / useGrowthLog elsewhere in this feature.

const INSTANCES_KEY = ["plant_instances"];
const SEASONS_KEY = ["growing_seasons"];

export type CreatePlantInstanceInput = {
  speciesId: string;
  customName: string | null;
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
};

export function usePlantInstances() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: INSTANCES_KEY });
    queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
  }

  const createInstanceWithSeason = useMutation({
    mutationFn: async (input: CreatePlantInstanceInput) => {
      const { data: instance, error: instanceError } = await supabase
        .from("plant_instances")
        .insert({
          species_id: input.speciesId,
          custom_name: input.customName,
          location: input.location,
          cultivation_type: input.cultivationType,
          indoor_outdoor: input.indoorOutdoor,
          pot_size_liters: input.potSizeLiters,
          pot_material: input.potMaterial,
          pot_color: input.potColor,
          soil_type: input.soilType,
          soil_mix_notes: input.soilMixNotes,
          planted_at: input.plantedAt,
          acquired_at: input.acquiredAt,
          source: input.source,
          price: input.price,
          status: "active",
        })
        .select()
        .single();
      if (instanceError) throw instanceError;

      const year = new Date(input.seasonStartedAt).getFullYear();
      const { data: season, error: seasonError } = await supabase
        .from("growing_seasons")
        .insert({
          plant_instance_id: instance.id,
          year,
          label: input.seasonLabel?.trim() || `Seizoen ${year}`,
          started_at: input.seasonStartedAt,
          status: "active",
        })
        .select()
        .single();
      if (seasonError) throw seasonError;

      return { instance, season };
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
  };
}
