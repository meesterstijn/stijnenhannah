import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { History, Loader2, Plus, Radio, RotateCcw, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { R6MatchCard } from "@/features/rainbow-six-siege/components/R6MatchCard";
import { R6MatchForm } from "@/features/rainbow-six-siege/components/R6MatchForm";
import { R6SessionSettings } from "@/features/rainbow-six-siege/components/R6SessionSettings";
import { R6SessionMediaGallery } from "@/features/rainbow-six-siege/components/R6SessionMediaGallery";
import { R6AfterActionReport } from "@/features/rainbow-six-siege/components/R6AfterActionReport";
import { R6LiveDashboard } from "@/features/rainbow-six-siege/components/R6LiveDashboard";
import { R6EndGameSheet } from "@/features/rainbow-six-siege/components/R6EndGameSheet";
import {
  useAddR6SessionPlayer,
  useDeleteR6Match,
  useR6SessionDetail,
  useRemoveR6SessionPlayer,
} from "@/features/rainbow-six-siege/hooks/useR6SessionDetail";
import {
  useDeleteR6Session,
  useEndR6Session,
  useReopenR6Session,
  useUpdateR6SessionDetails,
} from "@/features/rainbow-six-siege/hooks/useR6Sessions";
import { useR6Challenges, useR6Maps, useR6Operators, useR6ScoreRules } from "@/features/rainbow-six-siege/hooks/useR6Reference";
import {
  useLatestR6Match,
  useR6Events,
  useRecordR6Event,
  useStartR6Round,
  useUndoR6Event,
} from "@/features/rainbow-six-siege/hooks/useR6Events";
import { computeScoreboard } from "@/features/rainbow-six-siege/lib/scoring";
import type { R6Match, R6ScoreRule } from "@/features/rainbow-six-siege/types";

function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}u ${minutes}m`;
}

export default function RainbowSixSiegeSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<"live" | "geschiedenis">("live");
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<R6Match | null>(null);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [endGameOpen, setEndGameOpen] = useState(false);
  const [justEndedGameNumber, setJustEndedGameNumber] = useState<number | null>(null);

  const { data: detail, isLoading } = useR6SessionDetail(sessionId);
  const { data: maps = [] } = useR6Maps();
  const { data: operators = [] } = useR6Operators();
  const { data: challenges = [] } = useR6Challenges();
  const { rules: scoreRules, usingFallback: usingFallbackRules } = useR6ScoreRules();
  const endSession = useEndR6Session();
  const reopenSession = useReopenR6Session();
  const updateSessionDetails = useUpdateR6SessionDetails();
  const deleteSession = useDeleteR6Session();
  const deleteMatch = useDeleteR6Match(sessionId ?? "");
  const addSessionPlayer = useAddR6SessionPlayer(sessionId ?? "");
  const removeSessionPlayer = useRemoveR6SessionPlayer(sessionId ?? "");

  const { data: liveEvents = [] } = useR6Events(sessionId ?? "");
  const latestMatchQuery = useLatestR6Match(sessionId ?? "");
  const startRound = useStartR6Round(sessionId ?? "");
  const recordEvent = useRecordR6Event(sessionId ?? "");
  const undoEvent = useUndoR6Event(sessionId ?? "");
  const currentMatch = latestMatchQuery.data ?? null;

  const mapsById = useMemo(() => new Map(maps.map((m) => [m.id, m])), [maps]);
  const operatorsById = useMemo(() => new Map(operators.map((o) => [o.id, o])), [operators]);
  const challengesById = useMemo(() => new Map(challenges.map((c) => [c.id, c])), [challenges]);
  const playersById = useMemo(
    () => new Map((detail?.sessionPlayers ?? []).map((sp) => [sp.player_id, sp.player])),
    [detail],
  );
  const roster = useMemo(() => (detail?.sessionPlayers ?? []).map((sp) => sp.player), [detail]);
  const isLive = detail?.session.status === "live";

  // Zolang de sessie live is, komen de gebeurtenissen uit de live-query
  // (met optimistische updates voor directe tik-feedback). Na afronden
  // wordt er niet meer getikt, dus dan volstaat de al-opgehaalde, statische
  // events-lijst uit het sessiedetail.
  const events = isLive ? liveEvents : (detail?.events ?? []);

  const scoreboard = useMemo(() => {
    if (!detail) return [];
    return computeScoreboard(roster, detail.matches, detail.matchPlayers, challenges, scoreRules, events);
  }, [detail, roster, challenges, scoreRules, events]);

  const quickActions = useMemo(
    () => scoreRules.filter((r) => r.is_quick_action && r.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [scoreRules],
  );

  // Zodra een LAN live is maar nog geen enkele Gimma heeft, wordt "Gimma 1"
  // automatisch aangemaakt — de gebruiker begint direct bij het scorebord,
  // niet bij een "nieuwe Gimma starten"-formulier. Elke volgende Gimma start
  // op dezelfde manier automatisch, als onderdeel van "Gimma afronden" (zie
  // R6EndGameSheet.onEnded hieronder) — er is verder nergens een losse
  // "nieuwe Gimma"-knop nodig.
  //
  // De ref hieronder voorkomt dat dit tweemaal een Gimma aanmaakt (bug: een
  // verse LAN begon bij "Gimma 2" i.p.v. "Gimma 1"). Oorzaak: React
  // StrictMode voert effects in ontwikkeling twee keer na elkaar uit, zonder
  // dat daar een render tussen zit — `startRound.isPending` staat in beide
  // aanroepen dus nog op de oude `false`-waarde, waardoor `mutate()` alsnog
  // twee keer werd aangeroepen vóórdat de query kon bijwerken. De ref wordt
  // synchroon gezet vóórdat `mutate()` wordt aangeroepen, dus een tweede
  // aanroep binnen dezelfde tick ziet 'm al staan en doet niets.
  const autoStartedForSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isLive || !sessionId) return;
    if (!latestMatchQuery.isSuccess || latestMatchQuery.data !== null) return;
    if (autoStartedForSessionRef.current === sessionId) return;
    autoStartedForSessionRef.current = sessionId;
    startRound.mutate();
  }, [isLive, sessionId, latestMatchQuery.isSuccess, latestMatchQuery.data, startRound]);

  if (isLoading || !detail || !sessionId) {
    return (
      <div className="flex justify-center py-20 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const { session, matches, matchPlayers } = detail;

  function openCreateMatch() {
    setEditingMatch(null);
    setMatchFormOpen(true);
  }

  function openEditMatch(match: R6Match) {
    setEditingMatch(match);
    setMatchFormOpen(true);
  }

  async function handleDeleteSession() {
    await deleteSession.mutateAsync(session.id);
    navigate("/rainbow-six-siege/lan");
  }

  function handleTap(playerId: string, rule: R6ScoreRule) {
    if (!currentMatch) return;
    setPendingPlayerId(playerId);
    recordEvent.mutate(
      { matchId: currentMatch.id, playerId, scoreRuleCode: rule.code, optimisticPoints: rule.points },
      { onSettled: () => setPendingPlayerId(null) },
    );
  }

  return (
    <div className="space-y-4">
      {usingFallbackRules && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          De puntregels konden niet uit de database geladen worden — dit scorebord gebruikt tijdelijk de standaardwaarden.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Status</p>
          <p className={`font-serif text-lg font-semibold ${isLive ? "text-amber-400" : "text-zinc-100"}`}>
            {isLive ? "LIVE" : "Afgerond"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Datum</p>
          <p className="font-serif text-lg font-semibold text-zinc-100">
            {new Date(session.started_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Looptijd</p>
          <p className="font-serif text-lg font-semibold text-zinc-100">{formatDuration(session.started_at, session.ended_at)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500">Gimma's</p>
          <p className="font-serif text-lg font-semibold text-zinc-100">{matches.length}</p>
        </div>
      </div>

      {session.notes && !isLive && (
        <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">{session.notes}</p>
      )}

      {justEndedGameNumber !== null && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Gimma {justEndedGameNumber} afgerond — Gimma {justEndedGameNumber + 1} gestart!
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {isLive ? (
          <div className="flex gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 p-1">
            <button
              type="button"
              onClick={() => setView("live")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${view === "live" ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <Radio className="h-3.5 w-3.5" /> Live
            </button>
            <button
              type="button"
              onClick={() => setView("geschiedenis")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${view === "geschiedenis" ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <History className="h-3.5 w-3.5" /> Geschiedenis
            </button>
          </div>
        ) : (
          <div />
        )}

        <div className="flex flex-wrap gap-2">
          {isLive ? (
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setConfirmEndOpen(true)}
            >
              <Square className="h-4 w-4" /> LAN beëindigen
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setConfirmReopenOpen(true)}
            >
              <RotateCcw className="h-4 w-4" /> LAN heropenen
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-rose-500/40 bg-transparent text-rose-400 hover:bg-rose-500/10"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> LAN verwijderen
          </Button>
        </div>
      </div>

      {isLive && view === "live" && (
        <R6LiveDashboard
          scoreboard={scoreboard}
          roster={roster}
          quickActions={quickActions}
          players={playersById}
          currentMatch={currentMatch}
          events={events}
          onTap={handleTap}
          onUndo={(eventId) => undoEvent.mutate(eventId)}
          onEndGame={() => setEndGameOpen(true)}
          pendingPlayerId={pendingPlayerId}
        />
      )}

      {isLive && currentMatch && (
        <R6EndGameSheet
          open={endGameOpen}
          onOpenChange={setEndGameOpen}
          sessionId={session.id}
          currentMatch={currentMatch}
          roster={roster}
          maps={maps}
          onEnded={(endedGameNumber) => {
            setJustEndedGameNumber(endedGameNumber);
            setTimeout(() => setJustEndedGameNumber(null), 4000);
          }}
        />
      )}

      {isLive && view === "geschiedenis" && (
        <>
          <R6SessionSettings
            session={session}
            sessionPlayers={detail.sessionPlayers}
            onUpdateDetails={(input) => updateSessionDetails.mutateAsync({ sessionId: session.id, ...input })}
            onAddPlayer={async (name) => {
              await addSessionPlayer.mutateAsync(name);
            }}
            onRemovePlayer={(playerId) => removeSessionPlayer.mutateAsync(playerId)}
          />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-serif text-lg font-semibold text-zinc-100">Gespeelde Gimma's</p>
              <Button type="button" className="bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={openCreateMatch}>
                <Plus className="h-4 w-4" /> Gimma toevoegen
              </Button>
            </div>
            {/* De actief lopende Gimma is nog een kale container zonder afgeronde
                gegevens (zie R6EndGameSheet) — die hoort hier pas thuis zodra
                "Gimma afronden" 'm heeft afgesloten, anders staat er verwarrend
                een Gimma met "Onbekend" resultaat en 0 stats tussen. */}
            {matches.filter((m) => m.id !== currentMatch?.id).length === 0 ? (
              <p className="text-sm text-zinc-400">Nog geen Gimma's geregistreerd.</p>
            ) : (
              <div className="space-y-3">
                {matches.filter((m) => m.id !== currentMatch?.id).map((match) => (
                  <R6MatchCard
                    key={match.id}
                    match={match}
                    matchPlayers={matchPlayers.filter((mp) => mp.match_id === match.id)}
                    players={playersById}
                    maps={mapsById}
                    operators={operatorsById}
                    challenges={challengesById}
                    canEdit={isLive}
                    onEdit={() => openEditMatch(match)}
                    onDelete={() => deleteMatch.mutateAsync(match.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <p className="font-serif text-lg font-semibold text-zinc-100">Foto's</p>
            <R6SessionMediaGallery sessionId={session.id} matches={matches} editable />
          </section>
        </>
      )}

      {!isLive && (
        <R6AfterActionReport
          session={session}
          matches={matches}
          matchPlayers={matchPlayers}
          scoreboard={scoreboard}
          maps={mapsById}
          operators={operatorsById}
          challenges={challengesById}
          scoreRules={scoreRules}
        />
      )}

      {isLive && (
        <R6MatchForm
          open={matchFormOpen}
          onOpenChange={setMatchFormOpen}
          sessionId={session.id}
          roster={roster}
          existingMatch={editingMatch ?? undefined}
          existingMatchPlayers={editingMatch ? matchPlayers.filter((mp) => mp.match_id === editingMatch.id) : undefined}
        />
      )}

      <Dialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <DialogContent className="r6-theme border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-zinc-100">Weet je zeker dat je deze LAN wilt beëindigen?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              De eindbonussen worden definitief berekend en de sessie wordt alleen-lezen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setConfirmEndOpen(false)}
              disabled={endSession.isPending}
            >
              Annuleer
            </Button>
            <Button
              type="button"
              className="bg-rose-500 text-zinc-950 hover:bg-rose-400"
              disabled={endSession.isPending}
              onClick={() => endSession.mutate(session.id, { onSuccess: () => setConfirmEndOpen(false) })}
            >
              {endSession.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ja, beëindigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReopenOpen} onOpenChange={setConfirmReopenOpen}>
        <DialogContent className="r6-theme border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-zinc-100">LAN heropenen?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              De sessie wordt weer live: Gimma's toevoegen, bewerken en verwijderen wordt weer mogelijk, foto's zijn weer bewerkbaar en de
              eindbonussen worden weer als voorlopig getoond, totdat je opnieuw beëindigt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setConfirmReopenOpen(false)}
              disabled={reopenSession.isPending}
            >
              Annuleer
            </Button>
            <Button
              type="button"
              className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
              disabled={reopenSession.isPending}
              onClick={() => reopenSession.mutate(session.id, { onSuccess: () => setConfirmReopenOpen(false) })}
            >
              {reopenSession.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ja, heropenen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="r6-theme border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-zinc-100">Deze LAN volledig verwijderen?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Alle Gimma's, statistieken en foto's van "{session.name}" worden definitief verwijderd. Dit kan niet ongedaan gemaakt worden.
              {isLive && (
                <span className="mt-2 block font-medium text-rose-400">
                  Let op: deze LAN is nog LIVE. Weet je zeker dat je een actieve sessie wilt verwijderen in plaats van eerst te beëindigen?
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={deleteSession.isPending}
            >
              Annuleer
            </Button>
            <Button type="button" className="bg-rose-500 text-zinc-950 hover:bg-rose-400" onClick={handleDeleteSession} disabled={deleteSession.isPending}>
              {deleteSession.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Definitief verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
