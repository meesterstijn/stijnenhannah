import { useEffect, useRef, useState } from "react";
import type {
  GameNightCharacterPart,
  GameNightFaceCrop,
  GameNightPlayer,
} from "@/lib/supabase";
import type { Area } from "react-easy-crop";
import { ArrowLeft, Camera, ImageIcon, Loader2 } from "lucide-react";
import {
  optimizeGameNightFacePhoto,
  type OptimizedPhoto,
} from "@/features/game-night/lib/optimizeGameNightFacePhoto";
import {
  applyHeadSafetyMask,
  applyNeckCutoffFade,
  CHARACTER_CANVAS,
  compositeOntoCanonicalCanvas,
  computeHeadCropSourceRect,
  deriveDefaultHeadMaskPoints,
  drawRegionToCanvas,
  HEAD_CROP,
  HEAD_SAFETY_MASK_VERSION,
  loadImageFromUrl,
  mapRectIntoRegion,
  MANUAL_HEAD_MASK_VERSION,
  NECK_CUTOFF_VERSION,
  renderCanonicalFaceCanvas,
  type FaceSourceRect,
  type NormalizedPoint,
} from "@/features/game-night/lib/gameNightFaceCanvas";
import {
  preloadFaceSegmenter,
  removeSelfieBackground,
  SEGMENTATION_VERSION,
} from "@/features/game-night/lib/gameNightFaceSegmentation";
import { FaceCropper } from "@/features/game-night/components/FaceCropper";
import { HeadMaskEditor } from "@/features/game-night/components/HeadMaskEditor";
import {
  DEFAULT_BODY_SHAPE,
  personalFaceLayer,
  resolveBodyShapeAssetPath,
} from "@/features/game-night/lib/gameNightCharacter";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

type Step =
  | "pick"
  | "preparing"
  | "positioning"
  | "processing"
  | "masking"
  | "preview"
  | "saving"
  | "error";
type ErrorStage = "prepare" | "segmentation" | "save";

export type PreparedFacePhoto = {
  original: OptimizedPhoto;
  faceBlob: Blob;
  faceCrop: GameNightFaceCrop;
};

// Shared camera, crop, segmentation, contour and preview flow. Persistence is
// supplied by the caller so members and account-free guests use the same editor.
export function FacePhotoEditor({
  player: myPlayer,
  bodyPreviewPart,
  onSave,
  onCancel,
}: {
  player: Pick<
    GameNightPlayer,
    "name" | "nickname" | "face_asset_path" | "face_crop"
  >;
  bodyPreviewPart?: GameNightCharacterPart | null;
  onSave: (photo: PreparedFacePhoto) => Promise<void>;
  onCancel: () => void;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [maskBackgroundUrl, setMaskBackgroundUrl] = useState<string | null>(
    null,
  );
  const [previewFaceUrl, setPreviewFaceUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<ErrorStage | null>(null);

  const cropAreaRef = useRef<Area | null>(null);
  const optimizedOriginalRef = useRef<OptimizedPhoto | null>(null);
  // De gesegmenteerde head-crop + de daarbinnen gemapte oorspronkelijke
  // crop-rechthoek (opdracht: nieuwe "masking"-stap tussen segmentatie en
  // de definitieve compositie) — bewaard zodat handleConfirmMask() de
  // definitieve 512x512 PNG opnieuw, vanaf de bron, kan opbouwen (via
  // renderCanonicalFaceCanvas, ALTIJD een vers canvas — nooit een
  // gedeeld/gemuteerd canvas hergebruiken tussen pogingen, dat zou bij een
  // herhaalde bevestiging de maskers dubbel kunnen toepassen).
  const segmentedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropInHeadSpaceRef = useRef<FaceSourceRect | null>(null);
  const pendingFaceBlobRef = useRef<Blob | null>(null);
  const pendingManualHeadMaskRef = useRef<NormalizedPoint[] | null>(null);
  // De ORIGINELE (strakke, niet-vergrote) crop-rechthoek — dit is wat in
  // face_crop wordt opgeslagen (zelfde contract als voorheen: "genoeg om
  // face_asset later opnieuw te genereren vanuit face_original"), NIET het
  // vergrote hoofdgebied dat alleen als segmentatie-input dient.
  const pendingCropRectRef = useRef<FaceSourceRect | null>(null);

  // Opdracht sectie 11 (dit bestand behoudt dit gedrag): vast alvast
  // (optimistisch, fouten genegeerd) de ~9.4MB WASM-runtime laden zodra
  // deze pagina opent.
  useEffect(() => {
    preloadFaceSegmenter();
  }, []);

  useEffect(() => {
    return () => {
      if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    };
  }, [rawImageUrl]);

  useEffect(() => {
    return () => {
      if (previewFaceUrl) URL.revokeObjectURL(previewFaceUrl);
    };
  }, [previewFaceUrl]);

  async function prepareFile(file: File) {
    setStep("preparing");
    setErrorMessage(null);
    setErrorStage(null);
    try {
      const optimized = await optimizeGameNightFacePhoto(file);
      optimizedOriginalRef.current = optimized;
      cropAreaRef.current = null;
      setRawImageUrl(URL.createObjectURL(optimized.blob));
      setStep("positioning");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Foto verwerken is mislukt. Probeer het opnieuw.",
      );
      setErrorStage("prepare");
      setStep("error");
    }
  }

  function handlePicked(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setSelectedFile(file);
    void prepareFile(file);
  }

  async function runProcessing(cropArea: Area) {
    if (!rawImageUrl) return;
    setStep("processing");
    setErrorMessage(null);
    setErrorStage(null);
    try {
      const rawImage = await loadImageFromUrl(rawImageUrl);
      const cropRect: FaceSourceRect = {
        sourceX: cropArea.x,
        sourceY: cropArea.y,
        sourceWidth: cropArea.width,
        sourceHeight: cropArea.height,
      };
      // Head-crop-vóór-segmentatie (opdracht sectie 6): ruimer gebied rondom
      // de bevestigde crop, alleen dát gaat naar MediaPipe — zie
      // gameNightFaceCanvas.ts (HEAD_CROP) voor de gekozen marge/resolutie.
      const headRegion = computeHeadCropSourceRect(
        cropRect,
        rawImage.naturalWidth,
        rawImage.naturalHeight,
      );
      const { canvas: headCanvas, scale } = drawRegionToCanvas(
        rawImage,
        headRegion,
        HEAD_CROP.maxOutputSidePx,
      );
      const { canvas: segmentedCanvas } =
        await removeSelfieBackground(headCanvas);
      const cropInHeadSpace = mapRectIntoRegion(cropRect, headRegion, scale);

      // Nieuwe "masking"-stap (opdracht): de speler krijgt hier de
      // handmatige-contourpunten-editor te zien, als LAATSTE correctie NÁ
      // de volledige automatische pipeline — de achtergrond is dus het
      // canoniek geplaatste resultaat MET head safety mask én nek-cutoff-
      // fade al toegepast (de automatische pipeline maakt eerst zijn eigen
      // beste resultaat; de polygon mag daarna alleen nog pixels
      // WEGNEMEN, geen enkel automatisch geometrisch masker volgt nog ná de
      // polygon, zie de volgorde in renderCanonicalFaceCanvas). Bewaar de
      // bron (segmentedCanvas + cropInHeadSpace) zodat de definitieve PNG
      // pas na bevestiging, vanaf een vers canvas, wordt opgebouwd —
      // hetzelfde canvas hier voor de achtergrond wordt nooit hergebruikt/
      // verder gemuteerd.
      segmentedCanvasRef.current = segmentedCanvas;
      cropInHeadSpaceRef.current = cropInHeadSpace;
      pendingCropRectRef.current = cropRect;
      const previewCanvas = compositeOntoCanonicalCanvas(
        segmentedCanvas,
        cropInHeadSpace,
      );
      const previewCtx = previewCanvas.getContext("2d");
      if (previewCtx) {
        applyHeadSafetyMask(
          previewCtx,
          CHARACTER_CANVAS.width,
          CHARACTER_CANVAS.height,
        );
        applyNeckCutoffFade(
          previewCtx,
          CHARACTER_CANVAS.width,
          CHARACTER_CANVAS.height,
        );
      }
      setMaskBackgroundUrl(previewCanvas.toDataURL("image/png"));
      setStep("masking");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Achtergrond verwijderen is mislukt. Probeer het opnieuw.",
      );
      setErrorStage("segmentation");
      setStep("error");
    }
  }

  async function handleConfirmMask(points: NormalizedPoint[]) {
    const segmentedCanvas = segmentedCanvasRef.current;
    const cropInHeadSpace = cropInHeadSpaceRef.current;
    if (!segmentedCanvas || !cropInHeadSpace) return;
    setErrorMessage(null);
    setErrorStage(null);
    try {
      // Vers canvas vanaf de bron (zie de toelichting bij
      // segmentedCanvasRef hierboven) — past head safety mask + nek-cutoff-
      // fade toe (ongewijzigde automatische baseline) en DAARNA pas het
      // optionele handmatige polygon-masker, als allerlaatste stap (zie
      // renderCanonicalFaceCanvas in gameNightFaceCanvas.ts).
      const faceBlob = await renderCanonicalFaceCanvas(
        segmentedCanvas,
        cropInHeadSpace,
        points,
      );
      pendingFaceBlobRef.current = faceBlob;
      pendingManualHeadMaskRef.current = points;
      setPreviewFaceUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(faceBlob);
      });
      setStep("preview");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Verwerken is mislukt. Probeer het opnieuw.",
      );
      setErrorStage("segmentation");
      setStep("error");
    }
  }

  function handleConfirmPositioning() {
    const cropArea = cropAreaRef.current;
    if (!cropArea) return; // react-easy-crop nog niet geïnitialiseerd — knop staat dan disabled
    void runProcessing(cropArea);
  }

  function handleAdjustAgain() {
    setErrorMessage(null);
    setErrorStage(null);
    setStep("positioning");
  }

  function handleAnotherPhoto() {
    setSelectedFile(null);
    setRawImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setMaskBackgroundUrl(null);
    setPreviewFaceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    optimizedOriginalRef.current = null;
    segmentedCanvasRef.current = null;
    cropInHeadSpaceRef.current = null;
    pendingFaceBlobRef.current = null;
    pendingManualHeadMaskRef.current = null;
    pendingCropRectRef.current = null;
    cropAreaRef.current = null;
    setErrorMessage(null);
    setErrorStage(null);
    setStep("pick");
  }

  function handleRetry() {
    if (errorStage === "prepare") {
      if (selectedFile) void prepareFile(selectedFile);
      else handleAnotherPhoto();
      return;
    }
    if (errorStage === "segmentation") {
      const cropArea = cropAreaRef.current;
      if (cropArea) void runProcessing(cropArea);
      else setStep("positioning");
      return;
    }
    void handleUsePreview();
  }

  function handleBackToProfile() {
    onCancel();
  }

  async function handleUsePreview() {
    const optimizedOriginal = optimizedOriginalRef.current;
    const faceBlob = pendingFaceBlobRef.current;
    const cropRect = pendingCropRectRef.current;
    if (!optimizedOriginal || !faceBlob || !cropRect || !myPlayer) return;

    setStep("saving");
    setErrorMessage(null);
    setErrorStage(null);
    try {
      await onSave({
        original: optimizedOriginal,
        faceBlob,
        faceCrop: {
          ...cropRect,
          segmentationVersion: SEGMENTATION_VERSION,
          neckCutoffVersion: NECK_CUTOFF_VERSION,
          headSafetyMaskVersion: HEAD_SAFETY_MASK_VERSION,
          ...(pendingManualHeadMaskRef.current
            ? {
                manualHeadMask: {
                  version: MANUAL_HEAD_MASK_VERSION,
                  points: pendingManualHeadMaskRef.current,
                },
              }
            : {}),
          processedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Opslaan is mislukt. Probeer het opnieuw.",
      );
      setErrorStage("save");
      setStep("error");
    }
  }

  const backAction =
    step === "pick"
      ? handleBackToProfile
      : step === "preview" || step === "masking"
        ? handleAdjustAgain
        : handleAnotherPhoto;

  return (
    <GnV2Scene className="gnv2-creator-scene">
      <header className="gnv2-topbar gnv2-topbar-compact">
        <button
          type="button"
          onClick={backAction}
          className="gnv2-nav-btn"
          disabled={
            step === "saving" || step === "processing" || step === "preparing"
          }
          aria-label="Terug"
          title="Terug"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="gnv2-identity gnv2-identity-center">
          <p className="gnv2-identity-eyebrow">Game Night</p>
          <p className="gnv2-identity-date">Maak je character</p>
        </div>
        <div className="gnv2-topbar-spacer" aria-hidden />
      </header>

      {/* Responsive-shell-consistentieronde: `.gnv2-creator-scene` heeft nu
          een echt `height:100dvh`-plafond (styles.css) — `min-h-0` is hier
          nodig zodat DEZE zone (niet de header) daadwerkelijk krimpt/zelf
          scrollt (crop/masker-stappen kunnen visueel hoog zijn) i.p.v. de
          hele pagina te laten scrollen. */}
      <div className="flex flex-1 min-h-0 flex-col items-center gap-4 overflow-y-auto px-4 py-6">
        {step === "pick" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                handlePicked(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handlePicked(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <p className="gnv2-dialog-muted text-center text-sm">
              Maak een foto van je gezicht of kies een bestaande foto — je
              positioneert daarna je hoofd, en we verwijderen automatisch de
              achtergrond.
            </p>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="gnv2-capture-btn gnv2-capture-btn-camera"
            >
              <span className="gnv2-capture-icon">
                <Camera className="h-5 w-5" />
              </span>
              <span className="gnv2-capture-label">Foto maken</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="gnv2-capture-btn gnv2-capture-btn-gallery"
            >
              <span className="gnv2-capture-icon">
                <ImageIcon className="h-5 w-5" />
              </span>
              <span className="gnv2-capture-label">Foto kiezen</span>
            </button>
          </div>
        )}

        {step === "preparing" && (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Foto verwerken…</p>
          </div>
        )}

        {step === "positioning" && rawImageUrl && (
          <div className="flex w-full flex-col items-center gap-4">
            <FaceCropper
              imageUrl={rawImageUrl}
              onCropAreaChange={(area) => {
                cropAreaRef.current = area;
              }}
            />
            <div className="flex w-full max-w-sm gap-2.5 sm:max-w-md lg:max-w-xl">
              <button
                type="button"
                onClick={handleAnotherPhoto}
                className="gnv2-btn gnv2-btn-ghost flex-1"
              >
                Andere foto
              </button>
              <button
                type="button"
                onClick={handleConfirmPositioning}
                className="gnv2-btn gnv2-btn-primary flex-1"
              >
                Doorgaan
              </button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="relative flex w-full max-w-sm flex-col items-center gap-4">
            {rawImageUrl && (
              <img
                src={rawImageUrl}
                alt=""
                className="aspect-square w-full rounded-2xl object-cover opacity-30 blur-sm"
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm font-medium">Achtergrond verwijderen…</p>
              <p className="gnv2-dialog-faint max-w-[16rem] text-center text-xs">
                Dit gebeurt volledig op je eigen toestel, kan bij de eerste keer
                een paar seconden duren.
              </p>
            </div>
          </div>
        )}

        {step === "masking" && maskBackgroundUrl && (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="gnv2-dialog-muted text-center text-sm font-semibold">
              Pas je hoofdcontour aan (optioneel)
            </p>
            <HeadMaskEditor
              imageUrl={maskBackgroundUrl}
              bodyPreviewUrl={
                bodyPreviewPart
                  ? resolveBodyShapeAssetPath(
                      bodyPreviewPart,
                      bodyPreviewPart.body_shape ?? DEFAULT_BODY_SHAPE,
                    )
                  : null
              }
              initialPoints={deriveDefaultHeadMaskPoints()}
              onConfirm={(points) => void handleConfirmMask(points)}
            />
          </div>
        )}

        {step === "preview" && previewFaceUrl && (
          <div className="flex w-full flex-col items-center gap-4">
            <p className="gnv2-dialog-muted text-center text-sm font-semibold">
              Zo ziet je character eruit
            </p>
            <div
              className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl bg-black/20 sm:max-w-sm lg:max-w-md"
              style={{
                backgroundImage:
                  "conic-gradient(#8a8a8a 90deg, #bdbdbd 90deg 180deg, #8a8a8a 180deg 270deg, #bdbdbd 270deg)",
                backgroundSize: "20px 20px",
              }}
            >
              <span className="gnv2-character-layers">
                {bodyPreviewPart && (
                  <img
                    src={resolveBodyShapeAssetPath(
                      bodyPreviewPart,
                      bodyPreviewPart.body_shape ?? DEFAULT_BODY_SHAPE,
                    )}
                    alt=""
                    className="gnv2-character-layer"
                  />
                )}
                <img
                  src={previewFaceUrl}
                  alt=""
                  className="gnv2-character-layer"
                />
              </span>
            </div>
            <p className="gnv2-dialog-faint max-w-sm text-center text-xs">
              Is je haar heel, zijn je oren heel, sluit je kin netjes aan, en
              zijn achtergrond/shirt/schouders volledig verdwenen? Zo niet, pas
              de positionering aan.
            </p>
            <div className="flex w-full max-w-sm flex-col gap-2.5 sm:max-w-sm lg:max-w-md">
              <button
                type="button"
                onClick={handleUsePreview}
                className="gnv2-btn gnv2-btn-primary"
              >
                Deze gebruiken
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleAdjustAgain}
                  className="gnv2-btn gnv2-btn-ghost flex-1"
                >
                  Opnieuw aanpassen
                </button>
                <button
                  type="button"
                  onClick={handleAnotherPhoto}
                  className="gnv2-btn gnv2-btn-ghost flex-1"
                >
                  Andere foto
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center gap-3 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Bezig met opslaan…</p>
          </div>
        )}

        {step === "error" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <div className="flex w-full gap-2.5">
              <button
                type="button"
                onClick={handleAnotherPhoto}
                className="gnv2-btn gnv2-btn-ghost flex-1"
              >
                Andere foto kiezen
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="gnv2-btn gnv2-btn-primary flex-1"
              >
                Opnieuw proberen
              </button>
            </div>
          </div>
        )}
      </div>

      {myPlayer.face_asset_path && step === "pick" && (
        <div className="flex flex-col items-center gap-2 pb-6">
          <p className="gnv2-dialog-faint text-xs">Huidig gezicht</p>
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-full bg-black/20"
            style={{ width: 96, height: 96 }}
          >
            <CharacterVisual
              player={myPlayer}
              characterId={null}
              layers={[personalFaceLayer(myPlayer)].filter((l) => l !== null)}
            />
          </div>
        </div>
      )}
    </GnV2Scene>
  );
}
