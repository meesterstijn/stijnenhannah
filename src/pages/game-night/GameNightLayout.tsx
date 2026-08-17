import { Outlet } from "react-router-dom";

// Geneste layout voor /game-night — zelfde rol als GitaarLayout: bundelt de
// subroutes via <Outlet> en zet de eigen thema-klasse (.gamenight-theme,
// zie styles.css) op precies de plek waar deze module leeft, zodat de
// nieuwe visuele wereld nergens buiten /game-night lekt.
export default function GameNightLayout() {
  return (
    <div className="gamenight-theme">
      <Outlet />
    </div>
  );
}
