import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://lrqivcfuiuskqkpmyxfo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycWl2Y2Z1aXVza3FrcG15eGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzQyMzEsImV4cCI6MjA5NDAxMDIzMX0.vG0Gm6ycQNV20QurnGMVPElsMhQ7bi60uDdimL6vIrM",
);

export type GroceryItem = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
};

export type WeekPlanRow = {
  day: string;
  meal: string;
  recipe_id: string | null;
};

export type Recipe = {
  id: string;
  title: string;
  time: string;
  servings: string;
  ingredients: string;
  steps: string;
  category: string;
  created_at: string;
};

export type DailyPrompt = {
  id: string;
  prompt: string;
  hour: number;
  minute: number;
  updated_at: string;
};

export type DailyPromptRun = {
  id: string;
  run_date: string;
  prompt: string;
  response: string;
  created_at: string;
};

export type Plant = {
  id: string;
  name: string;
  species: string | null;
  fun_fact: string | null;
  location: string | null;
  lifecycle: string | null;
  size_cm: number | null;
  spacing_cm: number | null;
  growth_habit: string[];
  sun_needs: string | null;
  season_notes: string | null;
  water_notes: string | null;
  water_tags: string[];
  watering_method: string[];
  watering_soak_minutes: number | null;
  growing_method: string | null;
  pot_min_liters: number | null;
  pot_recommended_liters: number | null;
  pot_min_depth_cm: number | null;
  pot_recommended_depth_cm: number | null;
  pot_water_notes: string | null;
  water_interval_days: number | null;
  pot_water_interval_days: number | null;
  last_watered_at: string | null;
  last_water_reminder_sent_at: string | null;
  water_skip_until: string | null;
  feeding_notes: string | null;
  feeding_interval_days: number | null;
  last_fed_at: string | null;
  last_feeding_reminder_sent_at: string | null;
  feeding_reminders_enabled: boolean;
  feeding_months: string[];
  soil_notes: string | null;
  soil_ph_min: number | null;
  soil_ph_max: number | null;
  temperature_notes: string | null;
  humidity_notes: string | null;
  winter_hardiness: string | null;
  winter_notes: string | null;
  pruning_notes: string | null;
  pest_notes: string | null;
  toxic_to_humans: boolean;
  toxic_to_cats: boolean;
  toxicity_notes: string | null;
  general_notes: string | null;
  sow_months: string[];
  sow_week: string | null;
  sow_notes: string | null;
  bloom_months: string[];
  bloom_week: string | null;
  bloom_notes: string | null;
  propagation_methods: string[];
  propagation_notes: string | null;
  harvest_notes: string | null;
  harvest_months: string[];
  harvest_week: string | null;
  greenhouse_notes: string | null;
  category: string | null;
  photo_url: string | null;
  planted: boolean;
  planted_at: string | null;
  reminders_enabled: boolean;
  // Individual-plant reality (distinct from the botanical advice fields
  // above, e.g. pot_recommended_liters / soil_notes / size_cm).
  health_status: PlantHealthStatus | null;
  last_checked_at: string | null;
  pot_size_liters: number | null;
  pot_material: PotMaterial | null;
  pot_color: string | null;
  soil_type: string | null;
  soil_mix_notes: string | null;
  last_repotted_at: string | null;
  acquired_at: string | null;
  source: string | null;
  price: number | null;
  first_flower_at: string | null;
  first_fruit_at: string | null;
  created_at: string;
};

/**
 * Shape of one entry in a plant-catalog import JSON (array or single object).
 * Differs from `Plant` in three ways:
 *   1. `sun_needs` may be a string array (new format) or a comma string (legacy export).
 *   2. `greenhouse_pref` is a separate field that the importer merges into `greenhouse_notes`.
 *   3. Numeric fields may arrive as strings because JSON from ChatGPT sometimes quotes numbers.
 * Database-generated fields (id, created_at, water_tags, *_reminder_sent_at) are absent.
 */
export type PlantImportData = {
  name: string;
  species?: string | null;
  fun_fact?: string | null;
  location?: string | null;
  category?: string | null;
  lifecycle?: string | null;
  size_cm?: string | number | null;
  spacing_cm?: string | number | null;
  growth_habit?: string[];
  sun_needs?: string | string[] | null;
  season_notes?: string | null;
  water_notes?: string | null;
  watering_method?: string[];
  watering_soak_minutes?: string | number | null;
  growing_method?: string | null;
  pot_min_liters?: string | number | null;
  pot_recommended_liters?: string | number | null;
  pot_min_depth_cm?: string | number | null;
  pot_recommended_depth_cm?: string | number | null;
  pot_water_notes?: string | null;
  water_interval_days?: string | number | null;
  pot_water_interval_days?: string | number | null;
  last_watered_at?: string | null;
  reminders_enabled?: boolean;
  greenhouse_pref?: string | null;
  greenhouse_notes?: string | null;
  feeding_notes?: string | null;
  feeding_interval_days?: string | number | null;
  last_fed_at?: string | null;
  feeding_reminders_enabled?: boolean;
  feeding_months?: string[];
  soil_notes?: string | null;
  soil_ph_min?: string | number | null;
  soil_ph_max?: string | number | null;
  temperature_notes?: string | null;
  humidity_notes?: string | null;
  winter_hardiness?: string | null;
  winter_notes?: string | null;
  pruning_notes?: string | null;
  pest_notes?: string | null;
  toxic_to_humans?: boolean;
  toxic_to_cats?: boolean;
  toxicity_notes?: string | null;
  sow_months?: string[];
  sow_week?: string | null;
  sow_notes?: string | null;
  bloom_months?: string[];
  bloom_week?: string | null;
  bloom_notes?: string | null;
  propagation_methods?: string[];
  propagation_notes?: string | null;
  harvest_months?: string[];
  harvest_week?: string | null;
  harvest_notes?: string | null;
  general_notes?: string | null;
  photo_url?: string | null;
  planted?: boolean;
  planted_at?: string | null;
  health_status?: string | null;
  last_checked_at?: string | null;
  water_skip_until?: string | null;
  first_flower_at?: string | null;
  first_fruit_at?: string | null;
  pot_size_liters?: string | number | null;
  pot_material?: string | null;
  pot_color?: string | null;
  soil_type?: string | null;
  soil_mix_notes?: string | null;
  last_repotted_at?: string | null;
  acquired_at?: string | null;
  source?: string | null;
  price?: string | number | null;
};

export type PlantHealthStatus =
  | "Zaailing"
  | "Net geplant"
  | "Gezond"
  | "In bloei"
  | "Vruchten"
  | "Stress"
  | "Ziek"
  | "Afgestorven";

export type PotMaterial =
  | "Terracotta"
  | "Kunststof"
  | "Keramiek"
  | "Metaal"
  | "Hout"
  | "Textiel"
  | "Steen"
  | "Biologisch afbreekbaar"
  | "Anders";

// ─── Species / instance / season split ─────────────────────────────────────
// `Plant` (above) is the permanent species catalog (botanical + care advice).
// `PlantInstance` is one physical planted specimen of a species — multiple
// instances may share the same species_id. `GrowingSeason` is one
// cultivation round for one instance. Deleting/completing an instance or
// season never touches the species row (species_id uses on delete restrict).

export type CultivationType = "pot" | "open_ground" | "raised_bed";
export type IndoorOutdoorType = "outdoor" | "indoor";

export type PlantInstanceStatus =
  | "active"
  | "dormant"
  | "archived"
  | "dead"
  | "removed";

export type GrowingSeasonStatus = "active" | "completed" | "failed";

// individual = deze rij stelt precies 1 fysieke plant voor (quantity is dan
// altijd 1, afgedwongen door een DB check-constraint). batch = deze rij
// stelt een groep samen bijgehouden planten voor, bv. een bak veldsla —
// water/voeding/groeifoto's blijven ongewijzigd één actie per rij, ongeacht
// tracking_mode (zie usePlantCareActions.ts). Zie migratie
// 20260905000000_plant_instance_batch_tracking.sql voor de volledige
// semantiek van quantity.
export type TrackingMode = "individual" | "batch";

export type PlantInstance = {
  id: string;
  species_id: string;
  custom_name: string | null;
  location: string | null;
  cultivation_type: CultivationType | null;
  indoor_outdoor: IndoorOutdoorType | null;
  pot_size_liters: number | null;
  pot_material: string | null;
  pot_color: string | null;
  soil_type: string | null;
  soil_mix_notes: string | null;
  planted_at: string | null;
  acquired_at: string | null;
  source: string | null;
  price: number | null;
  health_status: PlantHealthStatus | null;
  last_checked_at: string | null;
  last_repotted_at: string | null;
  first_flower_at: string | null;
  first_fruit_at: string | null;
  reminders_enabled: boolean;
  feeding_reminders_enabled: boolean;
  last_watered_at: string | null;
  last_fed_at: string | null;
  last_water_reminder_sent_at: string | null;
  last_feeding_reminder_sent_at: string | null;
  water_skip_until: string | null;
  status: PlantInstanceStatus;
  legacy_plant_id: string | null;
  // Set when this instance was created via "Plant nu" from a cultivation plan
  // item. ON DELETE SET NULL so deleting a plan never removes instances.
  cultivation_plan_item_id: string | null;
  tracking_mode: TrackingMode;
  // Huidig aantal levende/groeiende planten in deze registratie. Altijd 1
  // bij tracking_mode "individual". Bij "batch": null = nog niet geteld
  // (NOOIT 0 voor "onbekend" — 0 betekent letterlijk nul planten over).
  quantity: number | null;
  // Verwijst naar de zaailing-instance waaruit dit exemplaar ontstond via
  // "Zaailing uitplanten" (plant_seedling_to_instances). Puur relationeel —
  // gebruikt om de fotohistorie van vóór de split erbij te tonen (zie
  // useAncestorGrowthHistory). Null voor exemplaren die niet uit een split
  // ontstonden. Zie 20260906000000_qr_labels_and_photo_lineage.sql.
  derived_from_instance_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowingSeason = {
  id: string;
  plant_instance_id: string;
  year: number;
  label: string | null;
  started_at: string;
  ended_at: string | null;
  status: GrowingSeasonStatus;
  closing_reason: string | null;
  closing_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlantInstanceWithSpecies = PlantInstance & { species: Plant };

export type PlantPhoto = {
  id: string;
  plant_id: string;
  photo_url: string;
  note: string | null;
  taken_at: string;
  // Nullable, additive instance/season linkage (see
  // 20260802060000_plant_photos_instance_columns.sql) — null means a
  // legacy/general species-level photo, exactly as before this column
  // existed; set means the photo belongs to one concrete instance.
  plant_instance_id: string | null;
  growing_season_id: string | null;
};

export type PlantHarvestLog = {
  id: string;
  plant_id: string;
  // Nullable, additive instance/season linkage — populated whenever a
  // harvest is logged from the instance detail dialog; null for legacy
  // species-level rows created before instances existed (see
  // 20260802040000_logs_instance_season_columns.sql).
  plant_instance_id: string | null;
  growing_season_id: string | null;
  harvested_at: string;
  weight_grams: number | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
};

export type PlantPruningLog = {
  id: string;
  plant_id: string;
  plant_instance_id: string | null;
  growing_season_id: string | null;
  pruned_at: string;
  pruning_type: string | null;
  notes: string | null;
  created_at: string;
};

export type PlantRepotLog = {
  id: string;
  plant_id: string;
  plant_instance_id: string | null;
  growing_season_id: string | null;
  repotted_at: string;
  old_pot_size_liters: number | null;
  new_pot_size_liters: number | null;
  pot_material: string | null;
  soil_type: string | null;
  notes: string | null;
  created_at: string;
};

// Instance-aware inspection history (phase 3) — always tied to a concrete
// plant_instance_id, unlike the legacy species-level *_logs tables above.
export type PlantInspectionLog = {
  id: string;
  plant_instance_id: string;
  growing_season_id: string | null;
  checked_at: string;
  health_status: PlantHealthStatus | null;
  notes: string | null;
  issues: string | null;
  action_taken: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Teeltplanner ────────────────────────────────────────────────────────────

export type CultivationPlanStatus =
  | "draft"
  | "active"
  | "completed"
  | "archived";

export type CultivationPlan = {
  id: string;
  name: string;
  plan_year: number;
  status: CultivationPlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CultivationPlanItem = {
  id: string;
  cultivation_plan_id: string;
  species_id: string;
  planned_quantity: number;
  backup_quantity: number;
  planted_quantity: number;
  planned_location: string | null;
  notes: string | null;
  pot_liters_override: number | null;
  created_at: string;
  updated_at: string;
};

export type CultivationPlanWithItems = CultivationPlan & {
  items: CultivationPlanItem[];
};

// Storage-backed photo linked to a growth_log_entry. One entry can have
// zero, one, or multiple photos. plant_instance_id is denormalized from
// the parent entry for fast per-instance queries.
export type GrowthLogPhoto = {
  id: string;
  growth_log_entry_id: string;
  plant_instance_id: string; // NOT NULL: always mirrors the parent entry's plant_instance_id
  storage_path: string;
  photo_url: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

// ─── QR-labels ───────────────────────────────────────────────────────────
// Een label is een permanente, herbruikbare rij (staat voor de fysieke
// sticker); de koppeling naar een plant_instance is losstaand en
// historisch bijgehouden zodat een sticker na vrijgeven opnieuw te
// gebruiken is. Zie 20260906000000_qr_labels_and_photo_lineage.sql.
export type QrLabel = {
  id: string;
  code: string;
  note: string | null;
  created_at: string;
  // Soft-delete/archief-tijdstip. Null = normaal actief label. Niet-null =
  // "verwijderd" — verdwijnt uit de standaard beheerlijst, kan nooit meer
  // gekoppeld worden, maar de rij (en zijn assignmenthistorie) blijft
  // bestaan. Zie 20260907000000_qr_label_management.sql.
  deleted_at: string | null;
};

export type PlantInstanceQrAssignment = {
  id: string;
  qr_label_id: string;
  plant_instance_id: string;
  assigned_at: string;
  // null = deze koppeling is momenteel actief.
  released_at: string | null;
};

// ─── Gitaar / Akkoorden ─────────────────────────────────────────────────

export type GuitarAlbum = {
  id: string;
  title: string;
  artist: string;
  cover_storage_path: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type GuitarSong = {
  id: string;
  title: string;
  artist: string;
  album_id: string | null;
  // Grondtoon-notatie, bv. "A", "F#", "Bb", "Em" — zelfde chordsyntax als
  // akkoorden in `content` (zie features/guitar/lib/transpose.ts).
  original_key: string;
  bpm: number | null;
  // Originele, ongewijzigde songdata: secties + inline akkoorden gekoppeld
  // aan tekstposities. Zie features/guitar/lib/chordSheet.ts voor het
  // opslagformaat en de parser.
  content: string;
  source_url: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type GuitarSongWithAlbum = GuitarSong & {
  album: Pick<
    GuitarAlbum,
    "id" | "title" | "artist" | "cover_storage_path"
  > | null;
};

export type GuitarAlbumWithSongCount = GuitarAlbum & { song_count: number };

// ─── Game Night ─────────────────────────────────────────────────────────
// Functioneel fundament: permanente spelers, Game Night-sessies, spelsessies
// (één spel binnen een avond), rondes/resultaten en checkpoints/foto's. Zie
// de migraties 20260912000000 t/m 20260912050000 en het opleverrapport voor
// de volledige architectuurmotivatie (met name sectie 12: een overwinning is
// altijd herleidbaar via ronde/spelsessie → spel → Game Night, nooit los).

export type GameDifficulty = "licht" | "gemiddeld" | "zwaar";
export type GameResultMode = "winner" | "score" | "ranking" | "team" | "coop";

// Game Night V2.7A (20260912200000_game_night_arena_config.sql) — vaste
// preset-allowlists voor de toekomstige Game Arena (V2.7B). De database
// bewaart uitsluitend deze preset-id's, nooit CSS/HTML/animatiecode; welk
// icoon/welke animatie bij een preset hoort bepaalt de frontend later (zie
// gameNightArena.ts). Zelfde allowlist als de CHECK-constraints in die
// migratie — bewust hier ook als TS-union zodat een onbekende/corrupte
// runtime-waarde nooit stilzwijgend als geldige preset wordt behandeld.
export type GameNightArenaStyle =
  | "warm"
  | "dark"
  | "neon"
  | "playful"
  | "classic";
export type GameNightArenaSymbol =
  | "hex"
  | "skull"
  | "music"
  | "cards"
  | "dice"
  | "crown"
  | "burst"
  | "star"
  | "none";
export type GameNightCelebrationStyle =
  | "burst"
  | "pulse"
  | "spark"
  | "slam"
  | "glitch"
  | "confetti";

export type GameNightGame = {
  id: string;
  name: string;
  // Stabiele, naam-onafhankelijke sleutel voor spel-specifieke Hall of
  // Fame-titels (20260912110000_game_night_history_and_awards.sql) — null
  // voor spellen zonder gekoppelde titelconfiguratie.
  slug: string | null;
  cover_storage_path: string | null;
  min_players: number | null;
  max_players: number | null;
  duration_minutes: number | null;
  difficulty: GameDifficulty | null;
  tags: string[];
  description: string | null;
  uses_rounds: boolean;
  track_round_results: boolean;
  has_session_winner: boolean;
  result_mode: GameResultMode;
  archived_at: string | null;
  // Game Night V2.1 (20260912130000) — optioneel per-spel-thema-accent uit
  // GameNightColorPaletteEntry. Nog zonder UI.
  accent_color_id: string | null;
  // Game Night V2.7A (20260912200000) — Game Arena-configuratiebasis, alle
  // zes nullable/backwards-compatible (bestaande spellen: allemaal null,
  // zie gameNightArena.ts voor de veilige fallback-resolutie). Kleuren zijn
  // altijd genormaliseerd naar lowercase "#rrggbb" door de database-trigger,
  // maar worden hier bewust als `string` (niet een striktere template-
  // literal-type) getypeerd — de TS-laag valideert defensief opnieuw via
  // isValidHexColor() i.p.v. blind op deze compile-time-only garantie te
  // vertrouwen (runtime-data uit Supabase is nooit type-afgedwongen).
  setup_storage_path: string | null;
  arena_primary_color: string | null;
  arena_secondary_color: string | null;
  arena_style: GameNightArenaStyle | null;
  arena_symbol: GameNightArenaSymbol | null;
  arena_tagline: string | null;
  celebration_style: GameNightCelebrationStyle | null;
  created_at: string;
  updated_at: string;
};

export type GameNightPlayer = {
  id: string;
  name: string;
  avatar_url: string | null;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
  // Game Night V2.1 (20260912130000) — fundamentvelden voor het telefoon-
  // profiel/gecureerd kleurenpalet. Alle drie nullable en nog zonder UI of
  // RLS-betekenis; `name` blijft de echte/weergavenaam zolang `nickname`
  // leeg is.
  nickname: string | null;
  auth_user_id: string | null;
  color_id: string | null;
  // Game Night V2.8 (20260913000000) — gekozen character-preset-id (vaste
  // allowlist, zie characterPresets.ts). Null = nog geen character gekozen.
  character_id: string | null;
  // Game Night V2.9E (20260915000000) — structurele lichaamsbouw-keuze,
  // alleen betekenisvol bij een female base. Null = nog geen bewuste keuze;
  // de applicatielaag valt dan terug op "medium"
  // (zie resolveBodyShape() in gameNightCharacter.ts), nooit hier een
  // kolomdefault die dat verhult.
  body_shape: GameNightBodyShape | null;
  // Game Night — persoonlijke face-layer (selfie/crop-flow). Alle drie
  // null = nog geen face ingesteld; CharacterVisual/resolvePlayerCharacter
  // vallen dan terug op het bestaande modulaire/legacy/leeg-gedrag.
  // face_original_path: de alleen-grootte-beperkte, nog niet gecropte
  // selfie (bewaard voor toekomstige herverwerking). face_asset_path: de
  // afgeleide, canonieke 512x512 face-laag die daadwerkelijk gerenderd
  // wordt. Beide staan altijd samen gezet of samen null (zie
  // game_night_update_my_face-RPC).
  face_original_path: string | null;
  face_asset_path: string | null;
  face_crop: GameNightFaceCrop | null;
  created_at: string;
  updated_at: string;
};

// Game Night — cropmetadata uit het origineel (pixels binnen
// face_original_path) waarmee face_asset_path later opnieuw gegenereerd
// kan worden zonder de croppositionering te verliezen. Zie
// FACE_ANCHOR/CHARACTER_CANVAS in gameNightFaceCanvas.ts voor de
// canonieke 512x512-doelgeometrie waar deze rechthoek naartoe wordt
// getekend.
export type GameNightFaceCrop = {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  // Optioneel, binnen dezelfde jsonb-kolom (bewust GEEN nieuwe
  // databasekolommen voor deze twee) — laat een latere sessie zien met
  // welke segmentatie-implementatie/wanneer een face_asset_path is
  // gegenereerd, zodat een toekomstig beter model selectief kan
  // herverwerken (bv. "alleen faces met segmentationVersion < 2").
  segmentationVersion?: string;
  processedAt?: string;
};

// Game Night V2.1 (20260912130000_game_night_identity_foundations.sql) —
// gecureerd kleurenpalet, owner-beheerd, nog zonder UI.
export type GameNightColorPaletteEntry = {
  id: string;
  hex: string;
  label: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type GameNightSessionStatus = "active" | "paused" | "completed";

export type GameNightSession = {
  id: string;
  name: string;
  status: GameNightSessionStatus;
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GameNightSessionPlayerSource = "manual" | "qr_join";

export type GameNightSessionPlayer = {
  session_id: string;
  player_id: string;
  joined_at: string;
  // Game Night V2.4 (20260912170000) — party-status bovenop de bestaande
  // attendance-rij. `active_at_table` bepaalt alleen wie NU aan tafel zit;
  // attendance-statistiek blijft gebaseerd op het bestaan van de rij zelf.
  active_at_table: boolean;
  left_at: string | null;
  source: GameNightSessionPlayerSource;
  seat_index: number | null;
};

// Game Night V2.4 (20260912180000_game_night_join_tokens.sql) — alleen
// owner leest deze tabel rechtstreeks (RLS); overige interactie loopt via
// de generate/revoke/validate-RPC's.
export type GameNightJoinToken = {
  id: string;
  game_night_session_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_by: string | null;
};

export type GameNightGameSession = {
  id: string;
  game_night_session_id: string;
  game_id: string;
  status: GameNightSessionStatus;
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  // Cumulatieve gepauzeerde tijd in seconden — zie
  // 20260912060000_game_night_active_play.sql voor de volledige uitleg.
  total_paused_seconds: number;
  // Snapshot van game_night_games.{uses_rounds,track_round_results,
  // has_session_winner,result_mode} op het moment dat DEZE spelsessie
  // startte (20260912070000_game_night_round_configuration.sql). Alle UI-
  // logica moet deze velden lezen, nooit gameSession.game.uses_rounds e.d.
  // — zo blijft een lopende/afgeronde sessie stabiel als de spelconfiguratie
  // later wijzigt.
  uses_rounds: boolean;
  track_round_results: boolean;
  has_session_winner: boolean;
  result_mode: GameResultMode;
  // Game Night V2.1 (20260912120000) — expliciete snapshot van welke tabel
  // de WinRecords van DEZE spelsessie levert. 'legacy' voor alle bestaande
  // sessies en (tot een V2.2-wijziging van het start-RPC) ook alle nieuwe
  // sessies; 'win_events' pas zodra V2.2 dat expliciet laat starten. Zie
  // normalizeWinRecords() in gameNightStats.ts.
  win_source: GameNightWinSource;
  created_at: string;
  updated_at: string;
};

export type GameNightWinSource = "legacy" | "win_events";

// Game Night V2.1 (20260912120000_game_night_win_events.sql) — één rij per
// WIN-gebeurtenis. Wordt in V2.1 nog door niets geschreven; V2.2 introduceert
// de RPC's die deze tabel vullen. undone_at = soft-delete voor undo, nooit
// hard verwijderen.
export type GameNightWinEvent = {
  id: string;
  game_session_id: string;
  player_id: string;
  created_at: string;
  undone_at: string | null;
};

export type GameNightGameSessionPlayer = {
  game_session_id: string;
  player_id: string;
  team_id: string | null;
  seat_order: number | null;
  created_at: string;
};

export type GameNightRound = {
  id: string;
  game_session_id: string;
  round_number: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type GameNightRoundResult = {
  id: string;
  round_id: string;
  player_id: string;
  team_id: string | null;
  is_winner: boolean;
  score: number | null;
  rank: number | null;
  created_at: string;
  updated_at: string;
};

export type GameNightGameSessionResult = {
  id: string;
  game_session_id: string;
  player_id: string;
  team_id: string | null;
  is_winner: boolean;
  score: number | null;
  rank: number | null;
  created_at: string;
  updated_at: string;
};

export type GameNightCheckpointPhotoType =
  | "board"
  | "cards"
  | "player"
  | "supply"
  | "score"
  | "other";

export type GameNightCheckpoint = {
  id: string;
  game_session_id: string;
  title: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  // Context/metadata: tijdens welke ronde dit checkpoint gemaakt is (alleen
  // relevant voor rondespellen) — 20260912090000_game_night_checkpoint_photo_ux.
  round_id: string | null;
};

export type GameNightCheckpointPhoto = {
  id: string;
  checkpoint_id: string;
  storage_path: string;
  photo_type: GameNightCheckpointPhotoType;
  caption: string | null;
  sort_order: number;
  created_at: string;
  // Optioneel: van welke speler is deze foto (kaarten/hand) —
  // 20260912090000_game_night_checkpoint_photo_ux.
  player_id: string | null;
};

// Game Night V2.9B (20260914000000) — modulaire Character Creator-
// fundament. Zie src/features/game-night/lib/gameNightCharacter.ts voor de
// pure domain-laag (types/resolvers) die deze rijen consumeert.
export type GameNightCharacterSlot =
  // V2.9B — blijven volledig geldig, bestaande data breekt niet.
  | "base"
  | "face"
  | "hair"
  | "outfit"
  | "headwear"
  | "accessory"
  | "effect"
  | "badge"
  // Game Night V2.9E (20260915000000) — nieuwe 128×128 pixel-art
  // assetstandaard. "clothing" is de opvolger van "outfit", "glasses" van
  // "accessory"; "eyes"/"eyebrows"/"mouth" splitsen het oude "face" op.
  | "clothing"
  | "eyes"
  | "eyebrows"
  | "mouth"
  | "facial-hair"
  | "glasses"
  | "arms"
  | "props"
  | "foreground-effects";

// Game Night V2.9E — structurele lichaamsbouw, alleen voor de female base.
// Bewust GEEN cupmaten: puur neutrale, visuele groottes.
export type GameNightBodyShape = "small" | "medium" | "large";

export type GameNightCharacterPart = {
  id: string;
  key: string;
  slot: GameNightCharacterSlot;
  label: string;
  asset_path: string;
  layer_order: number;
  is_starter: boolean;
  rarity: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Game Night V2.9E (20260915000000) — alleen gezet op BASE-rijen die zelf
  // een aparte, direct selecteerbare lichaamsvorm-tegel zijn (de 3 female
  // bases). Null voor alle overige rijen.
  body_shape: GameNightBodyShape | null;
  // Optioneel: { small?, medium?, large?: asset_path } voor kleding/arm-
  // items die per lichaamsvorm een andere pasvorm nodig hebben terwijl de
  // speler nog altijd maar ÉÉN tegel kiest. Ontbrekende sleutel =
  // needs_asset_revision voor die vorm (zie resolveBodyShapeAssetPath()).
  body_shape_variants: Partial<Record<GameNightBodyShape, string>> | null;
  // Game Night V2.9E — pose/prop-koppeling (sectie "Pose/prop-compatibiliteit").
  // `pose_key`: alleen gezet op een `arms`-rij — de stabiele identifier
  // waarnaar een `props`-rij verwijst. `requires_pose_key`: alleen gezet op
  // een `props`-rij die NIET los kan zweven en dus een specifieke arm/hand-
  // laag vereist (bv. prop-mug-01 → requires_pose_key "pose-hold-mug").
  // Een prop zonder `requires_pose_key` is decoratief en pose-onafhankelijk
  // (bv. foreground-effects).
  pose_key: string | null;
  requires_pose_key: string | null;
};

export type GameNightCharacterUnlockSource =
  | "starter"
  | "wins"
  | "game_achievement"
  | "attendance"
  | "title"
  | "special"
  | "owner_grant";

export type GameNightPlayerCharacterUnlock = {
  player_id: string;
  part_id: string;
  unlocked_at: string;
  source: GameNightCharacterUnlockSource;
  source_ref: string | null;
};

export type GameNightPlayerCharacterEquipment = {
  player_id: string;
  slot: GameNightCharacterSlot;
  part_id: string;
  equipped_at: string;
};
