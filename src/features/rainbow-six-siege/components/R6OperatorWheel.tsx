import { Loader2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useR6Operators } from "@/features/rainbow-six-siege/hooks/useR6Reference";
import { useSaveR6GameOperatorAssignments } from "@/features/rainbow-six-siege/hooks/useR6OperatorWheel";
import type { R6Operator, R6Player } from "@/features/rainbow-six-siege/types";

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
function randomAssign(roster: R6Player[], operators: R6Operator[]) {
  const attackers = shuffle(operators.filter((o) => o.side === "attacker" && o.is_active));
  const defenders = shuffle(operators.filter((o) => o.side === "defender" && o.is_active));
  return roster.map((player, i) => ({
    playerId: player.id,
    attackerId: attackers.length > 0 ? attackers[i % attackers.length].id : null,
    defenderId: defenders.length > 0 ? defenders[i % defenders.length].id : null,
  }));
}

// Geen modal meer — één tik verdeelt en slaat direct nieuwe, willekeurige
// operators op voor iedereen in de actieve game. De toewijzing zelf is
// altijd zichtbaar op de spelerskaarten in R6LiveDashboard (naast de naam),
// dus een apart "bekijk huidige toewijzing"-scherm heeft geen functie meer.
export function R6OperatorWheel({
  sessionId,
  matchId,
  roster,
}: {
  sessionId: string;
  matchId: string;
  roster: R6Player[];
}) {
  const { data: operators = [] } = useR6Operators();
  const saveAssignments = useSaveR6GameOperatorAssignments(matchId);

  function handleClick() {
    const proposal = randomAssign(roster, operators);
    saveAssignments.mutate(
      proposal.map((a) => ({
        sessionId,
        matchId,
        playerId: a.playerId,
        attackerOperatorId: a.attackerId,
        defenderOperatorId: a.defenderId,
      })),
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
      onClick={handleClick}
      disabled={saveAssignments.isPending || roster.length === 0}
    >
      {saveAssignments.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
      Operator Wheel
    </Button>
  );
}
