import { Navigate } from "react-router-dom";

// De spelkeuze-modi ("Kies voor ons"/"Game Roulette", Game Night V4) leven
// nu inline op het bord (GameNightStartedPanel/GameChooserPanel), niet meer
// op deze aparte route. Een oude bookmark/terugknop naar dit pad stuurt
// gewoon door naar de Game Night-home i.p.v. verouderde tekst te tonen.
export default function GameNightPicker() {
  return <Navigate to="/game-night" replace />;
}
