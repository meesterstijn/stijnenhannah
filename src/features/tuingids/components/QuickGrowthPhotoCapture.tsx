import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Plant, PlantInstance } from "@/lib/supabase";
import { plantInstanceDisplayName } from "../lib/plantInstances";
import { compactBatchLabel, TRACKING_MODE_LABELS } from "../lib/plantInstanceStatus";
import { useQuickGrowthPhotoSave } from "../hooks/useQuickGrowthPhotoSave";
import { GrowthPhotoInput } from "./GrowthPhotoInput";

/**
 * De gedeelde "Foto-laag" (UI-kant): plant_instance is al bekend → toon een
 * korte bevestiging welke plant/batch het is, open de camera (best effort)
 * en sla de eerste gekozen/gemaakte foto's automatisch op — geen dropdown,
 * geen los "opslaan"-formulier, geen aparte bevestigingsstap. Gebruikt door
 * zowel de QR-groeifotoflow (QuickGrowthPhotoDialog, na een succesvolle
 * scan of handmatige selectie) als "Groeifoto maken" vanuit een al-geopend
 * plantdetail (PlantInstanceDetailDialog) — precies dezelfde component,
 * precies dezelfde opslagroute (useQuickGrowthPhotoSave), zodat er nergens
 * een tweede foto-opslagimplementatie ontstaat.
 */
export function QuickGrowthPhotoCapture({
  instance,
  species,
  growingSeasonId,
  autoOpenCamera = true,
  foundViaQr = false,
  onSaved,
}: {
  instance: PlantInstance;
  species: Plant | undefined;
  growingSeasonId: string | null;
  autoOpenCamera?: boolean;
  /** Alleen voor de banner-tekst ("Gevonden: ..." i.p.v. gewoon de naam). */
  foundViaQr?: boolean;
  onSaved: () => void;
}) {
  const { savePhotos } = useQuickGrowthPhotoSave();
  const [photos, setPhotos] = useState<File[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const savedOnceRef = useRef(false);

  const name = plantInstanceDisplayName(instance, species);
  const batchLabel = compactBatchLabel(instance);

  async function handleSave(photosToSave: File[]) {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await savePhotos({
        instanceId: instance.id,
        instanceName: name,
        growingSeasonId,
        date,
        photos: photosToSave,
      });
      toast.success("Groeifoto opgeslagen");
      onSaved();
    } catch (err) {
      setError(`Foto opslaan mislukt: ${err instanceof Error ? err.message : "onbekende fout"}. Probeer opnieuw.`);
      // Terug naar een lege capture-UI zodat de gebruiker gewoon opnieuw op
      // "Foto maken"/"Uit galerij" kan tikken — geen formulier om opnieuw in
      // te vullen, alleen de foto zelf hoeft over.
      setPhotos([]);
      savedOnceRef.current = false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  // Slaat automatisch op zodra er een foto is — geen los "opslaan"-tikje.
  // savedOnceRef voorkomt dat een tweede state-update met dezelfde/nog meer
  // foto's een dubbele opslag triggert.
  useEffect(() => {
    if (photos.length > 0 && !savedOnceRef.current) {
      savedOnceRef.current = true;
      void handleSave(photos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  return (
    <div className="space-y-3">
      <div className="sv-inset rounded-xl p-3">
        <p className="font-medium">
          {foundViaQr && "✅ Gevonden: "}
          {name}
        </p>
        {batchLabel && (
          <p className="text-xs sv-muted">
            {TRACKING_MODE_LABELS.batch} · {batchLabel}
          </p>
        )}
      </div>

      <GrowthPhotoInput files={photos} onFilesChange={setPhotos} disabled={isSaving} autoOpenCamera={autoOpenCamera} />

      <div>
        <label className="text-xs sv-muted block mb-1">Datum</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving} className="text-sm" />
      </div>

      {isSaving && (
        <p className="text-xs sv-muted flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Foto opslaan…
        </p>
      )}
      {error && <p className="text-xs sv-destructive-text">{error}</p>}
    </div>
  );
}
