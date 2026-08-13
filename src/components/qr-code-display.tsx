import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { cn } from "@/lib/utils";
import { buildQrCodeStylingOptions } from "./qr-code-image";

type Props = {
  /** De data die de QR moet coderen. `null` = nog niets om te tonen (bv. tijdens laden). */
  data: string | null;
  /** Zijde van de vierkante QR in px. Default 220. */
  size?: number;
  backgroundColor?: string;
  /** Puur cosmetisch (bv. rounded-md). Geen padding/border hier zetten — dat
   *  duwt de exact op `size` gezette box uit z'n vel; wrap deze component in
   *  plaats daarvan in een eigen buitenste div voor kader/padding, zoals
   *  wifi-widget.tsx en QrLabelsManagerDialog.tsx doen. */
  className?: string;
};

/**
 * Gedeelde QR-code-renderer, gebruikt door zowel de wifi-QR (wifi-widget.tsx)
 * als de Tuingids QR-labels (QrLabelsManagerDialog.tsx) — één implementatie
 * i.p.v. twee losse imperatieve qr-code-styling-integraties. De stijldefinitie
 * zelf (buildQrCodeStylingOptions) staat in qr-code-image.ts, samen met
 * downloadQrCodeImage — dat houdt dit bestand component-only (nodig voor
 * Fast Refresh; een bestand dat naast een component ook losse functies
 * exporteert breekt hot-reload voor dat bestand).
 *
 * Belangrijk lifecycle-detail (de oorzaak van een eerdere bug waarbij de QR
 * niet zichtbaar werd binnen een Radix <Dialog>): een `useRef` + `useEffect`
 * die alleen bij `[open, data]` opnieuw draait, gaat ervan uit dat de
 * container-DOM-node er al staat zodra dat effect voor het eerst vuurt. Bij
 * een eenvoudige `{open && <div ref .../>}` klopt dat meestal, maar
 * `DialogPrimitive.Content` (Radix) mount zijn kinderen — en dus deze ref —
 * niet gegarandeerd synchroon met de eerste render waarin `open` true wordt;
 * een callback-ref (via `useState` i.p.v. `useRef`) lost dat root cause op:
 * die wordt door React aangeroepen op het EXACTE moment dat de DOM-node
 * verschijnt of verdwijnt, ongeacht wanneer dat is, dus het effect hieronder
 * (dat `container` als dependency heeft) vuurt gegarandeerd zodra er
 * daadwerkelijk iets is om in te renderen — nooit te vroeg, nooit "gemist".
 *
 * Elke instantie van dit component heeft zijn eigen QRCodeStyling-object
 * (i.p.v. één module-singleton gedeeld tussen alle gebruikers ervan) zodat
 * twee QR-weergaven nooit elkaars laatst-gebruikte containerreferentie delen.
 */
export function QrCodeDisplay({ data, size = 220, backgroundColor = "#ffffff", className }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!container || !data) return;

    if (!qrInstanceRef.current) {
      qrInstanceRef.current = new QRCodeStyling(buildQrCodeStylingOptions(size, backgroundColor));
    }

    qrInstanceRef.current.update({ data, width: size, height: size, backgroundOptions: { color: backgroundColor } });
    // Container expliciet legen vóór het appenden: voorkomt dat bij meerdere
    // keren openen/herrenderen meerdere SVG's zich opstapelen in dezelfde node.
    container.innerHTML = "";
    qrInstanceRef.current.append(container);

    return () => {
      container.innerHTML = "";
    };
  }, [container, data, size, backgroundColor]);

  return (
    // width vast op `size` (crisp render-resolutie voor qr-code-styling),
    // maar `max-width:100%` + aspect-ratio + een child-selector die de
    // geïnjecteerde <svg> zelf op w-full/h-auto zet, laat 'm op smalle
    // mobiele schermen responsief meekrimpen zonder kwaliteitsverlies (SVG,
    // dus schaalt vector-scherp via de eigen viewBox).
    <div
      ref={setContainer}
      className={cn("[&>svg]:h-auto [&>svg]:w-full", className)}
      style={{ width: size, maxWidth: "100%", aspectRatio: "1 / 1" }}
    />
  );
}
