import { Outlet } from "react-router-dom";
import { useGameNightRealtimeSync } from "@/features/game-night/hooks/useGameNightRealtimeSync";

// Geneste layout voor /game-night — zelfde rol als GitaarLayout: bundelt de
// subroutes via <Outlet> en zet de eigen thema-klasse (.gamenight-theme,
// zie styles.css) op precies de plek waar deze module leeft, zodat de
// nieuwe visuele wereld nergens buiten /game-night lekt.
//
// useGameNightRealtimeSync() wordt hier, en ALLEEN hier, gemount — dit is
// het ENE gedeelde Realtime-kanaal voor de hele /game-night-sectie (Lobby/
// Home, GameNightMe, Character Creator, Face Setup, spelersbeheer, QA,
// enz. renderen allemaal binnen deze <Outlet>). De teruggegeven status/
// laatste-event wordt via React Router's eigen `Outlet context`-mechanisme
// doorgegeven — geen aparte React Context nodig — zodat een dieper
// geneste pagina (CharacterAssetQaGrid.tsx, optionele debugstatus) 'm kan
// uitlezen via useOutletContext() ZONDER zelf nogmaals een kanaal te openen.
export default function GameNightLayout() {
  const realtimeInfo = useGameNightRealtimeSync();
  return (
    <div className="gamenight-theme">
      <Outlet context={realtimeInfo} />
    </div>
  );
}
