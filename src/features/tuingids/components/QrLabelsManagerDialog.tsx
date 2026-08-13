import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Pencil, Plus, QrCode as QrCodeIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { QrCodeDisplay } from "@/components/qr-code-display";
import { downloadQrCodeImage } from "@/components/qr-code-image";
import type { Plant, PlantInstance, QrLabel } from "@/lib/supabase";
import { useQrLabels } from "../hooks/useQrLabels";
import { plantInstanceDisplayName } from "../lib/plantInstances";
import { buildQrLabelDeepLink } from "../lib/qrCode";

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
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tuinieren-theme sv-dialog w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="sv-heading text-2xl">QR-label</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl overflow-hidden bg-white p-3">
            <QrCodeDisplay data={code ? buildQrLabelDeepLink(code) : null} size={220} />
          </div>
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
 * Beheerscherm voor herbruikbare QR-labels: aanmaken (printen), bekijken,
 * de gebruiksvriendelijke naam (`note`) bewerken, en verwijderen. Koppelen
 * zelf gebeurt bewust NIET hier — dat gebeurt via "QR-code scannen" bij het
 * aanmaken van een nieuw exemplaar (Deel C) of "QR-code koppelen/vervangen"
 * in het detailvenster van een bestaand exemplaar (Deel D).
 *
 * "Verwijderen" is functioneel een archivering (qr_labels.deleted_at), geen
 * SQL DELETE: plant_instance_qr_assignments.qr_label_id verwijst met ON
 * DELETE CASCADE naar qr_labels, dus een echte delete zou ook alle
 * historische koppelingen van dat label vernietigen. De code zelf (de
 * permanente identiteit van de fysieke sticker) is in de UI nergens
 * wijzigbaar — alleen `note` is bewerkbaar.
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
  const {
    activeLabels,
    labels,
    getActiveAssignmentForLabel,
    createLabel,
    isCreatingLabel,
    createLabelError,
    updateLabelNote,
    isUpdatingLabelNote,
    archiveLabel,
  } = useQrLabels();
  const [note, setNote] = useState("");
  const [previewLabel, setPreviewLabel] = useState<{ code: string; note: string | null } | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState("");
  const [confirmDeleteLabel, setConfirmDeleteLabel] = useState<QrLabel | null>(null);
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [downloadingLabelId, setDownloadingLabelId] = useState<string | null>(null);

  const deletedLabels = labels.filter((l) => l.deleted_at !== null);

  async function handleCreate() {
    const created = await createLabel(note.trim() || null);
    setNote("");
    if (created) setPreviewLabel({ code: created.code, note: created.note });
  }

  // Downloadt exact dezelfde QR-afbeelding als de "Bekijken"-preview (zelfde
  // deeplink, zelfde stijl via downloadQrCodeImage), alleen als bestand
  // i.p.v. op het scherm — geen aparte QR-implementatie.
  async function handleDownload(label: QrLabel) {
    setDownloadingLabelId(label.id);
    try {
      await downloadQrCodeImage(buildQrLabelDeepLink(label.code), label.note || `qr-label-${label.code.slice(0, 8)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "QR-code downloaden mislukt.");
    } finally {
      setDownloadingLabelId(null);
    }
  }

  function startEdit(label: QrLabel) {
    setEditingLabelId(label.id);
    setEditNoteValue(label.note ?? "");
  }

  function cancelEdit() {
    setEditingLabelId(null);
    setEditNoteValue("");
  }

  async function saveEdit(labelId: string) {
    try {
      await updateLabelNote({ labelId, note: editNoteValue.trim() || null });
      setEditingLabelId(null);
      setEditNoteValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Opslaan mislukt.");
    }
  }

  function handleDeleteClick(label: QrLabel) {
    const assignment = getActiveAssignmentForLabel(label.id);
    if (assignment) {
      const instance = instancesById.get(assignment.plant_instance_id);
      const species = instance ? speciesById.get(instance.species_id) : undefined;
      const linkedName = instance ? plantInstanceDisplayName(instance, species) : "een registratie";
      setDeleteBlockedMessage(
        `Dit QR-label is nog gekoppeld aan ${linkedName}. Ontkoppel het label eerst voordat je het verwijdert.`,
      );
      return;
    }
    setConfirmDeleteLabel(label);
  }

  async function confirmDelete() {
    if (!confirmDeleteLabel) return;
    const label = confirmDeleteLabel;
    setConfirmDeleteLabel(null);
    try {
      await archiveLabel(label.id);
    } catch (err) {
      // Backend weigert alsnog als het label tussen het klikken op
      // "Verwijderen" en deze bevestiging alsnog gekoppeld is geraakt (race
      // condition) — de RPC is de echte bewaker, deze catch toont dat alleen
      // netjes i.p.v. de fout te laten verdwijnen.
      toast.error(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
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
              {activeLabels.length === 0 ? (
                <p className="text-sm sv-muted">Nog geen QR-labels aangemaakt.</p>
              ) : (
                [...activeLabels].reverse().map((label) => {
                  const assignment = getActiveAssignmentForLabel(label.id);
                  const instance = assignment ? instancesById.get(assignment.plant_instance_id) : undefined;
                  const species = instance ? speciesById.get(instance.species_id) : undefined;
                  const linkedName = instance ? plantInstanceDisplayName(instance, species) : null;
                  const isEditing = editingLabelId === label.id;
                  return (
                    <div key={label.id} className="sv-panel p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{label.note ?? "Naamloos label"}</p>
                          {linkedName ? (
                            <p className="text-xs sv-muted truncate">
                              In gebruik — <span className="text-foreground">{linkedName}</span>
                            </p>
                          ) : (
                            <span className="sv-badge-ok inline-block text-xs px-2 py-0.5 rounded-full mt-0.5">
                              Vrij
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="sv-button sv-button-thin-border h-8 w-8 p-0"
                            aria-label="Bekijken"
                            title="Bekijken"
                            onClick={() => setPreviewLabel({ code: label.code, note: label.note })}
                          >
                            <QrCodeIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="sv-button sv-button-thin-border h-8 w-8 p-0"
                            aria-label="Downloaden"
                            title="Downloaden als afbeelding"
                            onClick={() => handleDownload(label)}
                            disabled={downloadingLabelId === label.id}
                          >
                            {downloadingLabelId === label.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="sv-button sv-button-thin-border h-8 w-8 p-0"
                            aria-label="Bewerken"
                            title="Bewerken"
                            onClick={() => (isEditing ? cancelEdit() : startEdit(label))}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="sv-button sv-button-thin-border h-8 w-8 p-0 sv-destructive-text"
                            aria-label="Verwijderen"
                            title="Verwijderen"
                            onClick={() => handleDeleteClick(label)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="flex items-center gap-2 pt-2 border-t border-black/10">
                          <Input
                            autoFocus
                            value={editNoteValue}
                            onChange={(e) => setEditNoteValue(e.target.value)}
                            placeholder="Naam op sticker"
                            className="text-sm flex-1"
                            disabled={isUpdatingLabelNote}
                          />
                          <Button
                            size="sm"
                            className="sv-button shrink-0"
                            onClick={() => saveEdit(label.id)}
                            disabled={isUpdatingLabelNote}
                          >
                            {isUpdatingLabelNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Opslaan"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="sv-button sv-button-ghost shrink-0"
                            onClick={cancelEdit}
                            disabled={isUpdatingLabelNote}
                          >
                            Annuleren
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {deletedLabels.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDeleted((v) => !v)}
                  className="text-xs sv-muted underline"
                >
                  {showDeleted ? "Verwijderde labels verbergen" : `Verwijderde labels tonen (${deletedLabels.length})`}
                </button>
                {showDeleted && (
                  <div className="space-y-2">
                    {[...deletedLabels].reverse().map((label) => (
                      <div key={label.id} className="sv-panel p-3 opacity-60">
                        <p className="text-sm font-medium truncate">{label.note ?? "Naamloos label"}</p>
                        <span className="text-xs sv-muted">Verwijderd</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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

      <AlertDialog open={!!confirmDeleteLabel} onOpenChange={(o) => !o && setConfirmDeleteLabel(null)}>
        <AlertDialogContent className="tuinieren-theme sv-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>QR-label verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              De fysieke QR-sticker werkt daarna niet meer en deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteBlockedMessage} onOpenChange={(o) => !o && setDeleteBlockedMessage(null)}>
        <AlertDialogContent className="tuinieren-theme sv-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Kan niet verwijderen</AlertDialogTitle>
            <AlertDialogDescription>{deleteBlockedMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteBlockedMessage(null)}>Begrepen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
