import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CloudCheck,
  CloudOff,
  KeyRound,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useSyncStatus } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useConflicts,
  usePendingCount,
} from "@/features/schietsport/hooks/useSchietsportData";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

type Indicator = {
  icon: LucideIcon;
  label: string;
  tone: string;
  spin?: boolean;
};

function useIndicator(): Indicator {
  const status = useSyncStatus();
  const pending = usePendingCount();
  const conflicts = useConflicts()?.length ?? 0;
  const waiting =
    pending > 0 ? ` · ${pending} wacht${pending === 1 ? "" : "en"}` : "";

  if (conflicts > 0) {
    return {
      icon: AlertTriangle,
      label: `${conflicts} conflict${conflicts === 1 ? "" : "en"}`,
      tone: "text-[var(--ss-amber)]",
    };
  }
  if (status.phase === "syncing") {
    return {
      icon: Loader2,
      label: "Synchroniseren…",
      tone: "text-muted-foreground",
      spin: true,
    };
  }
  if (status.lastOutcome === "offline") {
    return {
      icon: CloudOff,
      label: `Offline${waiting}`,
      tone: "text-muted-foreground",
    };
  }
  if (status.lastOutcome === "auth") {
    return {
      icon: KeyRound,
      label: `Opnieuw inloggen nodig${waiting}`,
      tone: "text-[var(--ss-amber)]",
    };
  }
  if (status.lastOutcome === "error") {
    return {
      icon: AlertTriangle,
      label: `Sync mislukt${waiting}`,
      tone: "text-[var(--ss-amber)]",
    };
  }
  if (pending > 0) {
    return {
      icon: Loader2,
      label: `${pending} wacht${pending === 1 ? "" : "en"}`,
      tone: "text-muted-foreground",
    };
  }
  const time = status.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return {
    icon: CloudCheck,
    label: time ? `Gesynchroniseerd ${time}` : "Gesynchroniseerd",
    tone: "text-[var(--ss-olive)]",
  };
}

// Synchronisatiestatus; linkt naar Instellingen (daar staan details,
// conflicten en "Nu synchroniseren").
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { icon: Icon, label, tone, spin } = useIndicator();
  return (
    <Link
      to={`${SCHIETSPORT_BASE}/instellingen`}
      title={label}
      aria-label={`Synchronisatie: ${label}`}
      className={
        compact
          ? `flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 ${tone}`
          : `inline-flex items-center gap-2 text-xs transition-colors hover:text-foreground ${tone}`
      }
    >
      <Icon className={`h-4 w-4 shrink-0 ${spin ? "animate-spin" : ""}`} />
      {!compact && <span className="truncate">{label}</span>}
    </Link>
  );
}
