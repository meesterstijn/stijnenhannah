export type Ingredient = { name: string; amount: string };

export function ingredientsToText(list: Ingredient[]): string {
  return list
    .filter((i) => i.name.trim())
    .map((i) =>
      i.amount.trim() ? `${i.amount.trim()}\t${i.name.trim()}` : i.name.trim(),
    )
    .join("\n");
}

export function textToIngredients(text: string): Ingredient[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.replace(/^[-•*●▪◦]\s*/, "");
      const tab = cleaned.indexOf("\t");
      if (tab !== -1)
        return {
          amount: cleaned.slice(0, tab).trim(),
          name: cleaned.slice(tab + 1).trim(),
        };
      const measured = cleaned.match(/^((?:\d+(?:[.,]\d+)?(?:\s+\d+\/\d+|\/\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:kg|mg|g|gram|kilogram|ml|cl|dl|l|liter|el|tl|eetlepels?|theelepels?|cups?|stuks?)\.?)(?:\s+)(.+)$/i);
      if (measured) return { amount: measured[1].trim(), name: measured[2].trim() };
      const m = cleaned.match(/^((?:[0-9][^\s]*|[¼½¾⅓⅔⅛⅜⅝⅞])\s+)?(.+)$/);
      if (m && m[1]) return { amount: m[1].trim(), name: m[2].trim() };
      return { amount: "", name: cleaned };
    });
}

export function ingredientDisplayLine(line: string): string {
  const tab = line.indexOf("\t");
  return tab !== -1 ? `${line.slice(0, tab)} ${line.slice(tab + 1)}` : line;
}
