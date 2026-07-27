import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useR6Challenges, useR6Maps, useR6Operators } from "@/features/rainbow-six-siege/hooks/useR6Reference";
import { useCreateR6Match, useUpdateR6Match } from "@/features/rainbow-six-siege/hooks/useR6SessionDetail";
import { R6MatchPlayerFields } from "@/features/rainbow-six-siege/components/R6MatchPlayerFields";
import { pickerOptions } from "@/features/rainbow-six-siege/lib/reference";
import {
  buildR6NewMatchInput,
  buildR6UpdateMatchInput,
  emptyR6MatchPlayerFormState,
  type R6MatchGeneralFormState,
  type R6MatchPlayerFormState,
} from "@/features/rainbow-six-siege/lib/matchForm";
import type { R6Match, R6MatchPlayer, R6MatchResult, R6Player } from "@/features/rainbow-six-siege/types";

const NONE = "none";

const RESULT_OPTIONS: { value: R6MatchResult; label: string }[] = [
  { value: "win", label: "Gewonnen" },
  { value: "loss", label: "Verloren" },
  { value: "draw", label: "Gelijkspel" },
  { value: "unknown", label: "Onbekend" },
];

function emptyGeneralState(): R6MatchGeneralFormState {
  return {
    mapId: "",
    result: "unknown",
    challengeId: "",
    challengeCompleted: false,
    chaosRule: "",
    funniestMoment: "",
    notes: "",
    mvpPlayerId: "",
    mvpReason: "",
  };
}

function generalStateFromMatch(match: R6Match): R6MatchGeneralFormState {
  return {
    mapId: match.map_id ?? "",
    result: match.result,
    challengeId: match.challenge_id ?? "",
    challengeCompleted: match.challenge_completed,
    chaosRule: match.chaos_rule ?? "",
    funniestMoment: match.funniest_moment ?? "",
    notes: match.notes ?? "",
    mvpPlayerId: match.mvp_player_id ?? "",
    mvpReason: match.mvp_reason ?? "",
  };
}

function playerStateFromExisting(playerId: string, row: R6MatchPlayer | undefined): R6MatchPlayerFormState {
  if (!row) return emptyR6MatchPlayerFormState(playerId);
  return {
    playerId,
    operatorAttackerId: row.operator_attacker_id ?? "",
    operatorDefenderId: row.operator_defender_id ?? "",
    operatorSingleId: row.operator_single_id ?? "",
    kills: String(row.kills),
    deaths: String(row.deaths),
    assists: String(row.assists),
    revives: String(row.revives),
    headshots: String(row.headshots),
    clutch: row.clutch,
    ace: row.ace,
  };
}

export function R6MatchForm({
  open,
  onOpenChange,
  sessionId,
  roster,
  existingMatch,
  existingMatchPlayers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  roster: R6Player[];
  /** Aanwezig = bewerkmodus van een bestaande match; afwezig = nieuwe match. */
  existingMatch?: R6Match;
  existingMatchPlayers?: R6MatchPlayer[];
}) {
  const isEditMode = !!existingMatch;
  const { data: maps = [] } = useR6Maps();
  const { data: operators = [] } = useR6Operators();
  const { data: challenges = [] } = useR6Challenges();
  const createMatch = useCreateR6Match(sessionId);
  const updateMatch = useUpdateR6Match(sessionId);
  const pending = isEditMode ? updateMatch.isPending : createMatch.isPending;
  const isError = isEditMode ? updateMatch.isError : createMatch.isError;

  const [general, setGeneral] = useState<R6MatchGeneralFormState>(emptyGeneralState());
  const [playerStates, setPlayerStates] = useState<R6MatchPlayerFormState[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (existingMatch) {
      setGeneral(generalStateFromMatch(existingMatch));
      setPlayerStates(roster.map((p) => playerStateFromExisting(p.id, existingMatchPlayers?.find((mp) => mp.player_id === p.id))));
    } else {
      setGeneral(emptyGeneralState());
      setPlayerStates(roster.map((p) => emptyR6MatchPlayerFormState(p.id)));
    }
    setError(null);
    createMatch.reset();
    updateMatch.reset();
    // Alleen bij het openen (her)initialiseren, niet bij elke roster-wijziging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingMatch?.id]);

  const selectedOperatorIds = playerStates.flatMap((p) => [p.operatorAttackerId, p.operatorDefenderId, p.operatorSingleId]);
  const pickerOperators = useMemo(() => pickerOptions(operators, selectedOperatorIds), [operators, selectedOperatorIds]);
  const attackerOperators = pickerOperators.filter((o) => o.side === "attacker");
  const defenderOperators = pickerOperators.filter((o) => o.side === "defender");
  const pickerMaps = useMemo(() => pickerOptions(maps, [general.mapId]), [maps, general.mapId]);
  const pickerChallenges = useMemo(() => pickerOptions(challenges, [general.challengeId]), [challenges, general.challengeId]);

  function updatePlayerState(index: number, next: R6MatchPlayerFormState) {
    setPlayerStates((prev) => prev.map((p, i) => (i === index ? next : p)));
  }

  async function handleSubmit() {
    setError(null);
    try {
      if (isEditMode && existingMatch) {
        await updateMatch.mutateAsync(buildR6UpdateMatchInput(existingMatch.id, sessionId, general, playerStates));
      } else {
        await createMatch.mutateAsync(buildR6NewMatchInput(sessionId, general, playerStates));
      }
      onOpenChange(false);
    } catch {
      // isError van de mutatie toont al een melding; hier niets extra's nodig.
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl text-zinc-100">
            {isEditMode ? `Match ${existingMatch?.match_number} bewerken` : "Nieuwe match registreren"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-zinc-300">Map (optioneel)</label>
            <Select value={general.mapId || NONE} onValueChange={(v) => setGeneral((g) => ({ ...g, mapId: v === NONE ? "" : v }))}>
              <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectValue placeholder="Onbekend" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value={NONE} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                  Onbekend
                </SelectItem>
                {pickerMaps.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                    {m.name}
                    {!m.is_active && <span className="text-zinc-500"> (niet meer actief)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-300">Resultaat (gezamenlijk — jullie spelen in hetzelfde team)</label>
            <div className="flex flex-wrap overflow-hidden rounded-full border border-zinc-700">
              {RESULT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGeneral((g) => ({ ...g, result: opt.value }))}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    general.result === opt.value ? "bg-amber-500/20 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Dit resultaat telt niet mee voor de onderlinge LAN-score — alleen voor statistieken.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-300">Challenge</label>
            <Select
              value={general.challengeId || NONE}
              onValueChange={(v) =>
                setGeneral((g) => ({ ...g, challengeId: v === NONE ? "" : v, challengeCompleted: v === NONE ? false : g.challengeCompleted }))
              }
            >
              <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectValue placeholder="Geen" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value={NONE} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                  Geen
                </SelectItem>
                {pickerChallenges.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                    {c.name}
                    {!c.is_active && <span className="text-zinc-500"> (niet meer actief)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {general.challengeId && (
              <label className="mt-1 flex items-center gap-2 text-sm text-zinc-300">
                <Checkbox
                  checked={general.challengeCompleted}
                  onCheckedChange={(c) => setGeneral((g) => ({ ...g, challengeCompleted: c === true }))}
                />
                Challenge gehaald
              </label>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-300">Chaos-regel (optioneel)</label>
            <Textarea
              value={general.chaosRule}
              onChange={(e) => setGeneral((g) => ({ ...g, chaosRule: e.target.value }))}
              placeholder="Bv. Iedereen crouch only"
              className="min-h-9 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-300">Spelers</p>
            {playerStates.map((state, i) => (
              <R6MatchPlayerFields
                key={state.playerId}
                playerName={roster.find((p) => p.id === state.playerId)?.name ?? "Onbekend"}
                value={state}
                onChange={(next) => updatePlayerState(i, next)}
                attackerOperators={attackerOperators}
                defenderOperators={defenderOperators}
                allOperators={pickerOperators}
              />
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-300">MVP (optioneel, hoogstens één per match)</label>
            <Select value={general.mvpPlayerId || NONE} onValueChange={(v) => setGeneral((g) => ({ ...g, mvpPlayerId: v === NONE ? "" : v }))}>
              <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectValue placeholder="Geen" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                <SelectItem value={NONE} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                  Geen
                </SelectItem>
                {roster.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {general.mvpPlayerId && (
              <Input
                value={general.mvpReason}
                onChange={(e) => setGeneral((g) => ({ ...g, mvpReason: e.target.value }))}
                placeholder="MVP-reden (optioneel)"
                className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
              />
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-300">Grappigste moment (optioneel)</label>
            <Textarea
              value={general.funniestMoment}
              onChange={(e) => setGeneral((g) => ({ ...g, funniestMoment: e.target.value }))}
              placeholder="Bv. Bro sprong per ongeluk van het dak."
              className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-zinc-300">Notities (optioneel)</label>
            <Textarea
              value={general.notes}
              onChange={(e) => setGeneral((g) => ({ ...g, notes: e.target.value }))}
              className="min-h-9 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {isError && <p className="text-sm text-rose-400">Opslaan mislukt. Probeer opnieuw.</p>}
        </div>

        <SheetFooter className="mt-6">
          <Button type="button" className="bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditMode ? "Wijzigingen opslaan" : "Match opslaan"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
