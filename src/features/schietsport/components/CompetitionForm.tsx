import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  CompetitionPeriod,
  CompetitionRuleType,
  CompetitionRules,
} from "@/features/schietsport/domain/model";
import {
  DISTANCES,
  type Distance,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import {
  DEFAULT_BEST_COUNT,
  bestCountOf,
  evenPeriods,
  ruleTypeOf,
  sessionTypeOf,
  validatePeriods,
} from "@/features/schietsport/domain/competition";
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
  Segmented,
  TextArea,
  TextInput,
  inputClass,
} from "@/features/schietsport/components/form";

type Period = { start: string; end: string };

// Competitie aanmaken of bewerken, met de regels van de vereniging:
// puntenbord (periodes, hoogste score per periode), beste N (bv.
// klapschijf) of handmatig koppelen.
export function CompetitionForm({
  competition,
  onDone,
}: {
  competition?: CompetitionPeriod;
  onDone: (competition: CompetitionPeriod) => void;
}) {
  const { db, userId } = useSchietsport();
  const disciplines = useDisciplines() ?? [];
  const thisYear = new Date().getFullYear();
  const initialYear = competition
    ? Number(competition.startDate.slice(0, 4))
    : thisYear;

  const [name, setName] = useState(competition?.name ?? "");
  const [ruleType, setRuleType] = useState<CompetitionRuleType>(
    competition ? ruleTypeOf(competition) : "periods",
  );
  const [year, setYear] = useState(initialYear);
  const [periods, setPeriods] = useState<Period[]>(
    competition?.rules?.periods ?? evenPeriods(initialYear),
  );
  const [bestCount, setBestCount] = useState(
    String(competition ? bestCountOf(competition) : DEFAULT_BEST_COUNT),
  );
  const [startDate, setStartDate] = useState(
    competition?.startDate ?? `${thisYear}-01-01`,
  );
  const [endDate, setEndDate] = useState(
    competition?.endDate ?? `${thisYear}-12-31`,
  );
  const [disciplineId, setDisciplineId] = useState(
    competition?.disciplineId ?? "",
  );
  const [distance, setDistance] = useState<Distance | "all">(
    competition?.rules?.distance ?? "all",
  );
  const [sessionType, setSessionType] = useState<SessionType>(
    competition ? sessionTypeOf(competition) : "match",
  );
  const [notes, setNotes] = useState(competition?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const yearRange = { start: `${year}-01-01`, end: `${year}-12-31` };
  const frozenCount = competition?.rules?.frozen?.length ?? 0;
  const count = Number(bestCount);

  const error = !name.trim()
    ? "Geef de competitie een naam."
    : ruleType === "periods"
      ? validatePeriods(periods, yearRange)
      : !startDate || !endDate
        ? "Kies een begin- en einddatum."
        : endDate < startDate
          ? "De einddatum ligt vóór de begindatum."
          : ruleType === "best_of" &&
              (!Number.isInteger(count) || count < 1 || count > 50)
            ? "Kies een aantal scores van 1 tot en met 50."
            : null;

  const changeYear = (next: number) => {
    setYear(next);
    // Zelfde verdeling, maar in het nieuwe jaar.
    setPeriods(evenPeriods(next, periods.length || 5));
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (error || saving) return;
    setSaving(true);
    try {
      const rules: CompetitionRules =
        ruleType === "manual"
          ? {}
          : {
              sessionType,
              distance: distance === "all" ? null : distance,
              ...(ruleType === "periods"
                ? { periods, frozen: competition?.rules?.frozen ?? [] }
                : { bestCount: count }),
            };
      const input = {
        name,
        startDate: ruleType === "periods" ? yearRange.start : startDate,
        endDate: ruleType === "periods" ? yearRange.end : endDate,
        disciplineId: disciplineId || null,
        notes,
        ruleType,
        rules,
      };
      const saved = competition
        ? (await updateCompetition(db, competition.id, {
            ...input,
            name: input.name.trim(),
          }),
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
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Puntenbord 2026 of Klapschijf 2026"
          maxLength={120}
          autoFocus={!competition}
        />
      </Field>

      <Field label="Regels">
        <Segmented
          ariaLabel="Regels"
          value={ruleType}
          onChange={setRuleType}
          options={[
            { value: "periods", label: "Puntenbord", detail: "periodes" },
            {
              value: "best_of",
              label: "Beste scores",
              detail: "bv. klapschijf",
            },
            { value: "manual", label: "Handmatig", detail: "zelf koppelen" },
          ]}
        />
      </Field>
      <p className="-mt-3 text-xs text-muted-foreground">
        {ruleType === "periods"
          ? "Het jaar is verdeeld in periodes. De hoogste score binnen een periode telt; een afgelopen periode ligt vast."
          : ruleType === "best_of"
            ? "De eerste scores vullen de plekken; daarna vervangt een hogere score steeds je laagste."
            : "Je koppelt zelf officiële wedstrijden aan deze competitie."}
      </p>

      {ruleType === "periods" ? (
        <div className="space-y-3">
          <Field label="Jaar">
            <NativeSelect
              value={year}
              onChange={(e) => changeYear(Number(e.target.value))}
            >
              {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="space-y-2">
            {periods.map((period, index) => (
              <div key={index} className="flex items-end gap-2">
                <span className="w-16 shrink-0 pb-3 text-sm text-muted-foreground">
                  Periode {index + 1}
                </span>
                <input
                  type="date"
                  aria-label={`Periode ${index + 1} begin`}
                  className={`${inputClass} min-w-0`}
                  value={period.start}
                  min={yearRange.start}
                  max={yearRange.end}
                  onChange={(e) =>
                    setPeriods(
                      periods.map((p, i) =>
                        i === index ? { ...p, start: e.target.value } : p,
                      ),
                    )
                  }
                />
                <input
                  type="date"
                  aria-label={`Periode ${index + 1} einde`}
                  className={`${inputClass} min-w-0`}
                  value={period.end}
                  min={yearRange.start}
                  max={yearRange.end}
                  onChange={(e) =>
                    setPeriods(
                      periods.map((p, i) =>
                        i === index ? { ...p, end: e.target.value } : p,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={`Periode ${index + 1} verwijderen`}
                  disabled={periods.length <= 1 || index < frozenCount}
                  onClick={() =>
                    setPeriods(periods.filter((_, i) => i !== index))
                  }
                  className="shrink-0 p-2.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={periods.length >= 12}
              onClick={() => {
                const last = periods[periods.length - 1];
                setPeriods([
                  ...periods,
                  {
                    start: last ? last.end : yearRange.start,
                    end: yearRange.end,
                  },
                ]);
              }}
            >
              <Plus className="h-4 w-4" /> Periode
            </Button>
            <Button
              onClick={() => setPeriods(evenPeriods(year, periods.length || 5))}
            >
              Verdeel het jaar gelijk
            </Button>
          </div>
          {frozenCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {frozenCount === 1
                ? "Periode 1 ligt"
                : `Periodes 1–${frozenCount} liggen`}{" "}
              al vast; hun scores veranderen niet meer, ook niet als je de
              datums aanpast.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Begindatum">
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Einddatum">
            <input
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
      )}

      {ruleType === "best_of" && (
        <Field label="Aantal scores dat telt">
          <TextInput
            inputMode="numeric"
            value={bestCount}
            onChange={(e) => setBestCount(e.target.value.replace(/\D/g, ""))}
            maxLength={2}
          />
        </Field>
      )}

      {ruleType !== "manual" && (
        <>
          <Field label="Wat telt mee">
            <Segmented
              ariaLabel="Type schietbeurt"
              value={sessionType}
              onChange={setSessionType}
              options={[
                { value: "match", label: "Wedstrijden", detail: "schaal 300" },
                {
                  value: "free_card",
                  label: "Vrije kaarten",
                  detail: "schaal 50",
                },
              ]}
            />
          </Field>
          <Field label="Afstand">
            <Segmented
              ariaLabel="Afstand"
              value={distance}
              onChange={setDistance}
              options={[
                { value: "all" as const, label: "Alle" },
                ...DISTANCES.map((d) => ({ value: d, label: `${d} m` })),
              ]}
            />
          </Field>
        </>
      )}

      <Field
        label={ruleType === "manual" ? "Discipline (optioneel)" : "Discipline"}
        hint={
          ruleType === "manual"
            ? "Helpt bij het voorstellen van wedstrijden."
            : "Alleen schietbeurten in deze discipline tellen mee."
        }
      >
        <NativeSelect
          value={disciplineId}
          onChange={(e) => setDisciplineId(e.target.value)}
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
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="Afspraken van de vereniging…"
        />
      </Field>

      {error && name && <p className="text-xs text-destructive">{error}</p>}
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
