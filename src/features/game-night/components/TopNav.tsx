import { useState } from "react";
import { Link } from "react-router-dom";
import { Crown, LogOut, Music, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const NAV_LINKS = [
  { to: "/game-night/spellen", label: "Spellenkast" },
  { to: "/game-night/hall-of-fame", label: "Hall of Fame" },
  { to: "/game-night/geschiedenis", label: "Geschiedenis" },
];

// Bovenste navigatie (section 6). Muziek/geluid zijn echte toggle-buttons
// (aria-pressed, visuele state) — er is nog geen ambiance-audiosysteem om
// aan te sturen, dus ze doen bewust nog niets buiten hun eigen visuele
// staat; de gebruikerschip is wél volledig functioneel (uitloggen, zelfde
// actie als op Home.tsx) — section 19 vraagt expliciet om "gebruiker" en
// "audio" als echte interactie-elementen, niet als platte tekst.
export function TopNav() {
  const { profile, session } = useAuth();
  const [musicOn, setMusicOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const displayName =
    profile?.display_name || session?.user.email?.split("@")[0] || "Speler";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="gn-topnav">
      <div className="flex items-center gap-6">
        <Link to="/game-night" className="flex items-center gap-1.5">
          <Crown
            className="h-[1.15rem] w-[1.15rem]"
            style={{ color: "var(--gn-brass)" }}
            strokeWidth={1.8}
          />
          <span className="gn-display text-xl font-semibold tracking-wide">
            Game Night
          </span>
        </Link>
        <nav className="hidden items-center gap-5 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="gn-topnav-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMusicOn((v) => !v)}
          aria-pressed={musicOn}
          aria-label={musicOn ? "Ambiance-muziek uit" : "Ambiance-muziek aan"}
          className="gn-topnav-icon-btn"
          style={
            musicOn
              ? { color: "var(--gn-brass)", borderColor: "var(--gn-brass)" }
              : undefined
          }
        >
          <Music className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setSoundOn((v) => !v)}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Geluid uit" : "Geluid aan"}
          className="gn-topnav-icon-btn"
          style={
            soundOn
              ? { color: "var(--gn-brass)", borderColor: "var(--gn-brass)" }
              : undefined
          }
        >
          {soundOn ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="gn-topnav-user"
          aria-label={`Uitloggen (${displayName})`}
          title="Uitloggen"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{
              background: "var(--gn-brass-soft)",
              color: "var(--gn-brass)",
            }}
          >
            {initial}
          </span>
          <span className="hidden sm:inline">{displayName}</span>
          <LogOut className="h-3.5 w-3.5 opacity-60" />
        </button>
      </div>
    </div>
  );
}
