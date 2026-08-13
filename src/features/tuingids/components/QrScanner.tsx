import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  /** Uitsluitend voor gebruik binnen QuickGrowthPhotoDialog, dat zelf al een
   *  eigen modale <Dialog> open heeft staan terwijl deze scanner ook open
   *  gaat. Standaard (false, alle andere aanroepers) rendert deze component
   *  zijn eigen `DialogPrimitive.Root`/Portal/Overlay — dat is dan de ENIGE
   *  modale laag. `embedded=true` slaat die Radix-Dialog-wrapper over en
   *  portalt in plaats daarvan een kale, niet-Radix full-screen `<div>` met
   *  exact dezelfde opmaak naar document.body.
   *
   *  Waarom: twee gelijktijdig open Radix `Dialog.Root`-instanties (deze
   *  scanner ÉN de aanroepende dialoog) zijn geen DOM-afstammeling van
   *  elkaar (allebei geportald), maar registreren zich wél als aparte lagen
   *  bij Radix' gedeelde DismissableLayer-stack. Op desktop bleek al dat
   *  focus die in deze (hogere) laag belandt door de buitenste dialoog als
   *  "focus verliet mij" wordt gezien. Op mobiel/touch is er een tweede,
   *  hardnekkiger variant: Radix' `usePointerDownOutside` stelt de
   *  dismiss-beslissing bij een touch-pointerdown bewust uit tot het
   *  eerstvolgende `click`-event op `document` (zie
   *  node_modules/@radix-ui/react-dismissable-layer/dist/index.js,
   *  `if (event.pointerType === "touch") { ... addEventListener("click", ..., {once:true}) }`)
   *  — en dát is precies hetzelfde native click-event dat de "Handmatig
   *  kiezen"-knop zelf ook al afhandelt. Een losse `onInteractOutside`-
   *  preventDefault op de buitenste dialoog (eerdere, ontoereikende fix)
   *  blijft afhankelijk van de exacte volgorde waarin React die uitgestelde
   *  dispatch verwerkt t.o.v. de eigen state-update, en is op mobiel niet
   *  betrouwbaar gebleken. `embedded` verwijdert de wortel van dit probleem:
   *  met maar één actieve Radix-Dialog-laag tegelijk kan dit conflict
   *  helemaal niet meer optreden — voor geen enkele andere aanroeper van
   *  QrScanner verandert er iets, die laten `embedded` gewoon weg.
   *
   *  `embedded` alléén blijkt niet voldoende: zonder een tweede Radix-laag
   *  ziet de aanroepende dialoog een klik in deze overlay opnieuw als
   *  "outside" (voorheen toevallig onderdrukt door de layer-stack-logica die
   *  bij twee gelijktijdige modale Radix-lagen hoort — zie
   *  `onEmbeddedPointerDown` hieronder voor de aanvullende fix die de
   *  aanroeper daadwerkelijk in staat stelt dit te voorkomen). */
  embedded?: boolean;
  /** Alleen relevant met `embedded`. Vuurt synchroon op de capture-fase van
   *  pointerdown binnen deze overlay — vóórdat React state bijwerkt of iets
   *  unmount. De aanroeper gebruikt dit om (via een ref, niet via state) te
   *  onthouden "deze interactie begon in de scanner", zodat de eigen
   *  buitenste <Dialog> die interactie via `onInteractOutside` alsnog kan
   *  negeren — ongeacht of dat direct gebeurt (muis) of pas na een later,
   *  uitgesteld click-event op document (touch, Radix' eigen gedrag voor
   *  pointerType "touch"), want op dát moment kan de eigen `phase`-state
   *  van de aanroeper al zijn doorgeschoten naar "manual". */
  onEmbeddedPointerDown?: () => void;
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
export function QrScanner({
  open,
  onClose,
  onDetected,
  title = "QR-code scannen",
  description,
  footer,
  embedded = false,
  onEmbeddedPointerDown,
}: Props) {
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

  // Gedeeld tussen beide render-paden hieronder (embedded en normaal) —
  // exact dezelfde opmaak/markup, alleen de buitenste wrapper verschilt.
  const content = (
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
  );

  if (embedded) {
    // Kale, niet-Radix full-screen overlay — zie de toelichting bij de
    // `embedded`-prop hierboven voor waarom dit nodig is (voorkomt een
    // tweede, gelijktijdig actieve Radix Dialog-laag). Overlay-achtergrond
    // en content-centrering hier samengevoegd in één element (i.p.v. de
    // aparte Overlay+Content van Radix hieronder) — puur omdat er nu geen
    // aparte lagen meer nodig zijn; visueel identiek.
    if (!open) return null;
    return createPortal(
      <div
        // `pointer-events-auto` is hier geen stijlkeuze maar functioneel
        // noodzakelijk: zolang de aanroepende (buitenste) Dialog modaal open
        // staat, zet Radix' eigen DismissableLayer `document.body.style.
        // pointerEvents = "none"` om echte klikken buiten de dialoog te
        // blokkeren — en compenseert dat alleen voor DOM-nodes die het zelf
        // als Radix-laag herkent. Deze div is met opzet GEEN Radix-laag
        // (dat is het hele punt van embedded), dus zonder deze expliciete
        // override erft hij `pointer-events: none` van <body> en wordt de
        // volledige overlay (incl. "Of kies handmatig") onklikbaar terwijl
        // 'm gewoon zichtbaar blijft.
        className="fixed inset-0 z-[210] flex flex-col items-center justify-center p-4 bg-black/90 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDownCapture={onEmbeddedPointerDown}
      >
        {content}
      </div>,
      document.body,
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[210] bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[210] flex flex-col items-center justify-center p-4 focus:outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {content}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
