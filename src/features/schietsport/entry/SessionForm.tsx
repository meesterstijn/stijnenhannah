import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  FileClock,
  Layers,
  Pencil,
  Target,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import type { ShootingSession } from "@/features/schietsport/domain/model";
import {
  DISTANCES,
  MATCH_LAYOUT_PRESETS,
  SESSION_TYPE_LABELS,
  isValidMatchLayout,
  layoutKey,
  maxScoreFor,
  type SessionType,
} from "@/features/schietsport/domain/rules";
import {
  scoreProgress,
  scoreSession,
} from "@/features/schietsport/domain/scoring";
import {
  deleteDraft,
  saveDraft,
  saveSession,
} from "@/features/schietsport/db/repository";
import { useSchietsport } from "@/features/schietsport/hooks/SchietsportProvider";
import {
  useDisciplines,
  useSessions,
  useWeapons,
} from "@/features/schietsport/hooks/useSchietsportData";
import {
  defaultsFromHistory,
  fromSession,
  initialFormState,
  layoutOf,
  parseScore,
  toScoreInput,
  withMatchLayout,
  withType,
  type SessionFormState,
} from "@/features/schietsport/entry/formState";
import { findPossibleDuplicate } from "@/features/schietsport/entry/duplicates";
import { CardEditor } from "@/features/schietsport/entry/CardEditor";
import {
  Button,
  ConfirmDialog,
  Field,
  NativeSelect,
  Segmented,
  TextArea,
  inputClass,
} from "@/features/schietsport/components/form";
import { formatDate, todayYmd } from "@/features/schietsport/lib/format";
import { SCHIETSPORT_BASE } from "@/features/schietsport/nav";

const TYPE_TILES: {
  type: SessionType;
  icon: typeof Trophy;
  detail: string;
}[] = [
  { type: "match", icon: Trophy, detail: "30 schoten · max 300" },
  { type: "free_card", icon: Target, detail: "5 schoten · max 50" },
  { type: "practice_match", icon: Layers, detail: "6 kaarten × 5 · max 300" },
];

const DRAFT_NEW = "new";

// Invoer en bewerken van één schietbeurt. Snelste route bij de vereniging:
// type kiezen (vaak al via de knop op het dashboard), score, opslaan —
// wapen, discipline, afstand en kaartindeling komen uit de vorige keer.
export function SessionForm({
  editing,
  initialType,
}: {
  editing?: ShootingSession;
  initialType?: SessionType;
}) {
  const { db, userId } = useSchietsport();
  const navigate = useNavigate();
  const sessions = useSessions();
  const disciplines = useDisciplines({ includeArchived: !!editing });
  const weapons = useWeapons({ includeArchived: !!editing });
  const draftId = editing ? `edit:${editing.id}` : DRAFT_NEW;

  const [state, setState] = useState<SessionFormState | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<ShootingSession | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [customLayout, setCustomLayout] = useState("");
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const defaults = useMemo(
    () =>
      sessions && disciplines
        ? defaultsFromHistory(sessions, {
            disciplineId: disciplines[0]?.id ?? "",
          })
        : null,
    [sessions, disciplines],
  );

  // Eenmalig initialiseren zodra de gegevens geladen zijn: concept (als dat
  // er is en bij het gevraagde type past), bestaande beurt, of nieuw.
  useEffect(() => {
    if (state || !defaults) return;
    let cancelled = false;
    void (async () => {
      const draft = await db.drafts.get(draftId);
      if (cancelled) return;
      const draftState = draft?.data as SessionFormState | undefined;
      const draftFits =
        draftState &&
        (!initialType || draftState.type === initialType) &&
        (!editing || draft!.updatedAt > editing.updatedAt);
      const initial = draftFits
        ? draftState
        : editing
          ? fromSession(editing)
          : initialFormState(initialType ?? "match", todayYmd(), defaults);
      setState(initial);
      setRestoredDraft(!!draftFits);
      // Context ingeklapt als alles al bekend is (snelle route).
      setContextOpen(!(initial.disciplineId && initial.distance));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, defaults, draftId, editing, initialType, state]);

  // Concept automatisch bewaren (alleen lokaal; telt nergens mee).
  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => void saveDraft(db, draftId, state), 500);
    return () => clearTimeout(timer);
  }, [db, draftId, state]);

  // Gefocuste velden boven de vaste opslaan-balk houden (mobiel).
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = "11rem";
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, []);

  if (!state || !defaults || !disciplines || !weapons) {
    return <div className="ss-card h-64 animate-pulse" />;
  }

  const update = (patch: Partial<SessionFormState>) =>
    setState((current) => (current ? { ...current, ...patch } : current));

  const scoreInput = toScoreInput(state);
  const progress = scoreProgress(scoreInput);
  const result = scoreSession(scoreInput);
  const contextErrors = [
    !state.disciplineId && "Kies een discipline.",
    !state.distance && "Kies een afstand.",
    !state.sessionDate && "Kies een datum.",
  ].filter(Boolean) as string[];
  const firstError =
    contextErrors[0] ?? (!result.ok ? result.errors[0]?.message : null);
  const canSave = result.ok && contextErrors.length === 0 && !saving;
  const maxScore = maxScoreFor(state.type);
  const usesCards = !(state.type === "match" && state.matchMode === "total");

  const goToCard = (index: number) => {
    setActiveCard(index);
    cardRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  async function save(force = false) {
    setAttempted(true);
    if (!state || !result.ok || contextErrors.length > 0 || saving) return;
    const candidate = {
      id: editing?.id,
      sessionDate: state.sessionDate,
      type: state.type,
      disciplineId: state.disciplineId,
      distance: state.distance!,
      weaponId: state.weaponId || null,
      totalScore: result.value.totalScore,
    };
    if (!force && sessions) {
      const dup = findPossibleDuplicate(sessions, candidate);
      if (dup) {
        setDuplicate(dup);
        return;
      }
    }
    setSaving(true);
    try {
      const saved = await saveSession(db, userId, {
        id: editing?.id,
        sessionDate: state.sessionDate,
        weaponId: state.weaponId || null,
        disciplineId: state.disciplineId,
        distance: state.distance!,
        notes: state.notes,
        score: result.value,
      });
      await deleteDraft(db, draftId);
      toast.success(
        `${SESSION_TYPE_LABELS[saved.type]} opgeslagen · ${saved.totalScore}/${saved.maxScore}`,
      );
      navigate(`${SCHIETSPORT_BASE}/logboek/${saved.id}`, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
      setSaving(false);
    }
  }

  async function discardDraft() {
    await deleteDraft(db, draftId);
    setRestoredDraft(false);
    setState(
      editing
        ? fromSession(editing)
        : initialFormState(state!.type, todayYmd(), defaults!),
    );
  }

  return (
    <div className="space-y-5">
      {restoredDraft && (
        <div className="ss-card flex items-center gap-3 p-3 text-sm">
          <FileClock className="h-4 w-4 shrink-0 text-[var(--ss-amber)]" />
          <p className="flex-1 text-muted-foreground">
            Je concept is hersteld. Het telt pas mee na opslaan.
          </p>
          <button
            type="button"
            onClick={() => void discardDraft()}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Opnieuw beginnen
          </button>
        </div>
      )}

      {/* 1. Type */}
      <div className="grid grid-cols-3 gap-2">
        {TYPE_TILES.map(({ type, icon: Icon, detail }) => {
          const active = state.type === type;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setActiveCard(0);
                setState((s) => (s ? withType(s, type, defaults) : s));
              }}
              className={`ss-card flex flex-col items-start gap-2 p-3 text-left transition-colors sm:p-4 ${
                active
                  ? "shadow-[inset_0_0_0_1.5px_var(--ss-copper)]"
                  : "opacity-75 hover:opacity-100"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-[var(--ss-copper)]" : "text-muted-foreground"}`}
                strokeWidth={1.8}
              />
              <span className="text-sm font-semibold leading-tight">
                {SESSION_TYPE_LABELS[type]}
              </span>
              <span className="text-[0.7rem] leading-tight text-muted-foreground">
                {detail}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Context */}
      {!contextOpen && contextErrors.length === 0 ? (
        <button
          type="button"
          onClick={() => setContextOpen(true)}
          className="ss-card flex w-full items-center gap-3 p-3.5 text-left sm:p-4"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {disciplines.find((d) => d.id === state.disciplineId)?.name} ·{" "}
              {state.distance} m
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatDate(state.sessionDate)} ·{" "}
              {weapons.find((w) => w.id === state.weaponId)?.name ??
                "Onbekend / geleend wapen"}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" /> Wijzig
          </span>
        </button>
      ) : (
        <section className="ss-card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Datum">
            <input
              type="date"
              className={inputClass}
              value={state.sessionDate}
              max={todayYmd()}
              onChange={(e) => update({ sessionDate: e.target.value })}
            />
          </Field>
          <Field
            label="Wapen"
            hint={
              weapons.length === 0 ? (
                <Link to={`${SCHIETSPORT_BASE}/wapens`} className="underline">
                  Wapen toevoegen
                </Link>
              ) : undefined
            }
          >
            <NativeSelect
              value={state.weaponId}
              onChange={(e) => update({ weaponId: e.target.value })}
            >
              <option value="">Onbekend / geleend wapen</option>
              {weapons.map((weapon) => (
                <option key={weapon.id} value={weapon.id}>
                  {weapon.name}
                  {weapon.archivedAt ? " (gearchiveerd)" : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Discipline">
            <NativeSelect
              value={state.disciplineId}
              onChange={(e) => {
                const disciplineId = e.target.value;
                // Kaartindeling volgt de vorige wedstrijd in die discipline.
                const next = sessions
                  ? defaultsFromHistory(
                      sessions,
                      { disciplineId },
                      disciplineId,
                    )
                  : null;
                setState((s) => {
                  if (!s) return s;
                  const updated = { ...s, disciplineId };
                  return s.type === "match" &&
                    next &&
                    next.matchLayout.length > 0
                    ? withMatchLayout(updated, next.matchLayout)
                    : updated;
                });
              }}
            >
              {!state.disciplineId && (
                <option value="">Kies een discipline</option>
              )}
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Afstand">
            <Segmented
              ariaLabel="Afstand"
              value={state.distance}
              onChange={(distance) => update({ distance })}
              options={DISTANCES.map((d) => ({ value: d, label: `${d} m` }))}
            />
          </Field>
        </section>
      )}

      {/* 3. Score */}
      {state.type === "match" && (
        <section className="space-y-3">
          <Segmented
            ariaLabel="Invoermodus"
            value={state.matchMode}
            onChange={(matchMode) =>
              setState((s) =>
                !s
                  ? s
                  : matchMode === "cards" && s.cards.length === 0
                    ? withMatchLayout(s, MATCH_LAYOUT_PRESETS[0].layout)
                    : { ...s, matchMode },
              )
            }
            options={[
              { value: "total", label: "Alleen totaal", detail: "snelst" },
              {
                value: "cards",
                label: "Per kaart",
                detail: "kaartscores of schoten",
              },
            ]}
          />
          {state.matchMode === "cards" && (
            <div className="flex flex-wrap items-center gap-2">
              {MATCH_LAYOUT_PRESETS.map((preset) => {
                const active =
                  layoutKey(layoutOf(state)) === layoutKey(preset.layout);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setActiveCard(0);
                      setState((s) =>
                        s ? withMatchLayout(s, preset.layout) : s,
                      );
                    }}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-[var(--ss-copper)] bg-[oklch(0.7_0.115_58/0.15)]"
                        : "border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const layout = customLayout
                    .split(/[+,\s]+/)
                    .filter(Boolean)
                    .map(Number);
                  if (!isValidMatchLayout(layout)) {
                    toast.error(
                      "Een eigen indeling moet samen 30 schoten zijn, bv. 15+15.",
                    );
                    return;
                  }
                  setActiveCard(0);
                  setState((s) => (s ? withMatchLayout(s, layout) : s));
                }}
              >
                <input
                  className="w-28 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:border-[var(--ss-copper)] focus:outline-none"
                  placeholder="Eigen: 15+15"
                  value={customLayout}
                  onChange={(e) => setCustomLayout(e.target.value)}
                  aria-label="Eigen kaartindeling"
                />
                <button
                  type="submit"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Toepassen
                </button>
              </form>
            </div>
          )}
          {state.matchMode === "total" && (
            <div className="ss-card p-4 sm:p-5">
              <Field label="Totaalscore">
                <div className="relative">
                  <input
                    className={`${inputClass} ss-number py-4 text-center text-4xl font-semibold`}
                    inputMode="numeric"
                    placeholder="0–300"
                    maxLength={3}
                    autoFocus={!editing}
                    value={state.totalScore}
                    onChange={(e) =>
                      update({ totalScore: e.target.value.replace(/\D/g, "") })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void save();
                      }
                    }}
                  />
                  <span className="ss-number pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                    /300
                  </span>
                </div>
              </Field>
              {(parseScore(state.totalScore) ?? 0) > 300 && (
                <p className="mt-2 text-xs text-destructive">
                  Maximaal 300 punten.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                De 30 losse schoten blijven onbekend; er worden geen schoten
                verzonnen.
              </p>
            </div>
          )}
        </section>
      )}

      {usesCards && (
        <section className="space-y-3">
          {state.cards.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {state.cards.map((card, index) => {
                const filled = progressFilled(state, index);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goToCard(index)}
                    className={`ss-number flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border px-2.5 text-sm transition-colors ${
                      activeCard === index
                        ? "border-[var(--ss-copper)] text-foreground"
                        : filled
                          ? "border-[oklch(0.66_0.09_118/0.6)] bg-[oklch(0.66_0.09_118/0.14)] text-foreground"
                          : "border-white/10 text-muted-foreground"
                    }`}
                    aria-label={`Kaart ${index + 1}${filled ? ", ingevuld" : ""}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {progress.cardsFilled}/{progress.cardsTotal} kaarten
              </span>
            </div>
          )}
          {state.cards.map((card, index) => (
            <div
              key={`${layoutKey(layoutOf(state))}-${index}`}
              ref={(el) => void (cardRefs.current[index] = el)}
            >
              <CardEditor
                card={card}
                index={index}
                label={state.type === "free_card" ? "Vrije kaart" : undefined}
                active={activeCard === index}
                onActivate={() => setActiveCard(index)}
                onChange={(next) =>
                  setState((s) =>
                    s
                      ? {
                          ...s,
                          cards: s.cards.map((c, i) =>
                            i === index ? next : c,
                          ),
                        }
                      : s,
                  )
                }
                onComplete={() => {
                  if (index < state.cards.length - 1) goToCard(index + 1);
                }}
              />
            </div>
          ))}
        </section>
      )}

      {/* 4. Opmerkingen */}
      <section>
        {showNotes || state.notes ? (
          <Field label="Opmerkingen">
            <TextArea
              value={state.notes}
              onChange={(e) => update({ notes: e.target.value })}
              maxLength={2000}
              placeholder="Omstandigheden, gevoel, aandachtspunten…"
            />
          </Field>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="h-4 w-4" /> Opmerking toevoegen
          </button>
        )}
      </section>

      {/* 5. Totaal + opslaan */}
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] z-30 px-4 md:static md:px-0">
        <div className="ss-card flex items-center gap-4 border-white/15 bg-[var(--ss-surface-strong)] p-3 pl-4 sm:p-4 sm:pl-5">
          <div className="min-w-0 flex-1">
            <p className="ss-number leading-none">
              <span className="text-3xl font-semibold">
                {progress.runningTotal}
              </span>
              <span className="text-sm text-muted-foreground">
                {" "}
                / {maxScore}
              </span>
            </p>
            <p
              className={`mt-1 truncate text-xs ${attempted && firstError ? "text-destructive" : "text-muted-foreground"}`}
            >
              {attempted && firstError
                ? firstError
                : usesCards && state.cards.length > 1
                  ? `${progress.cardsFilled} van ${progress.cardsTotal} kaarten ingevuld`
                  : SESSION_TYPE_LABELS[state.type]}
            </p>
          </div>
          <Button
            variant="primary"
            className="px-6 py-3 text-base"
            disabled={saving || (attempted && !canSave)}
            onClick={() => void save()}
          >
            {editing ? "Wijzigingen opslaan" : "Opslaan"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!duplicate}
        onOpenChange={(open) => !open && setDuplicate(null)}
        title="Lijkt dubbel"
        description={`Je hebt net al een ${SESSION_TYPE_LABELS[state.type].toLowerCase()} met ${
          duplicate?.totalScore
        } punten op deze dag opgeslagen. Toch nog een keer opslaan?`}
        confirmLabel="Toch opslaan"
        onConfirm={() => {
          setDuplicate(null);
          void save(true);
        }}
      />
    </div>
  );
}

function progressFilled(state: SessionFormState, index: number) {
  const card = state.cards[index];
  if (card.mode === "shots") return card.shots.length === card.shotCount;
  const score = parseScore(card.score);
  return score !== null && score <= card.shotCount * 10;
}
