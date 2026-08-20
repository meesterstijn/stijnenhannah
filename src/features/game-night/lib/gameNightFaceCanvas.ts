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

// ── Head-crop-vóór-segmentation (nieuwe flow) ────────────────────────────
//
// De speler positioneert eerst zijn hoofd binnen de canonieke guides op de
// RUWE (nog niet gesegmenteerde) foto — exact diezelfde `croppedAreaPixels`-
// rechthoek die vroeger rechtstreeks naar de 512x512-export ging, dient nu
// ALLEEN nog als basis om een iets ruimer "hoofdgebied" te bepalen. Dat
// ruimere gebied (niet de volledige foto, en niet de exacte, strakke crop)
// is de input voor MediaPipe: genoeg marge voor volledige haarlijn/oren,
// maar zo min mogelijk shirt/schouders/borst — precies het gevraagde
// "eerst head crop, daarna segmentation" (i.p.v. de oude volgorde: eerst de
// hele foto segmenteren, dan pas croppen).
export const HEAD_CROP = {
  // 40% marge rondom de door de speler bevestigde crop — ruim genoeg voor
  // volledige haarlijn/oren bij vrijwel elke hoofdgrootte/-positionering,
  // zonder de borst/schouders standaard al mee te nemen (die beginnen pas
  // ver buiten dit gebied bij een normaal geframede selfie).
  marginFactor: 1.4,
  // Verstandige tijdelijke resolutie voor de segmentatie-input (opdracht
  // sectie 12, "rapporteer welke resolutie je kiest"): het model verwerkt
  // intern sowieso op een vast 256x256-grid (zie
  // gameNightFaceSegmentation.ts), dus een véél grotere input levert geen
  // scherpere maskerrand op. 640px is ruim boven die interne modelresolutie
  // (voorkomt zichtbare blokkerigheid na het terugschalen naar de
  // uiteindelijke 512x512-export) maar ver onder de volledige ~1600px-foto
  // (aanzienlijk snellere canvas-compositing op mobiel dan het oude
  // "segmenteer de hele foto"-pad).
  maxOutputSidePx: 640,
} as const;

// ── Nek-cutoff (opdracht sectie 7) ────────────────────────────────────────
//
// Zelfs met head-only segmentation-input kan MediaPipe nog een stukje nek/
// kraag/shirt als "persoon" classificeren. Dit is een TWEEDE, deterministische
// maskeerstap, losstaand van de segmentatie-confidence: een verticale
// alfa-fade in het canonieke 512x512-canvas zelf, uitsluitend gebaseerd op
// FACE_ANCHOR.chinY (320) — dus onafhankelijk van crop-/head-cropresolutie
// of segmentatiekwaliteit.
//
// Gekozen waarden (na visuele beoordeling tegen bestaande FACE_ANCHOR-
// verhoudingen, chinY=320 op een 512-canvas):
//   allowancePx: 26 — een klein, ONgefade stukje nek direct onder de kin
//     blijft volledig behouden (voorkomt een onnatuurlijk harde afsnede
//     precies onder de kaaklijn/baard).
//   fadePx: 34 — daarna een geleidelijke (lineaire) alfa-afname naar 0,
//     over de volgende 34px (canonieke Y 346→380).
// Alfa is GEGARANDEERD 0 vanaf canonieke Y 380 (chinY + allowancePx +
// fadePx) — een harde, resolutie-onafhankelijke ondergrens die kleding nooit
// kan overleven, zelfs niet bij een onvolledig/optimistisch segmentatie-
// masker. BODY_REFERENCE.topY (264) ligt ruim boven deze grens: de
// body/clothing-laag (die ONDER de face-laag rendert, zie
// PERSONAL_FACE_LAYER_ORDER) schemert vanaf Y380 gewoon door, exact zoals
// bedoeld — kleding komt voortaan uitsluitend uit body/clothing-assets, nooit
// uit de selfie zelf (opdracht sectie 14).
export const NECK_CUTOFF = {
  allowancePx: 26,
  fadePx: 34,
} as const;

// Versie-string voor face_crop.neckCutoffVersion (zelfde herverwerkings-
// motivatie als segmentationVersion, zie GameNightFaceCrop in
// src/lib/supabase.ts) — wijzigt zodra allowancePx/fadePx hierboven ooit
// wijzigen, zodat een toekomstige sessie selectief kan herverwerken.
export const NECK_CUTOFF_VERSION = "neck-fade-v1";

export type FaceSourceRect = {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
};

/**
 * Bepaalt het (vierkante) hoofdgebied dat als segmentatie-input dient, uit
 * de door de speler bevestigde crop-rechthoek (in pixels van de BRON-foto).
 * Vergroot rondom hetzelfde middelpunt met HEAD_CROP.marginFactor, geclamped
 * binnen de daadwerkelijke fotogrenzen — bij een hoofd dicht tegen de
 * fotorand schuift het gebied simpelweg op, nooit een out-of-bounds
 * rechthoek richting drawImage.
 */
export function computeHeadCropSourceRect(
  crop: FaceSourceRect,
  imageWidth: number,
  imageHeight: number,
): FaceSourceRect {
  const centerX = crop.sourceX + crop.sourceWidth / 2;
  const centerY = crop.sourceY + crop.sourceHeight / 2;
  const expandedSide = Math.max(
    crop.sourceWidth * HEAD_CROP.marginFactor,
    crop.sourceHeight * HEAD_CROP.marginFactor,
  );
  const size = Math.min(expandedSide, imageWidth, imageHeight);
  const x = Math.min(Math.max(centerX - size / 2, 0), imageWidth - size);
  const y = Math.min(Math.max(centerY - size / 2, 0), imageHeight - size);
  return { sourceX: x, sourceY: y, sourceWidth: size, sourceHeight: size };
}

/**
 * Tekent `rect` uit `image` op een nieuw, vierkant canvas, geschaald zodat
 * de langste zijde nooit boven `maxSidePx` uitkomt (nooit vergroot — een
 * rect kleiner dan maxSidePx blijft op zijn eigen grootte). Levert naast het
 * canvas ook de gebruikte schaalfactor (outputzijde/rect-zijde), nodig om
 * later een coördinaat uit BRON-ruimte naar dit canvas' pixelruimte om te
 * rekenen (zie mapRectIntoRegion).
 */
export function drawRegionToCanvas(
  image: HTMLImageElement | HTMLCanvasElement,
  rect: FaceSourceRect,
  maxSidePx: number,
): { canvas: HTMLCanvasElement; scale: number } {
  const outputSide = Math.min(maxSidePx, Math.round(rect.sourceWidth));
  const scale = outputSide / rect.sourceWidth;
  const canvas = document.createElement("canvas");
  canvas.width = outputSide;
  canvas.height = outputSide;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Kan geen 2D-canvascontext aanmaken voor de head-crop.");
  }
  ctx.drawImage(
    image,
    rect.sourceX,
    rect.sourceY,
    rect.sourceWidth,
    rect.sourceHeight,
    0,
    0,
    outputSide,
    outputSide,
  );
  return { canvas, scale };
}

/**
 * Rekent een rechthoek uit BRON-fotoruimte (bv. de oorspronkelijke,
 * strakke crop van de speler) om naar pixelruimte van een head-crop-canvas
 * dat via drawRegionToCanvas uit `region` (hetzelfde bronbeeld, ruimer
 * gebied) is getekend — puur een affiene verschuiving+schaal, geen nieuwe
 * crop-beslissing.
 */
export function mapRectIntoRegion(
  crop: FaceSourceRect,
  region: FaceSourceRect,
  scale: number,
): FaceSourceRect {
  return {
    sourceX: (crop.sourceX - region.sourceX) * scale,
    sourceY: (crop.sourceY - region.sourceY) * scale,
    sourceWidth: crop.sourceWidth * scale,
    sourceHeight: crop.sourceHeight * scale,
  };
}

/**
 * Past de nek-cutoff-fade (zie NECK_CUTOFF hierboven) toe op een canvas van
 * exact CHARACTER_CANVAS-afmetingen — vermenigvuldigt per pixel-rij vanaf
 * canonieke Y (FACE_ANCHOR.chinY + allowancePx) de bestaande alfawaarde met
 * een lineair aflopende factor (1 → 0 over fadePx), en dwingt alfa=0 af
 * vanaf de volledige fade-grens. Leest/schrijft uitsluitend de onderste
 * strook (nooit de volledige canvas) — goedkoop, ook op mobiel.
 */
export function applyNeckCutoffFade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const solidUntilY = FACE_ANCHOR.chinY + NECK_CUTOFF.allowancePx;
  const fadeEndY = solidUntilY + NECK_CUTOFF.fadePx;
  const startRow = Math.max(0, Math.floor(solidUntilY));
  if (startRow >= height) return;
  const stripHeight = height - startRow;
  const imageData = ctx.getImageData(0, startRow, width, stripHeight);
  const pixels = imageData.data;
  for (let y = startRow; y < height; y++) {
    let factor: number;
    if (y <= solidUntilY) factor = 1;
    else if (y >= fadeEndY) factor = 0;
    else factor = 1 - (y - solidUntilY) / (fadeEndY - solidUntilY);
    if (factor === 1) continue;
    const rowOffset = (y - startRow) * width;
    for (let x = 0; x < width; x++) {
      const idx = (rowOffset + x) * 4 + 3;
      pixels[idx] = factor === 0 ? 0 : Math.round(pixels[idx] * factor);
    }
  }
  ctx.putImageData(imageData, 0, startRow);
}

/**
 * Rendert een 512x512 PNG-blob uit een bronafbeelding (of -canvas) + een
 * crop-rechthoek (in pixels van de BRON). Puur een schaal/teken-operatie —
 * GEEN automatische crop/centrering/reconstructie: de speler heeft de
 * positionering zelf al bepaald via de cropper-guides, dit tekent letterlijk
 * dat gekozen gebied op het canonieke canvas, en past daarna de nek-cutoff-
 * fade toe (zie applyNeckCutoffFade hierboven).
 *
 * De bronafbeelding is inmiddels altijd de al-gesegmenteerde, transparante
 * achtergrond-verwijderde head-crop (zie gameNightFaceSegmentation.ts) —
 * deze functie zelf doet GEEN fillRect/fillStyle en vult het canvas nooit
 * met een achtergrondkleur, dus het alfakanaal van de bron blijft exact
 * behouden tot en met de PNG-export (canvas.toBlob met "image/png" bewaart
 * alpha; JPEG/WebP-zonder-alpha wordt hier bewust nooit gebruikt).
 */
export async function renderCanonicalFaceCanvas(
  image: HTMLImageElement | HTMLCanvasElement,
  crop: FaceSourceRect,
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
  applyNeckCutoffFade(ctx, CHARACTER_CANVAS.width, CHARACTER_CANVAS.height);
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
