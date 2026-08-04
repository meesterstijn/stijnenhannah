import { supabase } from "@/lib/supabase";
import type { CocktailVariantIngredientWithName } from "@/features/cocktail-bar/types";

// Cocktail Bar -> Boodschappen-integratie. Raakt src/lib/history.ts /
// parseItem() bewust NIET aan (dat blijft de bestaande "<qty>x <naam>"-
// notatie voor Boodschappen/Weekmenu) — dit is een eigen, feature-lokaal
// formaat: "<hoeveelheid><eenheid> <naam>", bv. "100ml Vodka" (GEEN spatie
// tussen getal en eenheid). Dat is bewust: Boodschappen.tsx rendert élke
// regel via parseItem() en toont het resultaat met een generieke +/1-
// stapteller (ItemRow, ongeacht wat voor regel het is). Met een spatie
// ("100 ml Vodka") herkent diens prefix-regex "100" als een los, telbaar
// aantal en wordt "ml Vodka" de weergegeven naam — de hoeveelheid verdwijnt
// dan uit beeld achter een onzinnige "100"-teller. Zonder spatie matcht
// parseItem() niets (geen \s+ direct na het getal) en valt terug op
// qty=1/naam=hele string, dus de regel blijft gewoon leesbare platte tekst.
// Alleen bestaande regels die ZELF exact dit patroon volgen komen in
// aanmerking om mee samengevoegd te worden; een handmatig getypte regel als
// "2x limoen" wordt nooit geherinterpreteerd of overschreven.
const COCKTAIL_LINE_PATTERN = /^([\d.,]+)(\S+)\s+(.+)$/;

function formatCocktailGroceryLine(amount: number, unit: string, name: string): string {
  const amountLabel = Number.isInteger(amount) ? String(amount) : amount.toFixed(1).replace(".", ",");
  return `${amountLabel}${unit} ${name}`;
}

function parseCocktailGroceryLine(text: string): { amount: number; unit: string; name: string } | null {
  const match = text.trim().match(COCKTAIL_LINE_PATTERN);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  return { amount, unit: match[2], name: match[3].trim() };
}

/**
 * Voegt de ingrediënten van één cocktailvariant, vermenigvuldigd met
 * `cocktailCount`, toe aan de bestaande `groceries`-lijst. Samenvoegen
 * gebeurt alleen bij exact dezelfde ingrediëntnaam ÉN eenheid in een
 * bestaande, nog niet afgevinkte regel (bevestigde keuze — geen eenheid-
 * conversie); bij een andere eenheid of geen match komt er een nieuwe,
 * losse regel bij. Geen aparte boodschappenlijst-tabel — hergebruikt
 * dezelfde `groceries`-tabel/architectuur als Boodschappen/Weekmenu.
 */
export async function addCocktailIngredientsToGroceryList(
  ingredients: CocktailVariantIngredientWithName[],
  cocktailCount: number,
): Promise<void> {
  if (cocktailCount <= 0 || ingredients.length === 0) return;

  const { data: existingRows, error: fetchError } = await supabase.from("groceries").select("id, text").eq("done", false);
  if (fetchError) throw fetchError;

  // Ingrediënten met dezelfde naam+eenheid binnen déze aanroep eerst zelf
  // samenvoegen, zodat er niet twee keer naar dezelfde bestaande regel wordt
  // geschreven voor wat feitelijk één regel is.
  const grouped = new Map<string, { amount: number; unit: string; name: string }>();
  for (const ingredient of ingredients) {
    const totalAmount = ingredient.amount * cocktailCount;
    const key = `${ingredient.ingredient_name.toLowerCase()}::${ingredient.unit.toLowerCase()}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.amount += totalAmount;
    } else {
      grouped.set(key, { amount: totalAmount, unit: ingredient.unit, name: ingredient.ingredient_name });
    }
  }

  const parsedExisting = (existingRows ?? []).map((row) => ({ row, parsed: parseCocktailGroceryLine(row.text) }));
  const updates: { id: string; text: string }[] = [];
  const inserts: { text: string; done: boolean }[] = [];

  for (const { amount, unit, name } of grouped.values()) {
    const match = parsedExisting.find(
      ({ parsed }) => parsed && parsed.name.toLowerCase() === name.toLowerCase() && parsed.unit.toLowerCase() === unit.toLowerCase(),
    );
    if (match?.parsed) {
      updates.push({ id: match.row.id, text: formatCocktailGroceryLine(match.parsed.amount + amount, unit, name) });
    } else {
      inserts.push({ text: formatCocktailGroceryLine(amount, unit, name), done: false });
    }
  }

  for (const update of updates) {
    const { error } = await supabase.from("groceries").update({ text: update.text }).eq("id", update.id);
    if (error) throw error;
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("groceries").insert(inserts);
    if (error) throw error;
  }
}
