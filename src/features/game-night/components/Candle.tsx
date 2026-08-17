import type { CSSProperties } from "react";

// Eén kaars (section 11/12/13): een echt fotoasset als basis
// (public/game-night/assets/candle-base.webp, uitgesneden uit de
// aangeleverde asset-sheet — de versie ZONDER brandende vlam, zie het
// opleverrapport voor waarom) met een losse, apart geanimeerde vlam
// (flame-a/flame-b.webp) erboven. Elke instantie krijgt een eigen
// (deterministische, niet-Math.random) timing/schaal/spiegeling via `seed`,
// zodat vier kaarsen nooit synchroon bewegen en niet identiek ogen —
// dezelfde twee assets worden dus meerdere keren hergebruikt (section 15).
export function Candle({
  seed,
  size = "md",
  className = "",
}: {
  seed: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const flickerDuration = 2.6 + (seed % 5) * 0.35;
  const flickerDelay = (seed % 7) * 0.31;
  const glowDuration = 5.5 + (seed % 4) * 1.4;
  const glowDelay = (seed % 6) * 0.6;
  const mirror = seed % 2 === 0;
  const flameSrc =
    seed % 2 === 0
      ? "/game-night/assets/flame-a.webp"
      : "/game-night/assets/flame-b.webp";
  const flameMirror = seed % 3 === 0;
  const baseTilt = -2 + (seed % 5) * 0.9;

  const style = {
    "--gn-flicker-dur": `${flickerDuration}s`,
    "--gn-flicker-delay": `${flickerDelay}s`,
    "--gn-glow-dur": `${glowDuration}s`,
    "--gn-glow-delay": `${glowDelay}s`,
  } as CSSProperties;

  const widths = { sm: "2.6rem", md: "3.6rem", lg: "4.6rem" };

  return (
    <div
      className={`gn-candle-v2 ${className}`}
      style={{ ...style, width: widths[size] }}
      aria-hidden
    >
      {/* Stapelvolgorde (ook geborgd via z-index in CSS): glow → candle-base
          → vlam, zodat de vlam nooit door het glas wordt overschilderd. */}
      <div className="gn-candle-glow-ambient" />
      <div className="gn-candle-glow-mid" />
      <div className="gn-candle-glow-core" />

      <img
        src="/game-night/assets/candle-base.webp"
        alt=""
        className="gn-candle-base-img"
        style={{
          transform: `rotate(${baseTilt}deg) ${mirror ? "scaleX(-1)" : ""}`,
        }}
      />

      <div className="gn-candle-flame-wrap">
        <img
          src={flameSrc}
          alt=""
          className="gn-candle-flame-img"
          style={{ transform: flameMirror ? "scaleX(-1)" : undefined }}
        />
      </div>
    </div>
  );
}
