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
