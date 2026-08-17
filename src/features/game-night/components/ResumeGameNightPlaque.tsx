import { PlayCircle } from "lucide-react";
import type { GameNightSession } from "@/lib/supabase";

// "VERDER MET GAME NIGHT" (sectie 17) — verschijnt boven de twee normale
// actieplaquettes zodra er een actieve/gepauzeerde sessie bestaat, in
// dezelfde fysieke plaque-stijl. Geen "Nu bezig: <spel>"-regel in dit
// fundament: welk spel er loopt komt uit game_night_game_sessions, dat pas
// gevuld wordt zodra de spelkiezer (een volgende opdracht) een spelsessie
// aanmaakt.
export function ResumeGameNightPlaque({
  session,
  onClick,
}: {
  session: GameNightSession;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="gn-plaque-action gn-plaque-action-primary w-full px-6 py-3.5 sm:px-7 sm:py-4"
    >
      <PlayCircle
        className="mb-1.5 h-5 w-5"
        style={{ color: "var(--gn-brass)" }}
        strokeWidth={1.7}
      />
      <span className="gn-display text-lg font-semibold tracking-wide sm:text-xl">
        Verder met Game Night
      </span>
      <span className="gn-muted mt-1 text-xs sm:text-sm">
        {session.name} · {session.status === "paused" ? "Gepauzeerd" : "Actief"}
      </span>
    </button>
  );
}
