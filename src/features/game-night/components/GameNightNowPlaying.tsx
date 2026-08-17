import { useCallback, useEffect, useState } from "react";
import { Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import {
  initiateSpotifyLogin,
  isSpotifyConnected,
  getNowPlaying,
  togglePlayback,
  skipTrack,
  type NowPlaying,
} from "@/lib/spotify";

// Ingebouwde playback-controller tijdens een actieve Game Night (correctie:
// "Spotify ombouwen naar controller") — hergebruikt uitsluitend de
// BESTAANDE Spotify-koppeling (src/lib/spotify.ts: zelfde PKCE-auth/tokens/
// refresh-logica als src/components/spotify-widget.tsx op de hoofdpagina).
// Geen tweede OAuth, geen nieuwe tokenopslag, geen nieuwe Spotify-app.
// `skipTrack("previous"|"next")` bestond al voor beide richtingen — geen
// nieuwe helper nodig voor "vorige".
//
// Bewust GEEN in-/uitklap-stap meer (dat kostte een extra tik vóór Next/
// Previous bruikbaar was) — het paneel toont cover/titel/artiest + drie
// 48px-knoppen direct. Spotify is en blijft ambiance, nooit kernfunctionaliteit
// (elke fout/afwezige koppeling/geen actief device geeft hier alleen een
// compacte staat, nooit een blokkade van Game Night) — de enige uitzondering
// is de "Koppelen"-knop wanneer er nog geen geldige auth bestaat.
export function GameNightNowPlaying() {
  const [connected, setConnected] = useState(isSpotifyConnected);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const fetchNowPlaying = useCallback(async () => {
    if (!isSpotifyConnected()) return;
    const result = await getNowPlaying();
    setNowPlaying(result);
    setHasFetchedOnce(true);
  }, []);

  useEffect(() => {
    if (!connected) return;
    fetchNowPlaying();
    // Redelijke periodieke polling (10s), geen agressieve API-calls; wordt
    // netjes opgeruimd bij unmount (bv. zodra de actieve speelmodus eindigt).
    const interval = setInterval(fetchNowPlaying, 10_000);
    return () => clearInterval(interval);
  }, [connected, fetchNowPlaying]);

  async function handleToggle() {
    if (!nowPlaying || actionPending) return;
    setActionPending(true);
    await togglePlayback(nowPlaying.isPlaying);
    setTimeout(() => {
      fetchNowPlaying();
      setActionPending(false);
    }, 500);
  }

  async function handleSkip(direction: "next" | "previous") {
    if (actionPending) return;
    setActionPending(true);
    await skipTrack(direction);
    setTimeout(() => {
      fetchNowPlaying();
      setActionPending(false);
    }, 700);
  }

  // Nog geen geldige Spotify-auth — de enige situatie waarin een auth-actie
  // hier logisch is; tijdens normale playback verlaat de gebruiker Game
  // Night nooit. Zelfde fysieke paneel in ruststand, geen los popupje.
  if (!connected) {
    return (
      <div className="gn-nowplaying-card gn-nowplaying-card-compact">
        <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
        <p className="gn-faint text-xs">Spotify niet verbonden</p>
        <button
          type="button"
          onClick={() => initiateSpotifyLogin().then(() => setConnected(true))}
          className="gn-button mt-2 flex min-h-[44px] w-full items-center justify-center px-4 text-xs"
        >
          Spotify koppelen
        </button>
      </div>
    );
  }

  // Wel gekoppeld, maar de eerste poll is nog niet binnen — voorkom een
  // verkeerde "geen apparaat"-flits vlak na het openen van de pagina.
  if (!hasFetchedOnce) {
    return (
      <div className="gn-nowplaying-card gn-nowplaying-card-compact">
        <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
        <Music className="gn-faint h-4 w-4" strokeWidth={1.7} />
      </div>
    );
  }

  // Gekoppeld, maar Spotify meldt geen actief apparaat/afspeelsessie.
  if (!nowPlaying) {
    return (
      <div className="gn-nowplaying-card gn-nowplaying-card-compact">
        <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
        <p className="text-xs font-medium">Geen actief apparaat</p>
        <p className="gn-faint mt-1 text-xs leading-snug">
          Open Spotify op een apparaat
        </p>
      </div>
    );
  }

  return (
    <div className="gn-nowplaying-card">
      <span className="gn-eyebrow gn-nowplaying-eyebrow">Muziek</span>
      <div className="flex items-center gap-2.5">
        {nowPlaying.albumArt ? (
          <img
            src={nowPlaying.albumArt}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--gn-brass-soft)" }}
          >
            <Music className="h-5 w-5" style={{ color: "var(--gn-brass)" }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {nowPlaying.trackName}
          </p>
          <p className="gn-faint truncate text-xs">{nowPlaying.artistName}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => handleSkip("previous")}
          disabled={actionPending}
          className="gn-nowplaying-btn"
          aria-label="Vorige"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleToggle}
          disabled={actionPending}
          className="gn-nowplaying-btn gn-nowplaying-btn-primary"
          aria-label={nowPlaying.isPlaying ? "Pauzeer" : "Speel af"}
        >
          {nowPlaying.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSkip("next")}
          disabled={actionPending}
          className="gn-nowplaying-btn"
          aria-label="Volgende"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
