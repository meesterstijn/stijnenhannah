// Lokale (per-apparaat) UI-voorkeuren voor de live-tik-flow — bewust géén
// databasekolom: "onthoud de laatst ingevulde MVP-punten als nieuwe
// standaard" is een klein, per-browser gemaksding, geen sessie- of
// LAN-gebonden gegeven dat gedeeld hoeft te worden tussen apparaten of in de
// geschiedenis bewaard hoeft te blijven. localStorage is hiervoor de
// eenvoudigste, meest passende opslag.
const LAST_MVP_POINTS_KEY = "r6_last_mvp_points";

export function getLastMvpPoints(): number | null {
  const raw = localStorage.getItem(LAST_MVP_POINTS_KEY);
  if (raw === null) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setLastMvpPoints(points: number): void {
  localStorage.setItem(LAST_MVP_POINTS_KEY, String(points));
}
