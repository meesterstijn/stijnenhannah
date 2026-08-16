import { Outlet } from "react-router-dom";
import { GuitarSidebar } from "@/features/guitar/components/GuitarSidebar";
import { GuitarMobileTabs } from "@/features/guitar/components/GuitarMobileTabs";

// Geneste layout voor /gitaar, zelfde rol als TuingidsLayout/CocktailBarLayout
// (bundelt de subroutes via <Outlet>). Desktop: smalle linkerzijbalk +
// hoofdcontent (section 4). Mobiel: horizontale tabbalk i.p.v. een
// permanente sidebar, zie GuitarMobileTabs.
export default function GitaarLayout() {
  return (
    <div className="guitar-theme">
      <div className="md:hidden mb-6">
        <GuitarMobileTabs />
      </div>
      <div className="grid gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
        <div className="hidden md:block">
          <GuitarSidebar />
        </div>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
