import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer as TimerIcon } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function playAlarmBeep() {
  try {
    const ctx = new AudioContext();
    const beep = (delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.25);
    };
    beep(0);
    beep(0.35);
    beep(0.7);
  } catch {
    // Web Audio not available — the visual pulse still signals completion.
  }
}

export function KitchenTimer({
  defaultLabel,
  storageKey,
}: {
  defaultLabel: string;
  storageKey: string;
}) {
  const [label, setLabel] = useLocalStorage(storageKey, defaultLabel);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<number | null>(null);

  function commitLabel() {
    setLabel(labelDraft.trim() || defaultLabel);
    setEditingLabel(false);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setFinished(true);
          playAlarmBeep();
          if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("Timer klaar", {
              body: `${label} is klaar!`,
              icon: "/stijnenhannah/icon.svg",
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running, label]);

  function addMinutes(minutes: number) {
    setFinished(false);
    setRemaining((prev) => prev + minutes * 60);
  }

  function toggle() {
    if (remaining === 0) return;
    setRunning((prev) => !prev);
  }

  function reset() {
    setRunning(false);
    setFinished(false);
    setRemaining(0);
  }

  return (
    <div
      onClick={finished ? reset : undefined}
      className={`rounded-2xl border p-3 sm:p-4 shadow-sm flex flex-col items-center gap-2 sm:gap-2.5 transition-colors ${
        finished
          ? "bg-destructive/10 border-destructive/50 animate-pulse cursor-pointer"
          : "bg-card border-border/60"
      }`}
    >
      <div className="flex items-center gap-1 text-muted-foreground min-w-0">
        <TimerIcon
          className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0"
          strokeWidth={1.6}
        />
        {editingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") {
                setLabelDraft(label);
                setEditingLabel(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.target.select()}
            maxLength={20}
            className="text-[10px] sm:text-xs uppercase tracking-wide bg-transparent border-b border-border/60 focus:outline-none text-center w-14 sm:w-20"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLabelDraft(label);
              setEditingLabel(true);
            }}
            className="text-[10px] sm:text-xs uppercase tracking-wide hover:text-foreground transition-colors truncate"
          >
            {label}
          </button>
        )}
      </div>

      <p
        className={`font-serif font-semibold tabular-nums text-xl sm:text-3xl ${finished ? "text-destructive" : ""}`}
      >
        {finished ? "Klaar!" : formatTime(remaining)}
      </p>

      {!finished && (
        <>
          <div className="flex gap-1.5">
            {[1, 5, 10].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => addMinutes(m)}
                className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                +{m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              disabled={remaining === 0}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              {running ? (
                <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-0.5" />
              )}
            </button>
            {remaining > 0 && (
              <button
                type="button"
                onClick={reset}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
