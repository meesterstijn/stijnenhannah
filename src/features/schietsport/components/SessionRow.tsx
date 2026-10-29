import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CloudUpload,
  Layers,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { LocalRecord } from "@/features/schietsport/db/database";
import type { Discipline, Weapon } from "@/features/schietsport/domain/model";
import {
  SESSION_TYPE_SHORT_LABELS,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import { formatDate } from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

export const TYPE_STYLE: Record<
  SessionType,
  { icon: LucideIcon; className: string; color: string }
> = {
  match: {
    icon: Trophy,
    className: "text-[var(--ss-copper)] bg-[oklch(0.7_0.115_58/0.14)]",
    color: "var(--ss-copper)",
  },
  practice_match: {
    icon: Layers,
    className: "text-[var(--ss-olive)] bg-[oklch(0.66_0.09_118/0.14)]",
    color: "var(--ss-olive)",
  },
  free_card: {
    icon: Target,
    className: "text-[var(--ss-amber)] bg-[oklch(0.82_0.13_78/0.12)]",
    color: "var(--ss-amber)",
  },
};

export function TypeIcon({
  type,
  size = "md",
}: {
  type: SessionType;
  size?: "sm" | "md";
}) {
  const { icon: Icon, className } = TYPE_STYLE[type];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ${className} ${
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      }`}
    >
      <Icon
        className={size === "sm" ? "h-4 w-4" : "h-5 w-5"}
        strokeWidth={1.8}
      />
    </span>
  );
}

export function SyncBadge({
  session,
}: {
  session: Pick<LocalRecord<"session">, "syncState" | "syncError">;
}) {
  if (session.syncState === "pending") {
    return (
      <CloudUpload
        className="h-3.5 w-3.5 text-muted-foreground"
        aria-label="Nog niet gesynchroniseerd"
      />
    );
  }
  if (session.syncState === "rejected") {
    return (
      <span title={session.syncError ?? undefined}>
        <AlertTriangle
          className="h-3.5 w-3.5 text-[var(--ss-amber)]"
          aria-label="Synchronisatie geweigerd"
        />
      </span>
    );
  }
  return null;
}

export function SessionRow({
  session,
  weapons,
  disciplines,
}: {
  session: LocalRecord<"session">;
  weapons: readonly Weapon[];
  disciplines: readonly Discipline[];
}) {
  const weapon = weapons.find((w) => w.id === session.weaponId);
  const discipline = disciplines.find((d) => d.id === session.disciplineId);
  return (
    <Link
      to={`${SCHIETSPORT_BASE}/logboek/${session.id}`}
      className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/5 sm:p-3"
    >
      <TypeIcon type={session.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {SESSION_TYPE_SHORT_LABELS[session.type]}
          {discipline && (
            <span className="text-muted-foreground"> · {discipline.name}</span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(session.sessionDate)} · {session.distance} m ·{" "}
          {weapon?.name ?? "Onbekend wapen"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <SyncBadge session={session} />
        <p className="ss-number text-right">
          <span className="text-xl font-semibold">{session.totalScore}</span>
          <span className="text-xs text-muted-foreground">
            /{session.maxScore}
          </span>
        </p>
      </div>
    </Link>
  );
}
