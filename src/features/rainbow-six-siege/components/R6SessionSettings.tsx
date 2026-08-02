import { useState } from "react";
import { Loader2, Plus, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { R6Session, R6SessionPlayer } from "@/features/rainbow-six-siege/types";

function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function R6SessionSettings({
  session,
  sessionPlayers,
  canRemovePlayer = false,
  onUpdateDetails,
  onAddPlayer,
  onRemovePlayer,
}: {
  session: R6Session;
  sessionPlayers: R6SessionPlayer[];
  /** "Spelers definitief verwijderen" is owner-only (zie useR6Permissions) —
   * de X-knop per speler verschijnt alleen als dit true is. */
  canRemovePlayer?: boolean;
  onUpdateDetails: (input: { name: string; startedAt: string; notes: string | null }) => Promise<void>;
  onAddPlayer: (name: string) => Promise<void>;
  onRemovePlayer: (playerId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(session.name);
  const [dateValue, setDateValue] = useState(toDateInputValue(session.started_at));
  const [notes, setNotes] = useState(session.notes ?? "");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveDetails() {
    setSavingDetails(true);
    setError(null);
    try {
      await onUpdateDetails({ name: name.trim() || session.name, startedAt: new Date(dateValue).toISOString(), notes: notes.trim() || null });
    } catch {
      setError("Opslaan van LAN-gegevens mislukt.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleAddPlayer() {
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    setAddingPlayer(true);
    setError(null);
    try {
      await onAddPlayer(trimmed);
      setNewPlayerName("");
    } catch {
      setError("Speler toevoegen mislukt.");
    } finally {
      setAddingPlayer(false);
    }
  }

  async function handleRemovePlayer(playerId: string) {
    setRemovingId(playerId);
    setError(null);
    try {
      await onRemovePlayer(playerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speler verwijderen mislukt.");
    } finally {
      setRemovingId(null);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-4 w-4" /> LAN-instellingen
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <p className="font-serif text-base font-semibold text-zinc-100">LAN-instellingen</p>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-zinc-400" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">LAN-naam</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="border-zinc-700 bg-zinc-900 text-zinc-100" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Datum</label>
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="border-zinc-700 bg-zinc-900 text-zinc-100"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Notities (optioneel)</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-9 border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>
      <Button type="button" className="bg-amber-500 text-zinc-950 hover:bg-amber-400" onClick={handleSaveDetails} disabled={savingDetails}>
        {savingDetails && <Loader2 className="h-4 w-4 animate-spin" />}
        Opslaan
      </Button>

      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <p className="text-xs text-zinc-400">Spelers</p>
        <div className="space-y-1.5">
          {sessionPlayers.map((sp) => (
            <div key={sp.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-1.5">
              <span className="text-sm text-zinc-200">{sp.player.name}</span>
              {canRemovePlayer && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-500 hover:text-rose-400"
                  onClick={() => handleRemovePlayer(sp.player_id)}
                  disabled={removingId === sp.player_id}
                >
                  {removingId === sp.player_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Nieuwe speler"
            className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={handleAddPlayer}
            disabled={addingPlayer || !newPlayerName.trim()}
          >
            {addingPlayer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-zinc-500">Een speler die al Gimma-gegevens heeft in deze LAN kan niet verwijderd worden.</p>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
