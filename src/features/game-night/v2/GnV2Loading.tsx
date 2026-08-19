import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";

// Game Night V2.7C (sectie 6) — de enige laadstatus die GameNightHome nog
// mag tonen vóórdat bekend is welke GNV2-scene hoort te renderen. Vervangt
// het oude "Even geduld..."-tekstje dat nog binnen de houten .gn-board
// stond — dat liet tijdens elke laad-/invalidatie-overgang een frame
// houten UI zien. Puur een rustpunt, geen eigen state/logica.
export function GnV2Loading() {
  return (
    <GnV2Scene className="gnv2-loading-scene">
      <div className="gnv2-loading">
        <div className="gnv2-loading-pulse" aria-hidden />
      </div>
    </GnV2Scene>
  );
}
