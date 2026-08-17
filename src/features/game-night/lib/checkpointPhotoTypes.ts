import {
  LayoutGrid,
  Layers,
  User,
  Package,
  Trophy,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import type { GameNightCheckpointPhotoType } from "@/lib/supabase";

export const PHOTO_TYPES: GameNightCheckpointPhotoType[] = [
  "board",
  "cards",
  "player",
  "supply",
  "score",
  "other",
];

export const PHOTO_TYPE_LABELS: Record<GameNightCheckpointPhotoType, string> = {
  board: "Speelbord",
  cards: "Kaarten / Hand",
  player: "Speler",
  supply: "Voorraad",
  score: "Score",
  other: "Overig",
};

export const PHOTO_TYPE_ICONS: Record<
  GameNightCheckpointPhotoType,
  LucideIcon
> = {
  board: LayoutGrid,
  cards: Layers,
  player: User,
  supply: Package,
  score: Trophy,
  other: ImageIcon,
};

// Types waarvoor het zinvol is om optioneel een speler te koppelen (sectie
// 19) — dezelfde types tonen in de viewer standaard de "verborgen kaarten"-
// afscherming (sectie 34/57), omdat een handfoto per definitie iets is dat
// niet iedereen aan tafel per ongeluk mag zien.
export const PLAYER_SELECTABLE_TYPES = new Set<GameNightCheckpointPhotoType>([
  "cards",
  "player",
]);

export const HIDDEN_INFO_TYPES = PLAYER_SELECTABLE_TYPES;
