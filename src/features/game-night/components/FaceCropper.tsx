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
//
// Nieuwe flow (opdracht sectie 1/6): dit component positioneert nu de RUWE,
// nog niet gesegmenteerde foto — segmentatie gebeurt pas NA het bevestigen
// van deze crop, op een uit deze positionering afgeleid hoofdgebied (zie
// computeHeadCropSourceRect() in gameNightFaceCanvas.ts, aangeroepen door
// GameNightFaceSetup.tsx). Er is hier dus geen zinvolle "body erachter"-
// preview meer te tonen (de foto is nog ondoorzichtig) — die vergelijking
// gebeurt voortaan in de nieuwe preview-stap ná verwerking (opdracht sectie
// 9), niet meer hier.
export function FaceCropper({
  imageUrl,
  onCropAreaChange,
}: {
  /** De RUWE (nog niet gesegmenteerde) foto. */
  imageUrl: string;
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

        {/* Ovale hoofd-guide: PUUR een positioneringshulp/maximum-veilige-
            ruimte, geen masking en geen vereiste dat de zijkant van het
            hoofd het ovaal ook daadwerkelijk raakt — leidend zijn alleen
            haar-top≈bovenste lijn, kin≈onderste lijn, hoofd gecentreerd (zie
            FACE_ANCHOR). Het is een gewone, doorzichtige cirkel-div met een
            enorme box-shadow die al het overige verduistert (CSS-
            "spotlight"-truc). De daadwerkelijke crop/export gebruikt
            uitsluitend de vierkante `croppedAreaPixels` van de Cropper
            hierboven — dit ovaal beïnvloedt die rechthoek op geen enkele
            manier. Het echte, generieuzere "niet breder dan dit"-masker
            (HEAD_SAFETY_MASK) wordt pas ná segmentatie/canonieke plaatsing
            toegepast, zie gameNightFaceCanvas.ts — een smal hoofd hoeft dit
            ovaal dus niet te vullen, MediaPipe bepaalt de echte haar-/
            oorcontour. */}
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-full border-2 border-emerald-400/80"
          style={{
            left: `${centerPct}%`,
            top: `${topPct}%`,
            width: `${(chinPct - topPct) * 0.72}%`,
            height: `${chinPct - topPct}%`,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
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
        Plaats de bovenkant van je haar op de bovenste lijn en je kin op de
        onderste lijn. Centreer je hoofd. Je hoofd hoeft de zijkanten van het
        ovaal niet te raken.
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
