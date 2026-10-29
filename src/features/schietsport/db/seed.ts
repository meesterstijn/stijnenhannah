import {
  getMeta,
  setMeta,
  type LocalRecord,
  type SchietsportDatabase,
} from "@/features/schietsport/db/database";
import { writeRecord } from "@/features/schietsport/db/repository";
import { deterministicId } from "@/features/schietsport/lib/ids";

// Standaarddisciplines: KNSA-disciplines voor klein kaliber (Schiet- en
// Wedstrijdreglement deel III en VI, oktober 2026) die op 10, 12 of 25 m
// geschoten worden, plus het verenigingsonderdeel karabijn staand. De
// KNSA-afstand staat alleen in de beschrijving: de afstand kies je per
// schietbeurt (de vereniging schiet bv. ook pistool op 12 m). Wat je niet
// gebruikt, archiveer je.
// `since`: seedversie waarin de discipline is toegevoegd. Nieuwe
// standaarddisciplines krijgen een hogere versie en verschijnen dan vanzelf
// ook bij bestaande gebruikers.
export const DEFAULT_DISCIPLINES: {
  key: string;
  name: string;
  description: string;
  since?: number;
}[] = [
  {
    key: "kk-pistool",
    name: "Klein kaliber pistool",
    description: "KNSA pistool · 10 m",
  },
  {
    key: "sportpistool-licht",
    name: "Sportpistool licht",
    description: "KNSA pistool · 25 m",
  },
  {
    key: "standaard-pistool",
    name: "Standaard pistool",
    description: "KNSA pistool · 25 m",
  },
  {
    key: "snelvuur-pistool",
    name: "Olympisch snelvuur pistool",
    description: "KNSA pistool · 25 m",
  },
  {
    key: "meesterkaart-licht",
    name: "Meesterkaart licht kaliber",
    description: "KNSA pistool · 25 m",
  },
  {
    key: "service-pistol-kk",
    name: "Service Pistol klein kaliber",
    description: "KNSA pistool · 25-20-15-10 m",
  },
  {
    key: "action-kk-standaard",
    name: "Action Shooting KK pistool standaard",
    description: "KNSA pistool · 10 m",
  },
  {
    key: "action-kk-vrij",
    name: "Action Shooting KK pistool vrij",
    description: "KNSA pistool · 10 m",
  },
  {
    key: "kkk-3-houdingen",
    name: "K.K. Karabijn 3-houdingen",
    description: "KNSA klein kaliber geweer · 12 m",
  },
  {
    key: "kkk-liggend",
    name: "K.K. Karabijn liggend",
    description: "KNSA klein kaliber geweer · 12 m",
  },
  {
    key: "kkk-knielend",
    name: "K.K. Karabijn knielend",
    description: "KNSA klein kaliber geweer · 12 m",
  },
  {
    key: "karabijn-staand",
    name: "Karabijn staand",
    description: "Verenigingsonderdeel · 25 m, 3 kaarten × 10",
  },
  {
    key: "klapschijf",
    name: "Klapschijfschieten",
    description: "Verenigingsonderdeel · 25 m, karabijn (later ook pistool)",
    since: 2,
  },
  {
    key: "vrij-geweer-3-houdingen",
    name: "Vrij geweer 3-houdingen",
    description: "KNSA klein kaliber geweer · 12 m",
  },
  {
    key: "vrij-geweer-liggend",
    name: "Vrij geweer liggend",
    description: "KNSA klein kaliber geweer · 12 m",
  },
  {
    key: "vrij-geweer-knielend",
    name: "Vrij geweer knielend",
    description: "KNSA klein kaliber geweer · 12 m",
  },
];

const DISCIPLINE_SEED_VERSION = 2;

// Per gebruiker per apparaat: zet de standaarddisciplines klaar die nieuwer
// zijn dan de laatst verwerkte seedversie. Ids zijn deterministisch per
// gebruiker, dus twee apparaten maken dezelfde records (geen dubbelingen),
// en een discipline die al bestaat — ook als verwijderde tombstone — wordt
// nooit opnieuw aangemaakt. Zolang een standaarddiscipline niet is
// aangepast, wint bij een conflict stil de server (zie sync/engine.ts).
export async function ensureDefaultDisciplines(
  db: SchietsportDatabase,
  userId: string,
) {
  const done =
    (await getMeta<number>(db, "disciplineSeedVersion")) ??
    ((await getMeta<boolean>(db, "seeded")) ? 1 : 0);
  if (done >= DISCIPLINE_SEED_VERSION) return;
  const timestamp = new Date().toISOString();
  for (const discipline of DEFAULT_DISCIPLINES) {
    if ((discipline.since ?? 1) <= done) continue;
    const id = await deterministicId(`${userId}:discipline:${discipline.key}`);
    if (await db.disciplines.get(id)) continue;
    const record = {
      id,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      version: 0,
      name: discipline.name,
      description: discipline.description,
      archivedAt: null,
    } as LocalRecord<"discipline">;
    await writeRecord(db, "discipline", record, { seeded: true, silent: true });
  }
  await setMeta(db, "seeded", true);
  await setMeta(db, "disciplineSeedVersion", DISCIPLINE_SEED_VERSION);
}

// Standaardwapens: de verenigingskarabijnen. Zelfde aanpak als de
// disciplines (deterministische ids, eenmalig per apparaat, server wint
// stil zolang ze niet zijn aangepast). Eigen vlag, zodat ze ook verschijnen
// voor wie de disciplines al had.
export const DEFAULT_WEAPONS: { key: string; name: string }[] = [
  6, 7, 8, 9,
].map((n) => ({ key: `karabijn-${n}`, name: `Karabijn ${n}` }));

export async function ensureDefaultWeapons(
  db: SchietsportDatabase,
  userId: string,
) {
  if (await getMeta<boolean>(db, "seededWeapons")) return;
  const timestamp = new Date().toISOString();
  for (const weapon of DEFAULT_WEAPONS) {
    const id = await deterministicId(`${userId}:weapon:${weapon.key}`);
    if (await db.weapons.get(id)) continue;
    const record = {
      id,
      userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      version: 0,
      name: weapon.name,
      brand: null,
      model: null,
      weaponType: "karabijn",
      caliber: null,
      ownership: "geleend",
      photoPath: null,
      notes: null,
      archivedAt: null,
    } as LocalRecord<"weapon">;
    await writeRecord(db, "weapon", record, { seeded: true, silent: true });
  }
  await setMeta(db, "seededWeapons", true);
}
