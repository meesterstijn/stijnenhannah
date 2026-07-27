import {
  Users,
  Trophy,
  ListChecks,
  Shuffle,
  BarChart3,
  Award,
  type LucideIcon,
} from "lucide-react";

export type R6FeatureId =
  | "lan-avond"
  | "scorebord"
  | "challenges"
  | "operator-wheel"
  | "statistieken"
  | "eindevaluatie";

export type R6Feature = {
  id: R6FeatureId;
  icon: LucideIcon;
  title: string;
  description: string;
  status: string;
  /** Wanneer aanwezig is de kaart een echte link i.p.v. een inerte preview. */
  to?: string;
};

// Fase 2: "LAN-avond" is nu een werkende sectie (sessies, matches, scorebord
// — zie src/pages/RainbowSixSiegeLan.tsx). De overige vijf blijven
// placeholders en worden later stap voor stap uitgebouwd; ze zijn bewust
// voorbereid om straks aan dezelfde r6_sessions/r6_matches-data te hangen
// (bv. Operator Wheel kiest uit r6_operators, Statistieken leest dezelfde
// r6_match_players-rijen als het scorebord).
export const R6_FEATURES: R6Feature[] = [
  {
    id: "lan-avond",
    icon: Users,
    title: "LAN-avond",
    description: "Start een nieuwe Rainbow Six Siege LAN-avond en houd de voortgang van de avond bij.",
    status: "Actief",
    to: "/rainbow-six-siege/lan",
  },
  {
    id: "scorebord",
    icon: Trophy,
    title: "Scorebord",
    description: "Houd punten, gewonnen Gimma's, clutches en andere prestaties bij.",
    status: "Binnenkort beschikbaar",
  },
  {
    id: "challenges",
    icon: ListChecks,
    title: "Challenges",
    description: "Voeg vaste en willekeurige opdrachten toe voor extra chaos tijdens de Gimma's.",
    status: "Binnenkort beschikbaar",
  },
  {
    id: "operator-wheel",
    icon: Shuffle,
    title: "Operator Wheel",
    description: "Laat willekeurig bepalen welke operator, wapens of speelregels jullie gebruiken.",
    status: "Binnenkort beschikbaar",
  },
  {
    id: "statistieken",
    icon: BarChart3,
    title: "Statistieken",
    description: "Bekijk kills, assists, revives, MVP's, K/D en andere resultaten van de avond.",
    status: "Binnenkort beschikbaar",
  },
  {
    id: "eindevaluatie",
    icon: Award,
    title: "Eindevaluatie",
    description: "Kies de winnaar, de grootste fail en het grappigste moment van de LAN-avond.",
    status: "Binnenkort beschikbaar",
  },
];

export type R6PointRule = {
  label: string;
  points: string;
  tone: "positive" | "negative" | "gold";
};

export const R6_POINT_RULES: R6PointRule[] = [
  { label: "Meeste headshots", points: "+1 punt", tone: "positive" },
  { label: "Meeste assists", points: "+1 punt", tone: "positive" },
  { label: "Meeste revives", points: "+2 punten", tone: "positive" },
  { label: "Domste death", points: "-1 punt", tone: "negative" },
  { label: "Clutch 1vX", points: "+3 punten", tone: "positive" },
  { label: "Ace", points: "Automatische rondewinnaar", tone: "gold" },
];

export const R6_CHAOS_ROUNDS: string[] = [
  "Alleen shotguns",
  "Alleen pistolen",
  "Operator blind kiezen",
  "Geen drones gebruiken",
  "Alleen melee kills",
  "Iedereen crouch-walk",
  "Alleen dezelfde operator-duo's",
];
