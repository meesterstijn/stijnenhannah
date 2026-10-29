import { Link } from "react-router-dom";
import { Crosshair } from "lucide-react";
import type { Weapon } from "@/features/schietsport/domain/model";
import type { ShootingSession } from "@/features/schietsport/domain/model";
import {
  personalBest,
  splitByScale,
  summarize,
} from "@/features/schietsport/domain/stats";
import { useWeaponPhotoUrl } from "@/features/schietsport/hooks/useSchietsportData";
import { formatMean } from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";
import { WEAPON_TYPE_LABELS } from "@/features/schietsport/components/WeaponForm";

export function WeaponThumb({
  weapon,
  size = "md",
}: {
  weapon: Weapon;
  size?: "sm" | "md" | "lg";
}) {
  const url = useWeaponPhotoUrl(weapon.id);
  const dimension = { sm: "h-10 w-14", md: "h-14 w-20", lg: "h-24 w-36" }[size];
  return (
    <div
      className={`${dimension} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <Crosshair
          className="h-5 w-5 text-muted-foreground"
          strokeWidth={1.5}
        />
      )}
    </div>
  );
}

export function weaponSubtitle(weapon: Weapon) {
  return [
    [weapon.brand, weapon.model].filter(Boolean).join(" ") ||
      WEAPON_TYPE_LABELS[weapon.weaponType],
    weapon.caliber,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Compacte rij: foto, naam, merk/model en de gemiddelde wedstrijdscore.
export function WeaponRow({
  weapon,
  sessions,
}: {
  weapon: Weapon;
  sessions: readonly ShootingSession[];
}) {
  const own = sessions.filter((s) => s.weaponId === weapon.id);
  const matches = summarize(splitByScale(own)[300]);
  return (
    <Link
      to={`${SCHIETSPORT_BASE}/wapens/${weapon.id}`}
      className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5"
    >
      <WeaponThumb weapon={weapon} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{weapon.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {weaponSubtitle(weapon)}
        </p>
      </div>
      <div className="text-right">
        <p className="ss-number text-sm font-semibold">
          {matches ? formatMean(matches.mean) : "—"}
        </p>
        <p className="text-[0.65rem] text-muted-foreground">gem. /300</p>
      </div>
    </Link>
  );
}

// Grote kaart voor het wapenoverzicht.
export function WeaponCard({
  weapon,
  sessions,
}: {
  weapon: Weapon;
  sessions: readonly ShootingSession[];
}) {
  const own = sessions.filter((s) => s.weaponId === weapon.id);
  const big = splitByScale(own)[300];
  const summary = summarize(big);
  const best = big.length > 0 ? personalBest(big) : null;
  return (
    <Link
      to={`${SCHIETSPORT_BASE}/wapens/${weapon.id}`}
      className="ss-card ss-card-interactive flex gap-4 p-4"
    >
      <WeaponThumb weapon={weapon} size="lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{weapon.name}</p>
            {weapon.ownership === "geleend" && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                geleend
              </span>
            )}
            {weapon.archivedAt && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                gearchiveerd
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {weaponSubtitle(weapon)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Beurten</p>
            <p className="ss-number text-base font-semibold">{own.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Gem. /300</p>
            <p className="ss-number text-base font-semibold">
              {summary ? formatMean(summary.mean) : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Record</p>
            <p className="ss-number text-base font-semibold text-[var(--ss-copper)]">
              {best ? best.totalScore : "—"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
