import { useState } from "react";
import { QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Plant, PlantInstance } from "@/lib/supabase";
import { useQrLabels } from "../hooks/useQrLabels";
import { QrScanner } from "./QrScanner";
import { parseQrScanText } from "../lib/qrCode";
import { plantInstanceDisplayName } from "../lib/plantInstances";

/**
 * Gedeelde "QR-code scannen"-knop + resultaatweergave, gebruikt zowel bij
 * het aanmaken van een nieuw exemplaar (Deel C — de koppeling wordt daar pas
 * na het opslaan van de nieuwe instance daadwerkelijk gelegd) als bij het
 * koppelen van een QR-code aan een bestaand exemplaar (Deel D — daar wordt
 * meteen gekoppeld). Deze component bepaalt zelf alleen "is deze code
 * geldig en vrij" en geeft de gekozen code omhoog via onChange — de
 * daadwerkelijke assign_qr_label-aanroep (en het moment waarop die gebeurt)
 * blijft aan de aanroeper, omdat dat per flow verschilt.
 */
export function QrScanAndLinkControl({
  value,
  onChange,
  instancesById,
  speciesById,
  /** Als een gescande code al gekoppeld is aan dit exemplaar, telt dat niet
   *  als "elders gekoppeld" (gebruikt bij "QR-code vervangen": opnieuw
   *  scannen van dezelfde code op hetzelfde exemplaar is een no-op). */
  ignoreLinkedToInstanceId,
  disabled,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  instancesById: Map<string, PlantInstance>;
  speciesById: Map<string, Plant>;
  ignoreLinkedToInstanceId?: string;
  disabled?: boolean;
}) {
  const { getLabelByCode, getActiveAssignmentForLabel } = useQrLabels();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = value ? getLabelByCode(value) : null;

  function handleDetected(rawText: string) {
    setScannerOpen(false);
    const code = parseQrScanText(rawText);
    if (!code) {
      setError("Kon geen QR-code lezen. Probeer opnieuw.");
      return;
    }
    const foundLabel = getLabelByCode(code);
    if (!foundLabel) {
      setError("Onbekende QR-code — dit is geen Tuingids-label.");
      return;
    }
    const assignment = getActiveAssignmentForLabel(foundLabel.id);
    if (assignment && assignment.plant_instance_id !== ignoreLinkedToInstanceId) {
      const linkedInstance = instancesById.get(assignment.plant_instance_id);
      const linkedSpecies = linkedInstance ? speciesById.get(linkedInstance.species_id) : undefined;
      const linkedName = linkedInstance ? plantInstanceDisplayName(linkedInstance, linkedSpecies) : "een andere registratie";
      setError(`Deze QR-code is al gekoppeld aan ${linkedName}.`);
      return;
    }
    setError(null);
    onChange(code);
  }

  if (value && label) {
    return (
      <div className="sv-inset rounded-lg p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <QrCode className="h-4 w-4 shrink-0 sv-muted" />
          <span className="text-sm truncate">{label.note ?? "QR-label gekoppeld"}</span>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-xs sv-muted hover:opacity-80 flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" /> Verwijderen
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="sv-button sv-button-thin-border w-full"
        onClick={() => {
          setError(null);
          setScannerOpen(true);
        }}
        disabled={disabled}
      >
        <QrCode className="h-4 w-4" /> QR-code scannen
      </Button>
      {error && <p className="text-xs sv-destructive-text">{error}</p>}

      <QrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleDetected}
        title="QR-code scannen"
        description="Richt de camera op het QR-label."
      />
    </div>
  );
}
