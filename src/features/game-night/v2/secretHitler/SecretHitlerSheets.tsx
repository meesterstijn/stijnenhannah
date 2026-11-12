import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  hitlerKnowsFascists,
  roleDistribution,
  validateRoles,
  type ShHandClaim,
  type ShRole,
} from "@/features/game-night/lib/secretHitler";
import {
  handLabel,
  roleIcon,
  ROLE_LABEL,
  type ShNarration,
} from "@/features/game-night/lib/secretHitlerStory";

export function ShSheet({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <div
      className="gnv2-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`gnv2-sheet-card sh-sheet${wide ? " sh-sheet-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sh-sheet-header">
          <p className="gnv2-dialog-title text-lg">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            title="Sluiten"
            className="gnv2-icon-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Kleine kaartjes voor een claim als "FFL". */
export function HandCards({
  fascists,
  size,
}: {
  fascists: number | null;
  size: number;
}) {
  if (fascists == null) return <span className="sh-hand-none">geen claim</span>;
  const label = handLabel(fascists, size);
  return (
    <span className="sh-hand" aria-label={label}>
      {label.split("").map((c, i) => (
        <span
          key={i}
          className={`sh-mini-card sh-mini-card-${c === "F" ? "fascist" : "liberal"}`}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

export function HandClaimPicker({
  label,
  size,
  value,
  onChange,
}: {
  label: string;
  size: 2 | 3;
  value: ShHandClaim | null;
  onChange: (v: ShHandClaim | null) => void;
}) {
  const options = size === 3 ? [3, 2, 1, 0] : [2, 1, 0];
  return (
    <div className="sh-claim-row">
      <span className="sh-claim-label">{label}</span>
      <div className="sh-claim-options">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            className={`sh-chip${value === n ? " sh-chip-on" : ""}`}
            onClick={() => onChange(value === n ? null : n)}
            aria-pressed={value === n}
          >
            <HandCards fascists={n} size={size} />
          </button>
        ))}
        <button
          type="button"
          className={`sh-chip${value == null ? " sh-chip-on" : ""}`}
          onClick={() => onChange(null)}
          aria-pressed={value == null}
        >
          🤐 Zegt niks
        </button>
      </div>
    </div>
  );
}

// ── Nachtfase: de "ogen dicht"-tekst, voorgelezen door het scherm ───────

function nightScript(playerCount: number): { text: string; ms: number }[] {
  const small = hitlerKnowsFascists(playerCount);
  const { fascists } = roleDistribution(playerCount);
  return [
    {
      text: "Iedereen sluit de ogen en steekt een vuist voor zich uit.",
      ms: 6000,
    },
    small
      ? {
          text: `Fascist en Hitler: open je ogen en kijk elkaar aan. (${fascists} fascist + Hitler)`,
          ms: 7000,
        }
      : {
          text: `Fascisten: open je ogen. Hitler houdt de ogen dicht en steekt een duim op. Fascisten, kijk goed wie dat is.`,
          ms: 9000,
        },
    { text: "Iedereen sluit de ogen en laat de hand zakken.", ms: 5000 },
    {
      text: "Iedereen mag de ogen weer openen. Veel plezier, en vertrouw niemand.",
      ms: 4000,
    },
  ];
}

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "nl-NL";
    u.rate = 0.92;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("nl"));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    // Geen spraak beschikbaar: de tekst staat ook groot op het scherm.
  }
}

export function NightPhaseSheet({
  playerCount,
  onClose,
}: {
  playerCount: number;
  onClose: () => void;
}) {
  const steps = useMemo(() => nightScript(playerCount), [playerCount]);
  const [step, setStep] = useState(-1);
  const [voice, setVoice] = useState(true);

  useEffect(() => {
    if (step < 0 || step >= steps.length) return;
    if (voice) speak(steps[step].text);
    const t = setTimeout(() => setStep((s) => s + 1), steps[step].ms);
    return () => clearTimeout(t);
  }, [step, steps, voice]);

  useEffect(
    () => () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* niets */
      }
    },
    [],
  );

  const done = step >= steps.length;
  return (
    <ShSheet title="🌙 Nachtfase" onClose={onClose}>
      {step < 0 ? (
        <>
          <p className="sh-night-intro">
            Iedereen heeft een envelop met een geheime rol en partijkaart. Het
            scherm leest de nachtfase voor, zodat niemand hoeft te spieken.
          </p>
          <label className="sh-toggle">
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => setVoice(e.target.checked)}
            />
            Hardop voorlezen
          </label>
          <button
            type="button"
            className="gnv2-btn gnv2-btn-primary w-full"
            onClick={() => setStep(0)}
          >
            Start de nachtfase
          </button>
        </>
      ) : done ? (
        <>
          <p className="sh-night-step">☀️ Goedemorgen, politici.</p>
          <button
            type="button"
            className="gnv2-btn gnv2-btn-primary w-full"
            onClick={onClose}
          >
            Klaar
          </button>
        </>
      ) : (
        <>
          <p className="sh-night-count">
            Stap {step + 1} van {steps.length}
          </p>
          <p className="sh-night-step" aria-live="assertive">
            {steps[step].text}
          </p>
          <div className="sh-night-progress" key={step}>
            <span style={{ animationDuration: `${steps[step].ms}ms` }} />
          </div>
          <button
            type="button"
            className="gnv2-btn gnv2-btn-ghost w-full"
            onClick={() => setStep((s) => s + 1)}
          >
            Volgende
          </button>
        </>
      )}
    </ShSheet>
  );
}

// ── Rollen onthullen ─────────────────────────────────────────────────────

export function RevealSheet({
  seats,
  nameOf,
  initial,
  pending,
  onSubmit,
  onClose,
}: {
  seats: string[];
  nameOf: (id: string) => string;
  initial: Record<string, ShRole>;
  pending: boolean;
  onSubmit: (roles: Record<string, ShRole>) => void;
  onClose: () => void;
}) {
  const [roles, setRoles] =
    useState<Record<string, ShRole | undefined>>(initial);
  const { liberals, fascists } = roleDistribution(seats.length);
  const error = validateRoles(seats, roles);
  const count = (r: ShRole) => seats.filter((id) => roles[id] === r).length;

  function set(id: string, role: ShRole) {
    setRoles((cur) => {
      const next = { ...cur, [id]: role };
      // Er is maar één Hitler: een nieuwe Hitler maakt de vorige leeg.
      if (role === "hitler") {
        for (const other of seats) {
          if (other !== id && next[other] === "hitler") next[other] = undefined;
        }
      }
      // Alleen nog liberalen over? Vul de rest vanzelf in.
      const filledFascist = seats.filter((s) => next[s] === "fascist").length;
      const filledHitler = seats.filter((s) => next[s] === "hitler").length;
      if (filledFascist === fascists && filledHitler === 1) {
        for (const other of seats) if (!next[other]) next[other] = "liberal";
      }
      return next;
    });
  }

  return (
    <ShSheet title="🎭 De maskers af!" onClose={onClose} wide>
      <p className="sh-sheet-lead">
        Iedereen laat de rolkaart zien. Tik per speler de rol aan.
      </p>
      <p className="sh-reveal-counts">
        <span className={count("liberal") === liberals ? "sh-ok" : ""}>
          🕊️ {count("liberal")}/{liberals}
        </span>
        <span className={count("fascist") === fascists ? "sh-ok" : ""}>
          💀 {count("fascist")}/{fascists}
        </span>
        <span className={count("hitler") === 1 ? "sh-ok" : ""}>
          🦎 {count("hitler")}/1
        </span>
      </p>
      <ul className="sh-reveal-list">
        {seats.map((id) => (
          <li key={id} className="sh-reveal-row">
            <span className="sh-reveal-name">{nameOf(id)}</span>
            <span className="sh-reveal-options">
              {(["liberal", "fascist", "hitler"] as ShRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`sh-chip sh-chip-${r}${roles[id] === r ? " sh-chip-on" : ""}`}
                  aria-pressed={roles[id] === r}
                  onClick={() => set(id, r)}
                >
                  {roleIcon(r)} {ROLE_LABEL[r]}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="sh-form-error">{error}</p>}
      <button
        type="button"
        className="gnv2-btn gnv2-btn-primary w-full"
        disabled={!!error || pending}
        onClick={() => onSubmit(roles as Record<string, ShRole>)}
      >
        {pending ? "Bezig..." : "Onthullen!"}
      </button>
    </ShSheet>
  );
}

// ── Verloop (alle vertellingen) ──────────────────────────────────────────

export function StorySheet({
  story,
  onClose,
}: {
  story: ShNarration[];
  onClose: () => void;
}) {
  return (
    <ShSheet title="📜 Het verloop" onClose={onClose} wide>
      {story.length === 0 ? (
        <p className="sh-sheet-lead">Nog niets gebeurd. Nog niet...</p>
      ) : (
        <ol className="sh-story-list">
          {[...story].reverse().map((line) => (
            <li
              key={line.eventId}
              className={`sh-story-item sh-tone-${line.tone}`}
            >
              <span className="sh-story-icon" aria-hidden>
                {line.icon}
              </span>
              <span>
                <strong>{line.title}</strong>
                <span className="sh-story-text">{line.text}</span>
                {line.extra && (
                  <span className="sh-story-extra">{line.extra}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </ShSheet>
  );
}

// ── Quote vastleggen ─────────────────────────────────────────────────────

export function QuoteSheet({
  seats,
  nameOf,
  pending,
  onSubmit,
  onClose,
}: {
  seats: string[];
  nameOf: (id: string) => string;
  pending: boolean;
  onSubmit: (playerId: string | null, text: string) => void;
  onClose: () => void;
}) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const trimmed = text.trim();
  return (
    <ShSheet title="💬 Quote vastleggen" onClose={onClose}>
      <p className="sh-sheet-lead">
        "Ik zweer op mijn moeder dat ik drie rode had." Komt terug in de
        uitslag.
      </p>
      <div className="sh-claim-options">
        {seats.map((id) => (
          <button
            key={id}
            type="button"
            className={`sh-chip${playerId === id ? " sh-chip-on" : ""}`}
            onClick={() => setPlayerId(playerId === id ? null : id)}
          >
            {nameOf(id)}
          </button>
        ))}
      </div>
      <textarea
        className="sh-textarea"
        value={text}
        maxLength={240}
        rows={3}
        placeholder="Wat werd er gezegd?"
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="gnv2-btn gnv2-btn-primary w-full"
        disabled={!trimmed || pending}
        onClick={() => onSubmit(playerId, trimmed)}
      >
        Vastleggen
      </button>
    </ShSheet>
  );
}

// ── Spel beëindigen (topbalk "Spel afsluiten") ───────────────────────────

export function EndGameSheet({
  gameOver,
  pending,
  onDeclare,
  onStopWithoutResult,
  onClose,
}: {
  gameOver: boolean;
  pending: boolean;
  onDeclare: (winner: "liberal" | "fascist") => void;
  onStopWithoutResult: () => void;
  onClose: () => void;
}) {
  return (
    <ShSheet title="Spel beëindigen" onClose={onClose}>
      {!gameOver && (
        <>
          <p className="sh-sheet-lead">
            Is het spel buiten het scherm om beslist? Kies wie er won; daarna
            onthul je de rollen.
          </p>
          <div className="sh-end-options">
            <button
              type="button"
              className="sh-big-choice sh-big-choice-liberal"
              disabled={pending}
              onClick={() => onDeclare("liberal")}
            >
              🕊️ Liberalen winnen
            </button>
            <button
              type="button"
              className="sh-big-choice sh-big-choice-fascist"
              disabled={pending}
              onClick={() => onDeclare("fascist")}
            >
              💀 Fascisten winnen
            </button>
          </div>
        </>
      )}
      <button
        type="button"
        className="gnv2-btn-danger-ghost w-full"
        disabled={pending}
        onClick={onStopWithoutResult}
      >
        Stoppen zonder uitslag
      </button>
      <p className="gnv2-dialog-muted text-sm">
        Zonder uitslag krijgt niemand een WIN. Dit kan niet ongedaan gemaakt
        worden.
      </p>
    </ShSheet>
  );
}
