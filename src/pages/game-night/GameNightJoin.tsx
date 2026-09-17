import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  useGuestOptions,
  useGuestPlayers,
  useGuestState,
  type GuestPlayer,
  type GuestProfileInput,
} from "@/features/game-night/hooks/useGameNightGuest";
import {
  ensureGuestToken,
  createGuestToken,
  guestErrorMessage,
  readGuestToken,
} from "@/features/game-night/lib/guestIdentity";
import { GuestProfileForm } from "@/features/game-night/v2/GuestProfileForm";
import { GuestPlayerPicker } from "@/features/game-night/v2/GuestPlayerPicker";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";

export default function GameNightJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [guestToken] = useState(readGuestToken);
  const restored = useGuestState(guestToken, undefined, token);
  const options = useGuestOptions(guestToken, token);
  const playerList = useGuestPlayers(token);
  const [creating, setCreating] = useState(false);
  // Persist the same credential throughout a retry, including a lost response.
  const attempt = useRef<{ key: string; credential: string } | null>(null);
  const join = useMutation({
    mutationFn: async (
      input: { player: GuestPlayer } | { profile: GuestProfileInput },
    ) => {
      const key = "player" in input ? input.player.id : "new";
      if (attempt.current?.key !== key) {
        const remembered =
          "player" in input &&
          options.data?.me?.id === input.player.id &&
          guestToken === readGuestToken();
        attempt.current = {
          key,
          credential: remembered ? ensureGuestToken() : createGuestToken(),
        };
      }
      const credentials = {
        p_join_token: token,
        p_guest_token: attempt.current.credential,
      };
      const { data, error } =
        "player" in input
          ? await supabase.rpc("game_night_choose_guest_player", {
              ...credentials,
              p_player_id: input.player.id,
            })
          : await supabase.rpc("game_night_join_as_guest", {
              ...credentials,
              ...input.profile,
            });
      if (error) throw error;
      return data as { session_id: string };
    },
    onSuccess: (result) =>
      navigate(`/game-night/guest/${result.session_id}`, { replace: true }),
  });

  // Recover membership even after the host renewed the QR or ended the night.
  if (guestToken && restored.isLoading) return <GnV2Loading />;
  if (restored.data?.valid)
    return (
      <Navigate to={`/game-night/guest/${restored.data.session.id}`} replace />
    );
  if (options.isLoading || playerList.isLoading) return <GnV2Loading />;
  const loadError = options.error ?? restored.error ?? playerList.error;
  const valid = options.data?.invitation?.valid && playerList.data?.valid;
  const players = playerList.data?.players ?? [];
  const showCreate = creating || players.length === 0;

  return (
    <GnV2Scene className="gnv2-guest-scene">
      <main className="gnv2-guest-shell">
        <header className="gnv2-guest-heading">
          <p className="gnv2-identity-eyebrow">Game Night · schuif aan</p>
          <h1>
            {valid
              ? options.data?.invitation?.game_night_name
              : "Welkom aan tafel"}
          </h1>
          {valid && (
            <p>
              {showCreate
                ? "Maak je speler één keer aan. Je naam en avatar bewaren we voor de volgende avond."
                : "Welkom terug! Kies je speler en schuif aan."}
            </p>
          )}
        </header>
        {loadError ? (
          <div className="gnv2-guest-panel" role="alert">
            <p>{guestErrorMessage(loadError)}</p>
            <button
              className="gnv2-btn gnv2-btn-primary mt-4"
              onClick={() => {
                void options.refetch();
                void playerList.refetch();
                if (guestToken) void restored.refetch();
              }}
            >
              Opnieuw proberen
            </button>
          </div>
        ) : !valid || !options.data ? (
          <div className="gnv2-guest-panel">
            <h2>Deze uitnodiging is verlopen</h2>
            <p>Vraag de host om de nieuwste QR-code en scan die opnieuw.</p>
          </div>
        ) : (
          <div className="gnv2-guest-panel">
            {showCreate ? (
              <GuestProfileForm
                options={options.data}
                pending={join.isPending}
                error={join.error ? guestErrorMessage(join.error) : null}
                onSubmit={(profile) => join.mutate({ profile })}
                onCancel={
                  players.length
                    ? () => {
                        join.reset();
                        setCreating(false);
                      }
                    : undefined
                }
                cancelLabel="Terug naar spelers kiezen"
              />
            ) : (
              <>
                <GuestPlayerPicker
                  players={players}
                  rememberedId={options.data.me?.id}
                  pending={join.isPending}
                  onChoose={(player) => join.mutate({ player })}
                  onCreate={() => {
                    join.reset();
                    setCreating(true);
                  }}
                />
                {join.isPending && (
                  <p role="status" className="gnv2-guest-footnote">
                    Je schuift aan…
                  </p>
                )}
                {join.error && (
                  <p role="alert" className="gnv2-guest-error mt-4">
                    {guestErrorMessage(join.error)}
                  </p>
                )}
              </>
            )}
            <p className="gnv2-guest-footnote">
              Geen account of wachtwoord nodig. De volgende keer kies je gewoon
              weer je eigen speler, ook op een andere telefoon.
            </p>
          </div>
        )}
      </main>
    </GnV2Scene>
  );
}
