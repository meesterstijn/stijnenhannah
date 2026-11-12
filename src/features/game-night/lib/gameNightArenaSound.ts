// Game Night V2.7B (sectie 10) — lichte, zelfgegenereerde geluidseffecten
// voor de Game Arena via de Web Audio API. Bewust GEEN audiobestanden
// (geen copyrighted game-audio, geen nieuwe externe URL/asset) — elke tone
// is een kort, zacht gegenereerd signaal met een snelle attack + exponentiële
// decay (voorkomt hoorbare "clicks" aan begin/eind). Eén gedeelde
// AudioContext, lazy aangemaakt bij de EERSTE aanroep — die valt in de
// praktijk altijd samen met een echte tik (WIN-registratie), dus
// browser-autoplaybeleid (context moet door een user-gesture gestart
// worden) wordt hier vanzelf gerespecteerd, geen aparte "unlock"-stap nodig.

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  if (sharedContext.state === "suspended") {
    // Best effort — sommige browsers vereisen dat resume() zelf ook nog
    // binnen dezelfde user-gesture-call-stack gebeurt, wat hier het geval
    // is (aangeroepen vanuit een click-handler).
    void sharedContext.resume();
  }
  return sharedContext;
}

// Eén korte toon: sinus/triangle-oscillator met een lineaire attack en
// exponentiële decay-envelope. `freqStart`/`freqEnd` laten een kleine
// glijdende toonhoogte toe (voor het onderscheid tussen presets), altijd
// binnen dezelfde korte, zachte vorm.
function playTone(
  ctx: AudioContext,
  {
    freqStart,
    freqEnd = freqStart,
    durationMs,
    type = "sine",
    gain = 0.09,
    delayMs = 0,
  }: {
    freqStart: number;
    freqEnd?: number;
    durationMs: number;
    type?: OscillatorType;
    gain?: number;
    delayMs?: number;
  },
) {
  const startAt = ctx.currentTime + delayMs / 1000;
  const durationSec = durationMs / 1000;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startAt);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, freqEnd),
      startAt + durationSec,
    );
  }

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

// Kort, prettig "ding" bij een WIN — geen copyrighted game-audio, gewoon een
// zachte stijgende twee-toon (kwint) van ~180ms, functioneel identiek voor
// elke celebration_style-preset (de preset bepaalt alleen de VISUELE
// animatie, niet welk geluid er klinkt — sectie 9: "alle presets moeten...
// functioneel dezelfde WIN registreren").
export function playWinSound(): void {
  const ctx = getContext();
  if (!ctx) return;
  playTone(ctx, { freqStart: 523.25, durationMs: 90, gain: 0.08 }); // C5
  playTone(ctx, {
    freqStart: 784,
    durationMs: 160,
    gain: 0.09,
    delayMs: 60,
  }); // G5
}

// Zachtere, dalende toon voor undo — duidelijk onderscheidbaar van de
// WIN-toon zonder onprettig te zijn.
export function playUndoSound(): void {
  const ctx = getContext();
  if (!ctx) return;
  playTone(ctx, {
    freqStart: 392,
    freqEnd: 294,
    durationMs: 140,
    type: "triangle",
    gain: 0.07,
  });
}

// ── Secret Hitler ────────────────────────────────────────────────────────
// Zelfde aanpak: korte, zelf gegenereerde tonen, geen audiobestanden.

export type SecretHitlerSound =
  | "liberal"
  | "fascist"
  | "shot"
  | "drama"
  | "win"
  | "tick";

function playNoiseBurst(ctx: AudioContext, durationMs: number, gain: number) {
  const length = Math.floor((ctx.sampleRate * durationMs) / 1000);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gainNode = ctx.createGain();
  gainNode.gain.value = gain;
  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start();
}

export function playSecretHitlerSound(kind: SecretHitlerSound): void {
  const ctx = getContext();
  if (!ctx) return;
  switch (kind) {
    case "liberal":
      // Heldere majeur-arpeggio.
      playTone(ctx, { freqStart: 523.25, durationMs: 140, gain: 0.07 });
      playTone(ctx, {
        freqStart: 659.25,
        durationMs: 140,
        gain: 0.07,
        delayMs: 90,
      });
      playTone(ctx, {
        freqStart: 783.99,
        durationMs: 260,
        gain: 0.08,
        delayMs: 180,
      });
      return;
    case "fascist":
      // Lage, dreigende mineur-stap.
      playTone(ctx, {
        freqStart: 146.83,
        durationMs: 380,
        type: "sawtooth",
        gain: 0.045,
      });
      playTone(ctx, {
        freqStart: 138.59,
        durationMs: 520,
        type: "sawtooth",
        gain: 0.05,
        delayMs: 260,
      });
      return;
    case "shot":
      playNoiseBurst(ctx, 260, 0.35);
      playTone(ctx, {
        freqStart: 120,
        freqEnd: 40,
        durationMs: 220,
        gain: 0.12,
      });
      return;
    case "drama":
      playTone(ctx, {
        freqStart: 220,
        durationMs: 160,
        type: "triangle",
        gain: 0.07,
      });
      playTone(ctx, {
        freqStart: 207.65,
        durationMs: 160,
        type: "triangle",
        gain: 0.07,
        delayMs: 170,
      });
      playTone(ctx, {
        freqStart: 196,
        durationMs: 420,
        type: "triangle",
        gain: 0.08,
        delayMs: 340,
      });
      return;
    case "win":
      playTone(ctx, { freqStart: 523.25, durationMs: 120, gain: 0.07 });
      playTone(ctx, {
        freqStart: 659.25,
        durationMs: 120,
        gain: 0.07,
        delayMs: 110,
      });
      playTone(ctx, {
        freqStart: 783.99,
        durationMs: 120,
        gain: 0.07,
        delayMs: 220,
      });
      playTone(ctx, {
        freqStart: 1046.5,
        durationMs: 420,
        gain: 0.09,
        delayMs: 330,
      });
      return;
    case "tick":
      playTone(ctx, {
        freqStart: 880,
        durationMs: 50,
        type: "square",
        gain: 0.025,
      });
      return;
  }
}
