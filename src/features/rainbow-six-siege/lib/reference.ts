import { supabase } from "@/lib/supabase";
import type { R6Challenge, R6Map, R6Operator, R6ScoreRule } from "@/features/rainbow-six-siege/types";

// Deze fetchen bewust ALLE rijen (actief én inactief), niet gefilterd —
// historische matches moeten een inactieve map/operator/challenge nog
// correct bij naam kunnen tonen ("Historische matches moeten inactieve
// operators wel correct blijven tonen"). Waar de UI alleen actieve opties
// wil aanbieden (bv. het matchformulier), filtert de aanroeper zelf op
// `is_active` — zie R6MatchForm.

export async function fetchR6Maps(): Promise<R6Map[]> {
  const { data, error } = await supabase
    .from("r6_maps")
    .select("id, name, is_active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as R6Map[];
}

export async function fetchR6Operators(): Promise<R6Operator[]> {
  const { data, error } = await supabase
    .from("r6_operators")
    .select("id, name, side, is_active, sort_order")
    .order("side", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as R6Operator[];
}

export async function fetchR6Challenges(): Promise<R6Challenge[]> {
  const { data, error } = await supabase
    .from("r6_challenges")
    .select("id, name, bonus_points, is_active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as R6Challenge[];
}

export async function fetchR6ScoreRules(): Promise<R6ScoreRule[]> {
  const { data, error } = await supabase
    .from("r6_score_rules")
    .select("id, code, name, description, category, points, icon, color, is_quick_action, is_active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as R6ScoreRule[];
}

export async function updateR6ScoreRule(
  id: string,
  patch: Partial<Pick<R6ScoreRule, "name" | "points" | "icon" | "color" | "sort_order" | "is_active">>,
): Promise<void> {
  const { error } = await supabase.from("r6_score_rules").update(patch).eq("id", id);
  if (error) throw error;
}

// Stabiele, unieke `code` afgeleid van de ingevoerde naam (geen los
// invoerveld hiervoor — de gebruiker denkt in namen, niet in sleutels).
// Accenten worden gestript en alles buiten a-z/0-9 wordt een underscore, zo
// blijft `code` altijd een geldige, leesbare sleutel voor r6_events.score_rule_code.
function slugifyScoreRuleCode(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || `actie_${Date.now()}`;
}

/**
 * Voegt een nieuwe, door de gebruiker gedefinieerde actietegel toe.
 * Altijd category='direct' en is_quick_action=true — de eindbonus-regels
 * ("meeste kills" e.d.) zijn en blijven een vaste, structurele set, geen
 * iets wat via deze UI aangemaakt wordt. Bij een dubbele `code` (zelfde naam
 * al in gebruik) gooit de unique constraint in de database een duidelijke
 * fout die de UI opvangt en toont — geen stilzwijgende overschrijving.
 */
export async function createR6ScoreRule(input: {
  name: string;
  points: number;
  icon: string | null;
  color: string | null;
  sortOrder: number;
}): Promise<R6ScoreRule> {
  const { data, error } = await supabase
    .from("r6_score_rules")
    .insert({
      code: slugifyScoreRuleCode(input.name),
      name: input.name.trim(),
      category: "direct",
      points: input.points,
      icon: input.icon,
      color: input.color,
      is_quick_action: true,
      is_active: true,
      sort_order: input.sortOrder,
    })
    .select("id, code, name, description, category, points, icon, color, is_quick_action, is_active, sort_order")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error(`Er bestaat al een actie met een vergelijkbare naam ("${input.name}"). Kies een net iets andere naam.`);
    }
    throw error;
  }
  return data as R6ScoreRule;
}

/**
 * Verwijdert een actietegel definitief. `r6_events.score_rule_code`
 * verwijst naar `r6_score_rules.code` zonder ON DELETE CASCADE — is deze
 * actie al minstens één keer getikt (of ergens anders aan gekoppeld), dan
 * weigert de database dit met een foreign-key-fout, die hier wordt omgezet
 * naar een leesbare melding. Dat is bewust: de geschiedenis van al getikte
 * gebeurtenissen mag nooit stilzwijgend verweesd raken. Nog nooit gebruikte
 * (of foutief aangemaakte) tegels kunnen wél gewoon weg — voor een tegel die
 * je liever verbergt zonder 'm te verwijderen is er `is_active`.
 */
export async function deleteR6ScoreRule(id: string): Promise<void> {
  const { error } = await supabase.from("r6_score_rules").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Deze actie is al minstens één keer gebruikt en kan niet verwijderd worden. Zet 'm op inactief in plaats daarvan.");
    }
    throw error;
  }
}

/**
 * Opties voor een keuzelijst: standaard alleen actieve rijen ("Het
 * matchformulier en toekomstige wheels tonen alleen actieve operators"),
 * maar mét de al-geselecteerde waarde(n) toegevoegd ook als die inactief
 * is — anders verdwijnt de bestaande keuze uit beeld zodra je een oude
 * match bewerkt die een inmiddels gepensioneerde map/operator/challenge
 * gebruikt.
 */
export function pickerOptions<T extends { id: string; is_active: boolean }>(
  all: T[],
  currentIds: (string | null | undefined)[],
): T[] {
  const currentSet = new Set(currentIds.filter((id): id is string => !!id));
  return all.filter((item) => item.is_active || currentSet.has(item.id));
}
