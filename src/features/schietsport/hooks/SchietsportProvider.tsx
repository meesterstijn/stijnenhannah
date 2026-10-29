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
import {
  SchietsportDatabase,
  databaseNameFor,
} from "@/features/schietsport/db/database";
import { onLocalChange } from "@/features/schietsport/db/repository";
import {
  ensureDefaultDisciplines,
  ensureDefaultWeapons,
} from "@/features/schietsport/db/seed";
import {
  SyncEngine,
  type SyncStatus,
} from "@/features/schietsport/sync/engine";
import { createSupabaseTransport } from "@/features/schietsport/sync/transport";

type SchietsportContextValue = {
  db: SchietsportDatabase;
  engine: SyncEngine;
  userId: string;
};

const SchietsportContext = createContext<SchietsportContextValue | null>(null);

const SYNC_INTERVAL_MS = 2 * 60 * 1000;
const CHANGE_DEBOUNCE_MS = 800;

// Zet per ingelogde gebruiker de lokale database en de sync op, en bepaalt
// wanneer er gesynchroniseerd wordt: bij openen, na elke lokale wijziging,
// bij terugkeer van het netwerk of de app, en periodiek.
export function SchietsportProvider({ children }: { children: ReactNode }) {
  const { session, isOfflineSession } = useAuth();
  // Met alleen een offline geldige sessie (verlopen token) heeft syncen geen
  // zin; zodra het token ververst is wordt dit false en syncen we weer.
  const offlineSessionRef = useRef(isOfflineSession);
  offlineSessionRef.current = isOfflineSession;
  // SchietsportLayout staat binnen de ingelogde routes; session is er altijd.
  const userId = session!.user.id;

  const value = useMemo(() => {
    const db = new SchietsportDatabase(databaseNameFor(userId));
    const engine = new SyncEngine(
      db,
      createSupabaseTransport(supabase),
      userId,
      {
        isOnline: () =>
          navigator.onLine !== false && !offlineSessionRef.current,
      },
    );
    return { db, engine, userId };
  }, [userId]);

  // Token weer geldig (netwerk terug): meteen synchroniseren.
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

    // Vraag de browser de lokale data niet op te ruimen bij ruimtegebrek
    // (vooral iOS Safari). Mislukt stil als het niet kan.
    void navigator.storage?.persist?.().catch(() => undefined);

    // Standaarddisciplines meteen klaarzetten (ook offline bij het eerste
    // gebruik), daarna synchroniseren. Veilig op meerdere apparaten: de ids
    // zijn deterministisch en bij een conflict wint stil de server.
    void ensureDefaultDisciplines(db, userId)
      .then(() => ensureDefaultWeapons(db, userId))
      .then(run, run);

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    const stopListening = onLocalChange(() => {
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
      stopListening();
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [value, userId]);

  // Bij wisselen van gebruiker de oude database sluiten. autoOpen blijft aan:
  // React StrictMode draait effecten in dev twee keer, en een volgende query
  // moet de database dan gewoon weer openen.
  useEffect(() => () => value.db.close({ disableAutoOpen: false }), [value]);

  return (
    <SchietsportContext.Provider value={value}>
      {children}
    </SchietsportContext.Provider>
  );
}

export function useSchietsport(): SchietsportContextValue {
  const context = useContext(SchietsportContext);
  if (!context) throw new Error("useSchietsport buiten SchietsportProvider");
  return context;
}

export function useSyncStatus(): SyncStatus {
  const { engine } = useSchietsport();
  return useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.status,
  );
}
