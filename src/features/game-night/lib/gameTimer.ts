// Pure tijd-formatters voor de actieve speelmodus. De ELAPSED SECONDS zelf
// komen altijd uit database-timestamps (zie useElapsedSeconds.ts) — deze
// module doet alleen de weergave.

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours === 0 && minutes === 0) return "<1m";
  if (hours === 0) return `${minutes}m`;
  return `${hours}u ${minutes}m`;
}
