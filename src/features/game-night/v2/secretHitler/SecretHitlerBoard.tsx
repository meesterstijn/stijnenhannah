import {
  drawOdds,
  fascistTrackPowers,
  hitlerDangerZone,
  SH_FASCIST_TRACK,
  SH_LIBERAL_TRACK,
  vetoUnlocked,
  type ShState,
} from "@/features/game-night/lib/secretHitler";
import {
  POWER_ICON,
  POWER_LABEL,
} from "@/features/game-night/lib/secretHitlerStory";

// Het spelbord: liberaal en fascistisch spoor (met de machten voor dit
// spelersaantal), verkiezingsteller en de stapel. Puur weergave; gedeeld
// door het tafelscherm en de telefoons.
export function SecretHitlerBoard({
  state,
  compact = false,
}: {
  state: ShState;
  compact?: boolean;
}) {
  const powers = fascistTrackPowers(state.playerCount);
  const odds = drawOdds(state);
  const danger = hitlerDangerZone(state) && state.phase !== "game_over";

  return (
    <div className={`sh-board${compact ? " sh-board-compact" : ""}`}>
      <div className="sh-track sh-track-liberal">
        <p className="sh-track-label">
          <span aria-hidden>🕊️</span> Liberaal
          <span className="sh-track-count">
            {state.liberalPolicies}/{SH_LIBERAL_TRACK}
          </span>
        </p>
        <ol className="sh-slots">
          {Array.from({ length: SH_LIBERAL_TRACK }, (_, i) => {
            const filled = i < state.liberalPolicies;
            const last = i === SH_LIBERAL_TRACK - 1;
            return (
              <li
                key={i}
                className={`sh-slot${filled ? " sh-slot-filled" : ""}`}
                aria-label={
                  filled ? "Liberale wet" : last ? "Overwinning" : "Leeg"
                }
              >
                {filled ? (
                  <span className="sh-card sh-card-liberal">🕊️</span>
                ) : last ? (
                  <span className="sh-slot-icon" aria-hidden>
                    🏆
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div
        className={`sh-track sh-track-fascist${danger ? " sh-track-danger" : ""}`}
      >
        <p className="sh-track-label">
          <span aria-hidden>💀</span> Fascistisch
          <span className="sh-track-count">
            {state.fascistPolicies}/{SH_FASCIST_TRACK}
          </span>
        </p>
        <ol className="sh-slots">
          {Array.from({ length: SH_FASCIST_TRACK }, (_, i) => {
            const filled = i < state.fascistPolicies;
            const power = powers[i] ?? null;
            const last = i === SH_FASCIST_TRACK - 1;
            const label = filled
              ? "Fascistische wet"
              : last
                ? "Overwinning"
                : power
                  ? POWER_LABEL[power]
                  : "Leeg";
            return (
              <li
                key={i}
                className={`sh-slot${filled ? " sh-slot-filled" : ""}${i >= 3 ? " sh-slot-hitler-zone" : ""}`}
                aria-label={label}
                title={label}
              >
                {filled ? (
                  <span className="sh-card sh-card-fascist">💀</span>
                ) : last ? (
                  <span className="sh-slot-icon" aria-hidden>
                    🏆
                  </span>
                ) : power ? (
                  <span className="sh-slot-power">
                    <span aria-hidden>{POWER_ICON[power]}</span>
                    {!compact && (
                      <span className="sh-slot-power-label">
                        {POWER_LABEL[power]}
                      </span>
                    )}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        {(danger || vetoUnlocked(state)) && (
          <p className="sh-track-note">
            {danger && <span>🦎 Hitler kanselier = fascisten winnen</span>}
            {vetoUnlocked(state) && <span>✋ Vetorecht actief</span>}
          </p>
        )}
      </div>

      <div className="sh-board-meta">
        <div
          className="sh-tracker"
          aria-label={`Verkiezingsteller ${state.electionTracker} van 3`}
        >
          <span className="sh-meta-label">Verkiezingsteller</span>
          <span className="sh-tracker-dots">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`sh-tracker-dot${i < state.electionTracker ? " sh-tracker-dot-on" : ""}${i === 2 ? " sh-tracker-dot-chaos" : ""}`}
              />
            ))}
            <span className="sh-tracker-chaos">🌪️</span>
          </span>
        </div>
        <div className="sh-deck">
          <span className="sh-meta-label">Stapel</span>
          <span>
            <strong>{state.drawPile}</strong> trekken · {state.discardPile}{" "}
            afgelegd
          </span>
        </div>
        {!compact && state.phase !== "game_over" && (
          <div
            className="sh-deck"
            title="Ruwe schatting over alle nog niet aangenomen wetten"
          >
            <span className="sh-meta-label">Kans op 3× rood</span>
            <span>
              <strong>{Math.round(odds.threeFascist * 100)}%</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
