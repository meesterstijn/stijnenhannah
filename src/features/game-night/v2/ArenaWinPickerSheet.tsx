import { X } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import {
  characterVisualPropsFor,
  type ResolvedCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

// Game Night V2.10.5 (Arena Fase 1, sectie "WIN registreren") — DE enige
// manier om een WIN te registreren: "🏆 Win registreren" (in
// GameNightV2Arena.tsx) opent dit overlay, één tik op een character
// registreert de WIN via de bestaande `useRecordWin`-infrastructuur
// (ongewijzigd) en sluit meteen weer — geen formulier, geen extra
// bevestigingsstap. Vervangt het oude "elk character op tafel is altijd
// een WIN-knop"-gedrag (sectie "Arena controls": "moet vooral bekeken
// worden, beperk controls" — een permanent live tik-doel overal op tafel
// is precies het tegenovergestelde). Hergebruikt dezelfde grote,
// kaderloze character-presentatie als de Lobby (`.gnv2-party-character*`).
export function ArenaWinPickerSheet({
  participants,
  colorHex,
  characterFor,
  pending,
  onPick,
  onClose,
}: {
  participants: GameNightPlayer[];
  colorHex: (player: GameNightPlayer) => string | null;
  characterFor: (player: GameNightPlayer) => ResolvedCharacter;
  pending: boolean;
  onPick: (playerId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="gnv2-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Wie won er?"
    >
      <div
        className="gnv2-sheet-card gnv2-win-picker-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gnv2-win-picker-header">
          <p className="gnv2-dialog-title text-lg">Wie won er?</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Annuleren"
            title="Annuleren"
            className="gnv2-icon-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="gnv2-win-picker-grid">
          {participants.map((player) => {
            const visualProps = characterVisualPropsFor(characterFor(player));
            const ringColor = colorHex(player) ?? "var(--gnv2-border-strong)";
            return (
              <button
                key={player.id}
                type="button"
                disabled={pending}
                onClick={() => onPick(player.id)}
                aria-label={`${getPlayerDisplayName(player)} heeft gewonnen`}
                className="gnv2-win-picker-option"
              >
                <span
                  className="gnv2-party-character"
                  style={{ ["--gnv2-ring" as string]: ringColor }}
                >
                  <span className="gnv2-party-character-art">
                    <CharacterVisual
                      player={player}
                      characterId={visualProps.characterId}
                      layers={visualProps.layers}
                      loading="eager"
                    />
                  </span>
                  <span className="gnv2-party-character-name">
                    {getPlayerDisplayName(player)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
