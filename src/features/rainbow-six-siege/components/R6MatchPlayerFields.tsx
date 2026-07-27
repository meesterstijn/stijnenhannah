import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { R6Operator } from "@/features/rainbow-six-siege/types";
import type { R6MatchPlayerFormState } from "@/features/rainbow-six-siege/lib/matchForm";

const NONE = "none";

function OperatorSelect({
  label,
  value,
  onChange,
  operators,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  operators: R6Operator[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger className="border-zinc-700 bg-zinc-900 text-zinc-100">
          <SelectValue placeholder="Geen" />
        </SelectTrigger>
        <SelectContent className="r6-theme border-zinc-700 bg-zinc-900 text-zinc-100">
          <SelectItem value={NONE} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
            Geen
          </SelectItem>
          {operators.map((op) => (
            <SelectItem key={op.id} value={op.id} className="text-zinc-100 focus:bg-amber-500/20 focus:text-amber-400">
              {op.name}
              {!op.is_active && <span className="text-zinc-500"> (niet meer actief)</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-zinc-700 bg-zinc-900 text-zinc-100"
      />
    </div>
  );
}

export function R6MatchPlayerFields({
  playerName,
  value,
  onChange,
  attackerOperators,
  defenderOperators,
  allOperators,
}: {
  playerName: string;
  value: R6MatchPlayerFormState;
  onChange: (next: R6MatchPlayerFormState) => void;
  attackerOperators: R6Operator[];
  defenderOperators: R6Operator[];
  allOperators: R6Operator[];
}) {
  function patch(partial: Partial<R6MatchPlayerFormState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="font-serif text-base font-semibold text-zinc-100">{playerName}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <OperatorSelect
          label="Operator (aanval)"
          value={value.operatorAttackerId}
          onChange={(v) => patch({ operatorAttackerId: v })}
          operators={attackerOperators}
        />
        <OperatorSelect
          label="Operator (verdediging)"
          value={value.operatorDefenderId}
          onChange={(v) => patch({ operatorDefenderId: v })}
          operators={defenderOperators}
        />
        <OperatorSelect
          label="Operator (alleen deze zijde gespeeld)"
          value={value.operatorSingleId}
          onChange={(v) => patch({ operatorSingleId: v })}
          operators={allOperators}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <StatInput label="Kills" value={value.kills} onChange={(v) => patch({ kills: v })} />
        <StatInput label="Deaths" value={value.deaths} onChange={(v) => patch({ deaths: v })} />
        <StatInput label="Assists" value={value.assists} onChange={(v) => patch({ assists: v })} />
        <StatInput label="Revives" value={value.revives} onChange={(v) => patch({ revives: v })} />
        <StatInput label="Headshots" value={value.headshots} onChange={(v) => patch({ headshots: v })} />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <Checkbox checked={value.clutch} onCheckedChange={(c) => patch({ clutch: c === true })} /> Clutch
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <Checkbox checked={value.ace} onCheckedChange={(c) => patch({ ace: c === true })} /> Ace
        </label>
      </div>
    </div>
  );
}
