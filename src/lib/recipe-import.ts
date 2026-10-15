export type ImportedRecipe = {
  title: string;
  time: string;
  servings: string;
  ingredients: string;
  steps: string;
  category: string;
};

function plain(line: string): string {
  return line.trim().replace(/^#{1,6}\s+/, "").replace(/\*\*|__/g, "").trim();
}

/** Recognize common recipe sections without inventing missing information. */
export function parseRecipe(text: string): ImportedRecipe {
  const recipe: ImportedRecipe = { title: "", time: "", servings: "", ingredients: "", steps: "", category: "Gerechten" };
  const ingredients: string[] = [];
  const steps: string[] = [];
  const unassigned: string[] = [];
  let section: "ingredients" | "steps" | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = plain(raw);
    if (!line || /^```|^~~~|^[-*_]{3,}$/.test(line)) continue;
    const heading = line.replace(/^[-*•]\s+/, "").replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "");
    const ingredientHeading = heading.match(/^(?:ingrediënten|ingredienten|ingredients|benodigdheden)(?:\s*\([^)]*\))?\s*:?\s*$/i);
    const stepsHeading = /^(?:bereiding(?:swijze)?|bereidingsstappen|instructies|stappen(?:plan)?|instructions|directions|method)\s*:?\s*$/i.test(heading);
    if (ingredientHeading || stepsHeading) {
      section = ingredientHeading ? "ingredients" : "steps";
      continue;
    }
    const time = heading.match(/^(?:totale?\s+)?(?:bereidingstijd|tijd|total time|time|duur)\s*:\s*(.+)$/i);
    const servings = heading.match(/^(?:personen|porties|aantal personen|servings|voor)\s*:\s*(\d+)(?:\s*(?:personen|porties|people))?\s*$/i)
      ?? heading.match(/^(?:voor\s+)?(\d+)\s*(?:personen|porties|servings)\s*$/i);
    const category = heading.match(/^categorie\s*:\s*(brood|gebak|gerechten|saus)\s*$/i);
    if (time) { recipe.time = time[1]; continue; }
    if (servings) { recipe.servings = servings[1]; continue; }
    if (category) { recipe.category = category[1][0].toUpperCase() + category[1].slice(1).toLowerCase(); continue; }
    if (!section && /^#{1,2}\s+/.test(raw.trim())) {
      if (recipe.title) unassigned.push(recipe.title);
      recipe.title = line;
      continue;
    }
    if (section === "ingredients") {
      ingredients.push(line.replace(/^[-*•]\s+/, ""));
    } else if (section === "steps") {
      steps.push(line);
    } else if (!recipe.title) {
      recipe.title = line.replace(/^(?:recept|titel)\s*:\s*/i, "");
    } else {
      unassigned.push(line);
    }
  }
  recipe.ingredients = ingredients.join("\n");
  // Keep unrecognized text visible for manual correction rather than discarding it.
  recipe.steps = [...unassigned, ...steps].join("\n");
  return recipe;
}

export function recipeServings(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const count = Number(value);
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(count) || count < 1 || count > 2147483647) {
    throw new Error("Vul bij personen een positief geheel getal in, bijvoorbeeld 2.");
  }
  return count;
}
