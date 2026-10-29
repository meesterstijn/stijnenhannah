import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { TrainingDatabase, databaseNameFor } from "@/features/training/db/database";
import { ensureProfile, onLocalChange } from "@/features/training/db/repository";
import { SyncEngine, type SyncStatus } from "@/features/training/sync/engine";
import { createSupabaseTransport } from "@/features/training/sync/transport";

type TrainingContextValue = {
  db: TrainingDatabase;
  engine: SyncEngine;
  userId: string;
};

const TrainingContext = createContext<TrainingContextValue | null>(null);

const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const CHANGE_DEBOUNCE_MS = 800;

// Per ingelogde gebruiker een eigen lokale database en sync. Gesynct wordt
// bij openen, kort na elke lokale wijziging, bij terugkeer van netwerk of
// app, en periodiek.
export function TrainingProvider({ children }: { children: ReactNode }) {
  const { session, isOfflineSession } = useAuth();
  const offlineRef = useRef(isOfflineSession);
  offlineRef.current = isOfflineSession;
  // TrainingLayout staat binnen de ingelogde routes; session is er altijd.
  const userId = session!.user.id;

  const value = useMemo(() => {
    const db = new TrainingDatabase(databaseNameFor(userId));
    const engine = new SyncEngine(db, createSupabaseTransport(supabase), {
      isOnline: () => navigator.onLine !== false && !offlineRef.current,
    });
    return { db, engine, userId };
  }, [userId]);

  useEffect(() => {
    if (!isOfflineSession) void value.engine.sync();
  }, [isOfflineSession, value]);

  useEffect(() => {
    const { db, engine } = value;
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (!cancelled) void engine.sync();
    };
    // Vraag de browser de lokale trainingsdata niet op te ruimen.
    void navigator.storage?.persist?.().catch(() => undefined);
    void ensureProfile(db, userId).then(run, run);

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    const stop = onLocalChange(() => {
      clearTimeout(debounce);
      debounce = setTimeout(run, CHANGE_DEBOUNCE_MS);
    });
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(run, SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearInterval(interval);
      stop();
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [value, userId]);

  useEffect(() => () => value.db.close({ disableAutoOpen: false }), [value]);

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingContextValue {
  const context = useContext(TrainingContext);
  if (!context) throw new Error("useTraining buiten TrainingProvider");
  return context;
}

export function useSyncStatus(): SyncStatus {
  const { engine } = useTraining();
  return useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.status,
  );
}
