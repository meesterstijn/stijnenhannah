import { useEffect, useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useR6Operators } from "@/features/rainbow-six-siege/hooks/useR6Reference";
import {
  useR6GameOperatorAssignments,
  useSaveR6GameOperatorAssignments,
} from "@/features/rainbow-six-siege/hooks/useR6OperatorWheel";
import type { R6Operator, R6Player } from "@/features/rainbow-six-siege/types";

type Assignment = { playerId: string; attackerId: string | null; defenderId: string | null };

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Wijst willekeurig één attacker en één defender per speler toe. Voorkomt
 * dubbele operators tussen spelers binnen dezelfde game door eerst te
 * schudden en dan sequentieel toe te kennen — zolang de actieve
 * operatorlijst minstens zo groot is als het aantal spelers krijgt iedereen
 * een unieke operator; is de lijst kleiner, dan wordt onvermijdelijk
 * hergebruikt (spec: "voor zover de beschikbare operatorlijst dat toelaat"). */
function randomAssign(roster: R6Player[], operators: R6Operator[]): Assignment[] {
  const attackers = shuffle(operators.filter((o) => o.side === "attacker" && o.is_active));
  const defenders = shuffle(operators.filter((o) => o.side === "defender" && o.is_active));
  return roster.map((player, i) => ({
    playerId: player.id,
    attackerId: attackers.length > 0 ? attackers[i % attackers.length].id : null,
    defenderId: defenders.length > 0 ? defenders[i % defenders.length].id : null,
  }));
}

export function R6OperatorWheel({
  sessionId,
  matchId,
  matchNumber,
  roster,
}: {
  sessionId: string;
  matchId: string;
  matchNumber: number;
  roster: R6Player[];
}) {
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState<Assignment[] | null>(null);
  const { data: operators = [] } = useR6Operators();
  const { data: savedAssignments = [] } = useR6GameOperatorAssignments(matchId);
  const saveAssignments = useSaveR6GameOperatorAssignments(matchId);

  const operatorsById = new Map(operators.map((o) => [o.id, o]));

  useEffect(() => {
    if (!open) {
      setProposal(null);
      return;
    }
    // Bij openen eerst de al opgeslagen toewijzingen tonen (zie spec:
    // "toon eerst de huidige toewijzingen"), pas overschreven na een
    // expliciete nieuwe "Verdeel operators" + "Accepteren".
    if (savedAssignments.length > 0) {
      setProposal(
        roster.map((player) => {
          const existing = savedAssignments.find((a) => a.player_id === player.id);
          return {
            playerId: player.id,
            attackerId: existing?.attacker_operator_id ?? null,
            defenderId: existing?.defender_operator_id ?? null,
          };
        }),
      );
    } else {
      setProposal(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matchId]);

  function handleDivide() {
    setProposal(randomAssign(roster, operators));
  }

  async function handleAccept() {
    if (!proposal) return;
    await saveAssignments.mutateAsync(
      proposal.map((a) => ({
        sessionId,
        matchId,
        playerId: a.playerId,
        attackerOperatorId: a.attackerId,
        defenderOperatorId: a.defenderId,
      })),
    );
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        onClick={() => setOpen(true)}
      >
        <Shuffle className="h-4 w-4" /> Operator Wheel
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="r6-theme w-full overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl text-zinc-100">Operator Wheel — Game {matchNumber}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {!proposal ? (
              <p className="text-sm text-zinc-400">Nog geen toewijzing voor deze game.</p>
            ) : (
              <div className="space-y-2">
                {proposal.map((a) => {
                  const player = roster.find((p) => p.id === a.playerId);
                  const attacker = a.attackerId ? operatorsById.get(a.attackerId) : null;
                  const defender = a.defenderId ? operatorsById.get(a.defenderId) : null;
                  return (
                    <div key={a.playerId} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <p className="font-serif text-base font-semibold text-zinc-100">{player?.name ?? "Onbekend"}</p>
                      <p className="text-xs text-zinc-400">
                        Attacker: <span className="font-semibold text-amber-400">{attacker?.name ?? "—"}</span>
                      </p>
                      <p className="text-xs text-zinc-400">
                        Defender: <span className="font-semibold text-amber-400">{defender?.name ?? "—"}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {!proposal ? (
              <Button type="button" className="w-full bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={handleDivide}>
                <Shuffle className="h-4 w-4" /> Verdeel operators
              </Button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={handleDivide}
                >
                  Opnieuw
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={() => setOpen(false)}
                >
                  Annuleren
                </Button>
                <Button type="button" className="bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={handleAccept} disabled={saveAssignments.isPending}>
                  {saveAssignments.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Accepteren
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
