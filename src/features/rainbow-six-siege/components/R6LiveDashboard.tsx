import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { R6PlayerActionTiles } from "@/features/rainbow-six-siege/components/R6PlayerActionTiles";
import { R6RecentEventsFeed } from "@/features/rainbow-six-siege/components/R6RecentEventsFeed";
import { R6QuickActionSettings } from "@/features/rainbow-six-siege/components/R6QuickActionSettings";
import type { R6Event, R6Match, R6Player, R6ScoreboardEntry, R6ScoreRule } from "@/features/rainbow-six-siege/types";

// Het hoofdscherm tijdens het spelen: live scorebord bovenaan, daaronder
// per speler een grote kaart met klikbare actietegels. Eén tik = direct
// geregistreerd, geen formulier, geen bevestiging (zie redesignfilosofie).
// Een "Gimma" is één volledige Rainbow Six-map — bewust niet "ronde" genoemd
// (dat woord gebruikt Rainbow Six zelf al voor de rondes ÍN een map, wat
// alleen maar verwarring geeft). Een Gimma is puur een container waarin
// gebeurtenissen verzameld worden; "Gimma afronden" (zie R6EndGameSheet) is
// het enige moment met een (klein) formulier — verder alleen tikken.
export function R6LiveDashboard({
  scoreboard,
  roster,
  quickActions,
  players,
  currentMatch,
  events,
  onTap,
  onUndo,
  onEndGame,
  pendingPlayerId,
}: {
  scoreboard: R6ScoreboardEntry[];
  roster: R6Player[];
  quickActions: R6ScoreRule[];
  players: Map<string, R6Player>;
  currentMatch: R6Match | null;
  events: R6Event[];
  onTap: (playerId: string, rule: R6ScoreRule) => void;
  onUndo: (eventId: string) => void;
  onEndGame: () => void;
  pendingPlayerId: string | null;
}) {
  const quickActionsByCode = new Map(quickActions.map((r) => [r.code, r]));
  const currentGameEvents = currentMatch ? events.filter((e) => e.match_id === currentMatch.id) : [];
  // Geen aparte ranglijst meer bovenaan — de punten staan al bij elke
  // spelerskaart, vlak boven de actietegels. Twee keer dezelfde punten
  // tonen kostte alleen maar ruimte zonder extra informatie. De tik-kaarten
  // staan bewust in vaste rooster-volgorde (niet gesorteerd op score): een
  // kaart die van plek wisselt net nadat je 'm hebt aangetikt zou de
  // volgende tik juist moeilijker maken.
  const entryByPlayerId = new Map(scoreboard.map((entry) => [entry.player.id, entry]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">{currentMatch ? `Gimma ${currentMatch.match_number} bezig` : "Gimma wordt gestart…"}</p>
        <div className="flex gap-2">
          <R6QuickActionSettings />
          <Button
            type="button"
            className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            onClick={onEndGame}
            disabled={!currentMatch}
          >
            <Flag className="h-4 w-4" /> Gimma afronden
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {roster.map((player) => {
          const entry = entryByPlayerId.get(player.id);
          return (
            <div key={player.id} className="flex-1 basis-0 min-w-[240px] space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-serif text-xl font-semibold text-zinc-100">{player.name}</p>
                <p className="font-serif text-2xl font-bold text-amber-400">{entry?.totalPoints ?? 0}</p>
              </div>
              <R6PlayerActionTiles
                quickActions={quickActions}
                disabled={!currentMatch || pendingPlayerId === player.id}
                onTap={(rule) => onTap(player.id, rule)}
              />
            </div>
          );
        })}
      </div>

      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-300">Laatste acties (deze Gimma eerst)</p>
        <R6RecentEventsFeed
          events={currentGameEvents.length > 0 ? currentGameEvents : events}
          players={players}
          quickActions={quickActionsByCode}
          onUndo={onUndo}
        />
      </section>
    </div>
  );
}
