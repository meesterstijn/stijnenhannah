import {
  Ban,
  Crown,
  Dices,
  Hexagon,
  Layers,
  Music2,
  Skull,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { GameNightArenaSymbol } from "@/lib/supabase";

// Game Night V2.7A/V2.7B — gedeelde preset->icoon-koppeling. De database
// bewaart uitsluitend de preset-id (arena_symbol); dit is de ENE plek die
// bepaalt welk Lucide-icoon daarbij hoort, gebruikt door zowel het owner-
// beheerformulier (GameFlowSettingsSheet) als de Game Arena-achtergrond
// (GameNightV2Arena) — nooit een tweede, losse koppeling.
export const ARENA_SYMBOL_ICONS: Record<GameNightArenaSymbol, LucideIcon> = {
  hex: Hexagon,
  skull: Skull,
  music: Music2,
  cards: Layers,
  dice: Dices,
  crown: Crown,
  burst: Sparkles,
  star: Star,
  none: Ban,
};

export const ARENA_SYMBOL_LABELS: Record<GameNightArenaSymbol, string> = {
  hex: "Hex",
  skull: "Schedel",
  music: "Muziek",
  cards: "Kaarten",
  dice: "Dobbelstenen",
  crown: "Kroon",
  burst: "Burst",
  star: "Ster",
  none: "Geen",
};
