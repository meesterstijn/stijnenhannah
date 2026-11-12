import type { ReactNode } from "react";
import type { ShRole, ShVote } from "@/features/game-night/lib/secretHitler";
import {
  roleIcon,
  ROLE_LABEL,
} from "@/features/game-night/lib/secretHitlerStory";

export type ShSeatBadge = {
  key: string;
  icon: string;
  label: string;
  tone?: "gold" | "liberal" | "fascist" | "muted" | "danger";
};

// Eén speler aan de Secret Hitler-tafel: het eigen character (of op de
// telefoon de gastavatar), met badges (president, kanselier, termijn,
// onderzocht, geen Hitler, dood) en tijdens het stemmen een Ja/Nein-stempel.
// Tikbaar zodra de tafel iets te kiezen heeft (kanselier, doelwit, stem).
export function SecretHitlerSeat({
  name,
  avatar,
  ringColor,
  badges,
  dead,
  vote,
  role,
  selected,
  selectable,
  disabledReason,
  heat,
  order,
  onClick,
}: {
  name: string;
  avatar: ReactNode;
  ringColor: string | null;
  badges: ShSeatBadge[];
  dead: boolean;
  vote?: ShVote | null;
  role?: ShRole | null;
  selected?: boolean;
  selectable?: boolean;
  disabledReason?: string | null;
  /** Aantal telefoons dat deze speler verdenkt (anoniem). */
  heat?: number;
  /** Zitplaatsnummer tijdens het instellen van de volgorde. */
  order?: number | null;
  onClick?: () => void;
}) {
  const className = [
    "sh-seat",
    dead ? "sh-seat-dead" : "",
    selected ? "sh-seat-selected" : "",
    selectable ? "sh-seat-selectable" : "",
    disabledReason ? "sh-seat-disabled" : "",
    role ? `sh-seat-role-${role}` : "",
    vote ? `sh-seat-vote-${vote}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span
        className="gnv2-party-character sh-seat-character"
        style={{
          ["--gnv2-ring" as string]: ringColor ?? "var(--gnv2-border-strong)",
        }}
      >
        <span className="gnv2-party-character-art">{avatar}</span>
        {vote && (
          <span className={`sh-vote-stamp sh-vote-stamp-${vote}`} aria-hidden>
            {vote === "ja" ? "JA!" : "NEIN!"}
          </span>
        )}
        {dead && (
          <span className="sh-seat-dead-mark" aria-hidden>
            💀
          </span>
        )}
        {role && (
          <span className={`sh-role-tag sh-role-tag-${role}`}>
            {roleIcon(role)} {ROLE_LABEL[role]}
          </span>
        )}
        {order != null && <span className="sh-seat-order">{order}</span>}
        {heat != null && heat > 0 && (
          <span
            className="sh-seat-heat"
            title={`${heat}× verdacht op een telefoon`}
          >
            🔥{heat}
          </span>
        )}
      </span>
      <span className="sh-seat-name">{name}</span>
      {badges.length > 0 && (
        <span className="sh-seat-badges">
          {badges.map((b) => (
            <span
              key={b.key}
              className={`sh-badge sh-badge-${b.tone ?? "muted"}`}
              title={b.label}
            >
              <span aria-hidden>{b.icon}</span>
              <span className="sh-badge-label">{b.label}</span>
            </span>
          ))}
        </span>
      )}
      {disabledReason && (
        <span className="sh-seat-reason">{disabledReason}</span>
      )}
    </>
  );

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={!!disabledReason}
      aria-pressed={selected}
      aria-label={
        vote
          ? `${name}: ${vote === "ja" ? "ja" : "nein"} (tik om te wisselen)`
          : name
      }
    >
      {content}
    </button>
  );
}
