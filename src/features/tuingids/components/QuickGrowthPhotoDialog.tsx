import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronDown, Loader2, QrCode, Sprout } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import type { Plant, PlantInstance } from "@/lib/supabase";
import { useGrowthLog } from "@/features/tuingids/hooks/useGrowthLog";
import { useGrowthPhotos } from "@/features/tuingids/hooks/useGrowthPhotos";
import { optimizeGrowthPhoto } from "@/features/tuingids/lib/optimizeGrowthPhoto";
import { uploadGrowthPhoto } from "@/features/tuingids/lib/growthPhotoStorage";
import { fetchActivePlantInstances, fetchAllGrowingSeasons, plantInstanceDisplayName } from "@/features/tuingids/lib/plantInstances";
import { HEALTH_STATUS_EMOJI, compactBatchLabel } from "@/features/tuingids/lib/plantInstanceStatus";
import { GrowthPhotoInput } from "@/features/tuingids/components/GrowthPhotoInput";
import { QrScanner } from "@/features/tuingids/components/QrScanner";
import { useQrLabels } from "@/features/tuingids/hooks/useQrLabels";
import { parseQrScanText } from "@/features/tuingids/lib/qrCode";

// Searchable exemplaar-picker — zelfde Popover+cmdk-Command-opbouw als
// SpeciesCombobox in Tuinieren.tsx (niet geëxporteerd vanuit die pagina om
// een circulaire import te voorkomen, dus hier één-op-één herbouwd met
// dezelfde classes voor visuele consistentie). Zoekt op zowel exemplaar-
// als soortnaam via CommandItem's `value`.
function InstanceCombobox({
  instances,
  speciesById,
  value,
  onSelect,
}: {
  instances: PlantInstance[];
  speciesById: Map<string, Plant>;
  value: string | null;
  onSelect: (instance: PlantInstance) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = instances.find((i) => i.id === value) ?? null;
  const selectedSpecies = selected ? speciesById.get(selected.species_id) : undefined;

  return (
    // `modal` is nodig omdat deze combobox binnen een echte modale <Dialog>
    // (QuickGrowthPhotoDialog) staat, i.t.t. SpeciesCombobox in Tuinieren.tsx
    // die los in de pagina staat. Radix Dialog blokkeert scroll/touch overal
    // buiten zijn eigen content via react-remove-scroll — een niet-modale
    // Popover doet daar niet aan mee, dus het CommandList hieronder kon niet
    // gescrold worden (ook niet op mobiel). Een modale Popover krijgt zelf
    // ook een react-remove-scroll-laag, die (als laatst gemount, dus hoogst
    // op de gedeelde lock-stack) de buitenste Dialog-lock tijdelijk
    // overneemt en scrollen binnen de popover weer toestaat.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="sv-inset rounded-lg px-3 py-2 w-full flex items-center justify-between gap-2 text-left text-sm hover:opacity-90"
        >
          {selected ? (
            <span className="min-w-0 flex items-center gap-2">
              {selectedSpecies?.photo_url ? (
                <img src={selectedSpecies.photo_url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
              ) : (
                <Sprout className="h-4 w-4 shrink-0 sv-muted" />
              )}
              <span className="truncate">{plantInstanceDisplayName(selected, selectedSpecies)}</span>
            </span>
          ) : (
            <span className="sv-muted">Zoek een exemplaar...</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 sv-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 z-[60] w-[var(--radix-popover-trigger-width)]">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Zoek op exemplaar- of soortnaam..." />
          <CommandList className="max-h-[min(70vh,32rem)]">
            <CommandEmpty>
              <p className="text-xs sv-muted px-3 py-2">Geen exemplaar gevonden.</p>
            </CommandEmpty>
            {instances.map((instance) => {
              const species = speciesById.get(instance.species_id);
              const name = plantInstanceDisplayName(instance, species);
              const healthLabel = instance.health_status
                ? `${HEALTH_STATUS_EMOJI[instance.health_status] ?? ""} ${instance.health_status}`
                : null;
              const subtitle = [species?.name, compactBatchLabel(instance), healthLabel, instance.location]
                .filter(Boolean)
                .join(" · ");
              return (
                <CommandItem
                  key={instance.id}
                  value={`${name} ${species?.name ?? ""}`}
                  onSelect={() => {
                    onSelect(instance);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {species?.photo_url ? (
                    <img src={species.photo_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                  ) : (
                    <Sprout className="h-4 w-4 shrink-0 sv-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate">{name}</p>
                    {subtitle && <p className="text-xs sv-muted truncate">{subtitle}</p>}
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type SavedConfirmation = { instanceName: string };

/**
 * Snelle groeifoto-workflow vanaf "Mijn geplante exemplaren": exemplaar
 * kiezen, foto maken/kiezen, optioneel meetgegevens invullen, opslaan — en
 * direct door naar het volgende exemplaar, zonder eerst het losse
 * plantdetailvenster te hoeven openen. Hergebruikt bewust exact dezelfde
 * opslagroute als PlantLogboek (in Tuinieren.tsx, de "Notitie toevoegen"-
 * flow in het detailvenster): useGrowthLog().addEntryAsync voor de
 * growth_log_entry, daarna optimizeGrowthPhoto + uploadGrowthPhoto +
 * useGrowthPhotos().addPhoto voor de foto zelf. Geen tweede
 * upload-/compressie-/opslagpad.
 *
 * Instances/seizoenen worden opgehaald met DEZELFDE React Query-keys als
 * MyPlantInstances (["plant_instances","active"] / ["growing_seasons","all"])
 * — deze dialoog is alleen bereikbaar terwijl "Mijn geplante exemplaren"
 * al gemount is en die query dus al in de cache zit, dus dit veroorzaakt
 * geen extra netwerkverzoek.
 */
export function QuickGrowthPhotoDialog({
  speciesList,
  open,
  onClose,
}: {
  speciesList: Plant[];
  open: boolean;
  onClose: () => void;
}) {
  const { data: instances = [] } = useQuery({
    queryKey: ["plant_instances", "active"],
    queryFn: fetchActivePlantInstances,
    enabled: open,
  });
  const { data: seasons = [] } = useQuery({
    queryKey: ["growing_seasons", "all"],
    queryFn: fetchAllGrowingSeasons,
    enabled: open,
  });
  const { addEntryAsync, deleteEntry } = useGrowthLog();
  const { addPhoto } = useGrowthPhotos();
  const { getLabelByCode, getActiveAssignmentForLabel } = useQrLabels();

  const speciesById = useMemo(() => new Map(speciesList.map((s) => [s.id, s])), [speciesList]);
  const activeSeasonIdByInstance = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seasons) if (s.status === "active") map.set(s.plant_instance_id, s.id);
    return map;
  }, [seasons]);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedConfirmation, setSavedConfirmation] = useState<SavedConfirmation | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [qrAutoSelected, setQrAutoSelected] = useState(false);
  const isSavingRef = useRef(false);

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) ?? null;
  const selectedSpecies = selectedInstance ? speciesById.get(selectedInstance.species_id) : undefined;
  const selectedName = selectedInstance ? plantInstanceDisplayName(selectedInstance, selectedSpecies) : null;

  const hasUnsavedInput = !savedConfirmation && (!!selectedInstanceId || selectedPhotos.length > 0);

  function resetAll() {
    setSelectedInstanceId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setSelectedPhotos([]);
    setFormError(null);
    setSavedConfirmation(null);
    setQrMessage(null);
    setQrAutoSelected(false);
    isSavingRef.current = false;
    setIsSaving(false);
  }

  // Snelle QR-flow (Deel F): scan → exemplaar/batch direct geselecteerd →
  // gebruiker tikt alleen nog "Foto maken" hieronder (GrowthPhotoInput) om
  // de OS-camera te openen. Geen los "instance_id"-veld in deze flow — de
  // gescande code IS de selectie. Werkt identiek voor tracking_mode
  // "individual" en "batch": in beide gevallen wordt precies één
  // growth_log_entry (met precies één foto) aangemaakt voor de gescande
  // instance, ongeacht quantity — een batch-QR maakt nooit meerdere
  // logregels per plant in de batch.
  function handleQrDetected(rawText: string) {
    setQrScannerOpen(false);
    const code = parseQrScanText(rawText);
    if (!code) {
      setQrMessage("Kon geen QR-code lezen. Probeer opnieuw, of kies hieronder handmatig een exemplaar.");
      return;
    }
    const label = getLabelByCode(code);
    if (!label) {
      setQrMessage("Onbekende QR-code — dit is geen Tuingids-label. Kies hieronder handmatig een exemplaar.");
      return;
    }
    const assignment = getActiveAssignmentForLabel(label.id);
    if (!assignment) {
      setQrMessage(
        `Deze QR-code is nog niet gekoppeld${label.note ? ` (${label.note})` : ""}. Koppel 'm eerst aan een exemplaar via "Nieuw exemplaar planten" of het detailvenster.`,
      );
      return;
    }
    const found = instances.find((i) => i.id === assignment.plant_instance_id);
    if (!found) {
      setQrMessage("Gekoppeld exemplaar is niet (meer) actief. Kies hieronder handmatig een exemplaar.");
      return;
    }
    setQrMessage(null);
    setQrAutoSelected(true);
    setSelectedInstanceId(found.id);
  }

  function requestClose() {
    if (isSavingRef.current) return;
    if (hasUnsavedInput) {
      setConfirmDiscardOpen(true);
      return;
    }
    resetAll();
    onClose();
  }

  function confirmDiscardAndClose() {
    setConfirmDiscardOpen(false);
    resetAll();
    onClose();
  }

  // "Volgende foto": alles wissen behalve dat de dialoog openblijft, terug
  // naar de exemplaarselectie — zodat een rondje door de tuin snel
  // meerdere exemplaren achter elkaar gefotografeerd kan worden.
  function startNextPhoto() {
    resetAll();
  }

  async function handleSave() {
    if (isSavingRef.current) return;
    setFormError(null);

    if (!selectedInstanceId || !selectedInstance) {
      setFormError("Kies eerst een exemplaar.");
      return;
    }
    if (selectedPhotos.length === 0) {
      setFormError("Voeg een foto toe.");
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);

    const instanceName = plantInstanceDisplayName(selectedInstance, selectedSpecies);
    let newEntry: { id: string } | undefined;
    try {
      newEntry = await addEntryAsync({
        plant_id: null,
        plant_name: instanceName,
        plant_instance_id: selectedInstanceId,
        growing_season_id: activeSeasonIdByInstance.get(selectedInstanceId) ?? null,
        date,
        notes: "",
        height_cm: null,
        flower_count: null,
        fruit_count: null,
        fruit_length_cm: null,
        fruit_width_cm: null,
        quantity: null,
        watered: false,
        fertilized: false,
        photo_url: "",
      });
    } catch (err) {
      setFormError(`Opslaan mislukt: ${err instanceof Error ? err.message : "Onbekende fout"}`);
      isSavingRef.current = false;
      setIsSaving(false);
      return;
    }

    // Anders dan de bestaande "Notitie"-flow in PlantLogboek (waar een
    // meting zonder foto ook een geldig, bewaarbaar resultaat is) is een
    // foto hier een harde vereiste — deze snelle workflow bestaat juist om
    // foto's vast te leggen. Een entry zonder foto zou dat contract
    // schenden, dus bij een mislukte upload ruimen we de net aangemaakte
    // entry weer op (voorkomt half opgeslagen data) i.p.v. 'm te laten
    // staan zoals PlantLogboek dat bewust wél doet.
    for (const photo of selectedPhotos) {
      try {
        const optimized = await optimizeGrowthPhoto(photo);
        const { storagePath, publicUrl } = await uploadGrowthPhoto(selectedInstanceId, newEntry.id, optimized);
        await addPhoto({
          growth_log_entry_id: newEntry.id,
          plant_instance_id: selectedInstanceId,
          storage_path: storagePath,
          photo_url: publicUrl,
          original_filename: optimized.originalFilename,
          mime_type: optimized.mimeType,
          file_size_bytes: optimized.fileSizeBytes,
        });
      } catch (photoErr) {
        deleteEntry(newEntry.id);
        setFormError(
          `Foto uploaden mislukt: ${photoErr instanceof Error ? photoErr.message : "Onbekende fout"}. Probeer het opnieuw.`,
        );
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }
    }

    isSavingRef.current = false;
    setIsSaving(false);
    setSavedConfirmation({ instanceName });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
        <DialogContent className="tuinieren-theme sv-dialog w-full max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="sv-heading text-3xl">Groeifoto maken</DialogTitle>
          </DialogHeader>

          {savedConfirmation ? (
            <div className="space-y-4">
              <div className="sv-badge-ok rounded-xl p-4 text-sm font-medium">
                Groeifoto opgeslagen voor {savedConfirmation.instanceName}
              </div>
              <div className="flex gap-2">
                <Button className="sv-button" onClick={startNextPhoto}>
                  <Camera className="h-4 w-4" /> Volgende foto
                </Button>
                <Button
                  className="sv-button sv-button-ghost"
                  onClick={() => {
                    resetAll();
                    onClose();
                  }}
                >
                  Klaar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="sv-button sv-button-thin-border w-full"
                  onClick={() => {
                    setQrMessage(null);
                    setQrScannerOpen(true);
                  }}
                >
                  <QrCode className="h-4 w-4" /> QR-code scannen
                </Button>
                {qrMessage && <p className="text-xs sv-muted">{qrMessage}</p>}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs sv-muted font-medium uppercase tracking-wide">Exemplaar</p>
                <InstanceCombobox
                  instances={instances}
                  speciesById={speciesById}
                  value={selectedInstanceId}
                  onSelect={(i) => {
                    setQrAutoSelected(false);
                    setSelectedInstanceId(i.id);
                  }}
                />
                {selectedInstance && (
                  <p className="text-xs sv-muted">
                    {qrAutoSelected ? "✅ Via QR-code gevonden — foto" : "Foto"} wordt toegevoegd aan{" "}
                    <span className="font-medium">{selectedName}</span>
                    {selectedSpecies && selectedSpecies.name !== selectedName ? ` (${selectedSpecies.name})` : ""}.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs sv-muted font-medium uppercase tracking-wide">Foto</p>
                <GrowthPhotoInput files={selectedPhotos} onFilesChange={setSelectedPhotos} disabled={isSaving} />
              </div>

              <div>
                <label className="text-xs sv-muted block mb-1">Datum</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
              </div>

              {formError && <p className="text-xs sv-destructive-text">{formError}</p>}

              <DialogFooter>
                <Button className="sv-button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Groeifoto opslaan"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent className="tuinieren-theme sv-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Niet-opgeslagen gegevens weggooien?</AlertDialogTitle>
            <AlertDialogDescription>
              Je hebt een exemplaar, foto of meetgegevens ingevuld die nog niet zijn opgeslagen. Als je sluit, gaan deze verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Terug naar formulier</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscardAndClose}>Sluiten zonder opslaan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QrScanner
        open={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onDetected={handleQrDetected}
        title="QR-code scannen"
        description="Richt de camera op het QR-label van de plant of batch."
      />
    </>
  );
}
