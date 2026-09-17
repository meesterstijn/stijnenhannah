import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Camera,
  Flag,
  Music,
  MoreHorizontal,
  Trophy,
  Undo2,
} from "lucide-react";
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
import {
  useMarioKartPointEvents,
  useUndoLastMarioKartPointEvent,
} from "@/features/game-night/hooks/useMarioKartPoints";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useLatestBoardPhoto } from "@/features/game-night/hooks/useCheckpoints";
import {
  useCharacterEquipmentForPlayers,
  useCharacterParts,
} from "@/features/game-night/hooks/useCharacterCatalog";
import { useGameArenaSound } from "@/features/game-night/hooks/useGameArenaSound";
import { resolvePlayerColorHex } from "@/features/game-night/lib/playerIdentity";
import { resolvePlayerCharacter } from "@/features/game-night/lib/gameNightCharacter";
import { resolveGameArenaTheme } from "@/features/game-night/lib/gameNightArena";
import {
  buildCompetitiveMoment,
  buildPreviousWinnerIntro,
  type PreviousWinnerIntro,
} from "@/features/game-night/lib/gameNightCompetitiveMoments";
import { resolveAvailableArenaScenes } from "@/features/game-night/lib/gameNightArenaScenes";
import { useArenaSceneRotation } from "@/features/game-night/hooks/useArenaSceneRotation";
import { ARENA_SYMBOL_ICONS } from "@/features/game-night/v2/arenaSymbolIcons";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { ArenaSetupPhoto } from "@/features/game-night/v2/ArenaSetupPhoto";
import { ArenaPlayerLayout } from "@/features/game-night/v2/ArenaPlayerLayout";
import { ArenaPlayerZone } from "@/features/game-night/v2/ArenaPlayerZone";
import {
  ArenaSceneHistorisch,
  ArenaSceneRecord,
  ArenaSceneRivaliteit,
  ArenaSceneVanavond,
} from "@/features/game-night/v2/ArenaScenes";
import { ArenaWinPickerSheet } from "@/features/game-night/v2/ArenaWinPickerSheet";
import { ArenaWinnerSpotlight } from "@/features/game-night/v2/ArenaWinnerSpotlight";
import { ArenaActionFeedSheet } from "@/features/game-night/v2/ArenaActionFeedSheet";
import { ArenaMoreMenuSheet } from "@/features/game-night/v2/ArenaMoreMenuSheet";
import { ArenaCheckpointOverlay } from "@/features/game-night/v2/ArenaCheckpointOverlay";
import { ArenaSpotifyPanel } from "@/features/game-night/v2/ArenaSpotifyPanel";
import { MarioKartLeaderboard } from "@/features/game-night/components/MarioKartLeaderboard";

const INTRO_MS = 4000;
const TOAST_MS = 3200;
// Sectie "automatische scènerotatie": "iedere 25-40 seconden" — TAFEL komt
// dubbel zo vaak voor in de rotatievolgorde (zie sceneSequence hieronder)
// zodat die, conform de scène-prioriteit, het merendeel van de tijd in
// beeld blijft zonder een aparte/langere timer voor die ene scène nodig te
// hebben.
const SCENE_ROTATION_MS = 32000;
const SPOTLIGHT_MS = 4200;

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
  // Mario Kart (20260924) gebruikt geen win_events: i.p.v. de character-ring
  // met een WIN-knop toont de tafelscène voor dit ene spel een permanent
  // zichtbaar, onder-elkaar-gerangschikt puntenklassement (zie
  // MarioKartLeaderboard, die zijn eigen useMarioKartPoints-data haalt) —
  // geen los overlay dat je eerst moet openen. `session.id` is bewust de
  // sleutel die daar naartoe gaat, niet gameSession.id: het klassement hoort
  // bij de hele Game Night, niet bij deze ene spelsessie (reset per Game
  // Night, niet per rematch — zie de migratie voor de reden).
  const isMarioKart = gameSession.game.slug === "mario-kart";
  // Los van MarioKartLeaderboard.tsx se eigen instantie van dezelfde hooks
  // (React Query dedupt op queryKey, dus geen dubbele fetch) — nodig omdat
  // de "Laatste ongedaan maken"-knop hier in de topbar staat (naast
  // camera/muziek), niet in het klassement zelf.
  const { data: marioKartPointEvents = [] } = useMarioKartPointEvents(
    isMarioKart ? session.id : undefined,
  );
  const undoLastMarioKartPoint = useUndoLastMarioKartPointEvent(
    isMarioKart ? session.id : undefined,
  );
  const canUndoMarioKartPoint = marioKartPointEvents.some(
    (e) => e.undone_at == null,
  );
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

  const [intro, setIntro] = useState<PreviousWinnerIntro | null>(null);
  // V2.10.5 (Arena Fase 1) — "🏆 Win registreren" opent dit overlay i.p.v.
  // dat elk character op tafel permanent een WIN-knop is (sectie "Arena
  // controls"). `spotlight` vervangt de oude kleine
  // `celebratingPlayerId`-pulse + optionele `GameArenaMomentBanner`: ELKE
  // WIN krijgt nu dezelfde grote, prominente "winnaar komt naar voren"-
  // presentatie (zie ArenaWinnerSpotlight.tsx) i.p.v. alleen de
  // "bijzondere" wins een moment te geven.
  const [winPickerOpen, setWinPickerOpen] = useState(false);
  const [spotlight, setSpotlight] = useState<{
    playerId: string;
    eventId: string;
    winsTonight: number;
    momentText: string | null;
  } | null>(null);
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
  }, [analyticsData, gameSession.game_id, gameSession.id]);

  // Keep the expiry independent of analytics refetches and StrictMode's
  // effect replay; otherwise cleanup can leave the introduction on screen.
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(() => setIntro(null), INTRO_MS);
    return () => clearTimeout(timer);
  }, [intro]);

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

  // V2.10.5 — vervangt het oude `handleTap` (elk character = WIN-knop):
  // wordt nu uitsluitend aangeroepen vanuit ArenaWinPickerSheet, ná
  // expliciete keuze in "Wie won er?". Zelfde onderliggende
  // win-infrastructuur (useRecordWin/RPC), ongewijzigd.
  async function handleWinPick(playerId: string) {
    // Sectie 7: beschermt alleen tegen één dubbel-verstuurd fysiek tik-
    // event — twee bewuste tikken na elkaar registreren gewoon twee WINs
    // (zelfde patroon als de legacy WinPlayPanel).
    if (recordWin.isPending) return;
    const event = await recordWin.mutateAsync(playerId);
    sound.playWin();
    setWinPickerOpen(false);

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
    setSpotlight({
      playerId,
      eventId: event.id,
      winsTonight: (activeWinsByPlayer.get(playerId) ?? 0) + 1,
      momentText: nextMoment?.subtitle ?? nextMoment?.headline ?? null,
    });
    setTimeout(() => {
      setSpotlight((cur) => (cur?.eventId === event.id ? null : cur));
    }, SPOTLIGHT_MS);
  }

  // ── V2.10.5 (Arena Fase 1) — automatische scènerotatie ─────────────────
  // Sectie "scène-prioriteit": TAFEL blijft altijd primair (dubbel gewicht
  // in de volgorde), de vier aanvullende scènes verschijnen alleen als er
  // écht bruikbare data voor is (resolveAvailableArenaScenes) — nooit een
  // lege/irrelevante scène tonen. Rotatie pauzeert tijdens de Win-picker
  // EN de Winner Spotlight (nooit de scène wisselen terwijl iemand actief
  // aan het kiezen is of net een spotlight-moment beleeft).
  const arenaScenes = useMemo(
    () =>
      resolveAvailableArenaScenes({
        analyticsData,
        gameId: gameSession.game_id,
        participants,
        activeWinsByPlayer,
      }),
    [analyticsData, gameSession.game_id, participants, activeWinsByPlayer],
  );
  const sceneSequence = useMemo(() => {
    // Mario Kart heeft geen win_events, dus nooit bruikbare data voor
    // vanavond/rivaliteit/historisch/record — de tafelscène (hier het
    // puntenklassement, zie hieronder) blijft daarom altijd de enige scène.
    if (isMarioKart) return ["tafel"] as const;
    const extra: ("vanavond" | "rivaliteit" | "historisch" | "record")[] = [];
    if (arenaScenes.vanavond) extra.push("vanavond");
    if (arenaScenes.rivaliteit) extra.push("rivaliteit");
    if (arenaScenes.historisch) extra.push("historisch");
    if (arenaScenes.record) extra.push("record");
    if (extra.length === 0) return ["tafel"] as const;
    // TAFEL na elke aanvullende scène terug — zie bestandscommentaar.
    return extra.flatMap((id) => ["tafel", id] as const);
  }, [isMarioKart, arenaScenes]);
  const activeScene = useArenaSceneRotation(sceneSequence, {
    intervalMs: SCENE_ROTATION_MS,
    paused: winPickerOpen || spotlight !== null,
  });

  const spotlightPlayer = spotlight
    ? participantsById.get(spotlight.playerId)
    : null;

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
            {isMarioKart && (
              <button
                type="button"
                onClick={() => undoLastMarioKartPoint.mutate()}
                disabled={
                  !canUndoMarioKartPoint || undoLastMarioKartPoint.isPending
                }
                aria-label="Laatste puntenwijziging ongedaan maken"
                title="Laatste puntenwijziging ongedaan maken"
                className="gnv2-nav-btn"
              >
                <Undo2 className="h-[18px] w-[18px]" />
              </button>
            )}
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
              aria-label="Spel afsluiten"
              title="Spel afsluiten"
              className="gnv2-btn-danger-ghost gnv2-arena-end-btn"
            >
              <Flag className="h-4 w-4" />
              {/* V2.10.5 (responsive-shell-consistentieronde): dit label
                  blijft de EXPLICIETE tekst op tablet/desktop (sectie
                  "actiebalk": "Spel afsluiten... hoeft niet dominant, maar
                  moet WEL bereikbaar blijven" — bewust niet verplaatst naar
                  het ···-menu, zie ArenaMoreMenuSheet.tsx's eigen
                  toelichting daarover). Op smalle telefoons verdwijnt
                  alleen de TEKST via CSS (.gnv2-arena-end-btn-label,
                  ≤640px) — de knop zelf blijft even groot/klikbaar (44px),
                  met aria-label/title hierboven als vaste toegankelijke
                  naam, dus dit is puur visueel, geen functieverlies. */}
              <span className="gnv2-arena-end-btn-label">Spel afsluiten</span>
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

        {/* V2.10.5 (Arena Fase 1) — de scène-wisseling zelf: TAFEL blijft
            de bestaande ArenaPlayerLayout-ring (nu passief, geen onTap
            meer — zie ArenaPlayerZone.tsx), de vier aanvullende scènes
            hergebruiken dezelfde al-gebatchte data (characterFor/colorHex/
            activeWinsByPlayer). `key={activeScene}` triggert bewust een
            React-remount per scènewissel: dat is precies de haak voor de
            CSS-crossfade hieronder (`.gnv2-arena-scene-stage`,
            styles.css), en de content zelf (characters/DOM binnen ÉÉN
            scène) blijft stabiel zolang die scène actief is — geen
            onnodige remounts van CharacterVisual/img's tijdens de 25-40s
            dat een scène in beeld staat. */}
        <main className="gnv2-arena-main">
          <div
            key={activeScene}
            className={`gnv2-arena-scene-stage${isMarioKart ? " gnv2-arena-scene-stage-fill" : ""}`}
          >
            {activeScene === "tafel" && isMarioKart && (
              <MarioKartLeaderboard
                gameNightSessionId={session.id}
                players={participants}
                characterFor={characterFor}
                colorHex={colorHex}
              />
            )}
            {activeScene === "tafel" && !isMarioKart && (
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
                    resolvedCharacter={characterFor(player)}
                    wins={activeWinsByPlayer.get(player.id) ?? 0}
                    celebrationStyle={theme.celebrationStyle}
                  />
                )}
              />
            )}
            {activeScene === "vanavond" && arenaScenes.vanavond && (
              <ArenaSceneVanavond
                data={arenaScenes.vanavond}
                colorHex={colorHex}
                characterFor={characterFor}
              />
            )}
            {activeScene === "rivaliteit" && arenaScenes.rivaliteit && (
              <ArenaSceneRivaliteit
                data={arenaScenes.rivaliteit}
                colorHex={colorHex}
                characterFor={characterFor}
              />
            )}
            {activeScene === "historisch" && arenaScenes.historisch && (
              <ArenaSceneHistorisch
                data={arenaScenes.historisch}
                colorHex={colorHex}
                characterFor={characterFor}
              />
            )}
            {activeScene === "record" && arenaScenes.record && (
              <ArenaSceneRecord
                data={arenaScenes.record}
                colorHex={colorHex}
                characterFor={characterFor}
              />
            )}
          </div>
        </main>

        {/* Mario Kart heeft geen eigen "Win registreren"-equivalent nodig:
            het klassement hierboven heeft al een invoerveld + knop per
            speler, dus een extra footer-actie zou dezelfde handeling
            dubbel aanbieden. */}
        {!isMarioKart && (
          <footer className="gnv2-footer gnv2-arena-footer">
            <button
              type="button"
              onClick={() => setWinPickerOpen(true)}
              className="gnv2-btn gnv2-btn-primary gnv2-arena-win-btn"
            >
              <Trophy className="h-4 w-4" />
              Win registreren
            </button>
          </footer>
        )}
      </div>

      {winPickerOpen && (
        <ArenaWinPickerSheet
          participants={participants}
          colorHex={colorHex}
          characterFor={characterFor}
          pending={recordWin.isPending}
          onPick={handleWinPick}
          onClose={() => setWinPickerOpen(false)}
        />
      )}

      {spotlight && spotlightPlayer && (
        <ArenaWinnerSpotlight
          player={spotlightPlayer}
          resolvedCharacter={characterFor(spotlightPlayer)}
          colorHex={colorHex(spotlightPlayer)}
          celebrationStyle={theme.celebrationStyle}
          winsTonight={spotlight.winsTonight}
          momentText={spotlight.momentText}
          eventId={spotlight.eventId}
        />
      )}

      {/* Fase 2 (nog NIET gebouwd, sectie "geen reactions nog"): telefoon-
          reacties (bier/salt/clown/kroon/...) horen hier als een
          VOLGEND, onafhankelijk overlay-element te komen — precies zoals
          ArenaWinPickerSheet/ArenaWinnerSpotlight hierboven: een eigen
          `position:fixed`-laag, een eigen stukje state
          (bv. `activeReactions`), en een eigen realtime-subscription
          (zelfde idioom als usePartyRealtimeSync/useCharacterEquipment-
          ForPlayers — een kanaal per gameSessionId, geen query per
          reactie). Geen wijziging aan de scène-rotatie/win-flow hierboven
          nodig om dat toe te voegen; vandaar bewust nog GEEN
          interaction-tabel/-hook gebouwd (zie het opleverrapport). */}

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
