import { useEffect, useState } from "react";

// Gedeeld tussen Tabletmodus en Big Screen — beide zijn kiosk-achtige
// schermen waar fullscreen relevant is, nergens anders in de app.
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => !!document.fullscreenElement,
  );

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  function toggle() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  return { isFullscreen, toggle };
}
