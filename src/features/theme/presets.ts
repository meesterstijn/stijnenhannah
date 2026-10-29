import type { CssVars, ThemeStyle, ThemeStyleId } from "./tokens";

// De zes stijlen uit de referentieafbeelding (1, 2, 4, 5, 6 en 7). Elke stijl
// levert per categorie uitsluitend "bladwaarden": kleuren, lengtes,
// percentages en afbeeldingen, nooit een var()-verwijzing naar een andere
// categorie. Hoe die waarden gecombineerd worden (bv. randkleur = mix van
// accent en border) staat op Ã©Ã©n plek in theme.css. Zo kan elke categorie
// van elke stijl met elke andere gecombineerd worden.
//
// Nieuwe stijl toevoegen: kopieer een blok hieronder, geef het een nieuw id
// in THEME_STYLE_IDS (tokens.ts) en vul dezelfde sleutels in. De
// presets.test.ts controleert dat geen sleutel ontbreekt.

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// shadcn-tokens in Ã©Ã©n compacte vorm, zodat elke palette dezelfde set
// bestaande tokens volledig overschrijft (niets lekt van :root door).
function shadcn(p: {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  mutedForeground: string;
  accent: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
}): CssVars {
  return {
    "--background": p.background,
    "--foreground": p.foreground,
    "--card": p.card,
    "--card-foreground": p.foreground,
    "--popover": p.card,
    "--popover-foreground": p.foreground,
    "--primary": p.primary,
    "--primary-foreground": p.primaryForeground,
    "--secondary": p.secondary,
    "--secondary-foreground": p.foreground,
    "--muted": p.secondary,
    "--muted-foreground": p.mutedForeground,
    "--accent": p.accent,
    "--accent-foreground": p.foreground,
    "--destructive": p.destructive,
    "--destructive-foreground": p.primaryForeground,
    "--border": p.border,
    "--input": p.input,
    "--ring": p.ring,
  };
}

const NONE = "none";

// Papierkorrel voor Retro / Vintage â€” SVG-ruis, geen extern bestand.
const PAPER_GRAIN = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0 0.12  0 0 0 0.09 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
);

const NIGHT_MOUNTAINS = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1426"/><stop offset="0.62" stop-color="#14233f"/><stop offset="1" stop-color="#0a1222"/></linearGradient></defs><rect width="1440" height="900" fill="url(#s)"/><path d="M0 610 L180 470 L300 540 L470 390 L640 520 L760 450 L930 560 L1100 420 L1260 520 L1440 460 L1440 900 L0 900Z" fill="#132038"/><path d="M0 700 L150 610 L330 680 L520 590 L700 690 L880 620 L1060 700 L1250 610 L1440 680 L1440 900 L0 900Z" fill="#0d172b"/><rect y="760" width="1440" height="140" fill="#0a1222" opacity="0.85"/></svg>`,
);

const SUNSET_LAKE = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2350"/><stop offset="0.35" stop-color="#7a4a7e"/><stop offset="0.52" stop-color="#d9826e"/><stop offset="0.6" stop-color="#f2b27a"/></linearGradient><linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e59a74"/><stop offset="0.25" stop-color="#7c4c78"/><stop offset="1" stop-color="#231a3c"/></linearGradient><radialGradient id="sun" cx="0.62" cy="0.58" r="0.3"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient></defs><rect width="1440" height="560" fill="url(#sky)"/><rect width="1440" height="900" fill="url(#sun)"/><path d="M0 470 L160 400 L320 440 L520 300 L640 360 L760 250 L880 330 L1010 280 L1180 380 L1320 340 L1440 390 L1440 560 L0 560Z" fill="#6c4a78" opacity="0.85"/><path d="M0 520 L120 470 L260 500 L400 440 L560 510 L720 470 L900 520 L1080 460 L1260 510 L1440 470 L1440 560 L0 560Z" fill="#3a2a55"/><path d="M0 560 L0 470 L30 430 L60 470 L80 410 L110 470 L140 440 L170 480 L200 420 L230 490 L230 560Z M1210 560 L1230 470 L1260 430 L1290 480 L1320 400 L1350 470 L1380 440 L1410 480 L1440 430 L1440 560Z" fill="#1f1733"/><rect y="560" width="1440" height="340" fill="url(#lake)"/><rect y="600" width="1440" height="2" fill="#ffd9a0" opacity="0.25"/><rect x="560" y="640" width="360" height="2" fill="#ffd9a0" opacity="0.18"/><rect x="640" y="690" width="220" height="2" fill="#ffd9a0" opacity="0.12"/></svg>`,
);

const NEON_GRID = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d946ef" stop-opacity="0"/><stop offset="1" stop-color="#d946ef" stop-opacity="0.35"/></linearGradient></defs><g stroke="url(#f)" stroke-width="1.2" fill="none"><path d="M0 640 H1440 M0 680 H1440 M0 730 H1440 M0 790 H1440 M0 860 H1440"/><path d="M720 620 L-400 900 M720 620 L-80 900 M720 620 L240 900 M720 620 L560 900 M720 620 L880 900 M720 620 L1200 900 M720 620 L1520 900 M720 620 L1840 900"/></g><path d="M0 620 L200 560 L330 600 L470 520 L600 590 L720 540 L860 600 L1010 530 L1160 590 L1300 550 L1440 600 L1440 622 L0 622Z" fill="#1a0f3a"/><path d="M0 620 H1440" stroke="#22d3ee" stroke-opacity="0.45" stroke-width="1.5"/></svg>`,
);

export const THEME_STYLES: Record<ThemeStyleId, ThemeStyle> = {
  minimal: {
    id: "minimal",
    number: 1,
    name: "Modern Minimalistisch",
    description: "Warm lichtbeige, witte kaarten, veel rust",
    colors: {
      scheme: "light",
      vars: {
        "--ht-page": "oklch(0.955 0.017 78)",
        "--ht-surface": "oklch(0.993 0.006 85)",
        "--ht-surface-hover": "oklch(1 0 0)",
        "--ht-text": "oklch(0.24 0.012 60)",
        "--ht-text-muted": "oklch(0.5 0.014 62)",
        "--ht-text-faint": "oklch(0.62 0.012 65)",
        "--ht-accent": "oklch(0.6 0.085 58)",
        "--ht-accent-2": "oklch(0.58 0.06 140)",
        "--ht-accent-contrast": "oklch(0.99 0.006 85)",
        "--ht-border": "oklch(0.88 0.014 75)",
        "--ht-nav-bg": "oklch(0.985 0.007 85)",
        "--ht-nav-fg": "oklch(0.55 0.012 62)",
        "--ht-nav-active": "oklch(0.24 0.012 60)",
        "--ht-success": "oklch(0.58 0.12 150)",
        "--ht-warning": "oklch(0.7 0.14 75)",
        "--ht-danger": "oklch(0.56 0.17 28)",
      },
      shadcn: shadcn({
        background: "oklch(0.955 0.017 78)",
        foreground: "oklch(0.24 0.012 60)",
        card: "oklch(0.993 0.006 85)",
        primary: "oklch(0.34 0.02 60)",
        primaryForeground: "oklch(0.99 0.006 85)",
        secondary: "oklch(0.93 0.015 78)",
        mutedForeground: "oklch(0.5 0.014 62)",
        accent: "oklch(0.92 0.02 75)",
        border: "oklch(0.88 0.014 75)",
        input: "oklch(0.89 0.014 75)",
        ring: "oklch(0.6 0.085 58)",
        destructive: "oklch(0.56 0.17 28)",
      }),
    },
    typography: {
      fontUrl:
        "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      vars: {
        "--ht-font-body": `"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`,
        "--ht-font-heading": `"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`,
        "--ht-weight-body": "400",
        "--ht-weight-heading": "700",
        "--ht-weight-label": "600",
        "--ht-tracking-heading": "-0.02em",
        "--ht-tracking-label": "0.08em",
        "--ht-label-case": "uppercase",
      },
    },
    cards: {
      vars: {
        "--ht-card-radius": "18px",
        "--ht-card-border-width": "1px",
        "--ht-card-alpha": "100%",
        "--ht-card-backdrop": NONE,
        "--ht-card-edge-accent": "0%",
        "--ht-card-edge-alpha": "75%",
        "--ht-card-sheen": NONE,
        "--ht-card-shadow-y": "10px",
        "--ht-card-shadow-blur": "28px",
        "--ht-card-shadow-spread": "-14px",
        "--ht-card-glow": "0%",
        "--ht-card-glow-size": "0px",
        "--ht-card-inset": "0px",
        "--ht-card-hover-mix": "100%",
        "--ht-card-pad": "1rem",
      },
    },
    background: {
      tone: "light",
      vars: {
        "--ht-bg-color": "oklch(0.95 0.02 78)",
        "--ht-bg-image": [
          "radial-gradient(110% 70% at 0% 0%, oklch(0.995 0.012 85 / 0.95), transparent 60%)",
          "repeating-linear-gradient(118deg, transparent 0 90px, oklch(1 0 0 / 0.16) 90px 150px, transparent 150px 260px)",
          "radial-gradient(90% 60% at 100% 100%, oklch(0.86 0.035 70 / 0.7), transparent 65%)",
          "linear-gradient(180deg, oklch(0.965 0.016 82), oklch(0.925 0.026 74))",
        ].join(", "),
        "--ht-bg-size": "cover",
        "--ht-bg-position": "center",
      },
    },
    icons: {
      vars: {
        "--ht-icon-stroke": "1.6",
        "--ht-icon-accent": "0%",
        "--ht-icon-tile": "0%",
        "--ht-icon-tile-border": "0px",
        "--ht-icon-pad": "0px",
        "--ht-icon-radius": "10px",
        "--ht-icon-glow": "0%",
      },
    },
    navigation: {
      vars: {
        "--ht-nav-alpha": "94%",
        "--ht-nav-blur": "14px",
        "--ht-nav-border-width": "1px",
        "--ht-nav-border-accent": "0%",
        "--ht-nav-glow": "0%",
        "--ht-nav-pill": "0%",
        "--ht-nav-dot": "1",
        "--ht-nav-label-weight": "500",
      },
    },
    effects: {
      vars: {
        "--ht-fx-duration": "200ms",
        "--ht-fx-lift": "-2px",
        "--ht-fx-shadow-color": "oklch(0.42 0.04 60 / 0.16)",
        "--ht-fx-text-glow": "0%",
        "--ht-fx-texture": NONE,
      },
    },
  },

  dark: {
    id: "dark",
    number: 2,
    name: "Donker & Modern",
    description: "Diep donkerblauw met een cyaan accent",
    colors: {
      scheme: "dark",
      vars: {
        "--ht-page": "oklch(0.17 0.03 255)",
        "--ht-surface": "oklch(0.2 0.014 255)",
        "--ht-surface-hover": "oklch(0.24 0.018 255)",
        "--ht-text": "oklch(0.97 0.005 250)",
        "--ht-text-muted": "oklch(0.74 0.015 250)",
        "--ht-text-faint": "oklch(0.6 0.015 250)",
        "--ht-accent": "oklch(0.78 0.13 222)",
        "--ht-accent-2": "oklch(0.74 0.12 250)",
        "--ht-accent-contrast": "oklch(0.18 0.03 250)",
        "--ht-border": "oklch(1 0 0 / 0.09)",
        "--ht-nav-bg": "oklch(0.15 0.022 255)",
        "--ht-nav-fg": "oklch(0.64 0.015 250)",
        "--ht-nav-active": "oklch(0.78 0.13 222)",
        "--ht-success": "oklch(0.72 0.14 160)",
        "--ht-warning": "oklch(0.8 0.14 80)",
        "--ht-danger": "oklch(0.68 0.18 25)",
      },
      shadcn: shadcn({
        background: "oklch(0.17 0.03 255)",
        foreground: "oklch(0.97 0.005 250)",
        card: "oklch(0.2 0.014 255)",
        primary: "oklch(0.78 0.13 222)",
        primaryForeground: "oklch(0.18 0.03 250)",
        secondary: "oklch(0.25 0.02 255)",
        mutedForeground: "oklch(0.74 0.015 250)",
        accent: "oklch(0.27 0.025 250)",
        border: "oklch(1 0 0 / 0.1)",
        input: "oklch(1 0 0 / 0.14)",
        ring: "oklch(0.78 0.13 222)",
        destructive: "oklch(0.66 0.19 25)",
      }),
    },
    typography: {
      vars: {
        "--ht-font-body": `"Inter", ui-sans-serif, system-ui, sans-serif`,
        "--ht-font-heading": `"Inter", ui-sans-serif, system-ui, sans-serif`,
        "--ht-weight-body": "400",
        "--ht-weight-heading": "600",
        "--ht-weight-label": "600",
        "--ht-tracking-heading": "-0.015em",
        "--ht-tracking-label": "0.1em",
        "--ht-label-case": "uppercase",
      },
    },
    cards: {
      vars: {
        "--ht-card-radius": "14px",
        "--ht-card-border-width": "1px",
        "--ht-card-alpha": "100%",
        "--ht-card-backdrop": NONE,
        "--ht-card-edge-accent": "0%",
        "--ht-card-edge-alpha": "100%",
        "--ht-card-sheen": NONE,
        "--ht-card-shadow-y": "12px",
        "--ht-card-shadow-blur": "30px",
        "--ht-card-shadow-spread": "-16px",
        "--ht-card-glow": "0%",
        "--ht-card-glow-size": "0px",
        "--ht-card-inset": "0px",
        "--ht-card-hover-mix": "100%",
        "--ht-card-pad": "1rem",
      },
    },
    background: {
      tone: "dark",
      vars: {
        "--ht-bg-color": "oklch(0.15 0.03 255)",
        "--ht-bg-image": [
          "linear-gradient(180deg, oklch(0.15 0.03 255 / 0.55), oklch(0.13 0.03 255 / 0.15) 40%, oklch(0.12 0.03 255 / 0.6))",
          "radial-gradient(70% 45% at 50% 0%, oklch(0.32 0.06 245 / 0.55), transparent 70%)",
          NIGHT_MOUNTAINS,
        ].join(", "),
        "--ht-bg-size": "cover",
        "--ht-bg-position": "center bottom",
      },
    },
    icons: {
      vars: {
        "--ht-icon-stroke": "1.7",
        "--ht-icon-accent": "100%",
        "--ht-icon-tile": "0%",
        "--ht-icon-tile-border": "0px",
        "--ht-icon-pad": "0px",
        "--ht-icon-radius": "10px",
        "--ht-icon-glow": "0%",
      },
    },
    navigation: {
      vars: {
        "--ht-nav-alpha": "100%",
        "--ht-nav-blur": "0px",
        "--ht-nav-border-width": "1px",
        "--ht-nav-border-accent": "0%",
        "--ht-nav-glow": "0%",
        "--ht-nav-pill": "0%",
        "--ht-nav-dot": "1",
        "--ht-nav-label-weight": "500",
      },
    },
    effects: {
      vars: {
        "--ht-fx-duration": "180ms",
        "--ht-fx-lift": "-1px",
        "--ht-fx-shadow-color": "oklch(0 0 0 / 0.55)",
        "--ht-fx-text-glow": "0%",
        "--ht-fx-texture": NONE,
      },
    },
  },

  glass: {
    id: "glass",
    number: 4,
    name: "Glassmorphism",
    description: "Zwevende glazen panelen boven een avondlandschap",
    colors: {
      scheme: "dark",
      vars: {
        "--ht-page": "oklch(0.3 0.06 305)",
        "--ht-surface": "oklch(0.4 0.05 315)",
        "--ht-surface-hover": "oklch(0.46 0.05 315)",
        "--ht-text": "oklch(0.99 0.004 320)",
        "--ht-text-muted": "oklch(0.9 0.015 320)",
        "--ht-text-faint": "oklch(0.8 0.02 320)",
        "--ht-accent": "oklch(0.86 0.09 60)",
        "--ht-accent-2": "oklch(0.82 0.08 340)",
        "--ht-accent-contrast": "oklch(0.24 0.04 310)",
        "--ht-border": "oklch(1 0 0 / 0.28)",
        "--ht-nav-bg": "oklch(0.28 0.05 305)",
        "--ht-nav-fg": "oklch(0.88 0.015 320)",
        "--ht-nav-active": "oklch(1 0 0)",
        "--ht-success": "oklch(0.8 0.13 160)",
        "--ht-warning": "oklch(0.85 0.13 80)",
        "--ht-danger": "oklch(0.72 0.17 20)",
      },
      shadcn: shadcn({
        background: "oklch(0.3 0.06 305)",
        foreground: "oklch(0.99 0.004 320)",
        card: "oklch(0.34 0.05 310)",
        primary: "oklch(0.86 0.09 60)",
        primaryForeground: "oklch(0.24 0.04 310)",
        secondary: "oklch(0.4 0.05 312)",
        mutedForeground: "oklch(0.88 0.02 320)",
        accent: "oklch(0.44 0.05 315)",
        border: "oklch(1 0 0 / 0.22)",
        input: "oklch(1 0 0 / 0.26)",
        ring: "oklch(0.86 0.09 60)",
        destructive: "oklch(0.62 0.19 22)",
      }),
    },
    typography: {
      fontUrl:
        "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap",
      vars: {
        "--ht-font-body": `"Manrope", ui-sans-serif, system-ui, sans-serif`,
        "--ht-font-heading": `"Manrope", ui-sans-serif, system-ui, sans-serif`,
        "--ht-weight-body": "500",
        "--ht-weight-heading": "600",
        "--ht-weight-label": "600",
        "--ht-tracking-heading": "-0.01em",
        "--ht-tracking-label": "0.12em",
        "--ht-label-case": "uppercase",
      },
    },
    cards: {
      vars: {
        "--ht-card-radius": "20px",
        "--ht-card-border-width": "1px",
        "--ht-card-alpha": "40%",
        "--ht-card-backdrop": "blur(18px) saturate(150%)",
        "--ht-card-edge-accent": "0%",
        "--ht-card-edge-alpha": "100%",
        "--ht-card-sheen":
          "linear-gradient(135deg, oklch(1 0 0 / 0.2), oklch(1 0 0 / 0.04) 45%, transparent 70%)",
        "--ht-card-shadow-y": "10px",
        "--ht-card-shadow-blur": "32px",
        "--ht-card-shadow-spread": "-10px",
        "--ht-card-glow": "0%",
        "--ht-card-glow-size": "0px",
        "--ht-card-inset": "0px",
        "--ht-card-hover-mix": "100%",
        "--ht-card-pad": "1rem",
      },
    },
    background: {
      tone: "dark",
      vars: {
        "--ht-bg-color": "oklch(0.3 0.06 305)",
        "--ht-bg-image": [
          "linear-gradient(180deg, oklch(0.2 0.05 300 / 0.35), oklch(0.2 0.05 300 / 0.1) 45%, oklch(0.18 0.05 300 / 0.5))",
          SUNSET_LAKE,
        ].join(", "),
        "--ht-bg-size": "cover",
        "--ht-bg-position": "center",
      },
    },
    icons: {
      vars: {
        "--ht-icon-stroke": "1.6",
        "--ht-icon-accent": "0%",
        "--ht-icon-tile": "0%",
        "--ht-icon-tile-border": "0px",
        "--ht-icon-pad": "0px",
        "--ht-icon-radius": "12px",
        "--ht-icon-glow": "0%",
      },
    },
    navigation: {
      vars: {
        "--ht-nav-alpha": "38%",
        "--ht-nav-blur": "22px",
        "--ht-nav-border-width": "1px",
        "--ht-nav-border-accent": "0%",
        "--ht-nav-glow": "0%",
        "--ht-nav-pill": "16%",
        "--ht-nav-dot": "0",
        "--ht-nav-label-weight": "500",
      },
    },
    effects: {
      vars: {
        "--ht-fx-duration": "260ms",
        "--ht-fx-lift": "-2px",
        "--ht-fx-shadow-color": "oklch(0.18 0.06 300 / 0.35)",
        "--ht-fx-text-glow": "0%",
        "--ht-fx-texture": NONE,
      },
    },
  },

  retro: {
    id: "retro",
    number: 5,
    name: "Retro / Vintage",
    description: "Perkament, serif-letters en donkergroen",
    colors: {
      scheme: "light",
      vars: {
        "--ht-page": "oklch(0.93 0.035 85)",
        "--ht-surface": "oklch(0.955 0.03 88)",
        "--ht-surface-hover": "oklch(0.97 0.028 88)",
        "--ht-text": "oklch(0.29 0.045 52)",
        "--ht-text-muted": "oklch(0.46 0.045 58)",
        "--ht-text-faint": "oklch(0.58 0.04 62)",
        "--ht-accent": "oklch(0.42 0.075 150)",
        "--ht-accent-2": "oklch(0.55 0.12 50)",
        "--ht-accent-contrast": "oklch(0.95 0.03 88)",
        "--ht-border": "oklch(0.62 0.055 65)",
        "--ht-nav-bg": "oklch(0.33 0.055 155)",
        "--ht-nav-fg": "oklch(0.86 0.03 90)",
        "--ht-nav-active": "oklch(0.82 0.13 72)",
        "--ht-success": "oklch(0.48 0.1 150)",
        "--ht-warning": "oklch(0.62 0.13 65)",
        "--ht-danger": "oklch(0.5 0.15 30)",
      },
      shadcn: shadcn({
        background: "oklch(0.93 0.035 85)",
        foreground: "oklch(0.29 0.045 52)",
        card: "oklch(0.955 0.03 88)",
        primary: "oklch(0.42 0.075 150)",
        primaryForeground: "oklch(0.95 0.03 88)",
        secondary: "oklch(0.9 0.04 84)",
        mutedForeground: "oklch(0.46 0.045 58)",
        accent: "oklch(0.88 0.045 82)",
        border: "oklch(0.72 0.05 68)",
        input: "oklch(0.74 0.05 70)",
        ring: "oklch(0.42 0.075 150)",
        destructive: "oklch(0.5 0.15 30)",
      }),
    },
    typography: {
      fontUrl:
        "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Lora:wght@400;500;600&display=swap",
      vars: {
        "--ht-font-body": `"Lora", ui-serif, Georgia, serif`,
        "--ht-font-heading": `"Libre Baskerville", ui-serif, Georgia, serif`,
        "--ht-weight-body": "400",
        "--ht-weight-heading": "700",
        "--ht-weight-label": "600",
        "--ht-tracking-heading": "0",
        "--ht-tracking-label": "0.14em",
        "--ht-label-case": "uppercase",
      },
    },
    cards: {
      vars: {
        "--ht-card-radius": "6px",
        "--ht-card-border-width": "1px",
        "--ht-card-alpha": "100%",
        "--ht-card-backdrop": NONE,
        "--ht-card-edge-accent": "0%",
        "--ht-card-edge-alpha": "100%",
        "--ht-card-sheen": NONE,
        "--ht-card-shadow-y": "1px",
        "--ht-card-shadow-blur": "0px",
        "--ht-card-shadow-spread": "0px",
        "--ht-card-glow": "0%",
        "--ht-card-glow-size": "0px",
        "--ht-card-inset": "3px",
        "--ht-card-hover-mix": "100%",
        "--ht-card-pad": "1.05rem",
      },
    },
    background: {
      tone: "light",
      vars: {
        "--ht-bg-color": "oklch(0.92 0.038 84)",
        "--ht-bg-image": [
          "radial-gradient(ellipse at center, transparent 45%, oklch(0.78 0.06 68 / 0.45) 100%)",
          "linear-gradient(180deg, oklch(0.94 0.032 86), oklch(0.9 0.042 80))",
        ].join(", "),
        "--ht-bg-size": "cover",
        "--ht-bg-position": "center",
      },
    },
    icons: {
      vars: {
        "--ht-icon-stroke": "1.75",
        "--ht-icon-accent": "100%",
        "--ht-icon-tile": "12%",
        "--ht-icon-tile-border": "1px",
        "--ht-icon-pad": "6px",
        "--ht-icon-radius": "6px",
        "--ht-icon-glow": "0%",
      },
    },
    navigation: {
      vars: {
        "--ht-nav-alpha": "100%",
        "--ht-nav-blur": "0px",
        "--ht-nav-border-width": "3px",
        "--ht-nav-border-accent": "0%",
        "--ht-nav-glow": "0%",
        "--ht-nav-pill": "0%",
        "--ht-nav-dot": "0",
        "--ht-nav-label-weight": "600",
      },
    },
    effects: {
      vars: {
        "--ht-fx-duration": "140ms",
        "--ht-fx-lift": "0px",
        "--ht-fx-shadow-color": "oklch(0.45 0.05 60 / 0.22)",
        "--ht-fx-text-glow": "0%",
        "--ht-fx-texture": PAPER_GRAIN,
      },
    },
  },

  neon: {
    id: "neon",
    number: 6,
    name: "Cyber / Neon",
    description: "Lichtgevende randen in blauw, paars en magenta",
    colors: {
      scheme: "dark",
      vars: {
        "--ht-page": "oklch(0.14 0.05 282)",
        "--ht-surface": "oklch(0.18 0.06 285)",
        "--ht-surface-hover": "oklch(0.22 0.07 287)",
        "--ht-text": "oklch(0.97 0.012 280)",
        "--ht-text-muted": "oklch(0.8 0.04 285)",
        "--ht-text-faint": "oklch(0.66 0.05 285)",
        "--ht-accent": "oklch(0.8 0.15 215)",
        "--ht-accent-2": "oklch(0.7 0.25 330)",
        "--ht-accent-contrast": "oklch(0.14 0.05 282)",
        "--ht-border": "oklch(0.8 0.15 215 / 0.4)",
        "--ht-nav-bg": "oklch(0.12 0.045 282)",
        "--ht-nav-fg": "oklch(0.74 0.08 300)",
        "--ht-nav-active": "oklch(0.82 0.15 215)",
        "--ht-success": "oklch(0.82 0.18 150)",
        "--ht-warning": "oklch(0.85 0.16 90)",
        "--ht-danger": "oklch(0.7 0.22 10)",
      },
      shadcn: shadcn({
        background: "oklch(0.14 0.05 282)",
        foreground: "oklch(0.97 0.012 280)",
        card: "oklch(0.18 0.06 285)",
        primary: "oklch(0.8 0.15 215)",
        primaryForeground: "oklch(0.14 0.05 282)",
        secondary: "oklch(0.23 0.07 288)",
        mutedForeground: "oklch(0.8 0.04 285)",
        accent: "oklch(0.26 0.09 300)",
        border: "oklch(0.8 0.15 215 / 0.3)",
        input: "oklch(0.8 0.15 215 / 0.35)",
        ring: "oklch(0.7 0.25 330)",
        destructive: "oklch(0.64 0.23 10)",
      }),
    },
    typography: {
      fontUrl:
        "https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&display=swap",
      vars: {
        "--ht-font-body": `"Exo 2", ui-sans-serif, system-ui, sans-serif`,
        "--ht-font-heading": `"Exo 2", ui-sans-serif, system-ui, sans-serif`,
        "--ht-weight-body": "400",
        "--ht-weight-heading": "600",
        "--ht-weight-label": "600",
        "--ht-tracking-heading": "0.01em",
        "--ht-tracking-label": "0.16em",
        "--ht-label-case": "uppercase",
      },
    },
    cards: {
      vars: {
        "--ht-card-radius": "14px",
        "--ht-card-border-width": "1.5px",
        "--ht-card-alpha": "74%",
        "--ht-card-backdrop": "blur(10px) saturate(120%)",
        "--ht-card-edge-accent": "100%",
        "--ht-card-edge-alpha": "85%",
        "--ht-card-sheen":
          "linear-gradient(160deg, oklch(1 0 0 / 0.07), transparent 42%)",
        "--ht-card-shadow-y": "8px",
        "--ht-card-shadow-blur": "24px",
        "--ht-card-shadow-spread": "-12px",
        "--ht-card-glow": "45%",
        "--ht-card-glow-size": "16px",
        "--ht-card-inset": "0px",
        "--ht-card-hover-mix": "100%",
        "--ht-card-pad": "1rem",
      },
    },
    background: {
      tone: "dark",
      vars: {
        "--ht-bg-color": "oklch(0.12 0.05 282)",
        "--ht-bg-image": [
          "radial-gradient(55% 40% at 85% 8%, oklch(0.55 0.24 330 / 0.38), transparent 70%)",
          "radial-gradient(50% 45% at 8% 30%, oklch(0.5 0.2 275 / 0.4), transparent 70%)",
          NEON_GRID,
          "linear-gradient(180deg, oklch(0.12 0.05 282), oklch(0.15 0.08 300))",
        ].join(", "),
        "--ht-bg-size": "cover",
        "--ht-bg-position": "center bottom",
      },
    },
    icons: {
      vars: {
        "--ht-icon-stroke": "1.8",
        "--ht-icon-accent": "100%",
        "--ht-icon-tile": "0%",
        "--ht-icon-tile-border": "0px",
        "--ht-icon-pad": "0px",
        "--ht-icon-radius": "10px",
        "--ht-icon-glow": "80%",
      },
    },
    navigation: {
      vars: {
        "--ht-nav-alpha": "92%",
        "--ht-nav-blur": "12px",
        "--ht-nav-border-width": "1px",
        "--ht-nav-border-accent": "70%",
        "--ht-nav-glow": "60%",
        "--ht-nav-pill": "0%",
        "--ht-nav-dot": "1",
        "--ht-nav-label-weight": "500",
      },
    },
    effects: {
      vars: {
        "--ht-fx-duration": "200ms",
        "--ht-fx-lift": "-2px",
        "--ht-fx-shadow-color": "oklch(0.05 0.04 282 / 0.7)",
        "--ht-fx-text-glow": "45%",
        "--ht-fx-texture":
          "repeating-linear-gradient(0deg, oklch(1 0 0 / 0.018) 0 1px, transparent 1px 3px)",
      },
    },
  },

  mono: {
    id: "mono",
    number: 7,
    name: "Monochroom",
    description: "Altijd donker: zwart, grijs en wit, verder niets",
    colors: {
      scheme: "dark",
      vars: {
        "--ht-page": "oklch(0.09 0 0)",
        "--ht-surface": "oklch(0.17 0 0)",
        "--ht-surface-hover": "oklch(0.21 0 0)",
        "--ht-text": "oklch(0.97 0 0)",
        "--ht-text-muted": "oklch(0.72 0 0)",
        "--ht-text-faint": "oklch(0.56 0 0)",
        "--ht-accent": "oklch(0.95 0 0)",
        "--ht-accent-2": "oklch(0.8 0 0)",
        "--ht-accent-contrast": "oklch(0.12 0 0)",
        "--ht-border": "oklch(1 0 0 / 0.11)",
        "--ht-nav-bg": "oklch(0.11 0 0)",
        "--ht-nav-fg": "oklch(0.6 0 0)",
        "--ht-nav-active": "oklch(0.98 0 0)",
        "--ht-success": "oklch(0.82 0 0)",
        "--ht-warning": "oklch(0.72 0 0)",
        "--ht-danger": "oklch(0.66 0.16 25)",
      },
      shadcn: shadcn({
        background: "oklch(0.09 0 0)",
        foreground: "oklch(0.97 0 0)",
        card: "oklch(0.17 0 0)",
        primary: "oklch(0.95 0 0)",
        primaryForeground: "oklch(0.12 0 0)",
        secondary: "oklch(0.22 0 0)",
        mutedForeground: "oklch(0.72 0 0)",
        accent: "oklch(0.25 0 0)",
        border: "oklch(1 0 0 / 0.12)",
        input: "oklch(1 0 0 / 0.16)",
        ring: "oklch(0.8 0 0)",
        destructive: "oklch(0.6 0.17 25)",
      }),
    },
    typography: {
      fontUrl:
        "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      vars: {
        "--ht-font-body": `"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif`,
        "--ht-font-heading": `"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif`,
        "--ht-weight-body": "400",
        "--ht-weight-heading": "500",
        "--ht-weight-label": "500",
        "--ht-tracking-heading": "-0.01em",
        "--ht-tracking-label": "0.18em",
        "--ht-label-case": "uppercase",
      },
    },
    cards: {
      vars: {
        "--ht-card-radius": "12px",
        "--ht-card-border-width": "1px",
        "--ht-card-alpha": "100%",
        "--ht-card-backdrop": NONE,
        "--ht-card-edge-accent": "0%",
        "--ht-card-edge-alpha": "100%",
        "--ht-card-sheen": NONE,
        "--ht-card-shadow-y": "0px",
        "--ht-card-shadow-blur": "0px",
        "--ht-card-shadow-spread": "0px",
        "--ht-card-glow": "0%",
        "--ht-card-glow-size": "0px",
        "--ht-card-inset": "0px",
        "--ht-card-hover-mix": "100%",
        "--ht-card-pad": "1rem",
      },
    },
    background: {
      tone: "dark",
      vars: {
        "--ht-bg-color": "oklch(0.07 0 0)",
        "--ht-bg-image":
          "radial-gradient(80% 45% at 50% 0%, oklch(0.13 0 0), transparent 70%)",
        "--ht-bg-size": "cover",
        "--ht-bg-position": "center",
      },
    },
    icons: {
      vars: {
        "--ht-icon-stroke": "1.4",
        "--ht-icon-accent": "0%",
        "--ht-icon-tile": "0%",
        "--ht-icon-tile-border": "0px",
        "--ht-icon-pad": "0px",
        "--ht-icon-radius": "8px",
        "--ht-icon-glow": "0%",
      },
    },
    navigation: {
      vars: {
        "--ht-nav-alpha": "100%",
        "--ht-nav-blur": "0px",
        "--ht-nav-border-width": "1px",
        "--ht-nav-border-accent": "0%",
        "--ht-nav-glow": "0%",
        "--ht-nav-pill": "0%",
        "--ht-nav-dot": "1",
        "--ht-nav-label-weight": "500",
      },
    },
    effects: {
      vars: {
        "--ht-fx-duration": "120ms",
        "--ht-fx-lift": "0px",
        "--ht-fx-shadow-color": "oklch(0 0 0 / 0)",
        "--ht-fx-text-glow": "0%",
        "--ht-fx-texture": NONE,
      },
    },
  },
};
