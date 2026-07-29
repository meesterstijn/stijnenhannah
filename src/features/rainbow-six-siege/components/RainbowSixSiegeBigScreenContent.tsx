import { useEffect, useState } from "react";
import { Maximize } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchR6SessionDetail } from "@/features/rainbow-six-siege/lib/sessions";
import { fetchR6GameOperatorAssignmentsForMatches } from "@/features/rainbow-six-siege/lib/operatorWheel";
import { fetchR6ChaosEffects, fetchR6SessionChaosEffects } from "@/features/rainbow-six-siege/lib/chaosWheel";
import { fetchR6Challenges, fetchR6Maps, fetchR6Operators, fetchR6ScoreRules } from "@/features/rainbow-six-siege/lib/reference";
import { computeScoreboard, FALLBACK_SCORE_RULES } from "@/features/rainbow-six-siege/lib/scoring";
import type {
  R6ChaosEffect,
  R6Challenge,
  R6Event,
  R6GameOperatorAssignment,
  R6Map,
  R6Match,
  R6MatchPlayer,
  R6Operator,
  R6ScoreRule,
  R6Session,
  R6SessionChaosEffect,
  R6SessionPlayer,
} from "@/features/rainbow-six-siege/types";

const RECENT_FEED_COUNT = 8;

/**
 * De daadwerkelijke Big Screen-presentatie + databronnen/Realtime voor
 * PRECIES één sessie — losgetrokken uit de oorspronkelijke, sessie-
 * gebonden pagina (RainbowSixSiegeBigScreen.tsx) zodat 'm ook gebruikt kan
 * worden door RainbowSixSiegeAutoBigScreen.tsx (de permanente
 * `/rainbow-six-siege/big-screen`-route, die zelf de actieve sessionId
 * bepaalt — zie useR6ActiveSessionWatch). Geen tweede implementatie:
 * beide routes renderen precies dit component, alleen de bron van
 * `sessionId` verschilt.
 *
 * De aanroeper is verantwoordelijk voor het volledig ont-/hermonteren van
 * dit component bij een sessionId-wijziging (bv. via React's `key`-prop) —
 * dat is de eenvoudigste, meest robuuste manier om te garanderen dat er
 * nooit data van de vorige sessie doorschemert en dat oude Realtime-
 * subscriptions altijd opgeruimd worden (React's eigen cleanup-mechanisme
 * i.p.v. handmatige reset-logica hier).
 */
export function RainbowSixSiegeBigScreenContent({
  sessionId,
  loadingLabel = "Laden…",
}: {
  sessionId: string;
  loadingLabel?: string;
}) {
  const [session, setSession] = useState<R6Session | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<R6SessionPlayer[]>([]);
  const [matches, setMatches] = useState<R6Match[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<R6MatchPlayer[]>([]);
  const [events, setEvents] = useState<R6Event[]>([]);
  const [operatorAssignments, setOperatorAssignments] = useState<R6GameOperatorAssignment[]>([]);
  const [sessionChaosEffects, setSessionChaosEffects] = useState<R6SessionChaosEffect[]>([]);
  const [maps, setMaps] = useState<R6Map[]>([]);
  const [operators, setOperators] = useState<R6Operator[]>([]);
  const [chaosEffects, setChaosEffects] = useState<R6ChaosEffect[]>([]);
  const [challenges, setChallenges] = useState<R6Challenge[]>([]);
  const [scoreRules, setScoreRules] = useState<R6ScoreRule[]>(FALLBACK_SCORE_RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const [detail, ops, mps, chall, rules, chaosCatalog] = await Promise.all([
          fetchR6SessionDetail(sessionId),
          fetchR6Operators(),
          fetchR6Maps(),
          fetchR6Challenges(),
          fetchR6ScoreRules().catch(() => []),
          fetchR6ChaosEffects().catch(() => []),
        ]);
        if (cancelled) return;
        setSession(detail.session);
        setSessionPlayers(detail.sessionPlayers);
        setMatches(detail.matches);
        setMatchPlayers(detail.matchPlayers);
        setEvents(detail.events);
        setOperators(ops);
        setMaps(mps);
        setChallenges(chall);
        setScoreRules(rules.length > 0 ? rules : FALLBACK_SCORE_RULES);
        setChaosEffects(chaosCatalog);

        const [assignments, sce] = await Promise.all([
          fetchR6GameOperatorAssignmentsForMatches(detail.matches.map((m) => m.id)),
          fetchR6SessionChaosEffects(sessionId),
        ]);
        if (cancelled) return;
        setOperatorAssignments(assignments);
        setSessionChaosEffects(sce);
        setLoading(false);
      } catch {
        // Meest voorkomende oorzaak: de sessie bestaat niet (meer) — bv. een
        // gebookmarkte sessiespecifieke link nadat de LAN verwijderd is, of
        // (bij de automatische route) een LAN die tussen het vinden van de
        // actieve sessionId en het laden van de details alweer verwijderd
        // is. Zonder deze catch bleef de pagina voorheen voor altijd op
        // "Laden…" hangen (onafgehandelde promise-rejection).
        if (!cancelled) {
          setError("Deze LAN kon niet geladen worden — mogelijk bestaat de sessie niet meer.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Realtime — alleen actief zolang de LAN live is; stopt vanzelf (cleanup
  // hieronder) zodra status naar 'completed' wisselt.
  useEffect(() => {
    if (!sessionId || !session || session.status !== "live") return;

    const channel = supabase
      .channel(`r6-big-screen-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "r6_events", filter: `session_id=eq.${sessionId}` },
        (payload) => setEvents((prev) => [...prev, payload.new as R6Event]),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "r6_events", filter: `session_id=eq.${sessionId}` },
        (payload) => setEvents((prev) => prev.filter((e) => e.id !== (payload.old as { id: string }).id)),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "r6_matches", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setMatches((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id));
            return;
          }
          const next = payload.new as R6Match;
          setMatches((prev) => (prev.some((m) => m.id === next.id) ? prev.map((m) => (m.id === next.id ? next : m)) : [...prev, next]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "r6_sessions", filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new as R6Session),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "r6_game_operator_assignments", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setOperatorAssignments((prev) => prev.filter((a) => a.id !== (payload.old as { id: string }).id));
            return;
          }
          const next = payload.new as R6GameOperatorAssignment;
          setOperatorAssignments((prev) => (prev.some((a) => a.id === next.id) ? prev.map((a) => (a.id === next.id ? next : a)) : [...prev, next]));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "r6_session_chaos_effects", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSessionChaosEffects((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
            return;
          }
          const next = payload.new as R6SessionChaosEffect;
          setSessionChaosEffects((prev) => (prev.some((c) => c.id === next.id) ? prev.map((c) => (c.id === next.id ? next : c)) : [...prev, next]));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.status]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      // Bewust op de hele document i.p.v. de eigen root-div: mocht hier
      // ooit een Portal-gebaseerd overlay (Dialog/Sheet) bijkomen, dan
      // rendert die naar document.body — zou alleen de root-div fullscreen
      // zijn, dan valt zo'n overlay buiten de fullscreen-boomstructuur en
      // wordt 'm onzichtbaar/niet-interactief (zelfde bug die de Tablet
      // Controller had).
      document.documentElement.requestFullscreen?.();
    }
  }

  if (error) {
    return (
      <div className="r6-theme flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-zinc-400">
        <p className="font-serif text-xl text-rose-400">{error}</p>
      </div>
    );
  }

  if (loading || !session || !sessionId) {
    return (
      <div className="r6-theme flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="font-serif text-xl">{loadingLabel}</p>
      </div>
    );
  }

  const roster = sessionPlayers.map((sp) => sp.player);
  const scoreboard = computeScoreboard(roster, matches, matchPlayers, challenges, scoreRules, events);
  const currentMatch = matches.length > 0 ? [...matches].sort((a, b) => b.match_number - a.match_number)[0] : null;
  const currentMap = currentMatch?.map_id ? maps.find((m) => m.id === currentMatch.map_id) : null;
  const activeChaos = currentMatch
    ? sessionChaosEffects.find((sce) => sce.match_id === currentMatch.id && sce.chaos_effect_id)
    : undefined;
  const activeChaosName = activeChaos?.chaos_effect_id ? chaosEffects.find((c) => c.id === activeChaos.chaos_effect_id)?.name : null;
  const operatorsById = new Map(operators.map((o) => [o.id, o]));
  const assignmentByPlayerId = new Map(
    currentMatch ? operatorAssignments.filter((a) => a.match_id === currentMatch.id).map((a) => [a.player_id, a]) : [],
  );
  const recentEvents = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, RECENT_FEED_COUNT);
  const playerNameById = new Map(roster.map((p) => [p.id, p.name]));
  const scoreRuleByCode = new Map(scoreRules.map((r) => [r.code, r]));
  const isLive = session.status === "live";
  const winner = !isLive && scoreboard.length > 0 ? scoreboard[0] : null;

  return (
    <div className="r6-theme min-h-screen bg-zinc-950 p-6 sm:p-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold uppercase tracking-wide text-zinc-100 sm:text-5xl">{session.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
              <span className={`rounded-sm border px-2 py-0.5 font-semibold uppercase tracking-wide ${isLive ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-900 text-zinc-300"}`}>
                {isLive ? "Live" : "Operation Complete"}
              </span>
              {currentMatch && <span>Game {currentMatch.match_number}</span>}
              {currentMap && <span>{currentMap.name}</span>}
              {activeChaosName && <span className="font-semibold text-amber-400">{activeChaosName}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-amber-400"
            aria-label="Fullscreen"
          >
            <Maximize className="h-5 w-5" />
          </button>
        </div>

        {winner && (
          <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-amber-400/70">Winnaar</p>
            <p className="font-serif text-4xl font-bold uppercase text-amber-400">{winner.player.name}</p>
          </div>
        )}

        <div className="space-y-3">
          {scoreboard.map((entry, index) => {
            const assignment = assignmentByPlayerId.get(entry.player.id);
            const attackerName = assignment?.attacker_operator_id ? operatorsById.get(assignment.attacker_operator_id)?.name : null;
            const defenderName = assignment?.defender_operator_id ? operatorsById.get(assignment.defender_operator_id)?.name : null;
            return (
              <div
                key={entry.player.id}
                className="flex items-center gap-4 rounded-sm border border-zinc-800 bg-zinc-900/60 px-6 py-4 transition-all"
              >
                <span className={`w-10 shrink-0 text-center font-serif text-2xl font-bold ${index === 0 ? "text-amber-400" : "text-zinc-500"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-2xl font-bold uppercase text-zinc-100 sm:text-4xl">{entry.player.name}</p>
                  {(attackerName || defenderName) && (
                    <p className="text-xs font-semibold text-amber-400 sm:text-sm">
                      {attackerName ?? "—"} / {defenderName ?? "—"}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-serif text-4xl font-bold text-amber-400 sm:text-6xl">{entry.totalPoints}</span>
              </div>
            );
          })}
        </div>

        {isLive && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Laatste acties</p>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-zinc-500">Nog geen acties geregistreerd.</p>
            ) : (
              recentEvents.map((event) => {
                const rule = scoreRuleByCode.get(event.score_rule_code);
                return (
                  <div key={event.id} className="flex items-center justify-between rounded-sm border border-zinc-800 bg-zinc-900/40 px-4 py-1.5 text-sm">
                    <span className="font-semibold uppercase text-zinc-200">{playerNameById.get(event.player_id) ?? "Onbekend"}</span>
                    <span className="text-zinc-400">{rule?.name ?? event.score_rule_code}</span>
                    <span className="font-semibold text-amber-400">
                      {event.points_awarded >= 0 ? "+" : ""}
                      {event.points_awarded}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
