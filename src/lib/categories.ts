const CATEGORIES_KEY = "product_categories";
const ASSIGNMENTS_KEY = "product_category_assignments";

export type Category = { id: string; name: string };

const DEFAULT_CATEGORIES: Category[] = [
  { id: "groente-fruit", name: "Groente & Fruit" },
  { id: "vlees-vis", name: "Vlees & Vis" },
  { id: "zuivel", name: "Zuivel & Eieren" },
  { id: "brood", name: "Brood & Bakkerij" },
  { id: "dranken", name: "Dranken" },
  { id: "diepvries", name: "Diepvries" },
  { id: "huishouden", name: "Huishouden" },
  { id: "overig", name: "Overig" },
];

export function getCategories(): Category[] {
  try {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_CATEGORIES;
}

export function saveCategories(cats: Category[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

export function getAssignments(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function assignCategory(product: string, categoryId: string | null) {
  const assignments = getAssignments();
  if (categoryId === null) {
    delete assignments[product.toLowerCase()];
  } else {
    assignments[product.toLowerCase()] = categoryId;
  }
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
}

export function getCategoryForProduct(product: string): string | null {
  const assignments = getAssignments();
  return assignments[product.toLowerCase()] ?? null;
}
