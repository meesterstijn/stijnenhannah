import { useState } from "react";
import { Loader2, Pencil, Quote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { R6Challenge, R6Map, R6Match, R6MatchPlayer, R6MatchResult, R6Operator, R6Player } from "@/features/rainbow-six-siege/types";

function operatorLabel(row: R6MatchPlayer, operators: Map<string, R6Operator>): string {
  const attacker = row.operator_attacker_id ? operators.get(row.operator_attacker_id)?.name : null;
  const defender = row.operator_defender_id ? operators.get(row.operator_defender_id)?.name : null;
  const single = row.operator_single_id ? operators.get(row.operator_single_id)?.name : null;
  const parts = [attacker && `Aanval: ${attacker}`, defender && `Verdediging: ${defender}`, single].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Geen operator ingevuld";
}

const RESULT_LABELS: Record<R6MatchResult, string> = {
  win: "Gewonnen",
  loss: "Verloren",
  draw: "Gelijkspel",
  unknown: "Onbekend resultaat",
};

const RESULT_CLASSES: Record<R6MatchResult, string> = {
  win: "bg-emerald-500/10 text-emerald-400",
  loss: "bg-rose-500/10 text-rose-400",
  draw: "bg-zinc-700/50 text-zinc-300",
  unknown: "bg-zinc-700/50 text-zinc-400",
};

export function R6MatchCard({
  match,
  matchPlayers,
  players,
  maps,
  operators,
  challenges,
  canEdit = false,
  onEdit,
  onDelete,
}: {
  match: R6Match;
  matchPlayers: R6MatchPlayer[];
  players: Map<string, R6Player>;
  maps: Map<string, R6Map>;
  operators: Map<string, R6Operator>;
  challenges: Map<string, R6Challenge>;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mapName = match.map_id ? (maps.get(match.map_id)?.name ?? match.map_id) : "Onbekende map";
  const challenge = match.challenge_id ? challenges.get(match.challenge_id) : null;

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-serif text-lg font-semibold text-zinc-100">
            Match {match.match_number} · {mapName}
          </p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${RESULT_CLASSES[match.result]}`}>{RESULT_LABELS[match.result]}</span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-500">
            {new Date(match.played_at).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
          {canEdit && (
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-amber-400" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {(challenge || match.chaos_rule || match.mvp_player_id) && (
        <div className="flex flex-wrap gap-2">
          {match.mvp_player_id && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
              MVP: {players.get(match.mvp_player_id)?.name ?? "Onbekend"}
              {match.mvp_reason ? ` — ${match.mvp_reason}` : ""}
            </span>
          )}
          {challenge && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-400">
              {challenge.name} {match.challenge_completed ? "✓ gehaald" : "— niet gehaald"}
            </span>
          )}
          {match.chaos_rule && (
            <span className="rounded-full border border-zinc-700 bg-zinc-950/50 px-2.5 py-0.5 text-xs text-zinc-300">
              Chaos: {match.chaos_rule}
            </span>
          )}
        </div>
      )}

      <div className="space-y-2">
        {matchPlayers.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <span className="text-sm font-medium text-zinc-100">{players.get(row.player_id)?.name ?? "Onbekend"}</span>
              <p className="text-xs text-zinc-500">{operatorLabel(row, operators)}</p>
            </div>
            <p className="text-xs text-zinc-400">
              {row.kills}K · {row.deaths}D · {row.assists}A · {row.revives}R · {row.headshots}HS
              {match.mvp_player_id === row.player_id ? " · MVP" : ""}
              {row.clutch ? " · Clutch" : ""}
              {row.ace ? " · Ace" : ""}
            </p>
          </div>
        ))}
      </div>

      {match.funniest_moment && (
        <p className="flex items-start gap-2 text-sm italic text-zinc-400">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          {match.funniest_moment}
        </p>
      )}
      {match.notes && <p className="text-xs text-zinc-500">{match.notes}</p>}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-zinc-100">Match {match.match_number} verwijderen?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Dit verwijdert de match en alle bijbehorende spelerstatistieken definitief. Het scorebord wordt automatisch herberekend.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Annuleer
            </Button>
            <Button type="button" className="bg-rose-500 text-zinc-950 hover:bg-rose-400" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
