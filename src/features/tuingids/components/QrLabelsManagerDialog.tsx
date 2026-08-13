import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { Loader2, Plus, QrCode as QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Plant, PlantInstance } from "@/lib/supabase";
import { useQrLabels } from "../hooks/useQrLabels";
import { plantInstanceDisplayName } from "../lib/plantInstances";
import { buildQrLabelDeepLink } from "../lib/qrCode";

// Zelfde imperatieve QRCodeStyling-patroon als de bestaande wifi-QR
// (wifi-widget.tsx): één module-singleton, hergebruikt via .update() +
// opnieuw .append()'en telkens als de preview voor een ander label opent.
const previewQr = new QRCodeStyling({
  width: 220,
  height: 220,
  type: "svg",
  dotsOptions: { type: "rounded", color: "#000000" },
  cornersSquareOptions: { type: "extra-rounded", color: "#000000" },
  cornersDotOptions: { type: "dot", color: "#000000" },
  backgroundOptions: { color: "#ffffff" },
  qrOptions: { errorCorrectionLevel: "M" },
});

function QrLabelPreviewDialog({
  code,
  note,
  open,
  onClose,
}: {
  code: string | null;
  note: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !code || !qrRef.current) return;
    previewQr.update({ data: buildQrLabelDeepLink(code) });
    qrRef.current.innerHTML = "";
    previewQr.append(qrRef.current);
  }, [open, code]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tuinieren-theme sv-dialog w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">QR-label</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div ref={qrRef} className="rounded-xl overflow-hidden bg-white p-3" />
          {note && <p className="text-sm font-medium">{note}</p>}
          <p className="text-xs sv-muted text-center">
            Print of bewaar deze afbeelding en plak 'm op de bak of pot. De sticker zelf blijft bruikbaar, ook nadat
            de plant die er nu aan hangt is afgerond — dan wordt het label vanzelf weer "Vrij".
          </p>
        </div>
        <DialogFooter>
          <Button size="sm" variant="ghost" className="sv-button sv-button-ghost" onClick={onClose}>
            Sluiten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Beheerscherm voor herbruikbare QR-labels: nieuwe labels aanmaken (voor het
 * printen van stickers) en per label zien of het Vrij is of aan welk
 * exemplaar/batch het momenteel gekoppeld is. Koppelen zelf gebeurt bewust
 * NIET hier — dat gebeurt via "QR-code scannen" bij het aanmaken van een
 * nieuw exemplaar (Deel C) of "QR-code koppelen/vervangen" in het
 * detailvenster van een bestaand exemplaar (Deel D), zodat een koppeling
 * altijd expliciet aan een concrete plant/batch hangt.
 */
export function QrLabelsManagerDialog({
  open,
  onClose,
  instancesById,
  speciesById,
}: {
  open: boolean;
  onClose: () => void;
  instancesById: Map<string, PlantInstance>;
  speciesById: Map<string, Plant>;
}) {
  const { labels, getActiveAssignmentForLabel, createLabel, isCreatingLabel, createLabelError } = useQrLabels();
  const [note, setNote] = useState("");
  const [previewLabel, setPreviewLabel] = useState<{ code: string; note: string | null } | null>(null);

  async function handleCreate() {
    const created = await createLabel(note.trim() || null);
    setNote("");
    if (created) setPreviewLabel({ code: created.code, note: created.note });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="tuinieren-theme sv-dialog w-full max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sv-heading text-3xl">QR-labels</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs sv-muted block">Naam op sticker (optioneel)</label>
                <Input
                  placeholder="bv. Bak links, moestuinbed A..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Button size="sm" className="sv-button shrink-0" onClick={handleCreate} disabled={isCreatingLabel}>
                {isCreatingLabel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Nieuw label
                  </>
                )}
              </Button>
            </div>
            {createLabelError && <p className="text-xs sv-destructive-text">{createLabelError.message}</p>}

            <div className="space-y-2">
              {labels.length === 0 ? (
                <p className="text-sm sv-muted">Nog geen QR-labels aangemaakt.</p>
              ) : (
                [...labels].reverse().map((label) => {
                  const assignment = getActiveAssignmentForLabel(label.id);
                  const instance = assignment ? instancesById.get(assignment.plant_instance_id) : undefined;
                  const species = instance ? speciesById.get(instance.species_id) : undefined;
                  const linkedName = instance ? plantInstanceDisplayName(instance, species) : null;
                  return (
                    <div key={label.id} className="sv-panel p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{label.note ?? "Naamloos label"}</p>
                        {linkedName ? (
                          <p className="text-xs sv-muted truncate">
                            In gebruik — <span className="text-foreground">{linkedName}</span>
                          </p>
                        ) : (
                          <span className="sv-badge-ok inline-block text-xs px-2 py-0.5 rounded-full mt-0.5">Vrij</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="sv-button sv-button-thin-border shrink-0"
                        onClick={() => setPreviewLabel({ code: label.code, note: label.note })}
                      >
                        <QrCodeIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="ghost" className="sv-button sv-button-ghost" onClick={onClose}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QrLabelPreviewDialog
        code={previewLabel?.code ?? null}
        note={previewLabel?.note ?? null}
        open={!!previewLabel}
        onClose={() => setPreviewLabel(null)}
      />
    </>
  );
}
