import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BookOpen, MessageSquareQuote, Moon, Undo2 } from "lucide-react";
import type { GameNightPlayer } from "@/lib/supabase";
import { getPlayerDisplayName } from "@/features/game-night/lib/playerIdentity";
import {
  characterVisualPropsFor,
  type ResolvedCharacter,
} from "@/features/game-night/lib/gameNightCharacter";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";
import {
  alivePlayers,
  buildSecretHitlerState,
  chancellorIneligibility,
  hitlerKnowsFascists,
  knownRoles,
  powerTargets,
  roleDistribution,
  vetoUnlocked,
  winningPlayers,
  type ShEventPayload,
  type ShHandClaim,
  type ShPolicy,
  type ShRole,
  type ShState,
  type ShTeam,
  type ShVote,
} from "@/features/game-night/lib/secretHitler";
import {
  buildStory,
  POWER_ICON,
  POWER_LABEL,
  TEAM_LABEL,
  WIN_REASON_TEXT,
  type ShNarration,
} from "@/features/game-night/lib/secretHitlerStory";
import {
  useFinishSecretHitler,
  useRecordSecretHitlerEvent,
  useSecretHitlerEvents,
  useSecretHitlerSuspicions,
  useUndoSecretHitlerEvent,
} from "@/features/game-night/hooks/useSecretHitler";
import {
  playSecretHitlerSound,
  type SecretHitlerSound,
} from "@/features/game-night/lib/gameNightArenaSound";
import { SecretHitlerBoard } from "@/features/game-night/v2/secretHitler/SecretHitlerBoard";
import {
  SecretHitlerSeat,
  type ShSeatBadge,
} from "@/features/game-night/v2/secretHitler/SecretHitlerSeat";
import {
  EndGameSheet,
  HandCards,
  HandClaimPicker,
  NightPhaseSheet,
  QuoteSheet,
  RevealSheet,
  StorySheet,
} from "@/features/game-night/v2/secretHitler/SecretHitlerSheets";

const BANNER_MS = 6500;

const INELIGIBLE_TEXT = {
  president: "president",
  dead: "dood",
  last_chancellor: "vorige kanselier",
  last_president: "vorige president",
} as const;

function soundFor(line: ShNarration): SecretHitlerSound {
  if (line.tone === "win") return "win";
  if (line.icon === "🔫") return "shot";
  if (line.tone === "liberal") return "liberal";
  if (line.tone === "fascist") return "fascist";
  if (line.tone === "danger" || line.extra?.includes("liegt")) return "drama";
  return "tick";
}

// De Secret Hitler-modus van de Arena: vervangt voor dit ene spel de
// character-ring + "Win registreren" door een volledige spelleider.
// Characters zijn de knoppen: tik op de kanselier, op wie je onderzoekt,
// op de stemmen. Het actiepaneel onderaan vraagt per fase precies wat er
// nodig is; de verteller maakt er een show van.
export function SecretHitlerTable({
  gameSessionId,
  participants,
  characterFor,
  colorHex,
  soundEnabled,
  endSheetOpen,
  onCloseEndSheet,
  onStopWithoutResult,
  stopPending,
}: {
  gameSessionId: string;
  participants: GameNightPlayer[];
  characterFor: (player: GameNightPlayer) => ResolvedCharacter;
  colorHex: (player: GameNightPlayer) => string | null;
  soundEnabled: boolean;
  endSheetOpen: boolean;
  onCloseEndSheet: () => void;
  onStopWithoutResult: () => void;
  stopPending: boolean;
}) {
  const eventsQuery = useSecretHitlerEvents(gameSessionId);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const record = useRecordSecretHitlerEvent(gameSessionId);
  const undo = useUndoSecretHitlerEvent(gameSessionId);
  const finish = useFinishSecretHitler();

  const participantIds = useMemo(
    () => participants.map((p) => p.id),
    [participants],
  );
  const playersById = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );
  const nameOf = useMemo(
    () => (id: string | null | undefined) => {
      const p = id ? playersById.get(id) : undefined;
      return p ? getPlayerDisplayName(p) : "Iemand";
    },
    [playersById],
  );

  const state = useMemo(
    () => buildSecretHitlerState(participantIds, events),
    [participantIds, events],
  );
  const story = useMemo(
    () => buildStory(participantIds, events, nameOf),
    [participantIds, events, nameOf],
  );
  const suspicionsQuery = useSecretHitlerSuspicions(
    gameSessionId,
    state.roles == null,
  );
  const suspicions = useMemo(
    () => suspicionsQuery.data ?? [],
    [suspicionsQuery.data],
  );
  const heat = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of suspicions)
      map.set(s.suspectId, (map.get(s.suspectId) ?? 0) + 1);
    return map;
  }, [suspicions]);

  // ── Lokale invoer per fase ──────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, ShVote>>({});
  const [policy, setPolicy] = useState<ShPolicy | null>(null);
  const [presClaim, setPresClaim] = useState<ShHandClaim | null>(null);
  const [chancClaim, setChancClaim] = useState<ShHandClaim | null>(null);
  const [teamClaim, setTeamClaim] = useState<ShTeam | null>(null);
  const [peekClaim, setPeekClaim] = useState<number | null>(null);
  // Zitvolgorde: `ordering` = bezig met aantikken, `customOrder` = klaar.
  const [ordering, setOrdering] = useState<string[] | null>(null);
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<
    null | "night" | "reveal" | "story" | "quote"
  >(null);
  const [showHeat, setShowHeat] = useState(true);

  const activeCount = events.filter((e) => e.undone_at == null).length;
  useEffect(() => {
    setSelectedId(null);
    setVotes({});
    setPolicy(null);
    setPresClaim(null);
    setChancClaim(null);
    setTeamClaim(null);
    setPeekClaim(null);
  }, [state.phase, activeCount]);

  // ── Verteller-banner + geluid bij elk nieuw event ──────────────────
  const [banner, setBanner] = useState<ShNarration | null>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  useEffect(() => {
    if (!eventsQuery.isSuccess) return;
    // Op event-id (niet op vertelling): bij het laden van de pagina staan
    // alle bestaande events op "gezien", ook als de spelers nog laden.
    if (seenRef.current == null) {
      seenRef.current = new Set(events.map((e) => e.id));
      return;
    }
    const seen = seenRef.current;
    const fresh = events.filter((e) => !seen.has(e.id));
    for (const e of fresh) seen.add(e.id);
    const last = story[story.length - 1];
    if (!last || !fresh.some((e) => e.id === last.eventId)) return;
    setBanner(last);
    if (soundRef.current) playSecretHitlerSound(soundFor(last));
  }, [story, events, eventsQuery.isSuccess]);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(t);
  }, [banner]);

  function send(payload: ShEventPayload, after?: () => void) {
    if (record.isPending) return;
    record.mutate(payload, { onSuccess: () => after?.() });
  }

  // ── Wat doet een tik op een speler in deze fase? ───────────────────
  const seats =
    state.phase === "setup" && customOrder ? customOrder : state.seats;
  const orderingSeats = state.phase === "setup" && ordering != null;
  const targets = state.phase === "power" ? powerTargets(state) : [];

  function seatAction(id: string): (() => void) | undefined {
    switch (state.phase) {
      case "setup":
        if (orderingSeats) {
          return () => {
            const cur = ordering ?? [];
            const next = cur.includes(id)
              ? cur.filter((x) => x !== id)
              : [...cur, id];
            if (next.length === state.playerCount) {
              setCustomOrder(next);
              setOrdering(null);
            } else {
              setOrdering(next);
            }
          };
        }
        return () => setSelectedId(id);
      case "nominate":
        return () => setSelectedId(id);
      case "vote":
        if (!alivePlayers(state).includes(id)) return undefined;
        return () =>
          setVotes((cur) => {
            const next = { ...cur };
            if (cur[id] === "ja") next[id] = "nein";
            else if (cur[id] === "nein") delete next[id];
            else next[id] = "ja";
            return next;
          });
      case "power":
        if (state.pendingPower === "peek") return undefined;
        return () => setSelectedId(id);
      default:
        return undefined;
    }
  }

  function disabledReason(id: string): string | null {
    if (state.phase === "nominate") {
      const why = chancellorIneligibility(state, id);
      return why ? INELIGIBLE_TEXT[why] : null;
    }
    if (state.phase === "power" && state.pendingPower !== "peek") {
      if (id === state.presidentId) return "president";
      if (state.dead.includes(id)) return "dood";
      if (!targets.includes(id)) return "al onderzocht";
    }
    if (state.phase === "vote" && state.dead.includes(id)) return "dood";
    return null;
  }

  function badgesFor(id: string): ShSeatBadge[] {
    const out: ShSeatBadge[] = [];
    const inRound = state.phase !== "setup" && state.phase !== "game_over";
    if (inRound && id === state.presidentId) {
      out.push({
        key: "pres",
        icon: "👑",
        label: state.currentIsSpecial ? "President*" : "President",
        tone: "gold",
      });
    }
    if (inRound && id === state.nomineeId) {
      out.push({ key: "chanc", icon: "🎩", label: "Kanselier", tone: "gold" });
    }
    if (
      inRound &&
      state.phase === "nominate" &&
      (id === state.lastElectedChancellorId ||
        (id === state.lastElectedPresidentId &&
          alivePlayers(state).length > 5)) &&
      id !== state.presidentId
    ) {
      out.push({ key: "term", icon: "⛔", label: "Termijn", tone: "muted" });
    }
    const investigation = state.governments
      .map((g) => g.power)
      .find((p) => p?.power === "investigate" && p.targetId === id);
    if (investigation?.power === "investigate") {
      out.push({
        key: "inv",
        icon: "🔍",
        label:
          investigation.claim == null
            ? "Onderzocht"
            : investigation.claim === "liberal"
              ? "‘Liberaal’"
              : "‘Fascist’",
        tone:
          investigation.claim === "fascist"
            ? "fascist"
            : investigation.claim === "liberal"
              ? "liberal"
              : "muted",
      });
    }
    if (state.confirmedNotHitler.includes(id) && !state.dead.includes(id)) {
      out.push({ key: "nh", icon: "✓", label: "Geen Hitler", tone: "liberal" });
    }
    if (state.specialElectionNextId === id) {
      out.push({
        key: "se",
        icon: "🗳️",
        label: "Volgende pres.",
        tone: "gold",
      });
    }
    return out;
  }

  const selectedLabel = selectedId ? nameOf(selectedId) : null;
  const gov = state.governments[state.governments.length - 1];
  const lastUndoable = [...story].reverse()[0];

  // ── Actiepaneel per fase ───────────────────────────────────────────
  function renderPanel() {
    switch (state.phase) {
      case "setup": {
        const { liberals, fascists } = roleDistribution(state.playerCount);
        const tooFew = state.playerCount < 5 || state.playerCount > 10;
        return (
          <>
            <p className="sh-prompt">
              <strong>{state.playerCount} spelers:</strong> {liberals}{" "}
              liberalen, {fascists} {fascists === 1 ? "fascist" : "fascisten"}{" "}
              en Hitler.{" "}
              {hitlerKnowsFascists(state.playerCount)
                ? "Hitler kent de fascist."
                : "Hitler kent de fascisten níét."}
            </p>
            {tooFew && (
              <p className="sh-form-error">
                Secret Hitler is voor 5 tot 10 spelers.
              </p>
            )}
            {orderingSeats ? (
              <p className="sh-hint">
                Tik de spelers aan <strong>met de klok mee</strong>, zoals ze
                aan tafel zitten ({ordering?.length ?? 0}/{state.playerCount}).
              </p>
            ) : (
              <p className="sh-hint">
                Tik op de <strong>eerste president</strong>
                {selectedLabel ? `: ${selectedLabel}` : ""}. De presidentsrol
                gaat daarna met de klok mee, in de volgorde van het scherm.
              </p>
            )}
            <div className="sh-actions">
              <button
                type="button"
                className="gnv2-btn gnv2-btn-ghost"
                onClick={() => setSheet("night")}
              >
                <Moon className="h-4 w-4" /> Nachtfase voorlezen
              </button>
              {orderingSeats ? (
                <button
                  type="button"
                  className="gnv2-btn gnv2-btn-ghost"
                  onClick={() => setOrdering(null)}
                >
                  Annuleren
                </button>
              ) : (
                <button
                  type="button"
                  className="gnv2-btn gnv2-btn-ghost"
                  onClick={() => setOrdering([])}
                >
                  {customOrder
                    ? "Zitvolgorde opnieuw"
                    : "Zitvolgorde aanpassen"}
                </button>
              )}
              <button
                type="button"
                className="gnv2-btn gnv2-btn-ghost"
                onClick={() =>
                  setSelectedId(
                    state.seats[Math.floor(Math.random() * state.seats.length)],
                  )
                }
              >
                🎲 Willekeurige president
              </button>
              <button
                type="button"
                className="gnv2-btn gnv2-btn-primary"
                disabled={
                  tooFew || record.isPending || orderingSeats || !selectedId
                }
                onClick={() =>
                  selectedId &&
                  send({
                    type: "start",
                    firstPresidentId: selectedId,
                    ...(customOrder ? { seats: customOrder } : {}),
                  })
                }
              >
                Start het spel
              </button>
            </div>
          </>
        );
      }
      case "nominate":
        return (
          <>
            <p className="sh-prompt">
              👑 <strong>{nameOf(state.presidentId)}</strong> is
              {state.currentIsSpecial ? " (door speciale verkiezing)" : ""}{" "}
              president. Wie wordt kanselier?
            </p>
            <p className="sh-hint">Tik op de voorgedragen kanselier.</p>
            <div className="sh-actions">
              <button
                type="button"
                className="gnv2-btn gnv2-btn-primary"
                disabled={!selectedId || record.isPending}
                onClick={() =>
                  selectedId &&
                  send({ type: "nominate", chancellorId: selectedId })
                }
              >
                {selectedLabel
                  ? `Draag ${selectedLabel} voor`
                  : "Kies een kanselier"}
              </button>
            </div>
          </>
        );
      case "vote": {
        const alive = alivePlayers(state);
        const ja = alive.filter((id) => votes[id] === "ja").length;
        const nein = alive.filter((id) => votes[id] === "nein").length;
        const open = alive.length - ja - nein;
        const suggested: boolean | null =
          ja > alive.length / 2
            ? true
            : nein >= alive.length / 2
              ? false
              : null;
        return (
          <>
            <p className="sh-prompt">
              🗳️ Stemming: <strong>{nameOf(gov?.presidentId)}</strong> +{" "}
              <strong>{nameOf(gov?.chancellorId)}</strong>
            </p>
            <p className="sh-hint">
              Tik op de spelers: één keer = Ja, twee keer = Nein. Stemmen
              invullen is optioneel, maar maakt de uitslag veel leuker.
            </p>
            <p className="sh-tally">
              <span className="sh-tally-ja">Ja {ja}</span>
              <span className="sh-tally-nein">Nein {nein}</span>
              {open > 0 && <span className="sh-tally-open">? {open}</span>}
            </p>
            <div className="sh-actions">
              <button
                type="button"
                className="gnv2-btn gnv2-btn-ghost"
                onClick={() =>
                  setVotes(
                    Object.fromEntries(alive.map((id) => [id, "ja" as const])),
                  )
                }
              >
                Iedereen ja
              </button>
              <button
                type="button"
                className="gnv2-btn gnv2-btn-ghost"
                onClick={() => setVotes({})}
              >
                Wissen
              </button>
              <button
                type="button"
                className={`sh-big-choice sh-big-choice-ja${suggested === true ? " sh-suggested" : ""}`}
                disabled={record.isPending || suggested === false}
                onClick={() => send({ type: "vote", passed: true, votes })}
              >
                ✅ Gekozen
              </button>
              <button
                type="button"
                className={`sh-big-choice sh-big-choice-nein${suggested === false ? " sh-suggested" : ""}`}
                disabled={record.isPending || suggested === true}
                onClick={() => send({ type: "vote", passed: false, votes })}
              >
                ❌ Weggestemd
              </button>
            </div>
          </>
        );
      }
      case "hitler_check":
        return (
          <>
            <p className="sh-prompt sh-prompt-danger">
              🦎 Er liggen al {state.fascistPolicies} fascistische wetten. Is{" "}
              <strong>{nameOf(gov?.chancellorId)}</strong> Hitler?
            </p>
            <p className="sh-hint">
              {nameOf(gov?.chancellorId)} moet dit nu eerlijk zeggen.
              Tromgeroffel...
            </p>
            <div className="sh-actions">
              <button
                type="button"
                className="sh-big-choice sh-big-choice-fascist"
                disabled={record.isPending}
                onClick={() => send({ type: "hitler_check", isHitler: true })}
              >
                🦎 Ja, ik ben Hitler
              </button>
              <button
                type="button"
                className="sh-big-choice sh-big-choice-liberal"
                disabled={record.isPending}
                onClick={() => send({ type: "hitler_check", isHitler: false })}
              >
                😮‍💨 Nee, geen Hitler
              </button>
            </div>
          </>
        );
      case "legislate":
        return (
          <>
            <p className="sh-prompt">
              📜 <strong>{nameOf(gov?.presidentId)}</strong> trekt drie kaarten,{" "}
              <strong>{nameOf(gov?.chancellorId)}</strong> kiest. Welke wet komt
              er?
            </p>
            <div className="sh-actions">
              <button
                type="button"
                className={`sh-big-choice sh-big-choice-liberal${policy === "L" ? " sh-suggested" : ""}`}
                onClick={() => setPolicy("L")}
                aria-pressed={policy === "L"}
              >
                🕊️ Liberaal
              </button>
              <button
                type="button"
                className={`sh-big-choice sh-big-choice-fascist${policy === "F" ? " sh-suggested" : ""}`}
                onClick={() => setPolicy("F")}
                aria-pressed={policy === "F"}
              >
                💀 Fascistisch
              </button>
              {vetoUnlocked(state) && (
                <button
                  type="button"
                  className="gnv2-btn gnv2-btn-ghost"
                  disabled={record.isPending}
                  onClick={() => send({ type: "veto" })}
                >
                  ✋ Veto (beiden akkoord)
                </button>
              )}
            </div>
            {policy && (
              <div className="sh-claims">
                <p className="sh-hint">
                  Wat zeggen ze dat ze kregen? (optioneel; het scherm vangt
                  tegenspraak)
                </p>
                <HandClaimPicker
                  label={`${nameOf(gov?.presidentId)} trok`}
                  size={3}
                  value={presClaim}
                  onChange={setPresClaim}
                />
                <HandClaimPicker
                  label={`${nameOf(gov?.chancellorId)} kreeg`}
                  size={2}
                  value={chancClaim}
                  onChange={setChancClaim}
                />
                <div className="sh-actions">
                  <button
                    type="button"
                    className="gnv2-btn gnv2-btn-primary"
                    disabled={record.isPending}
                    onClick={() =>
                      send({
                        type: "enact",
                        policy,
                        presidentClaim: presClaim,
                        chancellorClaim: chancClaim,
                      })
                    }
                  >
                    {policy === "L"
                      ? "🕊️ Liberale wet aannemen"
                      : "💀 Fascistische wet aannemen"}
                  </button>
                </div>
              </div>
            )}
          </>
        );
      case "chaos":
        return (
          <>
            <p className="sh-prompt sh-prompt-danger">
              🌪️ Chaos! Drie mislukte verkiezingen. Draai de bovenste kaart om.
            </p>
            <div className="sh-actions">
              <button
                type="button"
                className="sh-big-choice sh-big-choice-liberal"
                disabled={record.isPending}
                onClick={() => send({ type: "chaos", policy: "L" })}
              >
                🕊️ Liberaal
              </button>
              <button
                type="button"
                className="sh-big-choice sh-big-choice-fascist"
                disabled={record.isPending}
                onClick={() => send({ type: "chaos", policy: "F" })}
              >
                💀 Fascistisch
              </button>
            </div>
          </>
        );
      case "power": {
        const power = state.pendingPower!;
        const president = nameOf(state.presidentId);
        return (
          <>
            <p className="sh-prompt">
              {POWER_ICON[power]} <strong>{POWER_LABEL[power]}</strong> voor{" "}
              {president}
            </p>
            {power === "peek" ? (
              <>
                <p className="sh-hint">
                  {president} bekijkt stiekem de bovenste drie kaarten. Wat zegt{" "}
                  {president} dat er lag?
                </p>
                <HandClaimPicker
                  label="Claim"
                  size={3}
                  value={peekClaim}
                  onChange={setPeekClaim}
                />
                <div className="sh-actions">
                  <button
                    type="button"
                    className="gnv2-btn gnv2-btn-primary"
                    disabled={record.isPending}
                    onClick={() => send({ type: "peek", claim: peekClaim })}
                  >
                    Klaar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="sh-hint">
                  {power === "investigate" &&
                    `Tik op wie ${president} onderzoekt. Die geeft de partijkaart (niet de rolkaart!).`}
                  {power === "special_election" &&
                    `Tik op wie ${president} als volgende president aanwijst.`}
                  {power === "execute" &&
                    `Tik op wie ${president} executeert. Diegene zegt alleen of hij/zij Hitler was.`}
                  {selectedLabel && <strong> Gekozen: {selectedLabel}</strong>}
                </p>
                {power === "investigate" && selectedId && (
                  <div className="sh-claim-row">
                    <span className="sh-claim-label">{president} zegt:</span>
                    <div className="sh-claim-options">
                      {(["liberal", "fascist"] as ShTeam[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`sh-chip sh-chip-${t}${teamClaim === t ? " sh-chip-on" : ""}`}
                          onClick={() =>
                            setTeamClaim(teamClaim === t ? null : t)
                          }
                        >
                          {t === "liberal" ? "🕊️ Liberaal" : "💀 Fascist"}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`sh-chip${teamClaim == null ? " sh-chip-on" : ""}`}
                        onClick={() => setTeamClaim(null)}
                      >
                        🤐 Zegt niks
                      </button>
                    </div>
                  </div>
                )}
                <div className="sh-actions">
                  {power === "execute" ? (
                    <>
                      <button
                        type="button"
                        className="sh-big-choice sh-big-choice-liberal"
                        disabled={!selectedId || record.isPending}
                        onClick={() =>
                          selectedId &&
                          send({
                            type: "execute",
                            targetId: selectedId,
                            wasHitler: false,
                          })
                        }
                      >
                        🔫 Schieten: geen Hitler
                      </button>
                      <button
                        type="button"
                        className="sh-big-choice sh-big-choice-fascist"
                        disabled={!selectedId || record.isPending}
                        onClick={() =>
                          selectedId &&
                          send({
                            type: "execute",
                            targetId: selectedId,
                            wasHitler: true,
                          })
                        }
                      >
                        🎯 Schieten: was Hitler!
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="gnv2-btn gnv2-btn-primary"
                      disabled={!selectedId || record.isPending}
                      onClick={() => {
                        if (!selectedId) return;
                        if (power === "investigate")
                          send({
                            type: "investigate",
                            targetId: selectedId,
                            claim: teamClaim,
                          });
                        else
                          send({
                            type: "special_election",
                            targetId: selectedId,
                          });
                      }}
                    >
                      {selectedLabel
                        ? `Bevestig: ${selectedLabel}`
                        : "Kies een speler"}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        );
      }
      case "game_over":
        return renderGameOver();
    }
  }

  function renderGameOver() {
    const winner = state.winner!;
    const winners = winningPlayers(state);
    return (
      <>
        <p className={`sh-prompt sh-winner sh-winner-${winner}`}>
          {winner === "liberal" ? "🕊️" : "💀"}{" "}
          <strong>De {TEAM_LABEL[winner].toLowerCase()} winnen!</strong>{" "}
          {state.winReason ? WIN_REASON_TEXT[state.winReason] : ""}
        </p>
        {!state.roles ? (
          <>
            <p className="sh-hint">
              📱 Laatste kans: kies op je telefoon wie je voor Hitler hield (
              {suspicions.length}/{state.playerCount} gekozen). Daarna gaan de
              maskers af.
            </p>
            <div className="sh-actions">
              <button
                type="button"
                className="gnv2-btn gnv2-btn-primary"
                onClick={() => setSheet("reveal")}
              >
                🎭 Rollen onthullen
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sh-hint">
              Winnaars:{" "}
              <strong>{winners.map((id) => nameOf(id)).join(", ")}</strong>.
              Iedereen in het winnende team krijgt een WIN.
            </p>
            <div className="sh-actions">
              <button
                type="button"
                className="gnv2-btn gnv2-btn-primary"
                disabled={finish.isPending}
                onClick={() =>
                  finish.mutate({ gameSessionId, winnerIds: winners })
                }
              >
                {finish.isPending ? "Bezig..." : "🏆 Uitslag opslaan"}
              </button>
              <button
                type="button"
                className="gnv2-btn gnv2-btn-ghost"
                onClick={() => setSheet("reveal")}
              >
                Rollen aanpassen
              </button>
            </div>
            {finish.isError && (
              <p className="sh-form-error">
                Opslaan mislukt. Probeer het opnieuw.
              </p>
            )}
          </>
        )}
      </>
    );
  }

  const n = seats.length;
  const tableStyle = {
    ["--sh-n" as string]: String(n),
    ["--sh-half" as string]: String(Math.ceil(n / 2)),
  } as CSSProperties;

  function avatarFor(player: GameNightPlayer) {
    return (
      <CharacterVisual
        player={player}
        {...characterVisualPropsFor(characterFor(player))}
        loading="eager"
      />
    );
  }

  const recentLines = story.slice(-4).reverse();
  const totalHeat = suspicions.length;

  return (
    <div className="sh-root">
      <div className="sh-stage">
        <div className="sh-seats" style={tableStyle}>
          {seats.map((id, index) => {
            const player = playersById.get(id);
            if (!player) return null;
            const action = seatAction(id);
            const reason = disabledReason(id);
            return (
              <SecretHitlerSeat
                key={id}
                name={getPlayerDisplayName(player)}
                avatar={avatarFor(player)}
                ringColor={colorHex(player)}
                badges={badgesFor(id)}
                dead={state.dead.includes(id)}
                vote={state.phase === "vote" ? (votes[id] ?? null) : null}
                role={state.roles?.[id] ?? null}
                selected={selectedId === id}
                selectable={!!action && !reason}
                disabledReason={reason}
                heat={showHeat && !state.roles ? (heat.get(id) ?? 0) : 0}
                order={
                  orderingSeats
                    ? ordering!.includes(id)
                      ? ordering!.indexOf(id) + 1
                      : null
                    : state.phase === "setup"
                      ? index + 1
                      : null
                }
                onClick={action}
              />
            );
          })}
        </div>

        <div className="sh-middle">
          <SecretHitlerBoard state={state} />
          <aside className="sh-side">
            <div className="sh-side-block">
              <p className="sh-side-title">📜 Laatste nieuws</p>
              {recentLines.length === 0 ? (
                <p className="sh-side-empty">Het parlement is nog stil.</p>
              ) : (
                <ol className="sh-mini-story">
                  {recentLines.map((l) => (
                    <li key={l.eventId} className={`sh-tone-${l.tone}`}>
                      <span aria-hidden>{l.icon}</span> {l.title}
                      {l.extra && <em> · {l.extra}</em>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <LastGovernmentClaims state={state} nameOf={nameOf} />
            {totalHeat > 0 && !state.roles && (
              <div className="sh-side-block">
                <p className="sh-side-title">
                  🔥 Tafelverdenking
                  <button
                    type="button"
                    className="sh-link"
                    onClick={() => setShowHeat((v) => !v)}
                  >
                    {showHeat ? "verbergen" : "tonen"}
                  </button>
                </p>
                {showHeat && (
                  <ul className="sh-heat-list">
                    {[...heat.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([id, count]) => (
                        <li key={id}>
                          <span>{nameOf(id)}</span>
                          <span className="sh-heat-bar">
                            <span
                              style={{ width: `${(count / totalHeat) * 100}%` }}
                            />
                          </span>
                          <span>{count}</span>
                        </li>
                      ))}
                  </ul>
                )}
                <p className="sh-side-empty">
                  {totalHeat}/{state.playerCount} telefoons hebben een verdachte
                  gekozen.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <footer className="sh-panel">
        <div className="sh-panel-tools">
          <button
            type="button"
            className="sh-tool"
            onClick={() => setSheet("story")}
            title="Het verloop"
          >
            <BookOpen className="h-4 w-4" /> Verloop
          </button>
          <button
            type="button"
            className="sh-tool"
            onClick={() => setSheet("quote")}
            title="Quote vastleggen"
          >
            <MessageSquareQuote className="h-4 w-4" /> Quote
          </button>
          <button
            type="button"
            className="sh-tool"
            disabled={activeCount === 0 || undo.isPending}
            onClick={() => undo.mutate()}
            title={
              lastUndoable
                ? `Ongedaan maken: ${lastUndoable.title}`
                : "Ongedaan maken"
            }
          >
            <Undo2 className="h-4 w-4" /> Stap terug
            {lastUndoable && (
              <span className="sh-tool-detail">({lastUndoable.title})</span>
            )}
          </button>
        </div>
        <div className="sh-panel-body">{renderPanel()}</div>
        {record.isError && (
          <p className="sh-form-error">
            Dat lukte niet (
            {(record.error as Error)?.message ?? "onbekende fout"}).
          </p>
        )}
      </footer>

      {banner && (
        <div
          className={`sh-banner sh-tone-${banner.tone}`}
          role="status"
          onClick={() => setBanner(null)}
        >
          <span className="sh-banner-icon" aria-hidden>
            {banner.icon}
          </span>
          <p className="sh-banner-title">{banner.title}</p>
          <p className="sh-banner-text">{banner.text}</p>
          {banner.extra && <p className="sh-banner-extra">{banner.extra}</p>}
        </div>
      )}

      {sheet === "night" && (
        <NightPhaseSheet
          playerCount={state.playerCount}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "story" && (
        <StorySheet story={story} onClose={() => setSheet(null)} />
      )}
      {sheet === "quote" && (
        <QuoteSheet
          seats={state.seats}
          nameOf={nameOf}
          pending={record.isPending}
          onSubmit={(playerId, text) =>
            send({ type: "quote", playerId, text }, () => setSheet(null))
          }
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "reveal" && (
        <RevealSheet
          seats={state.seats}
          nameOf={nameOf}
          initial={state.roles ?? knownRoles(state)}
          pending={record.isPending}
          onSubmit={(roles: Record<string, ShRole>) =>
            send({ type: "reveal", roles }, () => setSheet(null))
          }
          onClose={() => setSheet(null)}
        />
      )}
      {endSheetOpen && (
        <EndGameSheet
          gameOver={state.phase === "game_over"}
          pending={record.isPending || stopPending}
          onDeclare={(winner) =>
            send({ type: "declare_winner", winner }, onCloseEndSheet)
          }
          onStopWithoutResult={onStopWithoutResult}
          onClose={onCloseEndSheet}
        />
      )}
    </div>
  );
}

function LastGovernmentClaims({
  state,
  nameOf,
}: {
  state: ShState;
  nameOf: (id: string | null | undefined) => string;
}) {
  const last = [...state.governments]
    .reverse()
    .find(
      (g) =>
        g.policy != null &&
        (g.presidentClaim != null || g.chancellorClaim != null),
    );
  if (!last) return null;
  return (
    <div className="sh-side-block">
      <p className="sh-side-title">🗣️ Laatste claims</p>
      <p className="sh-claim-line">
        {nameOf(last.presidentId)} trok{" "}
        <HandCards fascists={last.presidentClaim} size={3} />
      </p>
      <p className="sh-claim-line">
        {nameOf(last.chancellorId)} kreeg{" "}
        <HandCards fascists={last.chancellorClaim} size={2} />
      </p>
      {last.flags.length > 0 && (
        <p className="sh-claim-flag">
          {last.flags.some(
            (f) =>
              f !== "chancellor_chose_fascist" &&
              f !== "president_discarded_liberal",
          )
            ? "🔥 Iemand liegt!"
            : "🤨 Opvallend..."}
        </p>
      )}
    </div>
  );
}
