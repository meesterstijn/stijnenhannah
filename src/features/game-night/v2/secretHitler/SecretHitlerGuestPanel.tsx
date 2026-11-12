import { useMemo } from "react";
import {
  buildSecretHitlerState,
  type ShState,
} from "@/features/game-night/lib/secretHitler";
import { buildStory } from "@/features/game-night/lib/secretHitlerStory";
import {
  useGuestSecretHitler,
  useGuestSuspect,
} from "@/features/game-night/hooks/useSecretHitler";
import type { GuestPlayer } from "@/features/game-night/hooks/useGameNightGuest";
import { guestErrorMessage } from "@/features/game-night/lib/guestIdentity";
import { GuestAvatar } from "@/features/game-night/v2/GuestProfileForm";
import { SecretHitlerBoard } from "@/features/game-night/v2/secretHitler/SecretHitlerBoard";
import { SecretHitlerRecap } from "@/features/game-night/v2/secretHitler/SecretHitlerRecap";

function phaseText(
  state: ShState,
  nameOf: (id: string | null) => string,
): string {
  const gov = state.governments[state.governments.length - 1];
  switch (state.phase) {
    case "setup":
      return "De host zet het spel klaar. Bekijk stiekem je envelop.";
    case "nominate":
      return `👑 ${nameOf(state.presidentId)} kiest een kanselier.`;
    case "vote":
      return `🗳️ Stemmen: ${nameOf(gov?.presidentId ?? null)} + ${nameOf(gov?.chancellorId ?? null)}. Ja of nein?`;
    case "hitler_check":
      return `🦎 Is ${nameOf(gov?.chancellorId ?? null)} Hitler?!`;
    case "legislate":
      return `📜 ${nameOf(gov?.presidentId ?? null)} en ${nameOf(gov?.chancellorId ?? null)} maken een wet.`;
    case "chaos":
      return "🌪️ Chaos! De bovenste kaart wordt wet.";
    case "power":
      return `⚡ ${nameOf(state.presidentId)} gebruikt een presidentiële macht.`;
    case "game_over":
      return state.winner === "liberal"
        ? "🕊️ De liberalen winnen! Wacht op de onthulling..."
        : "💀 De fascisten winnen! Wacht op de onthulling...";
  }
}

// Telefoon tijdens Secret Hitler: het bord meekijken, wat er net gebeurde,
// en in het geheim aanwijzen wie jij voor Hitler houdt. Na de onthulling:
// de volledige uitslag met awards (en of jij het goed had).
export function SecretHitlerGuestPanel({
  guestToken,
  sessionId,
  players,
}: {
  guestToken: string | null;
  sessionId: string | undefined;
  players: GuestPlayer[];
}) {
  const query = useGuestSecretHitler(guestToken, sessionId, true);
  const suspect = useGuestSuspect(guestToken, sessionId);
  const data = query.data;

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const nameOf = useMemo(
    () => (id: string | null | undefined) =>
      id ? (byId.get(id)?.name ?? "Speler") : "Iemand",
    [byId],
  );
  const seats = useMemo(() => (data?.active ? data.seats : []), [data]);
  const events = useMemo(() => (data?.active ? data.events : []), [data]);
  const state = useMemo(
    () => buildSecretHitlerState(seats, events),
    [seats, events],
  );
  const story = useMemo(
    () => buildStory(seats, events, nameOf),
    [seats, events, nameOf],
  );

  if (!data?.active) return null;

  const me = data.me;
  const playing = seats.includes(me);
  const revealed = state.roles != null;

  function avatar(id: string) {
    const p = byId.get(id);
    if (!p) return <span className="sh-guest-initial">?</span>;
    return (
      <GuestAvatar
        name={p.name}
        face={p.guest_face}
        body={p.body}
        photoPath={p.face_asset_path}
        photoRevision={p.face_revision}
      />
    );
  }

  if (revealed) {
    return (
      <section className="gnv2-guest-panel sh-guest">
        <p className="gnv2-identity-eyebrow">Secret Hitler · uitslag</p>
        <SecretHitlerRecap
          seats={seats}
          events={events}
          nameOf={nameOf}
          suspicions={data.suspicions.map((s) => ({
            voterId: s.voter_player_id,
            suspectId: s.suspect_player_id,
          }))}
          renderAvatar={avatar}
          ringColor={(id) => byId.get(id)?.color ?? null}
          me={me}
        />
      </section>
    );
  }

  const recent = story.slice(-3).reverse();
  return (
    <>
      <section className="gnv2-guest-panel sh-guest" aria-live="polite">
        <p className="gnv2-identity-eyebrow">Secret Hitler · live</p>
        <h2 className="sh-guest-phase">{phaseText(state, nameOf)}</h2>
        <SecretHitlerBoard state={state} compact />
        {recent.length > 0 && (
          <ol className="sh-mini-story">
            {recent.map((l) => (
              <li key={l.eventId} className={`sh-tone-${l.tone}`}>
                <span aria-hidden>{l.icon}</span> <strong>{l.title}</strong>{" "}
                {l.text}
                {l.extra && <em> {l.extra}</em>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {playing && (
        <section className="gnv2-guest-panel sh-guest">
          <h2>🕵️ Wie is Hitler volgens jou?</h2>
          <p className="sh-guest-hint">
            Geheim: alleen jij ziet je keuze. Het tafelscherm toont alleen hoe
            vaak iemand verdacht wordt. Je mag steeds van gedachten veranderen;
            na de onthulling zie je of je gelijk had.
          </p>
          <ul className="sh-guest-suspects">
            {seats
              .filter((id) => id !== me)
              .map((id) => {
                const chosen = data.my_suspect === id;
                const dead = state.dead.includes(id);
                const cleared = state.confirmedNotHitler.includes(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`sh-guest-suspect${chosen ? " sh-guest-suspect-on" : ""}${dead || cleared ? " sh-guest-suspect-cleared" : ""}`}
                      disabled={suspect.isPending}
                      aria-pressed={chosen}
                      onClick={() => suspect.mutate(chosen ? null : id)}
                    >
                      <span className="sh-guest-suspect-avatar">
                        {avatar(id)}
                      </span>
                      <span>{nameOf(id)}</span>
                      {chosen && (
                        <span className="sh-guest-suspect-tag">
                          🦎 mijn verdachte
                        </span>
                      )}
                      {cleared && !chosen && (
                        <span className="sh-guest-suspect-tag">
                          geen Hitler
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
          {suspect.isError && (
            <p className="sh-form-error">{guestErrorMessage(suspect.error)}</p>
          )}
        </section>
      )}
    </>
  );
}
