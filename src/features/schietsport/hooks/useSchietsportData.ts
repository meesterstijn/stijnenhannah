import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import type { LocalRecord } from "@/features/schietsport/db/database";
import { sortChronological } from "@/features/schietsport/domain/stats";
import { membershipEntries } from "@/features/schietsport/domain/competition";

// Live gegevens uit IndexedDB: elk scherm werkt meteen bij na een lokale
// wijziging of een binnengekomen sync, ook offline. `undefined` = nog aan
// het laden.

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, "nl");

export function useDisciplines(options: { includeArchived?: boolean } = {}) {
  const { db } = useSchietsport();
  const all = useLiveQuery(() => db.disciplines.toArray(), [db]);
  return useMemo(
    () =>
      all
        ?.filter(
          (d) =>
            d.deletedAt === null &&
            (options.includeArchived || d.archivedAt === null),
        )
        .sort(byName),
    [all, options.includeArchived],
  );
}

export function useWeapons(options: { includeArchived?: boolean } = {}) {
  const { db } = useSchietsport();
  const all = useLiveQuery(() => db.weapons.toArray(), [db]);
  return useMemo(
    () =>
      all
        ?.filter(
          (w) =>
            w.deletedAt === null &&
            (options.includeArchived || w.archivedAt === null),
        )
        .sort(byName),
    [all, options.includeArchived],
  );
}

// Alle voltooide, niet-verwijderde schietbeurten, chronologisch (oud → nieuw).
export function useSessions(): LocalRecord<"session">[] | undefined {
  const { db } = useSchietsport();
  const all = useLiveQuery(() => db.sessions.toArray(), [db]);
  return useMemo(
    () =>
      all
        ? (sortChronological(
            all.filter((s) => s.deletedAt === null),
          ) as LocalRecord<"session">[])
        : undefined,
    [all],
  );
}

export function useSession(id: string | undefined) {
  const { db } = useSchietsport();
  return useLiveQuery(() => (id ? db.sessions.get(id) : undefined), [db, id]);
}

export function useCompetitions(options: { includeArchived?: boolean } = {}) {
  const { db } = useSchietsport();
  const all = useLiveQuery(() => db.competitions.toArray(), [db]);
  return useMemo(
    () =>
      all
        ?.filter(
          (c) =>
            c.deletedAt === null &&
            (options.includeArchived || c.archivedAt === null),
        )
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [all, options.includeArchived],
  );
}

export function useCompetitionEntries() {
  const { db } = useSchietsport();
  const all = useLiveQuery(() => db.competitionEntries.toArray(), [db]);
  return useMemo(() => all?.filter((e) => e.deletedAt === null), [all]);
}

export function usePendingCount(): number {
  const { db } = useSchietsport();
  return useLiveQuery(() => db.outbox.count(), [db]) ?? 0;
}

export function useConflicts() {
  const { db } = useSchietsport();
  return useLiveQuery(() => db.conflicts.toArray(), [db]);
}

export function useDrafts() {
  const { db } = useSchietsport();
  return useLiveQuery(
    () => db.drafts.orderBy("updatedAt").reverse().toArray(),
    [db],
  );
}

// Object-URL voor een lokaal bewaarde wapenfoto; wordt netjes vrijgegeven.
export function useWeaponPhotoUrl(weaponId: string | undefined) {
  const { db } = useSchietsport();
  const photo = useLiveQuery(
    () => (weaponId ? db.photos.get(weaponId) : undefined),
    [db, weaponId],
  );
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(photo.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);
  return url;
}

// Koppelingen voor filters: handmatige plus de automatisch meetellende
// schietbeurten van competities met regels.
export function useCompetitionMembership() {
  const competitions = useCompetitions({ includeArchived: true });
  const entries = useCompetitionEntries();
  const sessions = useSessions();
  return useMemo(
    () =>
      competitions && entries && sessions
        ? membershipEntries(competitions, sessions, entries)
        : undefined,
    [competitions, entries, sessions],
  );
}
