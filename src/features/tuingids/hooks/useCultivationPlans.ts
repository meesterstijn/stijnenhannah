import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type CultivationPlan,
  type CultivationPlanItem,
  type CultivationPlanStatus,
} from "@/lib/supabase";
import {
  fetchCultivationPlans,
  fetchCultivationPlanItems,
  defaultPlanName,
} from "../lib/cultivationPlans";

const PLANS_KEY = ["cultivation_plans"];
const planItemsKey = (planId: string) => ["cultivation_plan_items", planId];

export function useCultivationPlans() {
  const queryClient = useQueryClient();

  function invalidatePlans() {
    queryClient.invalidateQueries({ queryKey: PLANS_KEY });
  }

  function invalidateItems(planId: string) {
    queryClient.invalidateQueries({ queryKey: planItemsKey(planId) });
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: plans = [], isLoading: plansLoading } = useQuery<CultivationPlan[]>({
    queryKey: PLANS_KEY,
    queryFn: fetchCultivationPlans,
  });

  // ─── Plan mutations ──────────────────────────────────────────────────────────

  const createPlanMutation = useMutation({
    mutationFn: async (input: { name: string; plan_year: number; notes?: string | null }) => {
      const { data, error } = await supabase
        .from("cultivation_plans")
        .insert({
          name: input.name.trim() || defaultPlanName(input.plan_year),
          plan_year: input.plan_year,
          notes: input.notes ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: invalidatePlans,
  });

  const updatePlanMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<Pick<CultivationPlan, "name" | "plan_year" | "notes" | "status">>;
    }) => {
      const { error } = await supabase
        .from("cultivation_plans")
        .update(input.patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidatePlans,
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("cultivation_plans")
        .delete()
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: invalidatePlans,
  });

  const copyPlanMutation = useMutation({
    mutationFn: async (input: { sourcePlanId: string; newYear: number; newName?: string }) => {
      // Fetch source items
      const items = await fetchCultivationPlanItems(input.sourcePlanId);
      const sourcePlan = plans.find((p) => p.id === input.sourcePlanId);
      const name = input.newName?.trim() || defaultPlanName(input.newYear);

      // Create the new plan
      const { data: newPlan, error: planError } = await supabase
        .from("cultivation_plans")
        .insert({ name, plan_year: input.newYear, status: "draft", notes: sourcePlan?.notes ?? null })
        .select("id")
        .single();
      if (planError) throw planError;

      // Copy items: reset planted_quantity to 0
      if (items.length > 0) {
        const newItems = items.map((item) => ({
          cultivation_plan_id: newPlan.id,
          species_id: item.species_id,
          planned_quantity: item.planned_quantity,
          backup_quantity: item.backup_quantity ?? 0,
          planted_quantity: 0,
          planned_location: item.planned_location,
          notes: item.notes,
          pot_liters_override: item.pot_liters_override,
        }));
        const { error: itemsError } = await supabase
          .from("cultivation_plan_items")
          .insert(newItems);
        if (itemsError) throw itemsError;
      }

      return newPlan as { id: string };
    },
    onSuccess: invalidatePlans,
  });

  // ─── Item mutations ──────────────────────────────────────────────────────────

  const addItemMutation = useMutation({
    mutationFn: async (input: {
      planId: string;
      speciesId: string;
      plannedQuantity: number;
      backupQuantity?: number;
      plannedLocation?: string | null;
      notes?: string | null;
      potLitersOverride?: number | null;
    }) => {
      const { data, error } = await supabase
        .from("cultivation_plan_items")
        .insert({
          cultivation_plan_id: input.planId,
          species_id: input.speciesId,
          planned_quantity: Math.max(1, input.plannedQuantity),
          backup_quantity: Math.max(0, input.backupQuantity ?? 0),
          planned_location: input.plannedLocation ?? null,
          notes: input.notes ?? null,
          pot_liters_override: input.potLitersOverride ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (_, vars) => invalidateItems(vars.planId),
  });

  const updateItemMutation = useMutation({
    mutationFn: async (input: {
      planId: string;
      itemId: string;
      patch: Partial<
        Pick<
          CultivationPlanItem,
          | "planned_quantity"
          | "backup_quantity"
          | "planted_quantity"
          | "planned_location"
          | "notes"
          | "pot_liters_override"
        >
      >;
    }) => {
      const { error } = await supabase
        .from("cultivation_plan_items")
        .update(input.patch)
        .eq("id", input.itemId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateItems(vars.planId),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (input: { planId: string; itemId: string }) => {
      const { error } = await supabase
        .from("cultivation_plan_items")
        .delete()
        .eq("id", input.itemId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateItems(vars.planId),
  });

  // ─── "Plant nu" — creates instance + season + links back to the plan item ───

  const plantNowMutation = useMutation({
    mutationFn: async (input: {
      planId: string;
      itemId: string;
      speciesId: string;
      plantName: string;
      customName: string;
      seasonStartedAt: string;
      potSizeLiters: number | null;
      location: string | null;
    }) => {
      // 1. Create the plant instance and its first growing season atomically
      //    via the existing RPC (same one used by NewPlantInstanceForm).
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "create_plant_instance_with_season",
        {
          p_species_id: input.speciesId,
          p_plant_name: input.plantName,
          p_season_started_at: input.seasonStartedAt,
          p_custom_name: input.customName,
          p_location: input.location,
          p_pot_size_liters: input.potSizeLiters,
          p_start_height_cm: 0,
        },
      );
      if (rpcError) throw new Error(rpcError.message);
      const result = rpcResult as { instance_id: string; season_id: string; entry_id: string } | null;
      if (!result) throw new Error("RPC gaf geen resultaat");

      // 2. Atomically link the instance back to the plan item and increment
      //    planted_quantity. If this fails, the instance exists but is unlinked;
      //    the error is surfaced to the user.
      const { error: linkError } = await supabase.rpc("link_instance_to_plan_item", {
        p_instance_id: result.instance_id,
        p_plan_item_id: input.itemId,
      });
      if (linkError) throw new Error(`Exemplaar aangemaakt maar koppeling mislukt: ${linkError.message}`);

      return result;
    },
    onSuccess: (_, vars) => {
      invalidateItems(vars.planId);
      queryClient.invalidateQueries({ queryKey: ["plant_instances"] });
      queryClient.invalidateQueries({ queryKey: ["growing_seasons"] });
      queryClient.invalidateQueries({ queryKey: ["growth_log_entries"] });
    },
  });

  // ─── "Reserve inzetten" — creates an instance for a backup plant and
  //     decrements backup_quantity. Does NOT touch planted_quantity.
  const deployBackupMutation = useMutation({
    mutationFn: async (input: {
      planId: string;
      itemId: string;
      speciesId: string;
      plantName: string;
      customName: string;
      seasonStartedAt: string;
      potSizeLiters: number | null;
      location: string | null;
    }) => {
      // Create instance + season (reuse the same RPC as plantNow)
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "create_plant_instance_with_season",
        {
          p_species_id: input.speciesId,
          p_plant_name: input.plantName,
          p_season_started_at: input.seasonStartedAt,
          p_custom_name: input.customName,
          p_location: input.location,
          p_pot_size_liters: input.potSizeLiters,
          p_start_height_cm: 0,
        },
      );
      if (rpcError) throw new Error(rpcError.message);
      const result = rpcResult as { instance_id: string; season_id: string; entry_id: string } | null;
      if (!result) throw new Error("RPC gaf geen resultaat");

      // Fetch current backup_quantity and decrement by 1.
      // The DB CHECK constraint (backup_quantity >= 0) is the final guard.
      const { data: current, error: fetchErr } = await supabase
        .from("cultivation_plan_items")
        .select("backup_quantity")
        .eq("id", input.itemId)
        .single();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!current || (current.backup_quantity ?? 0) <= 0) {
        throw new Error("Geen reserveplanten meer beschikbaar");
      }
      const { error: updateErr } = await supabase
        .from("cultivation_plan_items")
        .update({ backup_quantity: current.backup_quantity - 1 })
        .eq("id", input.itemId);
      if (updateErr) throw new Error(updateErr.message);

      return result;
    },
    onSuccess: (_, vars) => {
      invalidateItems(vars.planId);
      queryClient.invalidateQueries({ queryKey: ["plant_instances"] });
      queryClient.invalidateQueries({ queryKey: ["growing_seasons"] });
      queryClient.invalidateQueries({ queryKey: ["growth_log_entries"] });
    },
  });

  return {
    // Queries
    plans,
    plansLoading,

    // Plan CRUD
    createPlan: (input: { name: string; plan_year: number; notes?: string | null }) =>
      createPlanMutation.mutateAsync(input),
    isCreatingPlan: createPlanMutation.isPending,

    updatePlan: (id: string, patch: Partial<Pick<CultivationPlan, "name" | "plan_year" | "notes" | "status">>) =>
      updatePlanMutation.mutateAsync({ id, patch }),
    isUpdatingPlan: updatePlanMutation.isPending,

    setStatus: (id: string, status: CultivationPlanStatus) =>
      updatePlanMutation.mutateAsync({ id, patch: { status } }),

    deletePlan: (planId: string) => deletePlanMutation.mutateAsync(planId),
    isDeletingPlan: deletePlanMutation.isPending,

    copyPlan: (input: { sourcePlanId: string; newYear: number; newName?: string }) =>
      copyPlanMutation.mutateAsync(input),
    isCopyingPlan: copyPlanMutation.isPending,

    // Item CRUD
    addItem: (input: Parameters<typeof addItemMutation.mutateAsync>[0]) =>
      addItemMutation.mutateAsync(input),
    isAddingItem: addItemMutation.isPending,

    updateItem: (input: Parameters<typeof updateItemMutation.mutateAsync>[0]) =>
      updateItemMutation.mutateAsync(input),
    isUpdatingItem: updateItemMutation.isPending,

    removeItem: (input: { planId: string; itemId: string }) =>
      removeItemMutation.mutateAsync(input),
    isRemovingItem: removeItemMutation.isPending,

    // "Plant nu"
    plantNow: (input: Parameters<typeof plantNowMutation.mutateAsync>[0]) =>
      plantNowMutation.mutateAsync(input),
    isPlanting: plantNowMutation.isPending,
    plantError: plantNowMutation.error as Error | null,

    // "Reserve inzetten"
    deployBackup: (input: Parameters<typeof deployBackupMutation.mutateAsync>[0]) =>
      deployBackupMutation.mutateAsync(input),
    isDeployingBackup: deployBackupMutation.isPending,
  };
}

// Separate hook for item list so components can subscribe independently.
export function useCultivationPlanItems(planId: string | null) {
  const { data: items = [], isLoading } = useQuery<CultivationPlanItem[]>({
    queryKey: planItemsKey(planId ?? ""),
    queryFn: () => fetchCultivationPlanItems(planId!),
    enabled: !!planId,
  });
  return { items, isLoading };
}
