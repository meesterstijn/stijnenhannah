export type R6SessionStatus = "live" | "completed";
export type R6MatchResult = "win" | "loss" | "draw" | "unknown";
export type R6OperatorSide = "attacker" | "defender";
export type R6ScoreRuleCategory = "direct" | "end_bonus" | "penalty";

export type R6Map = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export type R6Operator = {
  id: string;
  name: string;
  side: R6OperatorSide;
  is_active: boolean;
  sort_order: number;
};

export type R6Challenge = {
  id: string;
  name: string;
  bonus_points: number;
  is_active: boolean;
  sort_order: number;
};

// Databasegestuurde puntregels (fase 2.2) — vervangt de tot dan toe in
// TypeScript hardcoded R6_SCORE_RULES als bron van waarheid. `code` is de
// stabiele sleutel waarop gelezen wordt, nooit `id`. `icon`/`color`/
// `is_quick_action` (live-scorebord-redesign) bepalen of en hoe een regel
// als tik-tegel op het live dashboard verschijnt. De vroegere
// "end_bonus"-categorie (sessie-brede "meeste X"-bonussen) is verwijderd —
// alle punten komen nu uitsluitend uit `category: "direct"`-regels.
export type R6ScoreRule = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: R6ScoreRuleCategory;
  points: number;
  icon: string | null;
  color: string | null;
  is_quick_action: boolean;
  is_active: boolean;
  sort_order: number;
};

// Eén tik op een actietegel = één onveranderlijke rij. `points_awarded` is
// een momentopname (door een database-trigger gezet, nooit door de
// client), zodat een later aangepaste puntenwaarde van de regel bestaande
// gebeurtenissen niet met terugwerkende kracht verandert.
export type R6Event = {
  id: string;
  session_id: string;
  match_id: string;
  player_id: string;
  score_rule_code: string;
  points_awarded: number;
  created_at: string;
};

export type R6Player = {
  id: string;
  name: string;
  created_at: string;
};

export type R6Session = {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  status: R6SessionStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type R6SessionPlayer = {
  id: string;
  session_id: string;
  player_id: string;
  created_at: string;
  player: R6Player;
};

// Resultaat hoort bij de match (Stijn en de andere speler zitten in
// hetzelfde online team — winst/verlies is nooit een onderling verschil),
// niet per speler. MVP (fase 2.2) hoort er nu ook bij: hoogstens één
// officiële MVP per match is zo een structurele onmogelijkheid om te
// schenden, in plaats van een regel die apart afgedwongen moet worden.
export type R6Match = {
  id: string;
  session_id: string;
  match_number: number;
  played_at: string;
  map_id: string | null;
  result: R6MatchResult;
  challenge_id: string | null;
  challenge_completed: boolean;
  chaos_rule: string | null;
  funniest_moment: string | null;
  notes: string | null;
  mvp_player_id: string | null;
  mvp_reason: string | null;
  // Override van de MVP-puntenwaarde voor precies déze match — null
  // betekent "gebruik de actuele, globale mvp-regel uit r6_score_rules"
  // (het oorspronkelijke, nog steeds standaard gedrag). Alleen relevant
  // wanneer mvp_player_id gezet is (zie R6EndGameSheet).
  mvp_points: number | null;
  created_at: string;
};

export type R6MatchPlayer = {
  id: string;
  match_id: string;
  player_id: string;
  operator_attacker_id: string | null;
  operator_defender_id: string | null;
  operator_single_id: string | null;
  kills: number;
  deaths: number;
  assists: number;
  revives: number;
  headshots: number;
  clutch: boolean;
  ace: boolean;
  created_at: string;
};

// Input shape voor de create_r6_match/update_r6_match RPC's — één rij per
// speler in de match (zonder result/mvp — die zitten nu op de match zelf).
export type R6MatchPlayerInput = {
  player_id: string;
  operator_attacker_id: string | null;
  operator_defender_id: string | null;
  operator_single_id: string | null;
  kills: number;
  deaths: number;
  assists: number;
  revives: number;
  headshots: number;
  clutch: boolean;
  ace: boolean;
};

export type R6NewMatchInput = {
  session_id: string;
  map_id: string | null;
  result: R6MatchResult;
  players: R6MatchPlayerInput[];
  challenge_id: string | null;
  challenge_completed: boolean;
  chaos_rule: string | null;
  funniest_moment: string | null;
  notes: string | null;
  mvp_player_id: string | null;
  mvp_reason: string | null;
  mvp_points: number | null;
};

export type R6UpdateMatchInput = R6NewMatchInput & { match_id: string };

// Volledige sessie inclusief alles wat nodig is om scorebord + historie te
// tonen zonder extra round-trips.
export type R6SessionDetail = {
  session: R6Session;
  sessionPlayers: R6SessionPlayer[];
  matches: R6Match[];
  matchPlayers: R6MatchPlayer[];
  events: R6Event[];
};

// Punten komen uitsluitend uit direct getikte acties (actietegels: kill,
// headshot, revive, mvp, clutch, ace, ...) en de MVP-toekenning bij het
// afsluiten van een game — geen sessie-brede "meeste X"-eindbonussen, die
// telden bij de allereerste tik van een stat al onterecht mee (zie
// scoring.ts). totalPoints is dus altijd gelijk aan directPoints, en wordt
// altijd vers uit de ruwe matchdata herberekend.
export type R6ScoreboardEntry = {
  player: R6Player;
  directPoints: number;
  totalPoints: number;
  totals: {
    kills: number;
    deaths: number;
    assists: number;
    revives: number;
    headshots: number;
    wins: number;
    losses: number;
    draws: number;
    mvps: number;
    clutches: number;
    // 1v2/1v3 apart bijgehouden náást het bestaande gecombineerde
    // `clutches`-totaal — alleen afgeleid uit live-tik-events
    // (clutch_1v2/clutch_1v3), want het klassieke matchformulier kent enkel
    // een generieke clutch-boolean zonder dat onderscheid.
    clutch1v2: number;
    clutch1v3: number;
    aces: number;
    challengesCompleted: number;
  };
};

// LAN-foto's/media (fase 2.2). Alleen storage_path wordt bewaard — de
// publieke URL wordt altijd afgeleid via getR6MediaPublicUrl(), nooit apart
// opgeslagen (voorkomt dubbele opslag van dezelfde informatie).
export type R6SessionMedia = {
  id: string;
  session_id: string;
  match_id: string | null;
  storage_path: string;
  media_type: "image" | "video";
  caption: string | null;
  sort_order: number;
  taken_at: string | null;
  created_at: string;
};

// ── Fundament voor latere fases (nog niet gebruikt door enige UI/hook in
//    fase 2.2 — zie het opleverrapport voor de bewuste scope-afbakening) ──

export type R6Achievement = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  condition_type: string | null;
  condition_value: unknown;
  points: number;
  is_secret: boolean;
  is_active: boolean;
  sort_order: number;
};

export type R6PlayerAchievement = {
  id: string;
  player_id: string;
  achievement_id: string;
  session_id: string | null;
  match_id: string | null;
  earned_at: string;
  metadata: unknown;
};

export type R6SessionChallengeScope = "single_match" | "match_range" | "full_session";

export type R6SessionChallenge = {
  id: string;
  session_id: string;
  challenge_id: string;
  scope: R6SessionChallengeScope;
  start_match_number: number | null;
  end_match_number: number | null;
  status: "active" | "completed" | "abandoned";
  completed: boolean;
  assigned_to_player_id: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

export type R6ChaosEffect = {
  id: string;
  name: string;
  description: string | null;
  duration_type: R6SessionChallengeScope;
  default_duration: number | null;
  // Voor het beheerscherm van het Chaos Wheel ("categorie kiezen") —
  // vrije, optionele groeperingstekst (bv. "Wapens", "Movement").
  category: string | null;
  is_active: boolean;
  sort_order: number;
};

export type R6SessionChaosEffect = {
  id: string;
  session_id: string;
  match_id: string | null;
  chaos_effect_id: string | null;
  custom_text: string | null;
  start_match_number: number | null;
  end_match_number: number | null;
  status: "active" | "completed";
  created_at: string;
};

// Operator Wheel — welke attacker/defender een speler heeft voor precies
// één game. `unique (match_id, player_id)` in de database maakt dit
// upsert-baar: "opnieuw verdelen" is puur lokale state totdat er
// geaccepteerd wordt, dan pas één upsert.
export type R6GameOperatorAssignment = {
  id: string;
  session_id: string;
  match_id: string;
  player_id: string;
  attacker_operator_id: string | null;
  defender_operator_id: string | null;
  created_at: string;
  updated_at: string;
};
