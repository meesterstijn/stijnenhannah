import { useState } from "react";
import { Plus, UserRound } from "lucide-react";
import type { GuestPlayer } from "@/features/game-night/hooks/useGameNightGuest";
import { GuestAvatar } from "@/features/game-night/v2/GuestProfileForm";

export function GuestPlayerPicker({
  players,
  rememberedId,
  pending,
  onChoose,
  onCreate,
}: {
  players: GuestPlayer[];
  rememberedId?: string;
  pending: boolean;
  onChoose: (player: GuestPlayer) => void;
  onCreate: () => void;
}) {
  const [search, setSearch] = useState("");
  const visible = players
    .filter((player) =>
      player.name
        .toLocaleLowerCase("nl")
        .includes(search.trim().toLocaleLowerCase("nl")),
    )
    .sort(
      (a, b) =>
        Number(b.id === rememberedId) - Number(a.id === rememberedId) ||
        a.name.localeCompare(b.name, "nl"),
    );

  return (
    <section aria-labelledby="guest-picker-title">
      <h2 id="guest-picker-title">Wie speelt er mee?</h2>
      <p className="gnv2-dialog-muted">
        Kies je opgeslagen speler. Je naam, avatar en spelhistorie blijven
        behouden.
      </p>
      {players.length > 8 && (
        <label className="gnv2-guest-label">
          Zoek je naam
          <input
            className="gnv2-input mt-2"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Naam zoeken…"
          />
        </label>
      )}
      <ul className="gnv2-guest-player-picker">
        {visible.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onChoose(player)}
              className="gnv2-guest-player-choice"
              aria-label={`Verder als ${player.name}`}
            >
              <span
                className="gnv2-guest-player-avatar"
                style={{ borderColor: player.color ?? undefined }}
              >
                <GuestAvatar
                  name={player.name}
                  face={player.guest_face}
                  body={player.body}
                  photoPath={player.face_asset_path}
                  photoRevision={player.face_revision}
                />
              </span>
              <span className="gnv2-guest-player-name">{player.name}</span>
              {player.id === rememberedId && (
                <small>
                  <UserRound className="h-3 w-3" aria-hidden="true" />
                  Op dit apparaat
                </small>
              )}
            </button>
          </li>
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="gnv2-dialog-muted my-4">
          Geen speler gevonden met deze naam.
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={onCreate}
        className="gnv2-btn gnv2-btn-ghost w-full mt-4"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nieuwe speler maken
      </button>
    </section>
  );
}
