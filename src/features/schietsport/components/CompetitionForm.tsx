import { useState } from "react";
import { toast } from "sonner";
import type { CompetitionPeriod } from "@/features/schietsport/domain/model";
import {
  createCompetition,
  updateCompetition,
} from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import { useDisciplines } from "@/features/schietsport/hooks/useSchietsportData";
import {
  Button,
  Field,
  NativeSelect,
  TextArea,
  TextInput,
  inputClass,
} from "@/features/schietsport/components/form";

// Competitieperiode aanmaken of bewerken. De rekenregels voor een eindstand
// zijn nog niet vastgesteld door de vereniging en worden hier dus niet
// gevraagd.
export function CompetitionForm({
  competition,
  onDone,
}: {
  competition?: CompetitionPeriod;
  onDone: (competition: CompetitionPeriod) => void;
}) {
  const { db, userId } = useSchietsport();
  const disciplines = useDisciplines() ?? [];
  const year = new Date().getFullYear();
  const [values, setValues] = useState({
    name: competition?.name ?? "",
    startDate: competition?.startDate ?? `${year}-01-01`,
    endDate: competition?.endDate ?? `${year}-12-31`,
    disciplineId: competition?.disciplineId ?? "",
    notes: competition?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const error = !values.name.trim()
    ? "Geef de competitie een naam."
    : !values.startDate || !values.endDate
      ? "Kies een begin- en einddatum."
      : values.endDate < values.startDate
        ? "De einddatum ligt vóór de begindatum."
        : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (error || saving) return;
    setSaving(true);
    try {
      const input = {
        name: values.name,
        startDate: values.startDate,
        endDate: values.endDate,
        disciplineId: values.disciplineId || null,
        notes: values.notes,
      };
      const saved = competition
        ? (await updateCompetition(db, competition.id, input),
          { ...competition, ...input })
        : await createCompetition(db, userId, input);
      toast.success(
        competition ? "Competitie bijgewerkt" : "Competitie toegevoegd",
      );
      onDone(saved as CompetitionPeriod);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Naam">
        <TextInput
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          placeholder="Bijv. Wintercompetitie 2026–2027"
          maxLength={120}
          autoFocus={!competition}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Begindatum">
          <input
            type="date"
            className={inputClass}
            value={values.startDate}
            onChange={(e) =>
              setValues({ ...values, startDate: e.target.value })
            }
          />
        </Field>
        <Field label="Einddatum">
          <input
            type="date"
            className={inputClass}
            value={values.endDate}
            onChange={(e) => setValues({ ...values, endDate: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label="Discipline (optioneel)"
        hint="Helpt bij het voorstellen van wedstrijden."
      >
        <NativeSelect
          value={values.disciplineId}
          onChange={(e) =>
            setValues({ ...values, disciplineId: e.target.value })
          }
        >
          <option value="">Alle disciplines</option>
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Opmerkingen">
        <TextArea
          value={values.notes}
          onChange={(e) => setValues({ ...values, notes: e.target.value })}
          maxLength={2000}
          placeholder="Bijv. aantal wedstrijden, afspraken van de vereniging…"
        />
      </Field>
      {error && values.name && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <Button
        type="submit"
        variant="primary"
        className="w-full py-3"
        disabled={!!error || saving}
      >
        {competition ? "Wijzigingen opslaan" : "Competitie toevoegen"}
      </Button>
    </form>
  );
}
