import { Candle } from "./Candle";

// Twee losse kaarsen rond de tafel — een derde (rechts, bij het menu) is
// hier bewust weggelaten: op 1280×800 viel hij visueel achter de rechter
// menuplaquettes (z-30) zodat alleen de vlam/gloed door de kier tussen twee
// plaquettes zichtbaar bleef en de candle-base onzichtbaar was ("los
// vlammetje"). Twee duidelijk zichtbare kaarsen zijn beter dan een derde
// die niet overtuigend werkt. De linkerkaars staat iets naar rechts/beneden
// t.o.v. eerdere versies, zodat hij niet meer tegen de GAME NIGHT-wordmark
// in de navigatie aan komt. Alleen zichtbaar vanaf tablet-landscape (lg:).
const POSITIONS = [
  { top: "11%", left: "10%", size: "lg" as const, seed: 2 },
  // Iets naar links/beneden t.o.v. de vorige positie (was top:6%/left:95%)
  // zodat er duidelijke ruimte ontstaat tussen deze kaars en de fichenkom
  // ernaast — ze overlapten eerder zichtbaar. Alleen de positie is
  // aangepast, niets aan de kaars zelf (basis/vlam/glow) is veranderd.
  { top: "8%", left: "87%", size: "md" as const, seed: 5 },
];

export function CandleLayer() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 hidden lg:block"
      aria-hidden
    >
      {POSITIONS.map((pos, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ top: pos.top, left: pos.left }}
        >
          <Candle seed={pos.seed} size={pos.size} />
        </div>
      ))}
    </div>
  );
}
