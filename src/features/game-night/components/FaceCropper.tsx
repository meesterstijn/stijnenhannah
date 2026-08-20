import { useCallback, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import {
  CHARACTER_CANVAS,
  FACE_ANCHOR,
} from "@/features/game-night/lib/gameNightFaceCanvas";

// Game Night — de canonieke crop-interface (opdracht sectie 4/5/6). Gebruikt
// react-easy-crop (nieuwe dependency, zie package.json) voor het daadwerkelijke
// pan/pinch-zoom/drag-gedrag — geen custom pointer-event-afhandeling nodig
// (met name multi-touch pinch-zoom is notoir lastig zelf goed te bouwen,
// react-easy-crop is hierin al bewezen op zowel touch als muis/trackpad).
//
// `aspect={1}` + het vierkante wrapper-element hieronder garanderen dat de
// crop-viewport zelf ALTIJD het volledige 512x512-canonieke canvas
// vertegenwoordigt (geen losse offset-wiskunde nodig): de guide-lijnen
// hieronder zijn simpele percentage-gepositioneerde overlays binnen exact
// diezelfde vierkante viewport, dus X256/Y50/Y320 in FACE_ANCHOR komt altijd
// overeen met dezelfde relatieve positie in de uiteindelijke 512x512-export
// (zie renderCanonicalFaceCanvas in gameNightFaceCanvas.ts).
//
// `restrictPosition` (react-easy-crop's eigen prop, default AAN) voorkomt
// dat de foto ooit buiten de crop-viewport gepositioneerd kan worden op een
// manier die lege ruimte in de head-zone zou opleveren — de kleinste
// afbeeldingsdimensie vult bij zoom=1 altijd de volledige viewport, verder
// zoomen kan alleen INzoomen, nooit een gat creëren. Proportioneel zoomen
// is hiermee ook automatisch afgedwongen: react-easy-crop kent geen
// aparte horizontale/verticale schaal.
export function FaceCropper({
  imageUrl,
  bodyPreviewUrl,
  onCropAreaChange,
}: {
  /** De AL GESEGMENTEERDE (transparante-achtergrond) foto — zie
   *  gameNightFaceSegmentation.ts. Geen ruwe foto-met-achtergrond meer. */
  imageUrl: string;
  /** Optioneel: pad naar een bestaande, actieve 512x512 "base"-catalogus-
   *  asset (opdracht sectie 9) — rendert als live preview ACHTER de
   *  gesegmenteerde foto, in exact dezelfde 512x512-coördinatenruimte, zodat
   *  de speler kan zien of kin/hoofdgrootte/uitlijning kloppen t.o.v. de
   *  echte body. `undefined`/`null` (vandaag de realiteit: nog geen
   *  production-ready custom body in de repo) laat deze laag gewoon weg —
   *  GEEN placeholder-artwork. Zodra er een echte body-asset bijkomt, hoeft
   *  alleen de aanroeper (GameNightFaceSetup.tsx) een pad door te geven,
   *  deze component zelf hoeft niet te wijzigen. */
  bodyPreviewUrl?: string | null;
  /** Vuurt bij elke wijziging (drag/zoom) met de crop-rechthoek in pixels
   *  van de BRONafbeelding — de aanroeper bewaart alleen de laatste waarde,
   *  gebruikt bij bevestigen (zie GameNightFaceSetup.tsx). */
  onCropAreaChange: (area: Area) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      onCropAreaChange(croppedAreaPixels);
    },
    [onCropAreaChange],
  );

  const topPct = (FACE_ANCHOR.topY / CHARACTER_CANVAS.height) * 100;
  const chinPct = (FACE_ANCHOR.chinY / CHARACTER_CANVAS.height) * 100;
  const centerPct = (FACE_ANCHOR.centerX / CHARACTER_CANVAS.width) * 100;
  // Subtiele, NIET-canonical ooglijn (opdracht sectie 4) — puur een visuele
  // vuistregel op ~40% van top naar kin, nooit gebruikt om iets af te dwingen
  // of te vervormen; mensen hebben verschillende gezichtsverhoudingen.
  const eyeHintPct = topPct + (chinPct - topPct) * 0.4;

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-2xl bg-black">
        {/* Laagvolgorde (opdracht sectie 10): body ONDER, gesegmenteerde
            face BOVEN (via de Cropper hieronder, die zelf transparant is
            buiten de foto), guides/UI HELEMAAL bovenop. Exact zoals de
            uiteindelijke character-renderer (CharacterVisual: base
            layer_order 20, personal-face 40). Cropper's eigen container
            heeft standaard geen achtergrondkleur, dus de transparante delen
            van de gesegmenteerde foto laten deze body-laag gewoon
            doorschemeren. */}
        {bodyPreviewUrl && (
          <img
            src={bodyPreviewUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        )}
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          minZoom={1}
          maxZoom={4}
          aspect={1}
          cropShape="rect"
          showGrid={false}
          restrictPosition
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />

        {/* Subtiele donkere overlay buiten de head-zone (opdracht sectie 6)
            — puur decoratief, geen invloed op de crop zelf. De head-zone
            (top..chin) blijft volledig onbedekt zodat de speler zijn hele
            hoofd goed kan zien. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-black/35"
          style={{ height: `${topPct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/35"
          style={{ height: `${100 - chinPct}%` }}
        />

        <div className="pointer-events-none absolute inset-0">
          {/* Ooglijn — subtiel, expliciet niet-canonical */}
          <div
            className="absolute inset-x-0 border-t border-dashed border-white/30"
            style={{ top: `${eyeHintPct}%` }}
          />
          {/* Bovenkant-hoofd guide */}
          <div
            className="absolute inset-x-0 border-t-2 border-emerald-400"
            style={{ top: `${topPct}%` }}
          />
          <p
            className="absolute left-1.5 -translate-y-full text-[10px] font-semibold text-emerald-300"
            style={{ top: `${topPct}%` }}
          >
            Bovenkant hoofd
          </p>
          {/* Kin guide */}
          <div
            className="absolute inset-x-0 border-t-2 border-emerald-400"
            style={{ top: `${chinPct}%` }}
          />
          <p
            className="absolute left-1.5 text-[10px] font-semibold text-emerald-300"
            style={{ top: `${chinPct}%` }}
          >
            Kin
          </p>
          {/* Centerlijn */}
          <div
            className="absolute inset-y-0 border-l-2 border-emerald-400/70"
            style={{ left: `${centerPct}%` }}
          />
        </div>
      </div>

      <p className="text-center text-xs text-white/70">
        Plaats de bovenkant van je hoofd op de bovenste lijn en je kin op de
        onderste lijn. Centreer je gezicht op de verticale lijn.
      </p>

      {/* Zoom-slider (opdracht sectie 5: "eventueel een zoom-slider als
          fallback") — naast pinch/scroll, altijd zichtbaar zodat zoomen ook
          zonder touch/scroll-wheel werkt. */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-white/60">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
          aria-label="Zoom"
        />
      </div>
    </div>
  );
}
