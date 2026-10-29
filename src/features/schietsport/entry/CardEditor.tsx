import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { SHOT_MAX } from "@/features/schietsport/domain/rules";
import {
  cardMaxScore,
  resolveCardScore,
} from "@/features/schietsport/domain/scoring";
import {
  parseScore,
  type CardForm,
  type CardMode,
} from "@/features/schietsport/entry/formState";
import { inputClass } from "@/features/schietsport/components/form";

const KEYPAD = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

// Eén kaart: kaartscore óf losse schoten (0–10) via een groot cijferpad.
// Alleen de actieve kaart toont het cijferpad, zodat het scherm rustig blijft.
export function CardEditor({
  card,
  index,
  label,
  active,
  onActivate,
  onChange,
  onComplete,
}: {
  card: CardForm;
  index: number;
  label?: string;
  active: boolean;
  onActivate: () => void;
  onChange: (card: CardForm) => void;
  onComplete: () => void;
}) {
  const max = cardMaxScore(card.shotCount);
  const resolved = resolveCardScore({
    cardNumber: index + 1,
    shotCount: card.shotCount,
    score: card.mode === "score" ? parseScore(card.score) : null,
    shots: card.mode === "shots" ? card.shots : null,
  });
  const rawScore = parseScore(card.score);
  const scoreTooHigh =
    card.mode === "score" && rawScore !== null && rawScore > max;
  const [slot, setSlot] = useState(card.shots.length);

  // Na wisselen van kaart of modus: cursor op het eerste lege schot.
  useEffect(() => {
    setSlot(card.shots.length);
  }, [active, card.mode, card.shots.length]);

  const setMode = (mode: CardMode) => {
    if (mode === card.mode) return;
    // Bij overstappen naar schoten vervalt de losse kaartscore en andersom;
    // gemengde invoer op één kaart zou tot tegenstrijdige totalen leiden.
    onChange({ ...card, mode, score: "", shots: [] });
    onActivate();
  };

  const press = (value: number) => {
    const shots = [...card.shots];
    if (slot < shots.length) shots[slot] = value;
    else if (shots.length < card.shotCount) shots.push(value);
    else return;
    onChange({ ...card, shots });
    if (slot < card.shots.length) setSlot(shots.length);
    if (shots.length === card.shotCount && slot >= card.shots.length)
      onComplete();
  };

  const backspace = () => {
    if (card.shots.length === 0) return;
    onChange({ ...card, shots: card.shots.slice(0, -1) });
  };

  return (
    <div
      className={`ss-card p-3.5 transition-shadow sm:p-4 ${
        active ? "shadow-[inset_0_0_0_1px_oklch(0.7_0.115_58/0.55)]" : ""
      }`}
      onFocus={onActivate}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onActivate}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-semibold">
            {label ?? `Kaart ${index + 1}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {card.shotCount} {card.shotCount === 1 ? "schot" : "schoten"} · max{" "}
            {max}
          </p>
        </button>
        <div className="flex rounded-lg border border-white/10 bg-black/25 p-0.5 text-xs">
          {(["score", "shots"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              aria-pressed={card.mode === mode}
              className={`rounded-md px-2.5 py-1.5 transition-colors ${
                card.mode === mode
                  ? "bg-[oklch(0.7_0.115_58/0.2)] text-foreground shadow-[inset_0_0_0_1px_oklch(0.7_0.115_58/0.55)]"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "score" ? "Score" : "Schoten"}
            </button>
          ))}
        </div>
        <p className="ss-number w-16 text-right">
          <span
            className={`text-lg font-semibold ${resolved === null ? "text-muted-foreground" : ""}`}
          >
            {resolved ?? "–"}
          </span>
          <span className="text-xs text-muted-foreground">/{max}</span>
        </p>
      </div>

      {card.mode === "score" ? (
        <div className="mt-3">
          <input
            className={`${inputClass} ss-number text-center text-2xl font-semibold ${
              scoreTooHigh ? "border-destructive" : ""
            }`}
            inputMode="numeric"
            enterKeyHint="next"
            placeholder={`0–${max}`}
            value={card.score}
            maxLength={3}
            aria-label={`Score ${label ?? `kaart ${index + 1}`}`}
            onChange={(e) =>
              onChange({ ...card, score: e.target.value.replace(/\D/g, "") })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onComplete();
              }
            }}
          />
          {scoreTooHigh && (
            <p className="mt-1 text-xs text-destructive">
              Maximaal {max} op deze kaart.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(card.shotCount, 10)}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: card.shotCount }, (_, i) => {
              const value = card.shots[i];
              const selected =
                active &&
                i === Math.min(slot, card.shotCount - 1) &&
                card.shots.length <= card.shotCount;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onActivate();
                    setSlot(Math.min(i, card.shots.length));
                  }}
                  aria-label={`Schot ${i + 1}${value !== undefined ? `: ${value}` : ""}`}
                  className={`ss-number flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                    selected
                      ? "border-[var(--ss-copper)] bg-[oklch(0.7_0.115_58/0.15)]"
                      : "border-white/10 bg-black/25"
                  } ${value === SHOT_MAX ? "text-[var(--ss-amber)]" : ""}`}
                >
                  {value ?? ""}
                </button>
              );
            })}
          </div>
          {active && (
            <div className="grid grid-cols-6 gap-1.5">
              {KEYPAD.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => press(value)}
                  className={`ss-number h-12 rounded-xl border border-white/10 text-lg font-semibold transition-colors active:scale-95 ${
                    value === SHOT_MAX
                      ? "bg-[oklch(0.82_0.13_78/0.14)] text-[var(--ss-amber)]"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                onClick={backspace}
                aria-label="Laatste schot wissen"
                className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 active:scale-95"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
