import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Area } from "react-easy-crop";
import { ArrowLeft, Camera, ImageIcon, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useCharacterParts } from "@/features/game-night/hooks/useCharacterCatalog";
import { useUpdateMyFace } from "@/features/game-night/hooks/useGameNightFace";
import { optimizeGameNightFacePhoto } from "@/features/game-night/lib/optimizeGameNightFacePhoto";
import {
  uploadPlayerFaceAsset,
  uploadPlayerFaceOriginal,
} from "@/features/game-night/lib/gameNightFaceStorage";
import {
  loadImageFromUrl,
  renderCanonicalFaceCanvas,
} from "@/features/game-night/lib/gameNightFaceCanvas";
import {
  preloadFaceSegmenter,
  removeSelfieBackground,
} from "@/features/game-night/lib/gameNightFaceSegmentation";
import { FaceCropper } from "@/features/game-night/components/FaceCropper";
import { personalFaceLayer } from "@/features/game-night/lib/gameNightCharacter";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";
import { CharacterVisual } from "@/features/game-night/v2/CharacterVisual";

const SEGMENTATION_VERSION = "mediapipe-selfie-segmenter-v1";

type Step = "pick" | "segmenting" | "cropping" | "saving" | "error";
type ErrorStage = "segmentation" | "save";

// Game Night — "Maak je Game Night-character": foto maken/kiezen →
// achtergrond verwijderen (client-side segmentatie) → canonical crop →
// opslag → face-layer. Bewust EIGEN, kleine route (/game-night/me/face)
// i.p.v. een stap in GameNightCharacterCreator.tsx: dit is functioneel een
// volledig andere flow (camera/crop/segmentatie) dan de bestaande
// onderdelen-kiezer-grid, geen reden om die twee te vermengen.
//
// Foto-aanlevering hergebruikt bewust het bestaande, bewezen patroon uit
// PhotoCaptureFlow.tsx/GrowthPhotoInput.tsx (twee verborgen file-inputs,
// één met `capture`) i.p.v. een eigen WebRTC-camera-overlay te bouwen —
// hier met `capture="user"` (voorkant/selfiecamera) i.p.v. "environment",
// want dit is een portret van de speler zelf, geen omgevingsfoto.
export default function GameNightFaceSetup() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: analyticsData, isLoading: analyticsLoading } =
    useGameNightAnalytics();
  const { data: characterParts = [] } = useCharacterParts();
  const updateFace = useUpdateMyFace();

  const myPlayer = analyticsData?.players.find(
    (p) => p.auth_user_id === session?.user.id,
  );

  // Opdracht sectie 9: live body-preview áchter de gesegmenteerde foto in
  // de cropper. Vandaag bestaat er nog geen production-ready custom
  // 512x512 body (parts/custom/ is leeg, zie de vorige opleverrapporten) —
  // deze lookup levert dan simpelweg `undefined` op en FaceCropper toont
  // gewoon geen body-laag. Zodra een echte body-asset actief wordt
  // geregistreerd, pakt dit 'm automatisch op, zonder verdere codewijziging.
  const bodyPreviewPart = characterParts.find((p) => p.slot === "base");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPreviewUrl, setRawPreviewUrl] = useState<string | null>(null);
  const [segmentedImageUrl, setSegmentedImageUrl] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<ErrorStage | null>(null);
  const cropAreaRef = useRef<Area | null>(null);
  // Bewaard tussen de segmentatie- en opslagstap: de al-geoptimaliseerde
  // (grootte-beperkte) foto is zowel de segmentatie-INPUT als het
  // uiteindelijk als "origineel" te uploaden bestand — één keer berekend,
  // niet twee keer.
  const optimizedOriginalRef = useRef<Awaited<
    ReturnType<typeof optimizeGameNightFacePhoto>
  > | null>(null);

  // Opdracht sectie 11: vast alvast (optimistisch, fouten genegeerd) de
  // ~9.4MB WASM-runtime laden zodra deze pagina opent, zodat de
  // "Achtergrond verwijderen…"-stap na foto-keuze niet ook nog op die
  // download hoeft te wachten.
  useEffect(() => {
    preloadFaceSegmenter();
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setRawPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setRawPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (segmentedImageUrl) URL.revokeObjectURL(segmentedImageUrl);
    };
  }, [segmentedImageUrl]);

  async function runSegmentation(file: File) {
    setStep("segmenting");
    setErrorMessage(null);
    setErrorStage(null);
    try {
      // Segmentatie-input (opdracht sectie 12): de AL BESTAANDE, op 1600px
      // langste zijde gecapte "origineel"-foto — zie
      // gameNightFaceSegmentation.ts voor de volledige motivatie om geen
      // aparte, tweede downscale-stap te bouwen.
      const optimized = await optimizeGameNightFacePhoto(file);
      optimizedOriginalRef.current = optimized;
      const optimizedUrl = URL.createObjectURL(optimized.blob);
      try {
        const sourceImage = await loadImageFromUrl(optimizedUrl);
        const { canvas } = await removeSelfieBackground(sourceImage);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("Kan gesegmenteerde foto niet exporteren."));
          }, "image/png");
        });
        cropAreaRef.current = null;
        setSegmentedImageUrl(URL.createObjectURL(blob));
        setStep("cropping");
      } finally {
        URL.revokeObjectURL(optimizedUrl);
      }
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

  function handlePicked(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setSelectedFile(file);
    void runSegmentation(file);
  }

  function handleBackToPick() {
    setSelectedFile(null);
    setSegmentedImageUrl(null);
    optimizedOriginalRef.current = null;
    setErrorMessage(null);
    setErrorStage(null);
    setStep("pick");
  }

  function handleRetry() {
    if (!selectedFile) {
      handleBackToPick();
      return;
    }
    if (errorStage === "segmentation") {
      void runSegmentation(selectedFile);
    } else {
      void handleConfirmCrop();
    }
  }

  function handleBackToProfile() {
    navigate("/game-night/me");
  }

  async function handleConfirmCrop() {
    const optimizedOriginal = optimizedOriginalRef.current;
    if (!optimizedOriginal || !myPlayer || !segmentedImageUrl) return;
    const cropArea = cropAreaRef.current;
    if (!cropArea) return; // react-easy-crop nog niet geïnitialiseerd — knop staat dan disabled

    setStep("saving");
    setErrorMessage(null);
    setErrorStage(null);
    try {
      // 1. Origineel: de al-geoptimaliseerde (grootte-beperkte, nog NIET
      //    gecropte of gesegmenteerde) foto — bewaard voor toekomstige
      //    herverwerking (bv. een beter segmentatiemodel later), zie het
      //    opleverrapport.
      const uploadedOriginal = await uploadPlayerFaceOriginal(
        myPlayer.id,
        optimizedOriginal.blob,
        optimizedOriginal.mimeType,
        optimizedOriginal.extension,
      );

      // 2. Afgeleide canonieke 512x512 face-laag: getekend uit de
      //    GESEGMENTEERDE (transparante-achtergrond) foto, op de door de
      //    speler gekozen crop-positie. renderCanonicalFaceCanvas vult het
      //    canvas nergens met een achtergrondkleur — het alfakanaal van de
      //    segmentatie blijft volledig behouden tot en met de PNG-export.
      const segmentedImage = await loadImageFromUrl(segmentedImageUrl);
      const cropRect = {
        sourceX: cropArea.x,
        sourceY: cropArea.y,
        sourceWidth: cropArea.width,
        sourceHeight: cropArea.height,
      };
      const faceBlob = await renderCanonicalFaceCanvas(
        segmentedImage,
        cropRect,
      );
      const uploadedFace = await uploadPlayerFaceAsset(myPlayer.id, faceBlob);

      await updateFace.mutateAsync({
        faceOriginalPath: uploadedOriginal.storagePath,
        faceAssetPath: uploadedFace.storagePath,
        faceCrop: {
          ...cropRect,
          segmentationVersion: SEGMENTATION_VERSION,
          processedAt: new Date().toISOString(),
        },
      });

      navigate("/game-night/me");
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

  if (analyticsLoading) {
    return (
      <GnV2Scene className="gnv2-creator-scene">
        <div className="gnv2-loading">
          <div className="gnv2-loading-pulse" aria-hidden />
        </div>
      </GnV2Scene>
    );
  }

  if (!myPlayer) {
    return (
      <GnV2Scene className="gnv2-creator-scene">
        <div className="gnv2-creator-empty">
          <p>Dit account is nog niet gekoppeld aan een spelersprofiel.</p>
          <button
            type="button"
            onClick={handleBackToProfile}
            className="gnv2-btn gnv2-btn-ghost"
          >
            Terug
          </button>
        </div>
      </GnV2Scene>
    );
  }

  return (
    <GnV2Scene className="gnv2-creator-scene">
      <header className="gnv2-topbar gnv2-topbar-compact">
        <button
          type="button"
          onClick={step === "pick" ? handleBackToProfile : handleBackToPick}
          className="gnv2-nav-btn"
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

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6">
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
              Maak een foto van je gezicht of kies een bestaande foto — we
              verwijderen daarna automatisch de achtergrond.
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

        {step === "segmenting" && (
          <div className="relative flex w-full max-w-sm flex-col items-center gap-4">
            {rawPreviewUrl && (
              <img
                src={rawPreviewUrl}
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

        {step === "cropping" && segmentedImageUrl && (
          <div className="flex w-full flex-col items-center gap-4">
            <FaceCropper
              imageUrl={segmentedImageUrl}
              bodyPreviewUrl={bodyPreviewPart?.asset_path}
              onCropAreaChange={(area) => {
                cropAreaRef.current = area;
              }}
            />
            <div className="flex w-full max-w-sm gap-2.5">
              <button
                type="button"
                onClick={handleBackToPick}
                className="gnv2-btn gnv2-btn-ghost flex-1"
              >
                Andere foto
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="gnv2-btn gnv2-btn-primary flex-1"
              >
                Gebruiken
              </button>
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
                onClick={handleBackToPick}
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
