import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Plus, Trash2 } from "lucide-react";
import {
  GOAL_LABELS,
  LEVEL_LABELS,
} from "@/features/training/components/ProgramSetup";
import { SyncBadge } from "@/features/training/components/TrainingChrome";
import {
  NumberField,
  PageHeader,
  Segment,
  Switch,
} from "@/features/training/components/ui";
import { resolveConflict } from "@/features/training/db/repository";
import {
  bodyCsv,
  buildJsonExport,
  setsCsv,
} from "@/features/training/domain/export";
import type {
  EquipmentConfig,
  TrainingGoal,
  TrainingLevel,
  TrainingSettings,
} from "@/features/training/domain/types";
import { EQUIPMENT_LABELS, formatKg } from "@/features/training/domain/units";
import {
  useSyncStatus,
  useTraining,
} from "@/features/training/hooks/TrainingProvider";
import {
  useExercises,
  useProfile,
  useUpdateProfile,
} from "@/features/training/hooks/useTrainingData";

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ENTITY_LABELS: Record<string, string> = {
  profile: "Instellingen",
  exercise: "Eigen oefening",
  program: "Schema",
  session: "Training",
  set: "Set",
  body_metric: "Lichaamsmeting",
};

export default function TrainingInstellingen() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const { db } = useTraining();
  const { get } = useExercises();
  const status = useSyncStatus();
  const conflicts = useLiveQuery(() => db.conflicts.toArray(), [db]) ?? [];
  const rejected =
    useLiveQuery(
      async () => (await db.outbox.toArray()).filter((o) => o.lastError),
      [db],
    ) ?? [];
  const [newPlate, setNewPlate] = useState<{
    weightKg: number | null;
    count: number | null;
  }>({ weightKg: null, count: null });
  const [newItem, setNewItem] = useState("");
  const { settings, equipment } = profile;

  const setSettings = (patch: Partial<TrainingSettings>) =>
    update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const setEquipment = (change: (e: EquipmentConfig) => EquipmentConfig) =>
    update((p) => ({ ...p, equipment: change(p.equipment) }));

  const exportJson = async () => {
    const data = buildJsonExport(
      {
        profile: (await db.profiles.get(profile.id)) ?? null,
        programs: await db.programs.toArray(),
        exercises: await db.exercises.toArray(),
        sessions: await db.sessions.toArray(),
        sets: await db.sets.toArray(),
        bodyMetrics: await db.bodyMetrics.toArray(),
      },
      new Date().toISOString(),
    );
    download(
      `training-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
  };
  const exportCsv = async () => {
    download(
      `training-sets-${new Date().toISOString().slice(0, 10)}.csv`,
      "﻿" +
        setsCsv(
          await db.sessions.toArray(),
          await db.sets.toArray(),
          (id) => get(id).name,
        ),
      "text/csv",
    );
  };
  const exportBody = async () => {
    download(
      `lichaam-${new Date().toISOString().slice(0, 10)}.csv`,
      "﻿" + bodyCsv(await db.bodyMetrics.toArray()),
      "text/csv",
    );
  };

  const notificationState =
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Instellingen"
        subtitle="Alles wordt per account bewaard en gesynchroniseerd."
      />

      <section className="tr-card space-y-4 p-4">
        <h2 className="tr-h2">Trainingsprofiel</h2>
        <div className="space-y-1.5">
          <span className="tr-label">Niveau</span>
          <Segment
            label="Niveau"
            value={settings.level}
            onChange={(level) => setSettings({ level })}
            options={(Object.keys(LEVEL_LABELS) as TrainingLevel[]).map(
              (v) => ({ value: v, label: LEVEL_LABELS[v] }),
            )}
          />
        </div>
        <div className="space-y-1.5">
          <span className="tr-label">Doel</span>
          <Segment
            label="Doel"
            value={settings.goal}
            onChange={(goal) => setSettings({ goal })}
            options={(Object.keys(GOAL_LABELS) as TrainingGoal[]).map((v) => ({
              value: v,
              label: GOAL_LABELS[v],
            }))}
          />
        </div>
        <div className="space-y-1.5">
          <span className="tr-label">Beschikbare trainingsdagen per week</span>
          <Segment
            label="Dagen"
            value={settings.daysPerWeek}
            onChange={(daysPerWeek) => setSettings({ daysPerWeek })}
            options={[2, 3, 4, 5, 6].map((v) => ({
              value: v,
              label: String(v),
            }))}
          />
        </div>
        <div className="space-y-1.5">
          <span className="tr-label">Voorkeursduur per training</span>
          <Segment
            label="Duur"
            value={settings.sessionMinutes}
            onChange={(sessionMinutes) => setSettings({ sessionMinutes })}
            options={[30, 45, 60, 75, 90].map((v) => ({
              value: v,
              label: `${v} min`,
            }))}
          />
        </div>
        <p className="tr-muted text-xs">
          Deze voorkeuren gebruik je bij het kiezen van een nieuw schema;
          bestaande schema's veranderen niet vanzelf.
        </p>
      </section>

      <section className="tr-card p-4">
        <h2 className="tr-h2 mb-1">Tijdens het trainen</h2>
        <div className="space-y-1.5 py-2">
          <span className="block font-medium">Vorige prestatie</span>
          <Segment
            label="Vorige prestatie"
            value={settings.historyScope}
            onChange={(historyScope) => setSettings({ historyScope })}
            options={[
              { value: "any", label: "Meest recent, elk schema" },
              { value: "program", label: "Alleen binnen dit schema" },
            ]}
          />
        </div>
        <Switch
          label="Progressiesuggesties"
          description="Een zachte hint als je drie keer alle sets haalde. De app verhoogt nooit zelf gewicht of herhalingen."
          checked={settings.progressionHints}
          onChange={(progressionHints) => setSettings({ progressionHints })}
        />
        <Switch
          label="Geschatte 1RM tonen"
          description="Alleen als indicatie (Epley-formule)."
          checked={settings.showE1rm}
          onChange={(showE1rm) => setSettings({ showE1rm })}
        />
        <Switch
          label="Scherm aan houden"
          description="Tijdens een training, als de browser dat ondersteunt."
          checked={settings.keepAwake}
          onChange={(keepAwake) => setSettings({ keepAwake })}
        />
        <Switch
          label="Geluid na de rust"
          checked={settings.sound}
          onChange={(sound) => setSettings({ sound })}
        />
        <Switch
          label="Trillen na de rust"
          description="Werkt op Android, niet op iPhone."
          checked={settings.vibrate}
          onChange={(vibrate) => setSettings({ vibrate })}
        />
        <Switch
          label="Melding na de rust"
          description={
            notificationState === "unsupported"
              ? "Deze browser ondersteunt geen meldingen."
              : notificationState === "denied"
                ? "Meldingen zijn geblokkeerd in je browserinstellingen."
                : "Alleen als de app op de achtergrond nog draait. Bij een vergrendeld scherm kan Android de melding vertragen of overslaan."
          }
          checked={settings.notifications && notificationState === "granted"}
          onChange={async (on) => {
            if (!on) return setSettings({ notifications: false });
            if (typeof Notification === "undefined") return;
            const permission =
              Notification.permission === "granted"
                ? "granted"
                : await Notification.requestPermission();
            setSettings({ notifications: permission === "granted" });
          }}
        />
        <div className="space-y-1.5 py-2">
          <span className="block font-medium">Weergave</span>
          <Segment
            label="Weergave"
            value={settings.appearance}
            onChange={(appearance) => setSettings({ appearance })}
            options={[
              { value: "auto", label: "Volg site-thema" },
              { value: "light", label: "Licht" },
              { value: "dark", label: "Donker" },
            ]}
          />
        </div>
      </section>

      <section className="tr-card space-y-4 p-4">
        <h2 className="tr-h2">Apparatuur</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Gewicht lange stang"
            suffix="kg"
            placeholder="onbekend"
            value={equipment.barbell.weightKg}
            onChange={(weightKg) =>
              setEquipment((e) => ({
                ...e,
                barbell: { ...e.barbell, weightKg },
              }))
            }
          />
          <NumberField
            label="Max. belasting lange stang (optioneel)"
            suffix="kg"
            placeholder="onbekend"
            value={equipment.barbell.maxLoadKg}
            onChange={(maxLoadKg) =>
              setEquipment((e) => ({
                ...e,
                barbell: { ...e.barbell, maxLoadKg },
              }))
            }
          />
          <NumberField
            label="Gewicht per dumbbellstang"
            suffix="kg"
            placeholder="onbekend"
            value={equipment.dumbbells.handleWeightKg}
            onChange={(handleWeightKg) =>
              setEquipment((e) => ({
                ...e,
                dumbbells: { ...e.dumbbells, handleWeightKg },
              }))
            }
          />
          <NumberField
            label="Max. belasting per dumbbell (optioneel)"
            suffix="kg"
            placeholder="onbekend"
            value={equipment.dumbbells.maxLoadKg}
            onChange={(maxLoadKg) =>
              setEquipment((e) => ({
                ...e,
                dumbbells: { ...e.dumbbells, maxLoadKg },
              }))
            }
          />
          <NumberField
            label="Aantal dumbbellstangen"
            integer
            value={equipment.dumbbells.count}
            onChange={(count) =>
              setEquipment((e) => ({
                ...e,
                dumbbells: {
                  ...e.dumbbells,
                  count: Math.max(0, Math.min(10, count ?? 0)),
                },
              }))
            }
          />
          <NumberField
            label="Gewicht per sluiting"
            suffix="kg"
            value={equipment.collars.weightKg}
            onChange={(weightKg) =>
              setEquipment((e) => ({
                ...e,
                collars: { ...e.collars, weightKg: weightKg ?? 0 },
              }))
            }
          />
        </div>
        <div>
          <Switch
            label="Sluitingen meetellen op de lange stang"
            checked={equipment.collars.useOnBarbell}
            onChange={(useOnBarbell) =>
              setEquipment((e) => ({
                ...e,
                collars: { ...e.collars, useOnBarbell },
              }))
            }
          />
          <Switch
            label="Sluitingen meetellen op dumbbells"
            checked={equipment.collars.useOnDumbbells}
            onChange={(useOnDumbbells) =>
              setEquipment((e) => ({
                ...e,
                collars: { ...e.collars, useOnDumbbells },
              }))
            }
          />
        </div>

        <div>
          <h3 className="tr-label mb-2">Gewichtsschijven</h3>
          <ul className="space-y-2">
            {equipment.plates.map((p, i) => (
              <li
                key={i}
                className="tr-card-flat flex items-center gap-3 px-3 py-2"
              >
                <span className="tr-num w-20 font-semibold">
                  {formatKg(p.weightKg)} kg
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="tr-icon-btn"
                    aria-label="Eén minder"
                    onClick={() =>
                      setEquipment((e) => ({
                        ...e,
                        plates: e.plates.map((x, j) =>
                          j === i
                            ? { ...x, count: Math.max(0, x.count - 1) }
                            : x,
                        ),
                      }))
                    }
                  >
                    −
                  </button>
                  <span className="tr-num w-8 text-center font-semibold">
                    {p.count}×
                  </span>
                  <button
                    type="button"
                    className="tr-icon-btn"
                    aria-label="Eén meer"
                    onClick={() =>
                      setEquipment((e) => ({
                        ...e,
                        plates: e.plates.map((x, j) =>
                          j === i
                            ? { ...x, count: Math.min(99, x.count + 1) }
                            : x,
                        ),
                      }))
                    }
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="tr-icon-btn ml-auto"
                  aria-label="Schijf verwijderen"
                  onClick={() =>
                    setEquipment((e) => ({
                      ...e,
                      plates: e.plates.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <NumberField
                label="Nieuwe schijf"
                suffix="kg"
                value={newPlate.weightKg}
                onChange={(weightKg) => setNewPlate({ ...newPlate, weightKg })}
              />
            </div>
            <div className="w-24">
              <NumberField
                label="Aantal"
                integer
                value={newPlate.count}
                onChange={(count) => setNewPlate({ ...newPlate, count })}
              />
            </div>
            <button
              type="button"
              className="tr-btn tr-btn-secondary"
              disabled={
                !newPlate.weightKg || !newPlate.count || newPlate.weightKg > 50
              }
              onClick={() => {
                setEquipment((e) => ({
                  ...e,
                  plates: [
                    ...e.plates,
                    { weightKg: newPlate.weightKg!, count: newPlate.count! },
                  ].sort((a, b) => b.weightKg - a.weightKg),
                }));
                setNewPlate({ weightKg: null, count: null });
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div>
          <h3 className="tr-label mb-2">Overige apparatuur</h3>
          <div className="flex flex-wrap gap-1.5">
            {[
              ...new Set([
                ...Object.keys(EQUIPMENT_LABELS),
                ...equipment.owned,
              ]),
            ]
              .filter((k) => k !== "bodyweight")
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  className="tr-chip"
                  aria-pressed={equipment.owned.includes(k)}
                  onClick={() =>
                    setEquipment((e) => ({
                      ...e,
                      owned: e.owned.includes(k)
                        ? e.owned.filter((x) => x !== k)
                        : [...e.owned, k],
                    }))
                  }
                >
                  {EQUIPMENT_LABELS[k] ?? k}
                </button>
              ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="tr-input"
              placeholder="Toevoegen, bijv. kettlebell of stable_box"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
            />
            <button
              type="button"
              className="tr-btn tr-btn-secondary"
              disabled={!newItem.trim()}
              onClick={() => {
                const item = newItem.trim().toLowerCase().slice(0, 40);
                setEquipment((e) => ({
                  ...e,
                  owned: [...new Set([...e.owned, item])],
                }));
                setNewItem("");
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="tr-muted mt-2 text-xs">
            Oefeningen waarvoor apparatuur ontbreekt worden bij nieuwe schema's
            vervangen door een alternatief. "stable_box" = een stevige verhoging
            voor step-ups.
          </p>
        </div>
      </section>

      <section className="tr-card space-y-3 p-4">
        <h2 className="tr-h2">Gegevens exporteren</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={() => void exportJson()}
          >
            <Download className="h-4 w-4" /> Alles (JSON)
          </button>
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={() => void exportCsv()}
          >
            <Download className="h-4 w-4" /> Sets (CSV)
          </button>
          <button
            type="button"
            className="tr-btn tr-btn-ghost"
            onClick={() => void exportBody()}
          >
            <Download className="h-4 w-4" /> Lichaam (CSV)
          </button>
        </div>
      </section>

      <section className="tr-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="tr-h2">Synchronisatie</h2>
          <SyncBadge />
        </div>
        <p className="tr-muted text-sm">
          Alles wordt eerst op dit apparaat bewaard en daarna naar je account
          gestuurd. Zonder internet train je gewoon door.
          {status.lastSyncAt &&
            ` Laatst gesynchroniseerd: ${new Date(status.lastSyncAt).toLocaleString("nl-NL")}.`}
        </p>
        {rejected.length > 0 && (
          <div className="tr-banner tr-banner-danger flex-col">
            <strong>
              {rejected.length} wijziging(en) geweigerd door de server
            </strong>
            {rejected.map((r) => (
              <span key={r.recordId} className="text-sm">
                {ENTITY_LABELS[r.entity]}: {r.lastError}
              </span>
            ))}
            <span className="text-xs">
              Ze blijven op dit apparaat bewaard. Pas het record aan om het
              opnieuw te proberen.
            </span>
          </div>
        )}
        {conflicts.map((c) => (
          <div key={c.id} className="tr-banner tr-banner-warn flex-col">
            <strong>
              Conflict: {ENTITY_LABELS[c.entity]}{" "}
              {String(c.server.name ?? c.local.name ?? "")}
            </strong>
            <span className="text-sm">
              Op een ander apparaat is dit ook gewijzigd. De versie van het
              andere apparaat staat nu actief; jouw versie van{" "}
              {new Date(c.detectedAt).toLocaleString("nl-NL")} is bewaard.
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="tr-btn tr-btn-secondary"
                onClick={() => void resolveConflict(db, c.id, "local")}
              >
                Mijn versie gebruiken
              </button>
              <button
                type="button"
                className="tr-btn tr-btn-ghost"
                onClick={() => void resolveConflict(db, c.id, "server")}
              >
                Andere versie houden
              </button>
            </div>
          </div>
        ))}
        <p className="tr-muted text-xs">
          Tijdelijke gegevens staan per account in een aparte lokale database,
          zodat een ander account op dit apparaat ze niet in de app ziet.
        </p>
      </section>
    </div>
  );
}
