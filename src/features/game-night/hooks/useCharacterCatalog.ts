import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  supabase,
  type GameNightCharacterPart,
  type GameNightPlayerCharacterEquipment,
  type GameNightPlayerCharacterUnlock,
} from "@/lib/supabase";

// Game Night V2.9B (sectie 14) — volgt exact dezelfde queryarchitectuur als
// de rest van Game Night (bv. useCheckpointCountsForGameSessions.ts): de
// catalogus wordt ÉÉN keer geladen en lang gecached (klein, zelden
// wijzigend), equipment wordt BATCHED voor een gegeven set spelers (nooit
// een aparte query per speler) — bewust een LOS bestand i.p.v. toegevoegd
// aan useGameNightAnalytics.ts, om geen regressierisico te introduceren op
// die zwaar-hergebruikte win/stats-laag voor een op dit moment nog nergens
// live gekoppeld datamodel (sectie 17: geen wijziging aan bestaande
// Live Play-flows in V2.9B). Unlocks zijn bewust NIET in dit batchpatroon
// opgenomen — dat is privédata van de ingelogde speler zelf, alleen nodig
// voor de (toekomstige) eigen creator-UI, dus een kleinere, aparte hook.

const CHARACTER_PARTS_KEY = ["game-night", "character-parts"] as const;
const ALL_CHARACTER_PARTS_QA_KEY = [
  "game-night",
  "character-parts-qa-all",
] as const;
const MY_UNLOCKS_KEY = ["game-night", "my-character-unlocks"] as const;
const CHARACTER_EQUIPMENT_KEY = (playerIds: string[]) =>
  ["game-night", "character-equipment", [...playerIds].sort()] as const;

// Actieve catalogus — RLS beperkt members hier al tot active=true, de
// expliciete `.eq` is vooral voor de owner (die via zijn ALL-policy ook
// inactieve rijen zou terugkrijgen) zodat deze hook overal hetzelfde
// "wat kan een speler nu daadwerkelijk kiezen"-resultaat geeft.
export function useCharacterParts() {
  return useQuery({
    queryKey: CHARACTER_PARTS_KEY,
    queryFn: async (): Promise<GameNightCharacterPart[]> => {
      const { data, error } = await supabase
        .from("game_night_character_parts")
        .select("*")
        .eq("active", true)
        .order("slot", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Owner-only dev-tooling (CharacterAssetQaGrid.tsx): ALLE catalogus-rijen,
// ook inactieve/needs_asset_revision-items — bewust GEEN `.eq("active", true)`
// zoals useCharacterParts() hierboven, want de QA-pagina moet juist ook
// laten zien wat er (nog) niet actief staat. Werkt uitsluitend voor de
// owner: de "member select active"-RLS-policy op deze tabel laat een
// gewoon lid sowieso alleen active=true-rijen terugkrijgen, ongeacht deze
// query — de owner-ALL-policy geeft de owner hier het volledige beeld.
export function useAllCharacterPartsForQa() {
  return useQuery({
    queryKey: ALL_CHARACTER_PARTS_QA_KEY,
    queryFn: async (): Promise<GameNightCharacterPart[]> => {
      const { data, error } = await supabase
        .from("game_night_character_parts")
        .select("*")
        .order("slot", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });
}

// Batch-equipment voor een gegeven set spelers (Lobby/Arena/profielen —
// sectie 14: "geen query per speler"). Lege input geeft bewust een lege
// lijst zonder network-call, zelfde patroon als
// useCheckpointCountsForGameSessions.
//
// Bugfix (V2.10.4, "bestaande characters flitsen bij toevoegen speler"):
// de queryKey bevat bewust de VOLLEDIGE spelerslijst (nodig om per exacte
// tafelsamenstelling te cachen) — maar dat betekent ook dat elke wijziging
// in wie er aan tafel zit (bv. speler D toevoegen aan A/B/C) een geheel
// NIEUWE, nog nooit gefetchte querykey oplevert. Zonder `placeholderData`
// geeft TanStack Query voor zo'n nieuwe key `data: undefined` totdat de
// fetch klaar is — GameNightV2Lobby.tsx's `characterEquipment = []`-
// fallback vangt dat dan op, maar die lege array gaat via
// resolvePlayerCharacter() ook voor de AL ZICHTBARE spelers A/B/C (niet
// alleen de nieuwe D) tijdelijk naar hun legacy/lege fallback — een echte
// tak-wisseling in CharacterVisual (andere DOM-structuur), vandaar de
// zichtbare flits. `placeholderData: keepPreviousData` laat de vorige
// (nog steeds inhoudelijk correcte, want A/B/C's equipment is niet
// gewijzigd) dataset gewoon zichtbaar blijven terwijl de nieuwe key op de
// achtergrond fetcht — exact "alleen speler D mag nieuw laden".
export function useCharacterEquipmentForPlayers(playerIds: string[]) {
  const sortedIds = [...playerIds].sort();
  return useQuery({
    queryKey: CHARACTER_EQUIPMENT_KEY(sortedIds),
    queryFn: async (): Promise<GameNightPlayerCharacterEquipment[]> => {
      if (sortedIds.length === 0) return [];
      const { data, error } = await supabase
        .from("game_night_player_character_equipment")
        .select("*")
        .in("player_id", sortedIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: sortedIds.length > 0,
    placeholderData: keepPreviousData,
  });
}

// Eigen unlocks (self-service, RLS beperkt dit al tot de eigen speler-rij,
// zie 20260914010000) — alleen relevant voor de eigen creator-UI, nooit
// nodig om ANDERE spelers te renderen (dat gaat via ..._equipment, dat wél
// voor alle spelers leesbaar is).
export function useMyCharacterUnlocks() {
  return useQuery({
    queryKey: MY_UNLOCKS_KEY,
    queryFn: async (): Promise<GameNightPlayerCharacterUnlock[]> => {
      const { data, error } = await supabase
        .from("game_night_player_character_unlocks")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Sectie 12 — server-side gecontroleerd equippen/unequippen; de frontend
// stuurt uitsluitend slot+part-id, de RPC bepaalt zelf de speler (auth.uid())
// en controleert bestaan/actief/slot-match/unlock-status. Query-invalidatie
// raakt zowel de eigen-unlocks-cache (ongewijzigd, maar consistent) als elke
// equipment-batch die de eigen speler zou kunnen bevatten — eenvoudiger en
// veiliger dan proberen te raden welke exacte playerIds-batchsleutel(s) nu
// relevant zijn, dus een brede invalidatie op het "character-equipment"-
// query-key-prefix (TanStack Query matcht dat op alle bijbehorende batches).
export function useEquipCharacterPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      slot: string;
      partId: string;
    }): Promise<GameNightPlayerCharacterEquipment> => {
      const { data, error } = await supabase.rpc(
        "game_night_equip_character_part",
        { p_slot: input.slot, p_part_id: input.partId },
      );
      if (error) throw error;
      return data as GameNightPlayerCharacterEquipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["game-night", "character-equipment"],
      });
    },
  });
}

export function useUnequipCharacterPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slot: string): Promise<void> => {
      const { error } = await supabase.rpc(
        "game_night_unequip_character_part",
        { p_slot: slot },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["game-night", "character-equipment"],
      });
    },
  });
}
