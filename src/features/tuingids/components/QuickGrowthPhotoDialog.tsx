import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Loader2, QrCode, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import type { Plant, PlantInstance } from "@/lib/supabase";
import { fetchActivePlantInstances, fetchAllGrowingSeasons, plantInstanceDisplayName } from "@/features/tuingids/lib/plantInstances";
import { HEALTH_STATUS_EMOJI, compactBatchLabel, INSTANCE_STATUS_LABELS } from "@/features/tuingids/lib/plantInstanceStatus";
import { QrScanner } from "@/features/tuingids/components/QrScanner";
import { QuickGrowthPhotoCapture } from "@/features/tuingids/components/QuickGrowthPhotoCapture";
import { useQrLabels } from "@/features/tuingids/hooks/useQrLabels";

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

type Phase = "scanning" | "resolving" | "manual" | "capture";

/**
 * Snelle groeifoto-workflow vanaf "Mijn geplante exemplaren". Twee ingangen
 * naar hetzelfde eindpunt (QuickGrowthPhotoCapture, de gedeelde foto-laag):
 *
 *  - QR scannen (standaard bij openen): QrScanner (camera/decodering) →
 *    useQrLabels().resolveQrScan (resolver-laag: code → plant_instance) →
 *    exemplaar bekend, camera-capture opent automatisch.
 *  - "Of kies handmatig" (altijd bereikbaar, ook als scannen niet lukt/geen
 *    toestemming heeft/de sticker beschadigd is): dezelfde combobox als
 *    voorheen, resultaat gaat naar dezelfde capture-stap.
 *
 * QrScanner zelf blijft alleen verantwoordelijk voor camera + decoderen —
 * deze dialoog (de "caller") bepaalt wat er met een geslaagde scan gebeurt.
 * De algemene "QR scannen"-knop in Tuinieren.tsx gebruikt dezelfde resolver
 * maar doet er iets anders mee (detailvenster openen i.p.v. camera).
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
  const { resolveQrScan } = useQrLabels();

  const speciesById = useMemo(() => new Map(speciesList.map((s) => [s.id, s])), [speciesList]);
  const activeSeasonIdByInstance = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seasons) if (s.status === "active") map.set(s.plant_instance_id, s.id);
    return map;
  }, [seasons]);

  const [phase, setPhase] = useState<Phase>("scanning");
  const [resolvedInstance, setResolvedInstance] = useState<PlantInstance | null>(null);
  const [resolvedViaQr, setResolvedViaQr] = useState(false);

  // Terug naar de scanstap: gebruikt na een geslaagde opslag — de toast
  // ("Groeifoto opgeslagen", zie QuickGrowthPhotoCapture) blijft even
  // zichtbaar terwijl de scanner alweer klaarstaat voor de volgende plant,
  // zodat een rondje door de tuin zonder enige extra tik meerdere
  // exemplaren achter elkaar kan fotograferen.
  function resetToScanning() {
    setPhase("scanning");
    setResolvedInstance(null);
    setResolvedViaQr(false);
  }

  // Sluiten (kruisje, Escape, buiten de dialoog klikken — allemaal via
  // Radix' onOpenChange) reset meteen naar de scanstap, zodat de volgende
  // keer dat de dialoog opengaat er al een schone staat klaarstaat i.p.v.
  // pas ná het openen te moeten resetten (dat zou de vorige sessie's
  // capture-scherm nog héél even laten opflitsen — test 30 dekt dit).
  function handleClose() {
    resetToScanning();
    onClose();
  }

  async function handleQrDetected(rawText: string) {
    setPhase("resolving");
    const result = await resolveQrScan(rawText, instances);
    switch (result.status) {
      case "invalid":
        toast.error("Geen geldige Tuingids QR-code");
        setPhase("scanning");
        return;
      case "deleted":
        toast.error("Dit QR-label is verwijderd en niet meer in gebruik.");
        setPhase("scanning");
        return;
      case "unlinked":
        toast(`Deze QR-code is nog niet gekoppeld${result.label.note ? ` (${result.label.note})` : ""}.`);
        setPhase("scanning");
        return;
      case "inactive":
        toast.error(
          `Deze QR-code hoort bij een niet-actieve registratie (${INSTANCE_STATUS_LABELS[result.instance.status]}).`,
        );
        setPhase("scanning");
        return;
      case "resolved":
        setResolvedInstance(result.instance);
        setResolvedViaQr(true);
        setPhase("capture");
        return;
    }
  }

  function handleManualSelect(instance: PlantInstance) {
    setResolvedInstance(instance);
    setResolvedViaQr(false);
    setPhase("capture");
  }

  const resolvedSpecies = resolvedInstance ? speciesById.get(resolvedInstance.species_id) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="tuinieren-theme sv-dialog w-full max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="sv-heading text-3xl">Groeifoto maken</DialogTitle>
          </DialogHeader>

          {phase === "resolving" ? (
            <div className="py-10 flex flex-col items-center gap-2 text-sm sv-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              Plant zoeken…
            </div>
          ) : phase === "manual" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs sv-muted font-medium uppercase tracking-wide">Exemplaar</p>
                <InstanceCombobox instances={instances} speciesById={speciesById} value={null} onSelect={handleManualSelect} />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="sv-button sv-button-thin-border w-full"
                onClick={() => setPhase("scanning")}
              >
                <QrCode className="h-4 w-4" /> QR-code scannen
              </Button>
            </div>
          ) : phase === "capture" && resolvedInstance ? (
            <QuickGrowthPhotoCapture
              instance={resolvedInstance}
              species={resolvedSpecies}
              growingSeasonId={activeSeasonIdByInstance.get(resolvedInstance.id) ?? null}
              foundViaQr={resolvedViaQr}
              onSaved={resetToScanning}
            />
          ) : (
            // phase === "scanning" — de eigenlijke camera-overlay staat in
            // QrScanner hieronder; dit is puur wat er even doorheen
            // schemert in de dialoog erachter.
            <div className="py-10 text-center text-sm sv-muted">Scan de QR-code van de plant of batch.</div>
          )}
        </DialogContent>
      </Dialog>

      <QrScanner
        open={open && phase === "scanning"}
        onClose={() => setPhase("manual")}
        onDetected={(text) => void handleQrDetected(text)}
        title="QR-code scannen"
        description="Scan de QR-code van de plant of batch."
        // Deze scanner opent terwijl de <Dialog> hierboven al open staat —
        // embedded voorkomt daarmee een tweede, gelijktijdig actieve Radix
        // Dialog-laag (zie de toelichting bij QrScanner's `embedded`-prop).
        // Dat was de daadwerkelijke oorzaak van "Handmatig kiezen" die de
        // hele flow sloot, met name op mobiel/touch.
        embedded
        footer={
          <button type="button" onClick={() => setPhase("manual")} className="text-sm text-white/80 underline">
            Of kies handmatig
          </button>
        }
      />
    </>
  );
}
