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

// ── Nek-cutoff ─────────────────────────────────────────────────────────────
//
// Zelfs met head-only segmentation-input kan MediaPipe nog een stukje nek/
// kraag/shirt als "persoon" classificeren. Dit is een deterministische
// maskeerstap, losstaand van de segmentatie-confidence: een verticale
// alfa-fade in het canonieke 512x512-canvas zelf, uitsluitend gebaseerd op
// FACE_ANCHOR.chinY (320) — dus onafhankelijk van crop-/head-cropresolutie
// of segmentatiekwaliteit. Werkt samen met HEAD_SAFETY_MASK hieronder (die
// ook X-richting begrenst) — twee onafhankelijke, multiplicatieve
// alfa-maskers, geen onderlinge afhankelijkheid.
//
// Definitieve waarden (bijgesteld t.o.v. de vorige versie — 26/34, canonieke
// Y346→380 — na meldingen dat schouders/shirt soms nog zichtbaar bleven):
//   allowancePx: 25 — klein, ONgefade stukje nek direct onder de kin blijft
//     volledig behouden (canonieke Y320→345, voorkomt een onnatuurlijk harde
//     afsnede precies onder de kaaklijn/baard).
//   fadePx: 25 — daarna een geleidelijke (lineaire) alfa-afname naar 0, over
//     de volgende 25px (canonieke Y345→370).
// Alfa is GEGARANDEERD 0 vanaf canonieke Y370 (chinY + allowancePx + fadePx)
// — 10px eerder dan voorheen (380→370), een harde, resolutie-onafhankelijke
// ondergrens die kleding nooit kan overleven, zelfs niet bij een onvolledig/
// optimistisch segmentatiemasker. BODY_REFERENCE.topY (264) ligt ruim boven
// deze grens: de body/clothing-laag (die ONDER de face-laag rendert, zie
// PERSONAL_FACE_LAYER_ORDER) schemert vanaf Y370 gewoon door — kleding komt
// uitsluitend uit body/clothing-assets, nooit uit de selfie zelf.
export const NECK_CUTOFF = {
  allowancePx: 25,
  fadePx: 25,
} as const;

// Versie-string voor face_crop.neckCutoffVersion (zelfde herverwerkings-
// motivatie als segmentationVersion, zie GameNightFaceCrop in
// src/lib/supabase.ts) — wijzigt zodra allowancePx/fadePx hierboven ooit
// wijzigen, zodat een toekomstige sessie selectief kan herverwerken.
export const NECK_CUTOFF_VERSION = "neck-fade-v2";

// ── Head safety mask ────────────────────────────────────────────────────
//
// NECK_CUTOFF hierboven begrenst alleen de Y-richting (alles onder een
// vaste hoogte verdwijnt). Dat laat één gat open: schouders/kraag die
// SEIZIJDS in beeld komen — bv. bij een dichtbij-genomen selfie — op een Y
// die nog BOVEN de neck-cutoff-grens ligt, worden door MediaPipe terecht als
// "persoon" gezien en dus niet verwijderd door een puur verticaal masker.
// Dit tweede, onafhankelijke masker begrenst daarom ook de X-richting, per
// rij, volgens een natuurlijke "ei/gloeilamp"-vorm (breed rond oren/slapen,
// smaller richting kaak, smal richting nek) — zie HEAD_SAFETY_MASK.keyframes.
//
// Hard uitgangspunt (NIET veranderd t.o.v. de canonical geometrie): dit is
// uitsluitend een MAXIMUM/safety-grens. Het masker voegt NOOIT pixels toe en
// rekt het resultaat nooit op — een smal hoofd blijft gewoon smal (alles
// BINNEN de grens blijft exact zoals de segmentatie het aanlevert). Alleen
// wat verder van FACE_ANCHOR.centerX ligt dan de toegestane halve breedte op
// die hoogte, wordt (met feather, zie featherPx) naar transparant gemaskeerd.
//
// Keyframes: { y (canonieke Y, px), halfWidth (max. afstand tot centerX,
// px) } — lineair geïnterpoleerd tussen punten, geclampt aan het eerste/
// laatste punt buiten het bereik. Bewust een paar losse referentiepunten
// i.p.v. een enkele wiskundige ovaal-formule: geeft direct controleerbare,
// per-zone marges (boven ruim voor haar/kuif, midden ruim voor oren, onder
// smal voor nek) zonder de vorm via één parameter te moeten benaderen.
export const HEAD_SAFETY_MASK = {
  keyframes: [
    { y: 0, halfWidth: 150 },
    // FACE_ANCHOR.topY (50) — ruime marge zodat uitstekend haar/kuif/
    // krullen niet onnodig worden afgeknipt.
    { y: 50, halfWidth: 170 },
    // Breedste punt — rond oren/slapen, ruim genoeg voor de meeste
    // hoofdbreedtes/haarvolumes zonder de nek/schouders al toe te staan.
    { y: 150, halfWidth: 195 },
    { y: 260, halfWidth: 175 },
    // FACE_ANCHOR.chinY (320) — kaaklijn, merkbaar smaller dan het oorpunt.
    { y: 320, halfWidth: 140 },
    // Samenvallend met NECK_CUTOFF.allowancePx-grens (345) — smalle nek.
    { y: 345, halfWidth: 100 },
    // Samenvallend met de volledige NECK_CUTOFF-fade-grens (370) — vanaf
    // hier is alfa via NECK_CUTOFF al hard 0, deze breedte is dan ook geen
    // zichtbaar effect meer, alleen conceptuele continuïteit van de vorm.
    { y: 370, halfWidth: 65 },
    { y: 512, halfWidth: 65 },
  ],
  // Feather (klein houden — "geen wazig hoofd"): de rand van de hierboven
  // bepaalde maximumbreedte wordt over dit aantal pixels lineair naar 0
  // gefaded i.p.v. een harde knip, zodat haar/oren/kaak niet "met een
  // schaar geknipt" ogen.
  featherPx: 10,
} as const;

// Versie-string voor face_crop.headSafetyMaskVersion — zelfde
// herverwerkings-motivatie als segmentationVersion/neckCutoffVersion.
export const HEAD_SAFETY_MASK_VERSION = "head-safety-mask-v1";

function maxHalfWidthAtY(y: number): number {
  const kf = HEAD_SAFETY_MASK.keyframes;
  if (y <= kf[0].y) return kf[0].halfWidth;
  for (let i = 1; i < kf.length; i++) {
    const a = kf[i - 1];
    const b = kf[i];
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return a.halfWidth + (b.halfWidth - a.halfWidth) * t;
    }
  }
  return kf[kf.length - 1].halfWidth;
}

/**
 * Past het head safety mask toe op een canvas van exact CHARACTER_CANVAS-
 * afmetingen: per rij (Y) wordt de toegestane maximale afstand tot
 * FACE_ANCHOR.centerX bepaald (zie maxHalfWidthAtY), en alles verder daarvan
 * wordt — met een korte lineaire feather (HEAD_SAFETY_MASK.featherPx) —
 * naar alfa=0 gemaskeerd. Vermenigvuldigt uitsluitend de BESTAANDE
 * alfawaarde (nooit optellen/verhogen) — verwijdert dus alleen pixels,
 * voegt er nooit toe.
 */
export function applyHeadSafetyMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const { featherPx } = HEAD_SAFETY_MASK;
  for (let y = 0; y < height; y++) {
    const maxHalfWidth = maxHalfWidthAtY(y);
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const dist = Math.abs(x - FACE_ANCHOR.centerX);
      if (dist <= maxHalfWidth) continue;
      const over = dist - maxHalfWidth;
      const idx = (rowOffset + x) * 4 + 3;
      if (over >= featherPx) {
        pixels[idx] = 0;
      } else {
        const factor = 1 - over / featherPx;
        pixels[idx] = Math.round(pixels[idx] * factor);
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

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
 * Tekent `crop` uit `image` op een nieuw canvas van exact CHARACTER_CANVAS-
 * afmetingen — puur een schaal/teken-operatie, GEEN automatische crop/
 * centrering/reconstructie/masker: de speler heeft de positionering zelf al
 * bepaald via de cropper-guides, dit tekent letterlijk dat gekozen gebied op
 * het canonieke canvas. Losstaand geëxporteerd (i.p.v. alleen inline in
 * renderCanonicalFaceCanvas hieronder) zodat GameNightFaceSetup.tsx/QA-
 * tooling exact dezelfde "canonieke plaatsing, nog vóór de maskers"-stap
 * kunnen hergebruiken — geen tweede implementatie van deze teken-operatie.
 *
 * Canvas start standaard volledig transparant (alpha=0 overal) en wordt
 * hier NERGENS gevuld — drawImage kopieert de bron 1-op-1 inclusief
 * alfakanaal.
 */
export function compositeOntoCanonicalCanvas(
  image: HTMLImageElement | HTMLCanvasElement,
  crop: FaceSourceRect,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CHARACTER_CANVAS.width;
  canvas.height = CHARACTER_CANVAS.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Kan geen 2D-canvascontext aanmaken voor de face-export.");
  }
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
  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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

/**
 * Rendert de definitieve 512x512 PNG-blob uit een bronafbeelding (of
 * -canvas, altijd de al-gesegmenteerde, transparante head-crop, zie
 * gameNightFaceSegmentation.ts) + een crop-rechthoek (in pixels van de
 * BRON). Volgorde: canonieke plaatsing (compositeOntoCanonicalCanvas) →
 * head safety mask (applyHeadSafetyMask, begrenst X) → nek-cutoff-fade
 * (applyNeckCutoffFade, begrenst Y) → PNG-export. Beide maskers zijn puur
 * multiplicatief op het bestaande alfakanaal — nooit een fillRect/
 * fillStyle-achtergrondkleur, dus alfa buiten de toegestane zones blijft tot
 * en met de PNG-export exact 0 (canvas.toBlob met "image/png" bewaart
 * alpha; JPEG/WebP-zonder-alpha wordt hier bewust nooit gebruikt).
 */
export async function renderCanonicalFaceCanvas(
  image: HTMLImageElement | HTMLCanvasElement,
  crop: FaceSourceRect,
): Promise<Blob> {
  const canvas = compositeOntoCanonicalCanvas(image, crop);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Kan geen 2D-canvascontext aanmaken voor de face-export.");
  }
  applyHeadSafetyMask(ctx, CHARACTER_CANVAS.width, CHARACTER_CANVAS.height);
  applyNeckCutoffFade(ctx, CHARACTER_CANVAS.width, CHARACTER_CANVAS.height);
  return canvasToPngBlob(canvas);
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
