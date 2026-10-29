import type { Program, ProgramDay, TrainingSession } from "./types";

// Trainingsplanning: welke training is vandaag/volgende aan de beurt?
//   * Vaste weekplanning: elke trainingsdag heeft weekdagen. Een gemiste
//     training schuift niet vanzelf door; hij staat als "gemist" klaar om
//     in te halen, de rest van de week blijft zoals gepland.
//   * Doorlopende volgorde: na A komt B, ongeacht de kalenderdag.
// Datums zijn "YYYY-MM-DD" in de tijdzone van de gebruiker; weekdag 0 =
// maandag.

const DAY_MS = 86_400_000;

export function toLocalDate(date: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(date);
  }
}

const parse = (localDate: string) => {
  const [y, m, d] = localDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function weekdayOf(localDate: string): number {
  return (new Date(parse(localDate)).getUTCDay() + 6) % 7;
}

export function addDays(localDate: string, days: number): string {
  return new Date(parse(localDate) + days * DAY_MS).toISOString().slice(0, 10);
}

export const weekStart = (localDate: string) => addDays(localDate, -weekdayOf(localDate));

export const daysBetween = (from: string, to: string) =>
  Math.round((parse(to) - parse(from)) / DAY_MS);

// Telt als "gedaan" voor de planning: voltooid of bewust overgeslagen.
const counts = (s: TrainingSession) =>
  !s.deletedAt && (s.status === "completed" || s.status === "skipped");

export type TodayPlan = {
  mode: Program["content"]["scheduleMode"];
  // De training die nu aan de beurt is (null = rustdag en niets in te halen).
  day: ProgramDay | null;
  restDay: boolean;
  doneToday: boolean; // vandaag al een training van dit schema voltooid
  missed: ProgramDay[]; // eerder deze week gepland, nog niet gedaan
  upcoming: { day: ProgramDay; date: string } | null;
};

export function planToday(
  program: Program,
  sessions: TrainingSession[],
  today: string,
): TodayPlan {
  const days = program.content.days;
  const own = sessions.filter((s) => s.programId === program.id && counts(s));
  const doneToday = own.some((s) => s.localDate === today && s.status === "completed");

  if (program.content.scheduleMode === "sequence" || days.every((d) => d.weekdays.length === 0)) {
    const known = new Set(days.map((d) => d.id));
    const last = own
      .filter((s) => s.dayId && known.has(s.dayId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const index = last ? (days.findIndex((d) => d.id === last.dayId) + 1) % days.length : 0;
    const day = days[index] ?? null;
    return {
      mode: "sequence",
      day,
      restDay: false,
      doneToday,
      missed: [],
      upcoming: doneToday && day ? { day, date: addDays(today, 1) } : null,
    };
  }

  const monday = weekStart(today);
  const thisWeek = own.filter((s) => s.localDate >= monday && s.localDate <= addDays(monday, 6));
  const doneIds = new Set(thisWeek.map((s) => s.dayId));
  const todayIndex = weekdayOf(today);
  const plannedToday = days.filter((d) => d.weekdays.includes(todayIndex));
  const openToday = plannedToday.find((d) => !doneIds.has(d.id)) ?? null;
  const missed = days.filter(
    (d) =>
      d.weekdays.length > 0 &&
      d.weekdays.every((w) => w < todayIndex) &&
      !doneIds.has(d.id),
  );

  let upcoming: TodayPlan["upcoming"] = null;
  for (let offset = 1; offset <= 7 && !upcoming; offset++) {
    const date = addDays(today, offset);
    const weekday = weekdayOf(date);
    const sameWeek = weekStart(date) === monday;
    const day = days.find(
      (d) => d.weekdays.includes(weekday) && (!sameWeek || !doneIds.has(d.id)),
    );
    if (day) upcoming = { day, date };
  }

  return {
    mode: "weekly",
    day: openToday ?? missed[0] ?? null,
    restDay: plannedToday.length === 0,
    doneToday,
    missed,
    upcoming,
  };
}

export type WeekDayOverview = {
  date: string;
  weekday: number;
  planned: ProgramDay[];
  sessions: TrainingSession[];
  isToday: boolean;
};

export function weekOverview(
  program: Program | null,
  sessions: TrainingSession[],
  today: string,
): { days: WeekDayOverview[]; plannedCount: number; completedCount: number } {
  const monday = weekStart(today);
  const weekly = program?.content.scheduleMode === "weekly";
  const days = Array.from({ length: 7 }, (_, i): WeekDayOverview => {
    const date = addDays(monday, i);
    return {
      date,
      weekday: i,
      planned: weekly ? (program?.content.days.filter((d) => d.weekdays.includes(i)) ?? []) : [],
      sessions: sessions.filter(
        (s) => !s.deletedAt && s.status === "completed" && s.localDate === date,
      ),
      isToday: date === today,
    };
  });
  const plannedCount = !program
    ? 0
    : weekly
      ? program.content.days.reduce((n, d) => n + d.weekdays.length, 0)
      : Math.min(7, program.content.days.length);
  return {
    days,
    plannedCount,
    completedCount: days.reduce((n, d) => n + d.sessions.length, 0),
  };
}
