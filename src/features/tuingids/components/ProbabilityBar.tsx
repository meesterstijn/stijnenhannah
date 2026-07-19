interface ProbabilityBarProps {
  value: number; // 1-5
}

const LABELS = ["", "Zeldzaam", "Mogelijk", "Waarschijnlijk", "Zeer waarschijnlijk", "Meest voorkomend"];

export function ProbabilityBar({ value }: ProbabilityBarProps) {
  const pct = (value / 5) * 100;
  const color =
    value >= 4 ? "bg-amber-500" : value === 3 ? "bg-yellow-400" : "bg-muted-foreground/40";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground shrink-0 w-36">{LABELS[value]}</span>
    </div>
  );
}
