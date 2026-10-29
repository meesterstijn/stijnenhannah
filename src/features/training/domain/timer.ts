// Rusttimer op basis van een deadline (tijdstip), niet van een teller die
// elke seconde aftelt. Daardoor klopt de resterende tijd altijd, ook als de
// browser het tabblad afremt, het scherm op slot gaat of de pagina opnieuw
// wordt geopend. Pure functies; de hook bewaart de toestand lokaal.

export type TimerState =
  | { status: "idle" }
  | {
      status: "running";
      endsAt: number; // ms sinds epoch
      durationMs: number;
      label: string;
      slot: number | null;
    }
  | {
      status: "paused";
      remainingMs: number;
      durationMs: number;
      label: string;
      slot: number | null;
    };

export const IDLE: TimerState = { status: "idle" };

export function startTimer(
  durationMs: number,
  now: number,
  label = "Rust",
  slot: number | null = null,
): TimerState {
  return {
    status: "running",
    endsAt: now + Math.max(0, durationMs),
    durationMs: Math.max(0, durationMs),
    label,
    slot,
  };
}

export function remainingMs(state: TimerState, now: number): number {
  if (state.status === "running") return Math.max(0, state.endsAt - now);
  if (state.status === "paused") return state.remainingMs;
  return 0;
}

export function isFinished(state: TimerState, now: number): boolean {
  return state.status === "running" && state.endsAt <= now;
}

// 0 (net begonnen) … 1 (klaar)
export function progress(state: TimerState, now: number): number {
  if (state.status === "idle" || state.durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs(state, now) / state.durationMs));
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "running") return state;
  return {
    status: "paused",
    remainingMs: remainingMs(state, now),
    durationMs: state.durationMs,
    label: state.label,
    slot: state.slot,
  };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "paused") return state;
  return {
    status: "running",
    endsAt: now + state.remainingMs,
    durationMs: state.durationMs,
    label: state.label,
    slot: state.slot,
  };
}

// +15 s / −15 s. Nooit onder nul; de totale duur groeit mee zodat de
// voortgangsbalk niet terugspringt.
export function adjustTimer(state: TimerState, deltaMs: number, now: number): TimerState {
  if (state.status === "running") {
    const remaining = Math.max(0, state.endsAt - now + deltaMs);
    return {
      ...state,
      endsAt: now + remaining,
      durationMs: Math.max(state.durationMs + Math.max(0, deltaMs), remaining),
    };
  }
  if (state.status === "paused") {
    const remaining = Math.max(0, state.remainingMs + deltaMs);
    return {
      ...state,
      remainingMs: remaining,
      durationMs: Math.max(state.durationMs + Math.max(0, deltaMs), remaining),
    };
  }
  return state;
}

// Veilig inlezen uit opslag (beschadigde of oude waarden = idle).
export function parseTimerState(raw: unknown): TimerState {
  if (!raw || typeof raw !== "object") return IDLE;
  const s = raw as Record<string, unknown>;
  const label = typeof s.label === "string" ? s.label : "Rust";
  const slot = typeof s.slot === "number" ? s.slot : null;
  const durationMs = typeof s.durationMs === "number" ? s.durationMs : 0;
  if (s.status === "running" && typeof s.endsAt === "number") {
    return { status: "running", endsAt: s.endsAt, durationMs, label, slot };
  }
  if (s.status === "paused" && typeof s.remainingMs === "number") {
    return { status: "paused", remainingMs: s.remainingMs, durationMs, label, slot };
  }
  return IDLE;
}
