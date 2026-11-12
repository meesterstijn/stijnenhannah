import { useMemo, type ReactNode } from "react";
import {
  buildSecretHitlerState,
  isLieFlag,
  teamOf,
  type ShEvent,
  type ShGovernment,
  type ShRole,
} from "@/features/game-night/lib/secretHitler";
import {
  buildAwards,
  CLAIM_FLAG_TEXT,
  POWER_ICON,
  POWER_LABEL,
  roleIcon,
  ROLE_LABEL,
  TEAM_LABEL,
  WIN_REASON_TEXT,
  type ShSuspicion,
} from "@/features/game-night/lib/secretHitlerStory";
import { HandCards } from "@/features/game-night/v2/secretHitler/SecretHitlerSheets";

function RoleMark({ role }: { role: ShRole | undefined }) {
  if (!role) return null;
  return (
    <span
      className={`sh-role-mark sh-role-mark-${role}`}
      title={ROLE_LABEL[role]}
    >
      {roleIcon(role)}
    </span>
  );
}

function GovernmentRow({
  gov,
  roles,
  nameOf,
}: {
  gov: ShGovernment;
  roles: Record<string, ShRole> | null;
  nameOf: (id: string) => string;
}) {
  const aliveCount = gov.aliveCount;
  const votes = Object.entries(gov.votes);
  const ja = votes.filter(([, v]) => v === "ja");
  const nein = votes.filter(([, v]) => v === "nein");
  const lie = gov.flags.find(isLieFlag);
  const other = gov.flags.find((f) => !isLieFlag(f));
  const fascistsIn =
    roles &&
    [gov.presidentId, gov.chancellorId].filter(
      (id) => roles[id] && teamOf(roles[id]) === "fascist",
    ).length;
  return (
    <li className={`sh-gov${gov.passed === false ? " sh-gov-failed" : ""}`}>
      <span className="sh-gov-index">{gov.index + 1}</span>
      <div className="sh-gov-body">
        <p className="sh-gov-names">
          👑 {nameOf(gov.presidentId)}{" "}
          <RoleMark role={roles?.[gov.presidentId]} />
          <span className="sh-gov-plus">+</span>
          🎩 {nameOf(gov.chancellorId)}{" "}
          <RoleMark role={roles?.[gov.chancellorId]} />
          {gov.specialElection && (
            <span className="sh-gov-tag">speciale verkiezing</span>
          )}
        </p>
        <p className="sh-gov-result">
          {gov.passed === false ? (
            <span>❌ Weggestemd</span>
          ) : gov.hitlerCheck ? (
            <span>🦎 Hitler gekozen!</span>
          ) : gov.vetoed ? (
            <span>✋ Veto</span>
          ) : gov.policy ? (
            <span className={`sh-policy-pill sh-policy-pill-${gov.policy}`}>
              {gov.policy === "L" ? "🕊️ Liberaal" : "💀 Fascistisch"}
            </span>
          ) : (
            <span>…</span>
          )}
          {votes.length > 0 && (
            <span
              className="sh-gov-votes"
              title={`Ja: ${ja.map(([id]) => nameOf(id)).join(", ")}\nNein: ${nein.map(([id]) => nameOf(id)).join(", ")}`}
            >
              {ja.length} ja · {nein.length} nein
              {votes.length < aliveCount
                ? ` · ${aliveCount - votes.length} ?`
                : ""}
            </span>
          )}
          {(gov.presidentClaim != null || gov.chancellorClaim != null) && (
            <span className="sh-gov-claims">
              <HandCards fascists={gov.presidentClaim} size={3} /> →{" "}
              <HandCards fascists={gov.chancellorClaim} size={2} />
            </span>
          )}
        </p>
        {(lie || other) && (
          <p className={`sh-gov-flag${lie ? " sh-gov-flag-lie" : ""}`}>
            {lie ? "🔥" : "🤨"} {CLAIM_FLAG_TEXT[(lie ?? other)!]}
            {roles && fascistsIn != null && lie
              ? fascistsIn > 0
                ? " — en ja, er zat een fascist in."
                : " — maar het waren twee liberalen. Gewoon verward?"
              : ""}
          </p>
        )}
        {roles && votes.length > 0 && fascistsIn != null && fascistsIn > 0 && (
          <p className="sh-gov-hindsight">
            Liberalen die ja stemden:{" "}
            {ja
              .filter(([id]) => roles[id] === "liberal")
              .map(([id]) => nameOf(id))
              .join(", ") || "niemand 👏"}
          </p>
        )}
        {gov.power && (
          <p className="sh-gov-power">
            {POWER_ICON[gov.power.power]} {POWER_LABEL[gov.power.power]}
            {"targetId" in gov.power && `: ${nameOf(gov.power.targetId)}`}
            {gov.power.power === "investigate" && gov.power.claim && (
              <>
                {" "}
                — zei “{gov.power.claim === "liberal" ? "liberaal" : "fascist"}”
                {roles?.[gov.power.targetId] &&
                  (teamOf(roles[gov.power.targetId]) === gov.power.claim
                    ? " ✓ klopte"
                    : " ✗ GELOGEN")}
              </>
            )}
            {gov.power.power === "peek" && gov.power.claim != null && (
              <>
                {" "}
                — zag <HandCards fascists={gov.power.claim} size={3} />
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

// Uitslag van een Secret Hitler-potje: winnend team, alle rollen, awards
// en "achteraf bekeken": elke regering met de nu bekende rollen erbij.
// Gedeeld door het hostscherm (GameNightV2GameRecap) en de telefoons.
export function SecretHitlerRecap({
  seats,
  events,
  nameOf,
  renderAvatar,
  ringColor,
  suspicions,
  me,
}: {
  seats: string[];
  events: ShEvent[];
  nameOf: (id: string | null | undefined) => string;
  renderAvatar: (id: string) => ReactNode;
  ringColor: (id: string) => string | null;
  suspicions: ShSuspicion[];
  me?: string | null;
}) {
  const state = useMemo(
    () => buildSecretHitlerState(seats, events),
    [seats, events],
  );
  const awards = useMemo(
    () => buildAwards(state, nameOf, suspicions),
    [state, nameOf, suspicions],
  );
  const roles = state.roles;
  const mySuspicion = me ? suspicions.find((s) => s.voterId === me) : undefined;
  const hitlerId = roles
    ? Object.entries(roles).find(([, r]) => r === "hitler")?.[0]
    : undefined;

  return (
    <div className="sh-recap">
      {state.winner ? (
        <div className={`sh-recap-hero sh-winner-${state.winner}`}>
          <p className="sh-recap-hero-icon" aria-hidden>
            {state.winner === "liberal" ? "🕊️" : "💀"}
          </p>
          <p className="sh-recap-hero-title">
            De {TEAM_LABEL[state.winner].toLowerCase()} winnen!
          </p>
          {state.winReason && (
            <p className="sh-recap-hero-reason">
              {WIN_REASON_TEXT[state.winReason]}
            </p>
          )}
          <p className="sh-recap-hero-score">
            🕊️ {state.liberalPolicies} · 💀 {state.fascistPolicies}
            {state.chaosPolicies.length > 0 &&
              ` · 🌪️ ${state.chaosPolicies.length}× chaos`}
          </p>
        </div>
      ) : (
        <div className="sh-recap-hero">
          <p className="sh-recap-hero-title">Gestopt zonder uitslag</p>
        </div>
      )}

      {roles && (
        <ul className="sh-recap-roles">
          {seats.map((id) => {
            const role = roles[id];
            const won = role && state.winner && teamOf(role) === state.winner;
            return (
              <li
                key={id}
                className={`sh-recap-role sh-seat-role-${role ?? "none"}${won ? " sh-recap-role-won" : ""}`}
              >
                <span
                  className="gnv2-party-character sh-recap-character"
                  style={{
                    ["--gnv2-ring" as string]:
                      ringColor(id) ?? "var(--gnv2-border-strong)",
                  }}
                >
                  <span className="gnv2-party-character-art">
                    {renderAvatar(id)}
                  </span>
                  {state.dead.includes(id) && (
                    <span className="sh-seat-dead-mark" aria-hidden>
                      💀
                    </span>
                  )}
                </span>
                <span className="sh-recap-role-name">{nameOf(id)}</span>
                {role && (
                  <span
                    className={`sh-role-tag sh-role-tag-${role} sh-role-tag-static`}
                  >
                    {roleIcon(role)} {ROLE_LABEL[role]}
                  </span>
                )}
                {won && <span className="sh-recap-win">+1 WIN</span>}
              </li>
            );
          })}
        </ul>
      )}

      {mySuspicion && hitlerId && (
        <p
          className={`sh-recap-me ${mySuspicion.suspectId === hitlerId ? "sh-ok" : ""}`}
        >
          {mySuspicion.suspectId === hitlerId
            ? `🕵️ Jij had het goed: ${nameOf(hitlerId)} was Hitler!`
            : `🙈 Jij verdacht ${nameOf(mySuspicion.suspectId)}. Hitler was ${nameOf(hitlerId)}.`}
        </p>
      )}

      {awards.length > 0 && (
        <section className="sh-recap-section">
          <p className="sh-recap-heading">🏅 Awards</p>
          <ul className="sh-awards">
            {awards.map((a) => (
              <li key={a.id} className="sh-award">
                <span className="sh-award-icon" aria-hidden>
                  {a.icon}
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <span className="sh-award-who">
                    {a.playerIds.map((id) => nameOf(id)).join(", ")}
                  </span>
                  <span className="sh-award-text">{a.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.quotes.length > 0 && (
        <section className="sh-recap-section">
          <p className="sh-recap-heading">💬 Quotes van de avond</p>
          <ul className="sh-quotes">
            {state.quotes.map((q) => (
              <li key={q.eventId}>
                “{q.text}”
                {q.playerId && (
                  <span className="sh-quote-who">
                    — {nameOf(q.playerId)}{" "}
                    <RoleMark role={roles?.[q.playerId]} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {suspicions.length > 0 && roles && (
        <section className="sh-recap-section">
          <p className="sh-recap-heading">🕵️ Wie verdacht wie?</p>
          <ul className="sh-suspicion-list">
            {suspicions.map((s) => (
              <li key={s.voterId}>
                {nameOf(s.voterId)} <RoleMark role={roles[s.voterId]} /> →{" "}
                {nameOf(s.suspectId)} {s.suspectId === hitlerId ? "✓" : "✗"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.governments.length > 0 && (
        <section className="sh-recap-section">
          <p className="sh-recap-heading">🔎 Achteraf bekeken</p>
          <ol className="sh-govs">
            {state.governments.map((gov) => (
              <GovernmentRow
                key={gov.index}
                gov={gov}
                roles={roles}
                nameOf={nameOf}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
