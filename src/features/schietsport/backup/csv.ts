import type {
  Discipline,
  ShootingSession,
  Weapon,
} from "@/features/schietsport/domain/model";
import {
  SESSION_TYPE_LABELS,
  layoutLabel,
} from "@/features/schietsport/domain/rules";
import { sortChronological } from "@/features/schietsport/domain/stats";

// CSV-export voor Excel/Numbers. Puntkomma als scheidingsteken en decimale
// komma, zoals Nederlandse spreadsheetinstellingen verwachten; een BOM
// zorgt dat Excel UTF-8 herkent.

const SEPARATOR = ";";
const BOM = "﻿";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]): string {
  return BOM + rows.map((row) => row.map(cell).join(SEPARATOR)).join("\r\n");
}

const percent = (total: number, max: number) =>
  ((total / max) * 100).toFixed(1).replace(".", ",");

type Lookups = {
  weapons: readonly Weapon[];
  disciplines: readonly Discipline[];
};

const names = (session: ShootingSession, lookups: Lookups) => ({
  weapon:
    lookups.weapons.find((w) => w.id === session.weaponId)?.name ??
    "Onbekend wapen",
  discipline:
    lookups.disciplines.find((d) => d.id === session.disciplineId)?.name ?? "",
});

// Eén regel per schietbeurt.
export function sessionsToCsv(
  sessions: readonly ShootingSession[],
  lookups: Lookups,
): string {
  const header = [
    "Datum",
    "Type",
    "Wapen",
    "Discipline",
    "Afstand (m)",
    "Score",
    "Maximum",
    "Percentage",
    "Kaartindeling",
    "Kaartscores",
    "Opmerkingen",
    "Id",
  ];
  const rows = sortChronological(
    sessions.filter((s) => s.deletedAt === null),
  ).map((session) => {
    const { weapon, discipline } = names(session, lookups);
    return [
      session.sessionDate,
      SESSION_TYPE_LABELS[session.type],
      weapon,
      discipline,
      session.distance,
      session.totalScore,
      session.maxScore,
      percent(session.totalScore, session.maxScore),
      session.cards.length > 0
        ? layoutLabel(session.cards.map((c) => c.shotCount))
        : "alleen totaal",
      session.cards.map((c) => c.score).join(" | "),
      session.notes,
      session.id,
    ];
  });
  return toCsv([header, ...rows]);
}

// Eén regel per kaart, met losse schoten als die zijn ingevoerd.
export function cardsToCsv(
  sessions: readonly ShootingSession[],
  lookups: Lookups,
): string {
  const header = [
    "Datum",
    "Type",
    "Wapen",
    "Discipline",
    "Afstand (m)",
    "Kaart",
    "Schoten",
    "Score",
    "Maximum",
    "Losse schoten",
    "Schietbeurt-id",
  ];
  const rows: unknown[][] = [];
  for (const session of sortChronological(
    sessions.filter((s) => s.deletedAt === null),
  )) {
    const { weapon, discipline } = names(session, lookups);
    for (const card of session.cards) {
      rows.push([
        session.sessionDate,
        SESSION_TYPE_LABELS[session.type],
        weapon,
        discipline,
        session.distance,
        card.cardNumber,
        card.shotCount,
        card.score,
        card.shotCount * 10,
        card.shots ? card.shots.join(" ") : "",
        session.id,
      ]);
    }
  }
  return toCsv([header, ...rows]);
}
