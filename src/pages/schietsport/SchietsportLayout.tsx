import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import "@/features/schietsport/schietsport.css";
import { SchietsportSidebar } from "@/features/schietsport/components/SchietsportSidebar";
import {
  SchietsportBottomNav,
  SchietsportMobileTopBar,
} from "@/features/schietsport/components/SchietsportMobileNav";
import { SchietsportProvider } from "@/features/schietsport/hooks/SchietsportProvider";
import { Toaster } from "@/components/ui/sonner";

// Geneste layout voor /schietsport, zelfde opzet als GitaarLayout: desktop
// een linkerkolom, mobiel een bovenbalk + vaste onderbalk met plusknop.
// Full-bleed (SiteLayout geeft hier geen container), zodat het donkere
// thema de hele viewport vult.
export default function SchietsportLayout() {
  // Donkere paginaachtergrond (ook bij overscroll en in de iOS-statusbalk)
  // zolang de module open is; daarna weer zoals de rest van de site.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.backgroundColor;
    html.style.backgroundColor = "#121210";
    return () => {
      html.style.backgroundColor = previous;
    };
  }, []);

  return (
    <SchietsportProvider>
      <div className="schietsport-theme min-h-dvh">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-12 md:pt-8">
          <div className="md:hidden">
            <SchietsportMobileTopBar />
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[210px_minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)]">
            <div className="hidden md:block">
              <SchietsportSidebar />
            </div>
            <div className="min-w-0">
              <Outlet />
            </div>
          </div>
        </div>
        <div className="md:hidden">
          <SchietsportBottomNav />
        </div>
        <Toaster position="top-center" theme="dark" />
      </div>
    </SchietsportProvider>
  );
}
