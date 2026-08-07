// alcoholic_variant is een optioneel DERDE, vast slot ("Variant" in het
// detailvenster) — geen vrije/oneindige variantenlijst, zie
// 20260823000000_cocktail_bar_variant_2.sql.
export type CocktailVariantType =
  | "alcoholic"
  | "alcohol_free"
  | "alcoholic_variant";
export type CocktailOrderStatus =
  | "ordered"
  | "in_progress"
  | "ready"
  | "served";

export type CocktailSpirit = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type CocktailGlassType = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type CocktailGarnish = {
  id: string;
  name: string;
  created_at: string;
};

export type CocktailIngredient = {
  id: string;
  name: string;
  default_unit: string | null;
  created_at: string;
};

export type Cocktail = {
  id: string;
  name: string;
  tagline: string;
  backstory: string | null;
  photo_storage_path: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CocktailVariant = {
  id: string;
  cocktail_id: string;
  variant_type: CocktailVariantType;
  glass_type_id: string | null;
  // Klein notitieveld per glas (bv. ijs-aanwijzingen: "met crushed ice").
  // glass_type_id_2/glass_note_2 zijn een optioneel TWEEDE, vast glas-slot,
  // geen variabele lijst — zie 20260822000000_cocktail_bar_second_glass.sql.
  glass_note: string | null;
  glass_type_id_2: string | null;
  glass_note_2: string | null;
  // Losse, onafhankelijke bouw-vinkjes (geen van alle verplicht) — puur ter
  // ondersteuning van de bartender-workflow, niet in preparation_steps
  // gedupliceerd. Zie 20260825000000_cocktail_bar_build_method.sql.
  shake_with_ice: boolean;
  dry_shake_first: boolean;
  build_in_glass: boolean;
  spirit_id: string | null;
  garnish_id: string | null;
  abv_percent: number;
  preparation_steps: string;
  photo_storage_path: string | null;
  created_at: string;
  updated_at: string;
};

// 0-5 scores ONLY — badges (Zoet/Zuur/Bitter/Fris/Sterk) worden hier nooit
// opgeslagen, altijd afgeleid via deriveFlavourBadges() (lib/flavourBadges.ts).
export type CocktailFlavourProfile = {
  variant_id: string;
  sweet_score: number;
  sour_score: number;
  bitter_score: number;
  fresh_score: number;
  strong_score: number;
  updated_at: string;
};

export type CocktailVariantIngredient = {
  id: string;
  variant_id: string;
  ingredient_id: string;
  amount: number;
  unit: string;
  note: string | null;
  sort_order: number;
};

// Eén ingrediëntregel met de naam er al bij gejoined — het vorm waarin de
// UI ingrediëntenlijsten wil renderen, zonder los tegen cocktail_ingredients
// te moeten joinen op elke gebruiksplek.
export type CocktailVariantIngredientWithName = CocktailVariantIngredient & {
  ingredient_name: string;
};

// Eén variant met alles erbij wat een detailweergave nodig heeft — het
// resultaat van fetchCocktailFull() (lib/cocktails.ts), niet een losse
// databasetabel.
export type CocktailVariantFull = CocktailVariant & {
  flavour_profile: CocktailFlavourProfile | null;
  ingredients: CocktailVariantIngredientWithName[];
  spirit: CocktailSpirit | null;
  glass_type: CocktailGlassType | null;
  glass_type_2: CocktailGlassType | null;
  garnish: CocktailGarnish | null;
};

export type CocktailFull = Cocktail & {
  variants: CocktailVariantFull[];
};

export type CocktailFavorite = {
  profile_id: string;
  cocktail_id: string;
  created_at: string;
};

export type CocktailOrder = {
  id: string;
  cocktail_id: string;
  variant_id: string;
  guest_name: string;
  note: string | null;
  status: CocktailOrderStatus;
  ready_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CocktailHighlight = {
  id: string;
  guest_name: string;
  cocktail_id: string | null;
  order_id: string | null;
  title: string;
  subtitle: string | null;
  story: string;
  display_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CocktailBarState = {
  id: true;
  active_highlight_id: string | null;
  active_highlight_started_at: string | null;
  dismissed_ready_order_id: string | null;
  ready_display_seconds: number;
  updated_at: string;
};
