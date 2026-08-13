import QRCodeStyling from "qr-code-styling";

// Losstaand van qr-code-display.tsx (dat exporteert alleen het React-
// component, dit bestand alleen platte functies/waarden) zodat Fast Refresh
// voor beide bestanden schoon blijft werken.

// Eén plek voor de QR-stijl (dots/hoeken/quiet zone), gedeeld door
// QrCodeDisplay (op-scherm) én downloadQrCodeImage (bestand) — zodat een
// gedownload bestand er identiek uitziet aan wat er op het scherm staat, en
// er nergens een tweede QR-stijldefinitie ontstaat.
export function buildQrCodeStylingOptions(size: number, backgroundColor: string) {
  return {
    width: size,
    height: size,
    type: "svg" as const,
    // Quiet zone ZIT IN de afbeelding zelf (niet alleen als CSS-padding
    // eromheen) — cruciaal voor scanbaarheid vanaf een geprinte/uitgeknipte
    // sticker of een gedownload bestand. qr-code-styling's default is
    // margin:0.
    margin: Math.round(size * 0.07),
    dotsOptions: { type: "rounded" as const, color: "#000000" },
    cornersSquareOptions: { type: "extra-rounded" as const, color: "#000000" },
    cornersDotOptions: { type: "dot" as const, color: "#000000" },
    backgroundOptions: { color: backgroundColor },
    qrOptions: { errorCorrectionLevel: "M" as const },
  };
}

/** Bestandsveilige naam: geen pad-scheidingstekens of andere tekens die op
 *  desktop/mobiel voor problemen kunnen zorgen in een gedownloade bestandsnaam. */
function slugifyFilename(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "qr-label";
}

/**
 * Genereert dezelfde QR-stijl als QrCodeDisplay, maar los van een zichtbaar
 * component, en start direct een bestandsdownload (PNG) — voor de
 * "Downloaden"-knop bij een QR-label. Hergebruikt bewust
 * buildQrCodeStylingOptions (geen tweede QR-implementatie); alleen op een
 * hogere resolutie dan het scherm-formaat, zodat het bestand ook scherp
 * genoeg is om af te drukken.
 */
export async function downloadQrCodeImage(data: string, filenameBase: string, size = 1024): Promise<void> {
  const qr = new QRCodeStyling(buildQrCodeStylingOptions(size, "#ffffff"));
  qr.update({ data });
  await qr.download({ name: slugifyFilename(filenameBase), extension: "png" });
}
