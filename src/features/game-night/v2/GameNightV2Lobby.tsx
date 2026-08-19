import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { History, LogOut, QrCode, Trophy, Users } from "lucide-react";
import type { GameNightPlayer, GameNightSession } from "@/lib/supabase";
import {
  useActivePartySeats,
  useAddToParty,
  useRemoveFromParty,
  useSetPartyOrder,
  usePartyRealtimeSync,
} from "@/features/game-night/hooks/useGameNightParty";
import { usePlayers } from "@/features/game-night/hooks/usePlayers";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { buildPlayerStats } from "@/features/game-night/lib/gameNightStats";
import { resolvePlayerColorHex } from "@/features/game-night/lib/playerIdentity";
import { formatEveningIdentity } from "@/features/game-night/lib/gameNightName";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { PartyStage, PARTY_ZONE_ID } from "@/features/game-night/v2/PartyStage";
import {
  AvailablePlayerTray,
  AVAILABLE_ZONE_ID,
} from "@/features/game-night/v2/AvailablePlayerTray";
import { JoinPartySheet } from "@/features/game-night/v2/JoinPartySheet";

// Game Night V2.5 — de volledig nieuwe lobby-scene (sectie 1-37). Vervangt
// de oude .gn-tabletop/houten-tafel-weergave VOLLEDIG zodra een Game Night
// gestart is en er nog geen spel actief is (zie GameNightHome.tsx,
// isLobbyPartyView) — geen nieuwe UI bovenop de oude, precies één ervaring
// (sectie 29). Bron van waarheid blijft uitsluitend Supabase via de
// bestaande V2.4-hooks; geen lokale party-state, geen nieuwe RPC's/tabellen.

export function GameNightV2Lobby({
  session,
  onChooseGame,
  onCloseGameNight,
}: {
  session: GameNightSession;
  onChooseGame: () => void;
  onCloseGameNight: () => void;
}) {
  const { data: atTable = [] } = useActivePartySeats(session.id);
  const { data: allPlayers = [] } = usePlayers();
  const { data: palette = [] } = useGameNightColorPalette();
  const { data: analyticsData } = useGameNightAnalytics();
  const addToParty = useAddToParty(session.id);
  const removeFromParty = useRemoveFromParty(session.id);
  const setPartyOrder = useSetPartyOrder(session.id);
  usePartyRealtimeSync(session.id, true);

  const [showQr, setShowQr] = useState(false);
  const [joinToasts, setJoinToasts] = useState<{ id: string; text: string }[]>(
    [],
  );
  const prevSeatIdsRef = useRef<Set<string> | null>(null);

  // Sectie 11: een klein sociaal moment wanneer iemand via de telefoon
  // joint — puur afgeleid uit echte data (source === 'qr_join'), nooit een
  // verzonnen event. De eerste keer dat de party laadt slaan we bewust over
  // (anders "verschijnt" iedereen die al aan tafel zat als nieuwkomer).
  useEffect(() => {
    const currentIds = new Set(atTable.map((s) => s.player_id));
    if (prevSeatIdsRef.current) {
      const prev = prevSeatIdsRef.current;
      const arrived = atTable.filter(
        (s) => !prev.has(s.player_id) && s.source === "qr_join",
      );
      if (arrived.length > 0) {
        const next = arrived.map((s) => ({
          id: `${s.player_id}-${Date.now()}`,
          text: `${s.player.nickname?.trim() || s.player.name} schuift aan`,
        }));
        setJoinToasts((cur) => [...cur, ...next]);
        next.forEach((toast) => {
          setTimeout(() => {
            setJoinToasts((cur) => cur.filter((t) => t.id !== toast.id));
          }, 4200);
        });
      }
    }
    prevSeatIdsRef.current = currentIds;
  }, [atTable]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const atTableIds = new Set(atTable.map((s) => s.player_id));
  const available = allPlayers.filter((p) => !atTableIds.has(p.id));
  const colorHex = (player: GameNightPlayer) =>
    resolvePlayerColorHex(player, palette);
  const lifetimeWins = (playerId: string): number | null =>
    (analyticsData &&
      buildPlayerStats(analyticsData, playerId)?.canonicalWins) ??
    null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const playerId = active.id as string;
    const wasAtTable = atTableIds.has(playerId);

    const overIsPartyZone =
      over.id === PARTY_ZONE_ID || atTableIds.has(over.id as string);
    const overIsAvailableZone =
      over.id === AVAILABLE_ZONE_ID ||
      available.some((p) => p.id === (over.id as string));

    if (!wasAtTable && overIsPartyZone) {
      addToParty.mutate(playerId);
      return;
    }
    if (wasAtTable && overIsAvailableZone) {
      removeFromParty.mutate(playerId);
      return;
    }
    if (wasAtTable && overIsPartyZone && over.id !== playerId) {
      const ids = atTable.map((s) => s.player_id);
      const oldIndex = ids.indexOf(playerId);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = [...ids];
      next.splice(oldIndex, 1);
      next.splice(newIndex, 0, playerId);
      setPartyOrder.mutate(next);
    }
  }

  const { weekday, date } = formatEveningIdentity(session.started_at);

  return (
    <GnV2Scene>
      <header className="gnv2-topbar">
        <div className="gnv2-identity">
          <p className="gnv2-identity-eyebrow">{weekday}</p>
          <p className="gnv2-identity-date">{date}</p>
        </div>
        <nav className="gnv2-nav" aria-label="Game Night navigatie">
          <Link
            to="/game-night/spelers"
            className="gnv2-nav-btn"
            aria-label="Spelers"
            title="Spelers"
          >
            <Users className="h-[18px] w-[18px]" />
          </Link>
          <Link
            to="/game-night/hall-of-fame"
            className="gnv2-nav-btn"
            aria-label="Hall of Fame"
            title="Hall of Fame"
          >
            <Trophy className="h-[18px] w-[18px]" />
          </Link>
          <Link
            to="/game-night/geschiedenis"
            className="gnv2-nav-btn"
            aria-label="Geschiedenis"
            title="Geschiedenis"
          >
            <History className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={onCloseGameNight}
            className="gnv2-nav-btn"
            aria-label="Game Night afsluiten"
            title="Game Night afsluiten"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </nav>
      </header>

      <div className="gnv2-toasts" aria-live="polite">
        {joinToasts.map((toast) => (
          <div key={toast.id} className="gnv2-toast">
            {toast.text}
          </div>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <main className="gnv2-main">
          {atTable.length > 0 && (
            <p className="gnv2-headcount">{atTable.length} vanavond</p>
          )}
          <PartyStage
            seats={atTable}
            colorHex={colorHex}
            lifetimeWins={lifetimeWins}
            onRemove={(playerId) => removeFromParty.mutate(playerId)}
            onOpenQr={() => setShowQr(true)}
          />
        </main>

        <footer className="gnv2-footer">
          <AvailablePlayerTray
            players={available}
            colorHex={colorHex}
            onAdd={(playerId) => addToParty.mutate(playerId)}
          />

          <div className="gnv2-actions">
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="gnv2-btn gnv2-btn-ghost"
            >
              <QrCode className="h-4 w-4" />
              Join met telefoon
            </button>
            <button
              type="button"
              disabled={atTable.length === 0}
              onClick={onChooseGame}
              className="gnv2-btn gnv2-btn-primary"
            >
              Wat spelen we?
            </button>
          </div>
        </footer>
      </DndContext>

      {showQr && (
        <JoinPartySheet session={session} onClose={() => setShowQr(false)} />
      )}
    </GnV2Scene>
  );
}
