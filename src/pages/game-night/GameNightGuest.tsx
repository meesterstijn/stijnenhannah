import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  useGuestOptions,
  useGuestState,
  type GuestProfileInput,
} from "@/features/game-night/hooks/useGameNightGuest";
import {
  guestErrorMessage,
  readGuestToken,
} from "@/features/game-night/lib/guestIdentity";
import {
  GuestAvatar,
  GuestProfileForm,
} from "@/features/game-night/v2/GuestProfileForm";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";

export default function GameNightGuest() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [guestToken] = useState(readGuestToken);
  const state = useGuestState(guestToken, sessionId);
  const options = useGuestOptions(guestToken);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: async (profile: GuestProfileInput) => {
      const { error } = await supabase.rpc("game_night_update_guest", {
        p_guest_token: guestToken,
        p_session_id: sessionId,
        ...profile,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["game-night-guest-state", guestToken],
      });
      await queryClient.invalidateQueries({
        queryKey: ["game-night-guest-options", guestToken],
      });
      setEditing(false);
    },
  });
  if (state.isLoading) return <GnV2Loading />;
  const data = state.data;
  const complete = data?.valid && data.session.status === "completed";

  return (
    <GnV2Scene className="gnv2-guest-scene">
      <main className="gnv2-guest-shell">
        <header className="gnv2-guest-heading">
          <p className="gnv2-identity-eyebrow">Game Night · jouw plek</p>
          <h1>{data?.valid ? data.session.name : "Terug aan tafel"}</h1>
        </header>
        {state.isError && (
          <div className="gnv2-guest-panel" role="alert">
            <p>{guestErrorMessage(state.error)}</p>
            <button
              className="gnv2-btn gnv2-btn-ghost mt-3"
              onClick={() => void state.refetch()}
            >
              Opnieuw verbinden
            </button>
          </div>
        )}
        {!data?.valid ? (
          !state.isError && (
            <div className="gnv2-guest-panel">
              <h2>Scan de QR-code om mee te doen</h2>
              <p>
                Scan de uitnodiging van de host en kies je opgeslagen speler. Je
                hoeft je naam en avatar niet opnieuw te maken.
              </p>
            </div>
          )
        ) : editing && !complete && data.at_table ? (
          <div className="gnv2-guest-panel">
            <h2>Jouw speler</h2>
            {options.isLoading ? (
              <p>Avatars laden…</p>
            ) : options.isError || !options.data?.valid ? (
              <div role="alert">
                <p>{guestErrorMessage(options.error)}</p>
                <button
                  className="gnv2-btn gnv2-btn-ghost"
                  onClick={() => void options.refetch()}
                >
                  Opnieuw proberen
                </button>
                <button
                  className="gnv2-btn gnv2-btn-ghost"
                  onClick={() => setEditing(false)}
                >
                  Terug naar de lobby
                </button>
              </div>
            ) : (
              <GuestProfileForm
                options={options.data}
                initial={data.me}
                pending={update.isPending}
                error={update.error ? guestErrorMessage(update.error) : null}
                onSubmit={(profile) => update.mutate(profile)}
                onCancel={() => setEditing(false)}
                submitLabel="Mijn speler opslaan"
              />
            )}
          </div>
        ) : (
          <>
            <section className="gnv2-guest-panel gnv2-guest-welcome">
              <div
                className="gnv2-guest-my-avatar"
                style={{ borderColor: data.me.color ?? undefined }}
              >
                <GuestAvatar
                  name={data.me.name}
                  face={data.me.guest_face}
                  body={data.me.body}
                />
              </div>
              <div>
                <p className="gnv2-guest-presence">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {complete
                    ? "Bedankt voor het meespelen"
                    : data.at_table
                      ? "Je zit aan tafel"
                      : "Je staat even aan de kant"}
                </p>
                <h2>{data.me.name}</h2>
                {!complete && data.at_table && (
                  <button
                    className="gnv2-btn gnv2-btn-ghost"
                    onClick={() => {
                      update.reset();
                      setEditing(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Naam en avatar aanpassen
                  </button>
                )}
              </div>
            </section>
            <section className="gnv2-guest-panel" aria-live="polite">
              <p className="gnv2-identity-eyebrow">
                {complete
                  ? "Tot de volgende keer"
                  : data.game
                    ? "Nu op tafel"
                    : "De lobby"}
              </p>
              <h2>
                {complete
                  ? "Deze Game Night is afgelopen"
                  : !data.at_table
                    ? "De host beheert de tafel"
                    : (data.game?.name ?? "Klaar voor een leuke avond")}
              </h2>
              <p>
                {complete
                  ? "Je speler blijft bewaard voor de volgende uitnodiging."
                  : !data.at_table
                    ? "Vraag de host om je weer aan tafel te zetten."
                    : data.game
                      ? data.game.status === "paused"
                        ? "Het spel is even gepauzeerd."
                        : "Veel plezier! De host houdt het spel en de uitslagen bij."
                      : "De host kiest het spel. Je hoeft verder niets te doen."}
              </p>
            </section>
            {data.at_table && (
              <section className="gnv2-guest-panel">
                <h2 className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Aan tafel{" "}
                  <span className="gnv2-dialog-muted">
                    ({data.players.length})
                  </span>
                </h2>
                <ul className="gnv2-guest-roster">
                  {data.players.map((player) => (
                    <li
                      key={player.id}
                      style={{ borderColor: player.color ?? undefined }}
                    >
                      <div className="gnv2-guest-roster-avatar">
                        <GuestAvatar
                          name={player.name}
                          face={player.guest_face}
                          body={player.body}
                        />
                      </div>
                      <span>
                        {player.name}
                        {player.id === data.me.id && <small>jij</small>}
                      </span>
                    </li>
                  ))}
                </ul>
                {!complete && (
                  <p className="gnv2-guest-footnote">
                    De lobby wordt automatisch bijgewerkt.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </GnV2Scene>
  );
}
