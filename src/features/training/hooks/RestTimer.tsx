import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  IDLE,
  adjustTimer,
  isFinished,
  parseTimerState,
  pauseTimer,
  progress,
  remainingMs,
  resumeTimer,
  startTimer,
  type TimerState,
} from "@/features/training/domain/timer";
import { useTraining } from "./TrainingProvider";
import { useProfile } from "./useTrainingData";

// Eén rusttimer voor de hele module. De toestand (deadline) staat in
// localStorage per gebruiker, dus herladen of later terugkomen geeft de
// juiste resterende tijd. Het scherm ververst 4× per seconde zolang de
// timer loopt; de tijd zelf komt altijd uit de klok.

type RestTimerValue = {
  state: TimerState;
  remainingMs: number;
  progress: number;
  finished: boolean; // deadline voorbij, nog niet weggetikt
  start: (seconds: number, label: string, slot: number | null) => void;
  pause: () => void;
  resume: () => void;
  adjust: (seconds: number) => void;
  stop: () => void;
};

const RestTimerContext = createContext<RestTimerValue | null>(null);

function beep() {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [0, 0.25, 0.5].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i === 2 ? 1046 : 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // geen geluid mogelijk
  }
}

async function notify(label: string) {
  try {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const body = `${label}: tijd voor de volgende set.`;
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration) {
      await registration.showNotification("Rust voorbij", {
        body,
        tag: "training-rest",
        data: { url: `${location.pathname}#/training/workout` },
      });
    } else {
      new Notification("Rust voorbij", { body, tag: "training-rest" });
    }
  } catch {
    // melding niet beschikbaar
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const { userId } = useTraining();
  const { settings } = useProfile();
  const key = `training.timer.${userId}`;
  const [state, setState] = useState<TimerState>(() => {
    try {
      return parseTimerState(JSON.parse(localStorage.getItem(key) ?? "null"));
    } catch {
      return IDLE;
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const alerted = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const save = useCallback(
    (next: TimerState) => {
      setState(next);
      setNow(Date.now());
      try {
        if (next.status === "idle") localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // opslag vol of geblokkeerd: timer werkt in deze sessie gewoon
      }
    },
    [key],
  );

  // Verversen zolang hij loopt; ook direct bij terugkeer naar het tabblad.
  useEffect(() => {
    if (state.status !== "running") return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [state]);

  // Afloop: geluid, trillen en (alleen met toestemming, als het tabblad op
  // de achtergrond staat) een melding. Eén keer per timer.
  useEffect(() => {
    if (state.status !== "running") return;
    const fire = () => {
      if (alerted.current === state.endsAt) return;
      alerted.current = state.endsAt;
      const s = settingsRef.current;
      if (document.visibilityState === "visible") {
        if (s.sound) beep();
        if (s.vibrate) navigator.vibrate?.([200, 100, 200]);
      } else if (s.notifications) {
        void notify(state.label);
      }
    };
    const wait = state.endsAt - Date.now();
    if (wait <= 0) {
      // Pas na het herladen ontdekt: niet alsnog piepen voor oude timers.
      if (wait > -5000) fire();
      else alerted.current = state.endsAt;
      return;
    }
    const timeout = setTimeout(fire, wait);
    return () => clearTimeout(timeout);
  }, [state]);

  const value = useMemo<RestTimerValue>(
    () => ({
      state,
      remainingMs: remainingMs(state, now),
      progress: progress(state, now),
      finished: isFinished(state, now),
      start: (seconds, label, slot) =>
        save(startTimer(seconds * 1000, Date.now(), label, slot)),
      pause: () => save(pauseTimer(state, Date.now())),
      resume: () => save(resumeTimer(state, Date.now())),
      adjust: (seconds) => save(adjustTimer(state, seconds * 1000, Date.now())),
      stop: () => save(IDLE),
    }),
    [state, now, save],
  );

  return (
    <RestTimerContext.Provider value={value}>
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer(): RestTimerValue {
  const context = useContext(RestTimerContext);
  if (!context) throw new Error("useRestTimer buiten RestTimerProvider");
  return context;
}
