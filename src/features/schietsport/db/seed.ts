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
export const DEFAULT_DISCIPLINES: {
  key: string;
  name: string;
  description: string;
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

// Eenmalig per gebruiker per apparaat. Ids zijn deterministisch per
// gebruiker, dus twee apparaten die allebei seeden maken dezelfde records;
// zolang een standaarddiscipline niet is aangepast wint bij een conflict
// stil de server (zie sync/engine.ts).
export async function ensureDefaultDisciplines(
  db: SchietsportDatabase,
  userId: string,
) {
  if (await getMeta<boolean>(db, "seeded")) return;
  if ((await db.disciplines.count()) === 0) {
    const timestamp = new Date().toISOString();
    for (const discipline of DEFAULT_DISCIPLINES) {
      const record = {
        id: await deterministicId(`${userId}:discipline:${discipline.key}`),
        userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        version: 0,
        name: discipline.name,
        description: discipline.description,
        archivedAt: null,
      } as LocalRecord<"discipline">;
      await writeRecord(db, "discipline", record, {
        seeded: true,
        silent: true,
      });
    }
  }
  await setMeta(db, "seeded", true);
}
