import { useRef, useState } from "react";
import { RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { NormalizedPoint } from "@/features/game-night/lib/gameNightFaceCanvas";

// Game Night — bewerkbare-contourpunten hoofdmasker-editor. De LAATSTE stap
// van de face-pipeline, NÁ de volledige automatische verwerking (head-crop →
// MediaPipe → canonical placement → head safety mask → nek-cutoff-fade —
// alle vier ONGEWIJZIGD, blijven de vaste safety-baseline, zie
// GameNightFaceSetup.tsx/gameNightFaceCanvas.ts). De speler ziet hier dus
// het VOLLEDIGE automatische eindresultaat (inclusief safety mask/neck-fade)
// als achtergrond, en de polygon is een puur handmatige correctie
// BOVENOP dat resultaat — hij mag nog pixels wegnemen, maar er volgt na de
// polygon geen enkel automatisch geometrisch masker meer dat de gekozen
// contour opnieuw zou kunnen veranderen (zie de volgorde in
// renderCanonicalFaceCanvas: safety mask + neck-cutoff eerst, polygon-
// masker als allerlaatste stap).
//
// Belangrijk UX-uitgangspunt (opdracht): de polygon is een MAXIMUMgrens, geen
// precisie-outline. MediaPipe/head safety mask/neck-cutoff hebben de echte
// haar-/gezichtsrand al bepaald (alfa=0 buiten de persoon/toegestane zone) —
// een polygon die een stukje buiten dat automatische resultaat ligt haalt
// dus GEEN pixels terug, alleen een polygon die ECHTE, nog zichtbare pixels
// (bv. een stukje schouder dat de automatische maskers misten) afsnijdt
// heeft effect. Dat maakt dit voor de speler vergevingsgezind: de meeste
// correcties zijn een paar punten rond kaak/nek verplaatsen, niet elke
// haarpixel volgen.
//
// Twee modi, beide eindigen in dezelfde `points`-state (opdracht: "beide
// modi eindigen in hetzelfde datasysteem"):
//   - "polygon" (standaard): punten slepen, op een lijn tikken om een punt
//     tussen te voegen, geselecteerd punt verwijderen.
//   - "lasso" (optioneel, sneller): vrij tekenen, wordt bij loslaten
//     automatisch gesloten + vereenvoudigd naar LASSO_TARGET_POINTS punten
//     en overgezet naar polygon-modus.
//
// Touch/stylus/muis: uitsluitend Pointer Events (onPointerDown/Move/Up) —
// die dekken alle drie invoertypen met dezelfde handlers, geen aparte
// touch-/mouse-code nodig. Punt-handles zijn HTML-elementen (geen SVG-
// cirkels) met een vaste 44×44px hit-target (WCAG-achtige minimum-
// touchgrootte, matcht de rest van de app, bv. GameNightMe.tsx se
// min-h-[44px]-knoppen) — de daadwerkelijk OPGESLAGEN coördinaat is exact
// het middelpunt, alleen de klikbare/tikbare zone is ruimer.

const POINT_HIT_SIZE_PX = 44;
const LASSO_TARGET_POINTS = 18;
const LINE_HIT_STROKE_WIDTH = 22;
const MAX_HISTORY = 20;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Vereenvoudigt een ruwe, vrij getekende (mogelijk honderden samples lange)
// lasso-lijn naar een beheersbaar aantal, gelijkmatig over de (gesloten)
// omtrek verdeelde punten — een simpele, deterministische decimatie
// (arclength-resampling) i.p.v. een complexer curve-simplificatie-algoritme,
// precies genoeg voor "vereenvoudig de lijn naar een beheersbaar aantal
// punten" zonder een aparte library nodig te hebben.
function resampleClosedPath(
  raw: NormalizedPoint[],
  targetCount: number,
): NormalizedPoint[] {
  if (raw.length < 3) return raw;
  const closed = [...raw, raw[0]];
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const len = distance(closed[i], closed[i + 1]);
    segLengths.push(len);
    total += len;
  }
  if (total === 0) return raw.slice(0, targetCount);

  const result: NormalizedPoint[] = [];
  const step = total / targetCount;
  let segIndex = 0;
  let segStartDist = 0;
  for (let i = 0; i < targetCount; i++) {
    const targetDist = i * step;
    while (
      segIndex < segLengths.length - 1 &&
      segStartDist + segLengths[segIndex] < targetDist
    ) {
      segStartDist += segLengths[segIndex];
      segIndex++;
    }
    const segLen = segLengths[segIndex] || 1;
    const t = Math.min(1, Math.max(0, (targetDist - segStartDist) / segLen));
    const a = closed[segIndex];
    const b = closed[segIndex + 1];
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

// Puur visuele afronding (opdracht: "toon de contour visueel licht
// afgerond... zorg dat het uiteindelijke maskergedrag voorspelbaar
// blijft"). Standaard quadratic-curve-door-middelpunten-techniek: elke
// Bezier-boog blijft per definitie binnen de convexe combinatie van zijn 3
// controlepunten (vorig middelpunt, het echte punt, volgend middelpunt) —
// dus NOOIT overshoot voorbij de eigen polygonpunten. De daadwerkelijke
// maskergeometrie (rasterizePolygonMask/applyPolygonMask in
// gameNightFaceCanvas.ts) gebruikt altijd de rechte segmenten uit `points`
// zelf, nooit dit gladgestreken pad — puur decoratief.
function buildSmoothedPathD(points: NormalizedPoint[]): string {
  if (points.length < 3) return "";
  const mid = (a: NormalizedPoint, b: NormalizedPoint) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const first = mid(points[points.length - 1], points[0]);
  let d = `M ${first.x * 512} ${first.y * 512} `;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const m = mid(points[i], next);
    d += `Q ${points[i].x * 512} ${points[i].y * 512} ${m.x * 512} ${m.y * 512} `;
  }
  return `${d}Z`;
}

export function HeadMaskEditor({
  imageUrl,
  bodyPreviewUrl,
  initialPoints,
  onConfirm,
}: {
  /** Het VOLLEDIGE automatische eindresultaat — al gesegmenteerd, canoniek
   *  geplaatst, ÉN al head-safety-masked/neck-cut — de achtergrond waarop
   *  de speler zijn laatste, handmatige polygon-correctie positioneert. */
  imageUrl: string;
  /** Optioneel: pad naar een actieve base-body-asset, voor de "body-
   *  preview" toggle (opdracht: "body-preview op toggle of ernaast"). */
  bodyPreviewUrl?: string | null;
  /** Startpolygon (zie deriveDefaultHeadMaskPoints in gameNightFaceCanvas.ts). */
  initialPoints: NormalizedPoint[];
  /** Vuurt bij "Gebruiken" met de uiteindelijke puntenlijst. */
  onConfirm: (points: NormalizedPoint[]) => void;
}) {
  const [points, setPoints] = useState<NormalizedPoint[]>(initialPoints);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<"polygon" | "lasso">("polygon");
  const [lassoPath, setLassoPath] = useState<NormalizedPoint[]>([]);
  const [showBodyPreview, setShowBodyPreview] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const historyRef = useRef<NormalizedPoint[][]>([]);
  const [, forceRerender] = useState(0);
  const isLassoDrawingRef = useRef(false);

  function pushHistory(current: NormalizedPoint[]) {
    historyRef.current.push(current);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    forceRerender((n) => n + 1);
  }

  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setPoints(prev);
    setSelectedIndex(null);
    forceRerender((n) => n + 1);
  }

  function resetToPreset() {
    pushHistory(points);
    setPoints(initialPoints);
    setSelectedIndex(null);
  }

  function clientToNormalized(
    clientX: number,
    clientY: number,
  ): NormalizedPoint {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }

  function handlePointPointerDown(index: number, e: React.PointerEvent) {
    e.stopPropagation();
    pushHistory(points);
    setSelectedIndex(index);
    draggingIndexRef.current = index;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleContainerPointerMove(e: React.PointerEvent) {
    if (mode === "lasso") {
      if (!isLassoDrawingRef.current) return;
      const p = clientToNormalized(e.clientX, e.clientY);
      setLassoPath((prev) => [...prev, p]);
      return;
    }
    const idx = draggingIndexRef.current;
    if (idx === null) return;
    const p = clientToNormalized(e.clientX, e.clientY);
    setPoints((prev) => prev.map((pt, i) => (i === idx ? p : pt)));
  }

  function handleContainerPointerUp() {
    draggingIndexRef.current = null;
    if (mode === "lasso" && isLassoDrawingRef.current) {
      isLassoDrawingRef.current = false;
      if (lassoPath.length >= 3) {
        pushHistory(points);
        setPoints(resampleClosedPath(lassoPath, LASSO_TARGET_POINTS));
        setSelectedIndex(null);
        setMode("polygon");
      }
      setLassoPath([]);
    }
  }

  function handleLassoPointerDown(e: React.PointerEvent) {
    isLassoDrawingRef.current = true;
    setLassoPath([clientToNormalized(e.clientX, e.clientY)]);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // "tik op lijn → punt tussenvoegen": de daadwerkelijke insertiepositie is
  // het dichtstbijzijnde punt OP het rechte segment (niet zomaar de
  // klikpositie zelf) — geeft een net iets nauwkeuriger startpositie voor
  // het nieuwe punt, dat de speler daarna alsnog vrij kan verslepen.
  function handleLinePointerDown(segmentIndex: number, e: React.PointerEvent) {
    e.stopPropagation();
    const click = clientToNormalized(e.clientX, e.clientY);
    const a = points[segmentIndex];
    const b = points[(segmentIndex + 1) % points.length];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    const t =
      lenSq === 0
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              ((click.x - a.x) * abx + (click.y - a.y) * aby) / lenSq,
            ),
          );
    const insertPoint: NormalizedPoint = { x: a.x + abx * t, y: a.y + aby * t };
    pushHistory(points);
    const next = [...points];
    next.splice(segmentIndex + 1, 0, insertPoint);
    setPoints(next);
    setSelectedIndex(segmentIndex + 1);
  }

  function handleDeleteSelected() {
    if (selectedIndex === null || points.length <= 3) return;
    pushHistory(points);
    setPoints((prev) => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  }

  return (
    <div className="w-full max-w-sm space-y-3 sm:max-w-md lg:max-w-xl">
      <div
        ref={containerRef}
        className="relative mx-auto aspect-square w-full touch-none overflow-hidden rounded-2xl bg-black"
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
      >
        {showBodyPreview && bodyPreviewUrl && (
          <img
            src={bodyPreviewUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        )}
        <img
          src={imageUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />

        {mode === "lasso" ? (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 512 512"
            preserveAspectRatio="none"
            onPointerDown={handleLassoPointerDown}
          >
            {lassoPath.length > 1 && (
              <polyline
                points={lassoPath
                  .map((p) => `${p.x * 512},${p.y * 512}`)
                  .join(" ")}
                fill="none"
                stroke="#34d399"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        ) : (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 512 512"
            preserveAspectRatio="none"
          >
            <path
              d={buildSmoothedPathD(points)}
              fill="none"
              stroke="#34d399"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => {
              const next = points[(i + 1) % points.length];
              return (
                <line
                  key={`hit-${i}`}
                  x1={p.x * 512}
                  y1={p.y * 512}
                  x2={next.x * 512}
                  y2={next.y * 512}
                  stroke="transparent"
                  strokeWidth={LINE_HIT_STROKE_WIDTH}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "copy" }}
                  onPointerDown={(e) => handleLinePointerDown(i, e)}
                />
              );
            })}
          </svg>
        )}

        {mode === "polygon" &&
          points.map((p, i) => (
            <div
              key={i}
              className="absolute flex touch-none items-center justify-center"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: POINT_HIT_SIZE_PX,
                height: POINT_HIT_SIZE_PX,
                marginLeft: -POINT_HIT_SIZE_PX / 2,
                marginTop: -POINT_HIT_SIZE_PX / 2,
                cursor: "grab",
              }}
              onPointerDown={(e) => handlePointPointerDown(i, e)}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full border-2 shadow ${
                  selectedIndex === i
                    ? "border-white bg-amber-400"
                    : "border-emerald-100 bg-emerald-400"
                }`}
              />
            </div>
          ))}
      </div>

      <p className="text-center text-xs text-white/70">
        Sleep punten rond haar/oren/kaak/nek waar nodig. Tik op de lijn om een
        punt toe te voegen. De polygon is een maximumgrens — MediaPipe heeft de
        echte rand al bepaald.
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "polygon" ? "lasso" : "polygon"));
            setLassoPath([]);
            setSelectedIndex(null);
          }}
          className="gnv2-btn gnv2-btn-ghost px-3 py-1.5 text-xs"
        >
          {mode === "polygon" ? "Vrij tekenen" : "Terug naar punten"}
        </button>
        {bodyPreviewUrl && (
          <button
            type="button"
            onClick={() => setShowBodyPreview((v) => !v)}
            className="gnv2-btn gnv2-btn-ghost px-3 py-1.5 text-xs"
          >
            Body-preview {showBodyPreview ? "uit" : "aan"}
          </button>
        )}
        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={selectedIndex === null || points.length <= 3}
          className="gnv2-btn gnv2-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> Punt verwijderen
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={historyRef.current.length === 0}
          className="gnv2-btn gnv2-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" /> Ongedaan maken
        </button>
        <button
          type="button"
          onClick={resetToPreset}
          className="gnv2-btn gnv2-btn-ghost px-3 py-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      <button
        type="button"
        onClick={() => onConfirm(points)}
        className="gnv2-btn gnv2-btn-primary w-full"
      >
        Gebruiken
      </button>
    </div>
  );
}
