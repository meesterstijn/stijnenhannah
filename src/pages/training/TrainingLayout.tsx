import { useEffect, type CSSProperties } from "react";
import { useActivePalette } from "@/features/training/components/PaletteSwitcher";
import { Outlet, useLocation } from "react-router-dom";
import "@/features/training/training.css";
import { TrainingProvider } from "@/features/training/hooks/TrainingProvider";
import { RestTimerProvider } from "@/features/training/hooks/RestTimer";
import { useProfile } from "@/features/training/hooks/useTrainingData";
import {
  BottomNav,
  OpenSessionBanner,
  TopBar,
  useTrainingScheme,
} from "@/features/training/components/TrainingChrome";
import { FeedbackButton } from "@/features/training/feedback/FeedbackButton";
import { WhatsNew } from "@/features/training/updates/WhatsNew";
import { FEEDBACK_BUTTON_ENABLED } from "@/features/training/feedback/feedback";

const INTER =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";

// Geneste layout voor /training: eigen boven- en onderbalk (met de link
// terug naar Ons Huisje), full-bleed zodat de achtergrond de viewport vult.
// De actieve training krijgt een rustige focusweergave zonder onderbalk.
function Shell() {
  const { pathname } = useLocation();
  const { settings } = useProfile();
  const scheme = useTrainingScheme(settings.appearance);
  const inWorkout = pathname === "/training/workout";
  const { vars } = useActivePalette(scheme);
  const background =
    vars?.["--tr-bg"] ?? (scheme === "dark" ? "#161617" : "#f5f6f8");

  useEffect(() => {
    if (document.head.querySelector(`link[data-tr-font]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = INTER;
    link.dataset.trFont = "inter";
    document.head.appendChild(link);
  }, []);

  // Paginakleur ook bij overscroll en in de statusbalk.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.backgroundColor;
    html.style.backgroundColor = background;
    return () => {
      html.style.backgroundColor = previous;
    };
  }, [background]);

  return (
    <div
      className="training-theme min-h-dvh"
      data-tr-scheme={scheme}
      style={vars as CSSProperties | undefined}
    >
      <div
        className={`mx-auto max-w-5xl px-4 sm:px-6 ${inWorkout ? "pb-24" : "pb-28 md:pb-12"}`}
      >
        {!inWorkout && <TopBar />}
        {!inWorkout && <OpenSessionBanner />}
        <Outlet />
      </div>
      {!inWorkout && <BottomNav />}
      {FEEDBACK_BUTTON_ENABLED && <FeedbackButton low={inWorkout} />}
      {/* Niet midden in een training. */}
      <WhatsNew suppressed={inWorkout} />
    </div>
  );
}

export default function TrainingLayout() {
  return (
    <TrainingProvider>
      <RestTimerProvider>
        <Shell />
      </RestTimerProvider>
    </TrainingProvider>
  );
}
