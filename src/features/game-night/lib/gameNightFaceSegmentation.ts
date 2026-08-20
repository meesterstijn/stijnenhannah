// Game Night — client-side achtergrondverwijdering/persoonssegmentatie voor
// de face-setup-flow. Gekozen library: @mediapipe/tasks-vision (Google,
// Apache-2.0), model: de MediaPipe "Selfie Segmenter" (square, 256x256,
// binaire persoon/achtergrond-confidencemask) — zie het opleverrapport voor
// de volledige afweging tegen alternatieven (o.a. @imgly/background-removal,
// afgewezen vanwege een niet-standaard licentie en een veel groter model
// voor iets dat we niet nodig hebben — wij hebben alleen "persoon vs
// achtergrond" nodig, geen generieke objectsegmentatie).
//
// Volledig client-side: geen foto verlaat de browser voor segmentatie, geen
// Supabase Edge Function, geen externe AI-API. Zowel de ~9.4MB WASM-runtime
// (van jsdelivr, versie-vastgezet op de geïnstalleerde package-versie) als
// het ~244KB .tflite-model (zelf gehost onder public/game-night/models/ —
// bewust NIET de "latest"-alias-URL van Google gebruikt, die kan zonder
// waarschuwing naar een ander modelbestand gaan wijzen) worden pas
// opgehaald bij het eerste daadwerkelijke gebruik, via een dynamic import
// in dit bestand — GameNightFaceSetup.tsx importeert dit bestand zelf ook
// pas lazy (React.lazy op de hele pagina), dus de normale Game Night-bundle
// wordt hier op geen enkele manier door vergroot.

const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_PATH = "/game-night/models/selfie_segmenter.tflite";

// Segmentatie-input-resolutie (opdracht sectie 12): we voeren NIET de ruwe
// camera-foto (soms 4000x3000+) rechtstreeks in, maar hergebruiken de
// AL BESTAANDE, met optimizeGameNightFacePhoto() op 1600px langste zijde
// gecapte foto — diezelfde foto die toch al als "origineel" naar Storage
// gaat. Twee redenen om dat te hergebruiken i.p.v. een aparte, nieuwe
// downscale-stap te bouwen: (1) het model zelf verwerkt intern sowieso op
// een vast 256x256-grid, dus een véél grotere input levert geen betere
// maskerkwaliteit op, alleen tragere canvas-decodering/-compositing op
// mobiel; (2) 1600px is al de bewezen, bestaande grens voor "verstandige
// maximale resolutie" in dit project (zelfde constante als
// growth-photos/checkpoint-foto's).
export type SegmentationResult = {
  /** Canvas met alpha-transparante achtergrond, zelfde afmetingen als de
   *  ingevoerde afbeelding (dus GEEN 256x256 — het masker wordt naar de
   *  volledige inputresolutie geschaald tijdens het compositen). */
  canvas: HTMLCanvasElement;
  /** "gpu" of "cpu" — puur voor diagnose/QA, geen functioneel verschil in
   *  het resultaat. */
  delegate: "gpu" | "cpu";
};

let segmenterPromise: Promise<{
  segmenter: import("@mediapipe/tasks-vision").ImageSegmenter;
  delegate: "gpu" | "cpu";
}> | null = null;

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { ImageSegmenter, FilesetResolver } =
        await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

      // GPU-delegate (WebGL-gebaseerd bij MediaPipe Tasks — GEEN WebGPU,
      // die standaard bestaat daar nog niet voor) geeft op desktop/Android
      // meestal een merkbaar snellere inference, maar staat bekend als
      // minder stabiel op iOS Safari (WebGL-contextbeperkingen). MediaPipe
      // valt NIET automatisch terug bij een mislukte GPU-init —
      // `createFromOptions` verwerpt dan gewoon — dus hier expliciet zelf
      // eerst GPU proberen en bij falen op CPU/WASM terugvallen (werkt
      // gegarandeerd overal, inclusief iOS Safari).
      try {
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: "GPU",
          },
          outputCategoryMask: false,
          outputConfidenceMasks: true,
          runningMode: "IMAGE",
        });
        return { segmenter, delegate: "gpu" as const };
      } catch {
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: "CPU",
          },
          outputCategoryMask: false,
          outputConfidenceMasks: true,
          runningMode: "IMAGE",
        });
        return { segmenter, delegate: "cpu" as const };
      }
    })().catch((err) => {
      // Init-fout niet cachen — een volgende poging (bv. na "Opnieuw
      // proberen") moet gewoon opnieuw mogen initialiseren, niet blijven
      // hangen op een eerdere netwerk-/laadfout.
      segmenterPromise = null;
      throw err;
    });
  }
  return segmenterPromise;
}

/** Optioneel vooraf laden zodra de face-setup-pagina opent, zodat de
 *  daadwerkelijke "Achtergrond verwijderen…"-stap na foto-keuze niet ook
 *  nog moet wachten op de ~9.4MB WASM-runtime-download. Fouten hier worden
 *  bewust genegeerd — de echte foutafhandeling zit in removeSelfieBackground
 *  zelf, dit is puur een optimistische prefetch. */
export function preloadFaceSegmenter(): void {
  void getSegmenter().catch(() => {});
}

/**
 * Verwijdert de achtergrond uit `image` en levert een canvas met een
 * ECHT alfakanaal terug (transparant buiten de gedetecteerde persoon).
 * GEEN enkele fillRect/fillStyle-achtergrondkleur ergens in deze functie —
 * het canvas wordt nooit gevuld, alleen getekend en per-pixel voorzien van
 * een alpha-waarde uit het confidence-masker.
 */
export async function removeSelfieBackground(
  image: HTMLImageElement,
): Promise<SegmentationResult> {
  const { segmenter, delegate } = await getSegmenter();

  const result = segmenter.segment(image);
  const mask = result.confidenceMasks?.[0];
  if (!mask) {
    throw new Error(
      "Segmentatie leverde geen masker op — probeer een andere foto.",
    );
  }

  try {
    const maskData = mask.getAsFloat32Array();
    const maskWidth = mask.width;
    const maskHeight = mask.height;

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error(
        "Kan geen 2D-canvascontext aanmaken voor segmentatie-compositing.",
      );
    }
    // Bewust GEEN ctx.fillRect/fillStyle hier — het canvas start volledig
    // transparant (alpha=0 overal), drawImage hieronder vult alleen de
    // kleurkanalen; de alpha-waarden zetten we zelf, per pixel, uit het
    // masker.
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const scaleX = maskWidth / width;
    const scaleY = maskHeight / height;

    for (let y = 0; y < height; y++) {
      const maskRow = Math.min(maskHeight - 1, (y * scaleY) | 0) * maskWidth;
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const maskX = Math.min(maskWidth - 1, (x * scaleX) | 0);
        const confidence = maskData[maskRow + maskX];
        pixels[(rowOffset + x) * 4 + 3] = Math.max(
          0,
          Math.min(255, Math.round(confidence * 255)),
        );
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return { canvas, delegate };
  } finally {
    mask.close();
  }
}
