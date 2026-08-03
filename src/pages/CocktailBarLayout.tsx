import { Outlet } from "react-router-dom";

// Geneste layout voor de owner-facing Cocktail Bar-pagina's (route
// /cocktail-bar, zie App.tsx), mirrort TuingidsLayout qua rol (bundelt de
// subroutes). De subnavigatie zelf (Cocktails/Beheer) staat niet meer hier,
// maar in site-layout.tsx, naast de zwevende "Ons Huisje"-link.
export default function CocktailBarLayout() {
  return <Outlet />;
}
