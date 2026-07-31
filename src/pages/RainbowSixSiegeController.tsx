import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { R6TabletController } from "@/features/rainbow-six-siege/components/R6TabletController";
import { R6EndGameSheet } from "@/features/rainbow-six-siege/components/R6EndGameSheet";
import { useR6SessionDetail } from "@/features/rainbow-six-siege/hooks/useR6SessionDetail";
import { useR6Challenges, useR6Maps, useR6Operators, useR6ScoreRules } from "@/features/rainbow-six-siege/hooks/useR6Reference";
import { useLatestR6Match, useR6Events, useRecordR6Event, useStartR6Round } from "@/features/rainbow-six-siege/hooks/useR6Events";
import { useR6GameOperatorAssignmentsForMatches } from "@/features/rainbow-six-siege/hooks/useR6OperatorWheel";
import { useAcceptR6ChaosEffect, useR6ChaosEffects, useR6SessionChaosEffects } from "@/features/rainbow-six-siege/hooks/useR6ChaosEffects";
import { useR6SessionRealtimeSync } from "@/features/rainbow-six-siege/hooks/useR6SessionRealtimeSync";
import { computeScoreboard } from "@/features/rainbow-six-siege/lib/scoring";
import type { R6ScoreRule } from "@/features/rainbow-six-siege/types";

/**
 * Dunne data-/orchestratielaag — zelfde hooks en mutaties als
 * RainbowSixSiegeSession.tsx (bewust hergebruikt, niet herbouwd), maar
 * gecomponeerd voor de tabletgerichte R6TabletController i.p.v. de
 * responsieve desktop-layout. Zie R6TabletController.tsx voor de layout
 * zelf.
 */
export default function RainbowSixSiegeController() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [endGameOpen, setEndGameOpen] = useState(false);

  const { data: detail, isLoading, isError } = useR6SessionDetail(sessionId);
  const { data: maps = [] } = useR6Maps();
  const { data: operators = [] } = useR6Operators();
  const { data: challenges = [] } = useR6Challenges();
  const { rules: scoreRules } = useR6ScoreRules();

  const { data: liveEvents = [] } = useR6Events(sessionId ?? "");
  const latestMatchQuery = useLatestR6Match(sessionId ?? "");
  const startRound = useStartR6Round(sessionId ?? "");
  const recordEvent = useRecordR6Event(sessionId ?? "");
  const currentMatch = latestMatchQuery.data ?? null;

  const { data: chaosEffects = [] } = useR6ChaosEffects();
  const { data: sessionChaosEffects = [] } = useR6SessionChaosEffects(sessionId ?? "");
  const acceptChaosEffect = useAcceptR6ChaosEffect(sessionId ?? "");

  const matchIds = useMemo(() => (detail ? detail.matches.map((m) => m.id) : []), [detail]);
  const { data: operatorAssignments = [] } = useR6GameOperatorAssignmentsForMatches(matchIds);

  const isLive = detail?.session.status === "live";
  useR6SessionRealtimeSync(sessionId, !!isLive);

  const roster = useMemo(() => (detail?.sessionPlayers ?? []).map((sp) => sp.player), [detail]);
  const events = useMemo(() => (isLive ? liveEvents : (detail?.events ?? [])), [isLive, liveEvents, detail]);

  const scoreboard = useMemo(() => {
    if (!detail) return [];
    return computeScoreboard(roster, detail.matches, detail.matchPlayers, challenges, scoreRules, events);
  }, [detail, roster, challenges, scoreRules, events]);

  const quickActions = useMemo(
    () => scoreRules.filter((r) => r.is_quick_action && r.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [scoreRules],
  );

  // Zelfde bescherming als op de normale sessiepagina: bij een live LAN
  // zonder enkele game wordt "Game 1" precies één keer automatisch gestart.
  const autoStartedForSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isLive || !sessionId) return;
    if (!latestMatchQuery.isSuccess || latestMatchQuery.data !== null) return;
    if (autoStartedForSessionRef.current === sessionId) return;
    autoStartedForSessionRef.current = sessionId;
    startRound.mutate();
  }, [isLive, sessionId, latestMatchQuery.isSuccess, latestMatchQuery.data, startRound]);

  function handleTap(playerId: string, rule: R6ScoreRule) {
    if (!currentMatch || !sessionId) return;
    recordEvent.mutate({ matchId: currentMatch.id, playerId, scoreRuleCode: rule.code, optimisticPoints: rule.points });
  }

  function handleAcceptChaosEffect(chaosEffectId: string) {
    if (!currentMatch) return;
    acceptChaosEffect.mutate({ matchId: currentMatch.id, chaosEffectId });
  }

  const activeChaosEffectId = currentMatch
    ? (sessionChaosEffects.find((sce) => sce.match_id === currentMatch.id)?.chaos_effect_id ?? null)
    : null;

  if (!sessionId) {
    return (
      <div className="r6-theme flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <p className="font-serif text-lg">Geen LAN geselecteerd.</p>
        <Link to="/rainbow-six-siege" className="text-sm text-amber-400 underline">
          Terug naar Rainbow Six Siege
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="r6-theme flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="r6-theme flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <p className="font-serif text-lg">Deze LAN kon niet gevonden worden.</p>
        <Link to="/rainbow-six-siege" className="text-sm text-amber-400 underline">
          Terug naar Rainbow Six Siege
        </Link>
      </div>
    );
  }

  return (
    <>
      <R6TabletController
        sessionId={sessionId}
        session={detail.session}
        roster={roster}
        scoreboard={scoreboard}
        quickActions={quickActions}
        scoreRules={scoreRules}
        currentMatch={currentMatch}
        matches={detail.matches}
        events={events}
        maps={maps}
        operators={operators}
        operatorAssignments={operatorAssignments}
        chaosEffects={chaosEffects}
        activeChaosEffectId={activeChaosEffectId}
        onTap={handleTap}
        onAcceptChaosEffect={handleAcceptChaosEffect}
        isAcceptingChaosEffect={acceptChaosEffect.isPending}
        onEndGame={() => setEndGameOpen(true)}
      />

      {isLive && currentMatch && (
        <R6EndGameSheet
          open={endGameOpen}
          onOpenChange={setEndGameOpen}
          sessionId={sessionId}
          currentMatch={currentMatch}
          roster={roster}
          maps={maps}
          onEnded={() => setEndGameOpen(false)}
        />
      )}
    </>
  );
}
