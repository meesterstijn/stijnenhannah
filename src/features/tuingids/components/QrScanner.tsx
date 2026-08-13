import { useEffect, useRef, useState, type ReactNode } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (rawText: string) => void;
  title?: string;
  description?: string;
  /** Optionele extra actie onder de scanner (bv. "Of kies handmatig"). Puur
   *  een slot — QrScanner blijft zelf onwetend van wat de aanroeper daarmee
   *  doet, net als bij `onDetected`. Ook zichtbaar in de foutweergave, zodat
   *   'm bereikbaar blijft bij geweigerde cameratoegang of geen ondersteuning. */
  footer?: ReactNode;
};

/**
 * Camera-gebaseerde QR-scanner. Gebruikt de native BarcodeDetector API waar
 * beschikbaar (Chrome/Edge/Android) en valt anders terug op jsQR (leest
 * videoframes via een verborgen canvas) — nodig voor Safari/iOS, waar
 * BarcodeDetector niet bestaat. Dit is de ENIGE plek in de app die
 * getUserMedia gebruikt: de bestaande foto-opname (GrowthPhotoInput) werkt
 * via een native <input capture>, dus er is nooit een tweede actieve
 * camerastream — deze component stopt zijn eigen stream altijd (bij
 * detectie, sluiten, of unmount) vóórdat de aanroepende flow verdergaat naar
 * de volgende stap (bv. het foto-camera-input openen).
 */
export function QrScanner({ open, onClose, onDetected, title = "QR-code scannen", description, footer }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    let cancelled = false;
    let detected = false;

    function stopStream() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    function handleDetected(text: string) {
      if (detected) return;
      detected = true;
      stopStream();
      onDetectedRef.current(text);
    }

    async function runDetectionLoop() {
      const nativeDetectorCtor = "BarcodeDetector" in window ? window.BarcodeDetector : undefined;
      const detector = nativeDetectorCtor ? new nativeDetectorCtor({ formats: ["qr_code"] }) : null;

      const tick = async () => {
        if (cancelled || detected) return;
        const video = videoRef.current;
        if (video && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
          try {
            if (detector) {
              const results = await detector.detect(video);
              if (results.length > 0) {
                handleDetected(results[0].rawValue);
                return;
              }
            } else {
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext("2d");
              if (canvas && ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code?.data) {
                  handleDetected(code.data);
                  return;
                }
              }
            }
          } catch {
            // Eén mislukte detectiepoging is geen fout — gewoon volgende frame proberen.
          }
        }
        if (!cancelled && !detected) {
          rafRef.current = requestAnimationFrame(() => void tick());
        }
      };
      rafRef.current = requestAnimationFrame(() => void tick());
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera scannen wordt niet ondersteund in deze browser. Kies handmatig een exemplaar.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        void runDetectionLoop();
      } catch (err) {
        const denied =
          err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
        setError(
          denied
            ? "Cameratoegang geweigerd. Geef toegang in je browserinstellingen, of kies handmatig een exemplaar."
            : "Camera kon niet worden gestart. Kies handmatig een exemplaar.",
        );
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[210] bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[210] flex flex-col items-center justify-center p-4 focus:outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <div className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-between text-white">
              <p className="text-sm font-medium">{title}</p>
              <button
                type="button"
                onClick={onClose}
                className="bg-white/10 rounded-full h-9 w-9 flex items-center justify-center"
                aria-label="Sluiten"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {description && <p className="text-xs text-white/70">{description}</p>}

            {error ? (
              <div className="rounded-xl bg-white/10 text-white text-sm p-4 space-y-3">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="sv-button sv-button-thin-border px-4 py-2 text-sm"
                >
                  Sluiten
                </button>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-2xl" />
              </div>
            )}

            {footer && <div className="text-center">{footer}</div>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
