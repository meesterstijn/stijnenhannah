import { Pause, Play, SkipForward } from "lucide-react";
import { useRestTimer } from "@/features/training/hooks/RestTimer";
import { formatClock } from "@/features/training/domain/units";

const R = 88;
const C = 2 * Math.PI * R;

// Grote rusttimer. Loopt op een deadline, dus klopt ook na het scherm
// vergrendelen of herladen. Na afloop één grote tik terug naar de set.
export function RestPanel({ nextLabel, onBack }: { nextLabel: string | null; onBack: () => void }) {
  const timer = useRestTimer();
  const seconds = timer.remainingMs / 1000;
  const paused = timer.state.status === "paused";

  if (timer.finished || timer.state.status === "idle") {
    return (
      <button
        type="button"
        className="tr-rest-done flex min-h-[60dvh] w-full flex-col items-center justify-center gap-3 rounded-[22px] px-6 text-center"
        onClick={() => {
          timer.stop();
          onBack();
        }}
        autoFocus
      >
        <span className="text-3xl font-extrabold tracking-wide">RUST VOORBIJ</span>
        <span className="text-xl font-bold">VOLGENDE SET</span>
        {nextLabel && <span className="mt-2 text-base opacity-90">{nextLabel}</span>}
        <span className="mt-4 text-sm opacity-80">Tik om verder te gaan</span>
      </button>
    );
  }

  return (
    <section className="tr-card flex flex-col items-center gap-5 px-4 py-6" aria-label="Rusttimer">
      <div className="tr-label">Rust · {timer.state.label}</div>
      <div className="relative h-[220px] w-[220px]">
        <svg viewBox="0 0 200 200" className="tr-timer-ring h-full w-full" aria-hidden="true">
          <circle className="track" cx="100" cy="100" r={R} />
          <circle className="bar" cx="100" cy="100" r={R} strokeDasharray={C} strokeDashoffset={C * timer.progress} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tr-timer-digits" role="timer" aria-live="off">
            {formatClock(seconds)}
          </span>
          {paused && <span className="tr-muted mt-1 text-sm font-semibold">Gepauzeerd</span>}
        </div>
      </div>
      <div className="grid w-full max-w-sm grid-cols-4 gap-2">
        <button type="button" className="tr-btn tr-btn-ghost px-0" onClick={() => timer.adjust(-15)} aria-label="15 seconden korter">
          −15
        </button>
        <button
          type="button"
          className="tr-btn tr-btn-secondary col-span-2"
          onClick={() => (paused ? timer.resume() : timer.pause())}
        >
          {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          {paused ? "Hervatten" : "Pauzeren"}
        </button>
        <button type="button" className="tr-btn tr-btn-ghost px-0" onClick={() => timer.adjust(15)} aria-label="15 seconden langer">
          +15
        </button>
      </div>
      {nextLabel && (
        <p className="tr-muted text-center text-sm">
          Volgende: <span className="tr-ink-2 font-semibold">{nextLabel}</span>
        </p>
      )}
      <div className="flex w-full max-w-sm gap-2">
        <button type="button" className="tr-btn tr-btn-ghost flex-1" onClick={onBack}>
          Set bekijken
        </button>
        <button
          type="button"
          className="tr-btn tr-btn-primary flex-1"
          onClick={() => {
            timer.stop();
            onBack();
          }}
        >
          <SkipForward className="h-5 w-5" />
          Rust overslaan
        </button>
      </div>
    </section>
  );
}
