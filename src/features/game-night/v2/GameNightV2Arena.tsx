import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Camera, Flag, Music, MoreHorizontal } from "lucide-react";
import type {
  GameNightCheckpointPhotoType,
  GameNightPlayer,
  GameNightSession,
} from "@/lib/supabase";
import type { GameSessionWithGame } from "@/features/game-night/hooks/useGameSession";
import {
  useGameSessionWinEvents,
  useRecordWin,
  useUndoWinEvent,
  useCompleteWinSession,
} from "@/features/game-night/hooks/useGameNightWinEvents";
import { useGameNightColorPalette } from "@/features/game-night/hooks/useGameNightMemberProfile";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useLatestBoardPhoto } from "@/features/game-night/hooks/useCheckpoints";
import {
  useCharacterEquipmentForPlayers,
  useCharacterParts,
} from "@/features/game-night/hooks/useCharacterCatalog";
import { useGameArenaSound } from "@/features/game-night/hooks/useGameArenaSound";
import {
  getPlayerDisplayName,
  resolvePlayerColorHex,
} from "@/features/game-night/lib/playerIdentity";
import { resolvePlayerCharacter } from "@/features/game-night/lib/gameNightCharacter";
import { resolveGameArenaTheme } from "@/features/game-night/lib/gameNightArena";
import {
  buildCompetitiveMoment,
  buildPreviousWinnerIntro,
  type CompetitiveMoment,
  type PreviousWinnerIntro,
} from "@/features/game-night/lib/gameNightCompetitiveMoments";
import { ARENA_SYMBOL_ICONS } from "@/features/game-night/v2/arenaSymbolIcons";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { ArenaSetupPhoto } from "@/features/game-night/v2/ArenaSetupPhoto";
import { ArenaPlayerLayout } from "@/features/game-night/v2/ArenaPlayerLayout";
import { ArenaPlayerZone } from "@/features/game-night/v2/ArenaPlayerZone";
import { GameArenaMomentBanner } from "@/features/game-night/v2/GameArenaMomentBanner";
import { ArenaActionFeedSheet } from "@/features/game-night/v2/ArenaActionFeedSheet";
import { ArenaMoreMenuSheet } from "@/features/game-night/v2/ArenaMoreMenuSheet";
import { ArenaCheckpointOverlay } from "@/features/game-night/v2/ArenaCheckpointOverlay";
import { ArenaSpotifyPanel } from "@/features/game-night/v2/ArenaSpotifyPanel";

const CELEBRATION_MS = 900;
const MOMENT_MS = 3400;
const INTRO_MS = 4000;
const TOAST_MS = 3200;

function ArenaSymbolDecoration({
  symbol,
}: {
  symbol: keyof typeof ARENA_SYMBOL_ICONS;
}) {
  const Icon = ARENA_SYMBOL_ICONS[symbol];
  return (
    <div className="gnv2-arena-symbols" aria-hidden="true">
      <Icon className="gnv2-arena-symbol gnv2-arena-symbol-1" />
      <Icon className="gnv2-arena-symbol gnv2-arena-symbol-2" />
    </div>
  );
}

type CheckpointView = "closed" | "save" | "history";

// Game Night V2.7B — de Game Arena: vervangt de oude ActiveGameSessionPanel/
// WinPlayPanel VOLLEDIG voor win_events-sessies (sectie 1/16/33). Bron van
// waarheid blijft uitsluitend Supabase (win_events/RPC's, ongewijzigd,
// sectie 39/40) — alles hier is presentatie + het puur-frontend
// competitive-moment-laagje.
export function GameNightV2Arena({
  session,
  gameSession,
  participants,
}: {
  session: GameNightSession;
  gameSession: GameSessionWithGame;
  participants: GameNightPlayer[];
}) {
  const theme = useMemo(
    () => resolveGameArenaTheme(gameSession.game),
    [gameSession.game],
  );
  const { data: events = [] } = useGameSessionWinEvents(gameSession.id);
  const { data: palette = [] } = useGameNightColorPalette();
  const { data: analyticsData } = useGameNightAnalytics();
  const { data: liveBoardPhoto } = useLatestBoardPhoto(gameSession.id);
  // V2.9C (sectie 19): ÉÉN batched equipmentquery voor alle participants
  // van DEZE spelsessie — nooit een query per speler.
  const { data: characterParts = [] } = useCharacterParts();
  const { data: characterEquipment = [] } = useCharacterEquipmentForPlayers(
    participants.map((p) => p.id),
  );
  const recordWin = useRecordWin(gameSession.id);
  const undoWinEvent = useUndoWinEvent(gameSession.id);
  const completeWinSession = useCompleteWinSession();
  const sound = useGameArenaSound();

  const [celebratingPlayerId, setCelebratingPlayerId] = useState<string | null>(
    null,
  );
  const [moment, setMoment] = useState<CompetitiveMoment | null>(null);
  const [intro, setIntro] = useState<PreviousWinnerIntro | null>(null);
  const [actionFeedOpen, setActionFeedOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [checkpointView, setCheckpointView] =
    useState<CheckpointView>("closed");
  // Sectie 2/3 (V2.7D): "Foto maken"/"Uit galerij kiezen" in het ···-menu
  // springen direct naar de SPEELBORD-categorie + de bijbehorende native
  // picker (zie ArenaCheckpointOverlay.initialCategory/initialCaptureMode)
  // — de gewone camera-toolbarknop opent nog altijd het volledige
  // 6-categorieën-grid (checkpointQuickLaunch blijft dan null).
  const [checkpointQuickLaunch, setCheckpointQuickLaunch] = useState<{
    category: GameNightCheckpointPhotoType;
    captureMode: "camera" | "gallery";
  } | null>(null);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  // Sectie 13 (V2.8) — puur presentatie, wisselt NOOIT automatisch: de
  // setupfoto blijft standaard zichtbaar totdat iemand zelf op de
  // "Live tafelfoto"-toggle tikt (alleen zichtbaar als die echt bestaat).
  const [showLivePhoto, setShowLivePhoto] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);

  const moreMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const introShownRef = useRef(false);

  // Eenmalige "TE VERSLAAN"-intro (sectie 19) zodra analytics beschikbaar
  // is — nooit blokkerend, verdwijnt vanzelf.
  useEffect(() => {
    if (introShownRef.current || !analyticsData) return;
    introShownRef.current = true;
    const found = buildPreviousWinnerIntro(
      analyticsData,
      gameSession.game_id,
      gameSession.id,
    );
    if (!found) return;
    setIntro(found);
    const timer = setTimeout(() => setIntro(null), INTRO_MS);
    return () => clearTimeout(timer);
  }, [analyticsData, gameSession.game_id, gameSession.id]);

  const participantsById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const characterPartsById = useMemo(
    () => new Map(characterParts.map((p) => [p.id, p])),
    [characterParts],
  );
  function characterFor(player: GameNightPlayer) {
    return resolvePlayerCharacter(
      player,
      characterEquipment,
      characterPartsById,
    );
  }
  const activeEvents = useMemo(
    () => events.filter((e) => e.undone_at == null),
    [events],
  );
  const activeWinsByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of activeEvents) {
      map.set(e.player_id, (map.get(e.player_id) ?? 0) + 1);
    }
    return map;
  }, [activeEvents]);

  function colorHex(player: GameNightPlayer): string | null {
    return resolvePlayerColorHex(player, palette);
  }

  function pushToast(text: string) {
    const id = crypto.randomUUID();
    setToasts((cur) => [...cur, { id, text }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, TOAST_MS);
  }

  async function handleTap(playerId: string) {
    // Sectie 7: beschermt alleen tegen één dubbel-verstuurd fysiek tik-
    // event — twee bewuste tikken na elkaar registreren gewoon twee WINs
    // (zelfde patroon als de legacy WinPlayPanel).
    if (recordWin.isPending) return;
    const event = await recordWin.mutateAsync(playerId);
    sound.playWin();

    setCelebratingPlayerId(playerId);
    setTimeout(() => {
      setCelebratingPlayerId((cur) => (cur === playerId ? null : cur));
    }, CELEBRATION_MS);

    // Het net-aangemaakte event zit nog niet gegarandeerd in `events`
    // (query-invalidatie is async) — expliciet meegeven i.p.v. wachten op
    // een refetch, zodat het moment altijd op de daadwerkelijk zojuist
    // getikte WIN reageert.
    const nextMoment = buildCompetitiveMoment({
      gameId: gameSession.game_id,
      gameSessionId: gameSession.id,
      events: [...events, event],
      justRecordedEventId: event.id,
      participantsById,
      analyticsData,
    });
    if (nextMoment) {
      setMoment(nextMoment);
      setTimeout(() => {
        setMoment((cur) => (cur === nextMoment ? null : cur));
      }, MOMENT_MS);
    } else {
      // Sectie 22 (V2.8): de meeste WINs krijgen bewust GEEN competitive
      // moment ("niet elke WIN heeft een grap nodig") — zonder moment zou
      // een screenreader-gebruiker dan helemaal geen bevestiging krijgen.
      // Hergebruikt de bestaande toast/aria-live-mechaniek (kort, niet
      // permanent) i.p.v. een nieuwe feedbacklaag te bouwen.
      const player = participantsById.get(playerId);
      if (player) pushToast(`${getPlayerDisplayName(player)} pakt de WIN`);
    }
  }

  function handleUndo(eventId: string) {
    if (undoWinEvent.isPending) return;
    undoWinEvent.mutate(eventId, {
      onSuccess: () => {
        sound.playUndo();
        pushToast("WIN ongedaan gemaakt");
      },
    });
  }

  async function handleFinishSession() {
    await completeWinSession.mutateAsync(gameSession.id);
    setConfirmFinishOpen(false);
  }

  function openQuickPhoto(captureMode: "camera" | "gallery") {
    setCheckpointQuickLaunch({ category: "board", captureMode });
    setCheckpointView("save");
  }

  return (
    <GnV2Scene
      className="gnv2-arena-scene"
      hideSuits={theme.symbol !== "none"}
      style={
        {
          ["--gnv2-arena-primary"]: theme.primaryColor,
          ["--gnv2-arena-secondary"]: theme.secondaryColor,
        } as CSSProperties
      }
    >
      <div
        className="gnv2-arena-root"
        data-arena-style={theme.style ?? "default"}
      >
        {theme.symbol !== "none" && (
          <ArenaSymbolDecoration symbol={theme.symbol} />
        )}

        <header className="gnv2-topbar gnv2-topbar-compact gnv2-arena-topbar">
          <div className="gnv2-topbar-spacer" aria-hidden />
          <div className="gnv2-identity gnv2-identity-center">
            <p className="gnv2-identity-eyebrow">{session.name}</p>
            <p className="gnv2-identity-date">{gameSession.game.name}</p>
          </div>
          <div className="gnv2-arena-toolbar">
            <button
              type="button"
              onClick={() => {
                setCheckpointQuickLaunch(null);
                setCheckpointView("save");
              }}
              aria-label="Checkpoint / foto"
              title="Checkpoint / foto"
              className="gnv2-nav-btn"
            >
              <Camera className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setSpotifyOpen((v) => !v)}
              aria-label="Muziek"
              title="Muziek"
              className="gnv2-nav-btn"
            >
              <Music className="h-[18px] w-[18px]" />
            </button>
            <div className="gnv2-action-menu-anchor">
              <button
                ref={moreMenuTriggerRef}
                type="button"
                onClick={() => setMoreMenuOpen((v) => !v)}
                aria-label="Meer opties"
                title="Meer opties"
                aria-haspopup="menu"
                aria-expanded={moreMenuOpen}
                className="gnv2-nav-btn"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
              <ArenaMoreMenuSheet
                open={moreMenuOpen}
                triggerRef={moreMenuTriggerRef}
                soundEnabled={sound.enabled}
                onToggleSound={sound.toggle}
                onQuickPhoto={openQuickPhoto}
                onViewCheckpoints={() => setCheckpointView("history")}
                onUndoActions={() => setActionFeedOpen(true)}
                onClose={() => setMoreMenuOpen(false)}
              />
            </div>
            <button
              type="button"
              onClick={() => setConfirmFinishOpen(true)}
              className="gnv2-btn-danger-ghost"
            >
              <Flag className="h-4 w-4" />
              <span>Spel afsluiten</span>
            </button>
          </div>
        </header>

        <div className="gnv2-toasts" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="gnv2-toast">
              {toast.text}
            </div>
          ))}
        </div>

        {intro && (
          <div className="gnv2-arena-intro" role="status">
            <p className="gnv2-arena-intro-headline">{intro.headline}</p>
            <p className="gnv2-arena-intro-subtitle">{intro.subtitle}</p>
          </div>
        )}

        {moment && <GameArenaMomentBanner moment={moment} />}

        <main className="gnv2-arena-main">
          <ArenaPlayerLayout
            participants={participants}
            center={
              <ArenaSetupPhoto
                gameName={gameSession.game.name}
                theme={theme}
                liveBoardPhotoUrl={liveBoardPhoto?.url ?? null}
                showLive={showLivePhoto}
                onToggleLive={() => setShowLivePhoto((v) => !v)}
              />
            }
            renderPlayer={(player) => (
              <ArenaPlayerZone
                player={player}
                colorHex={colorHex(player)}
                characterId={player.character_id}
                resolvedCharacter={characterFor(player)}
                wins={activeWinsByPlayer.get(player.id) ?? 0}
                state={
                  celebratingPlayerId === player.id ? "celebrating" : "normal"
                }
                celebrationStyle={theme.celebrationStyle}
                disabled={recordWin.isPending}
                onTap={() => handleTap(player.id)}
              />
            )}
          />
        </main>
      </div>

      {actionFeedOpen && (
        <ArenaActionFeedSheet
          events={events}
          participantsById={participantsById}
          onUndo={handleUndo}
          undoPendingEventId={
            undoWinEvent.isPending
              ? ((undoWinEvent.variables as string | undefined) ?? null)
              : null
          }
          onClose={() => setActionFeedOpen(false)}
        />
      )}

      {checkpointView !== "closed" && (
        <ArenaCheckpointOverlay
          gameSessionId={gameSession.id}
          attendees={participants}
          initialView={checkpointView}
          initialCategory={checkpointQuickLaunch?.category ?? null}
          initialCaptureMode={checkpointQuickLaunch?.captureMode}
          onClose={() => {
            setCheckpointView("closed");
            setCheckpointQuickLaunch(null);
          }}
          onSaved={() => {
            setCheckpointView("closed");
            setCheckpointQuickLaunch(null);
            pushToast("✓ Moment opgeslagen");
          }}
        />
      )}

      {spotifyOpen && (
        <ArenaSpotifyPanel onClose={() => setSpotifyOpen(false)} />
      )}

      {confirmFinishOpen && (
        <div
          className="gnv2-sheet-backdrop"
          onClick={() => setConfirmFinishOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Spel afsluiten bevestigen"
        >
          <div className="gnv2-sheet-card" onClick={(e) => e.stopPropagation()}>
            <p className="gnv2-dialog-title text-lg">Spel afsluiten?</p>
            <p className="gnv2-dialog-muted text-sm">
              {gameSession.game.name} wordt afgesloten voor alle spelers — dit
              kan niet ongedaan gemaakt worden.
            </p>
            <div className="flex w-full gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmFinishOpen(false)}
                className="gnv2-btn gnv2-btn-ghost flex-1"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleFinishSession}
                disabled={completeWinSession.isPending}
                className="gnv2-btn-danger-ghost flex-1"
              >
                {completeWinSession.isPending ? "Bezig..." : "Ja, afsluiten"}
              </button>
            </div>
          </div>
        </div>
      )}
    </GnV2Scene>
  );
}
