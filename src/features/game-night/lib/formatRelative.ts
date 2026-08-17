export function formatRelativeDate(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Vorige week";
  if (weeks < 5) return `${weeks} weken geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}
