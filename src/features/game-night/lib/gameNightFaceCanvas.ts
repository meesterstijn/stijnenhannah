import type { GameNightFaceCrop } from "@/lib/supabase";

// Game Night — canonieke geometrie voor de persoonlijke face-layer.
// Handmatig getest/goedgekeurd in Photoshop — deze waarden zijn leidend
// voor zowel de cropper (guides) als voor alle toekomstige 512x512
// Photoshop-character-assets (die op exact (0,0) boven elkaar stapelen,
// zie CharacterVisual.tsx). NIET wijzigen zonder de Photoshop-bronbestanden
// opnieuw te herijken.
export const CHARACTER_CANVAS = {
  width: 512,
  height: 512,
} as const;

// centerX/topY/chinY zijn de drie PRIMAIRE, canonical guides die de
// cropper afdwingt/toont. normalizedHeadHeight (chinY - topY) is puur
// documentatie/afgeleid, niet apart canonical.
export const FACE_ANCHOR = {
  centerX: 256,
  topY: 50,
  chinY: 320,
  normalizedHeadHeight: 270,
} as const;

// Alleen documentatie/referentie voor de Photoshop-bodyassets — de cropper
// dwingt dit NIET af (zie de opdracht: "voorlopig alleen documentatie").
// De Y264-320-overlap met FACE_ANCHOR.chinY is bewust: de body/kraag loopt
// achter het hoofd door zodat er geen kier ontstaat (zie CharacterVisual's
// laagvolgorde-commentaar).
export const BODY_REFERENCE = {
  leftX: 68,
  rightX: 422,
  topY: 264,
  bottomY: 480,
} as const;

// Layer_order van de persoonlijke face-photo in de bestaande character-
// compositie (DEFAULT_SLOT_LAYER_ORDER in gameNightCharacter.ts) — exact op
// de positie van de oude/legacy "face"-slot (40): boven body/clothing
// (20/25), onder hair/glasses/headwear (50/55/60). Hier gedefinieerd
// (i.p.v. in gameNightCharacter.ts) omdat dit conceptueel bij de
// face-canvas-geometrie hoort, niet bij de catalogus-slotstructuur.
export const PERSONAL_FACE_LAYER_ORDER = 40;

/**
 * Rendert een 512x512 PNG-blob uit een bronafbeelding + een crop-rechthoek
 * (in pixels van de BRON, exact zoals react-easy-crop's `croppedAreaPixels`
 * teruggeeft). Puur een schaal/teken-operatie — GEEN automatische crop/
 * centrering/reconstructie: de speler heeft de positionering zelf al
 * bepaald via de cropper-guides, dit tekent letterlijk dat gekozen gebied
 * op het canonieke canvas.
 *
 * De bronafbeelding is inmiddels altijd de al-gesegmenteerde, transparante
 * achtergrond-verwijderde afbeelding (zie gameNightFaceSegmentation.ts) —
 * deze functie zelf doet GEEN fillRect/fillStyle en vult het canvas nooit
 * met een achtergrondkleur, dus het alfakanaal van de bron blijft exact
 * behouden tot en met de PNG-export (canvas.toBlob met "image/png" bewaart
 * alpha; JPEG/WebP-zonder-alpha wordt hier bewust nooit gebruikt).
 */
export async function renderCanonicalFaceCanvas(
  image: HTMLImageElement,
  crop: GameNightFaceCrop,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CHARACTER_CANVAS.width;
  canvas.height = CHARACTER_CANVAS.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Kan geen 2D-canvascontext aanmaken voor de face-export.");
  }
  // Canvas start standaard volledig transparant (alpha=0 overal) en wordt
  // hier NERGENS gevuld — drawImage kopieert de bron 1-op-1 inclusief
  // alfakanaal.
  ctx.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    0,
    0,
    CHARACTER_CANVAS.width,
    CHARACTER_CANVAS.height,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else
        reject(
          new Error(
            "Face-afbeelding kan niet worden geëxporteerd (toBlob retourneerde null).",
          ),
        );
    }, "image/png");
  });
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Foto kan niet worden geladen voor de crop-export."));
    img.src = url;
  });
}
