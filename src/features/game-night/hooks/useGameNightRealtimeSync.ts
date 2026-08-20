import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Game Night — live character-updates. Zelfde patroon/idioom als de
// bestaande Cocktail Bar-realtime-hooks (useCocktailShowcaseRealtimeSync.ts/
// useCocktailOrderRealtimeSync.ts) en usePartyRealtimeSync in
// useGameNightParty.ts: één supabase.channel(...) met postgres_changes-
// listeners die uitsluitend de AL BESTAANDE React Query-cache invalideren
// (queryClient.invalidateQueries), geen eigen parallelle state. Bewust GEEN
// tweede realtime-systeem — dit hergebruikt exact dezelfde primitieven
// (supabase.channel/.on("postgres_changes", ...)/.subscribe()/
// supabase.removeChannel) die Cocktails/R6 al gebruiken.
//
// Bewust ÉÉN gedeeld kanaal op een hoog niveau (gemount in
// GameNightLayout.tsx, niet in CharacterVisual of enige losse
// speler-/character-component) — in een lobby met meerdere spelers zou een
// subscription per CharacterVisual-instantie tientallen kanalen openen; nu
// is het er precies één voor de hele /game-night-sectie, ongeacht hoeveel
// characters er tegelijk op het scherm staan.
//
// Twee tabellen (opdracht sectie 3, bevestigd via code-inspectie — geen
// andere tabel is nodig voor character/face-weergave):
//   - game_night_players: bevat o.a. face_asset_path/face_crop (face) en
//     wordt als onderdeel van de grote useGameNightAnalyticsRaw()-bundel
//     opgehaald (ANALYTICS_KEY) — DEZELFDE bestaande query key die
//     useUpdateMyFace/useUpdateMyProfile ook al invalideren.
//   - game_night_player_character_equipment: welk onderdeel (bv. body) een
//     speler NU draagt — opgehaald via useCharacterEquipmentForPlayers(),
//     query key ["game-night","character-equipment",<sorted playerIds>].
//     DEZELFDE prefix die useEquipCharacterPart/useUnequipCharacterPart al
//     invalideren (React Query matcht invalidateQueries standaard op
//     query-key-PREFIX, dus alle batch-varianten worden geraakt zonder de
//     exacte playerIds-set hier te hoeven kennen).
//
// `event: "*"` op beide tabellen (opdracht sectie 9): de equip-RPC doet een
// upsert (insert-of-update) en unequip een delete, dus alle drie types
// komen daadwerkelijk voor bij equipment; voor players is "*" simpelweg
// eenvoudiger/robuuster (sectie 9 staat dat expliciet toe) en dekt ook
// toekomstige spelerwijzigingen buiten face om. Geen `filter` op een
// niet-PK-kolom — zelfde motivatie als useR6SessionRealtimeSync/
// useCocktailShowcaseRealtimeSync: een DELETE levert bij een niet-FULL
// REPLICA IDENTITY alleen de primary key, een filter op iets anders zou die
// rij dan stilzwijgend NOOIT laten binnenkomen. Ongefilterd + breed
// invalideren is hier goedkoop genoeg (klein aantal spelers/rijen).
const ANALYTICS_KEY = ["game-night", "analytics-raw"] as const;
const CHARACTER_EQUIPMENT_KEY_PREFIX = [
  "game-night",
  "character-equipment",
] as const;

const CHANNEL_NAME = "game-night-character-realtime";

export type GameNightRealtimeStatus =
  | "connecting"
  | "connected"
  | "disconnected";

export type GameNightRealtimeLastEvent = {
  table: "game_night_players" | "game_night_player_character_equipment";
  eventType: string;
  at: string;
} | null;

export type GameNightRealtimeInfo = {
  status: GameNightRealtimeStatus;
  lastEvent: GameNightRealtimeLastEvent;
};

// Sectie 8: lokale mutaties (de eigen telefoon) hebben hun bestaande
// onSuccess-invalidatie al (useUpdateMyFace/useEquipCharacterPart/
// useUnequipCharacterPart, ongewijzigd) — dit kanaal ontvangt het eigen
// Realtime-event dan gewoon ALSNOG (Supabase levert het aan iedere
// geabonneerde client, inclusief de auteur zelf) en invalideert nogmaals.
// Onschadelijk: een extra invalidateQueries op een query die al vers is,
// kost geen zichtbare extra fetch (React Query dedupliceert/staleTime-
// beschermt) — geen aparte "was dit mijn eigen wijziging"-uitzondering
// nodig, dat zou alleen complexiteit toevoegen zonder functioneel voordeel.
export function useGameNightRealtimeSync(): GameNightRealtimeInfo {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<GameNightRealtimeStatus>("connecting");
  const [lastEvent, setLastEvent] = useState<GameNightRealtimeLastEvent>(null);

  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_night_players" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ANALYTICS_KEY });
          setLastEvent({
            table: "game_night_players",
            eventType: payload.eventType,
            at: new Date().toISOString(),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_night_player_character_equipment",
        },
        (payload) => {
          queryClient.invalidateQueries({
            queryKey: CHARACTER_EQUIPMENT_KEY_PREFIX,
          });
          setLastEvent({
            table: "game_night_player_character_equipment",
            eventType: payload.eventType,
            at: new Date().toISOString(),
          });
        },
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") setStatus("connected");
        else if (
          subscribeStatus === "CHANNEL_ERROR" ||
          subscribeStatus === "TIMED_OUT" ||
          subscribeStatus === "CLOSED"
        )
          setStatus("disconnected");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { status, lastEvent };
}
