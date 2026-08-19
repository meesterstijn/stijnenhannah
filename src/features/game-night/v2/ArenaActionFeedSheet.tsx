import { Undo2, X } from "lucide-react";
import type { GameNightPlayer, GameNightWinEvent } from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";

const MAX_SHOWN = 20;

// Game Night V2.7B/V2.7D (sectie 23/24/26) — uitklapbare action feed: de
// arena zelf blijft schoon; dit sheet toont de laatste (maximaal 20)
// ACTIEVE win_events, elk met een eigen "ongedaan maken" — dus ook een
// iets oudere foutieve WIN kan gecorrigeerd worden (event-specifiek via
// useUndoWinEvent, geen "haal laatste WIN van speler X weg"). Geen
// confirm-stap (sectie 24: bewust, undo is laagdrempelig/omkeerbaar).
// Sinds V2.7D uitsluitend bereikbaar via het ···-menu ("Actie ongedaan
// maken") — de losse "Acties · N"-trigger onder het speelveld is
// vervallen (zie ArenaMoreMenuSheet).
export function ArenaActionFeedSheet({
  events,
  participantsById,
  onUndo,
  undoPendingEventId,
  onClose,
}: {
  events: GameNightWinEvent[];
  participantsById: Map<string, GameNightPlayer>;
  onUndo: (eventId: string) => void;
  undoPendingEventId: string | null;
  onClose: () => void;
}) {
  const active = [...events]
    .filter((e) => e.undone_at == null)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, MAX_SHOWN);

  return (
    <div
      className="gnv2-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recente acties"
    >
      <div
        className="gnv2-sheet-card gnv2-feed-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gnv2-feed-header">
          <p className="gnv2-select-heading" style={{ fontSize: "1.1rem" }}>
            Acties
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="gnv2-icon-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="gnv2-feed-list">
          {active.length === 0 ? (
            <p className="gnv2-lib-card-meta" style={{ padding: "1rem 0" }}>
              Nog geen WINs geregistreerd.
            </p>
          ) : (
            active.map((event) => (
              <div key={event.id} className="gnv2-feed-row">
                <span className="gnv2-feed-row-label">
                  {getPlayerDisplayName(
                    participantsById.get(event.player_id) ??
                      ({
                        id: event.player_id,
                        name: "?",
                        nickname: null,
                      } as GameNightPlayer),
                  )}{" "}
                  +1 WIN
                </span>
                <button
                  type="button"
                  onClick={() => onUndo(event.id)}
                  disabled={undoPendingEventId === event.id}
                  className="gnv2-feed-row-undo"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Ongedaan maken
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
