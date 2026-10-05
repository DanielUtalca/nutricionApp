// ============================================================
// shopping.ts — Lista de compras generada desde el plan semanal
// ============================================================
// Suma los ingredientes de las recetas planificadas, escalados por las
// porciones planificadas, y los agrupa por nombre y categoría.

import type { FoodEntry, MealPlanDay, Recipe } from "@/types";
import { FOODS, normalizeText, type FoodCategory } from "@/lib/food-db";

export interface ShoppingItem {
  key: string;
  name: string;
  category: FoodCategory | "Otros";
  /** Gramos totales (si todos los aportes tienen gramos) */
  grams?: number;
  /** Cantidades sin gramos conocidos (ej. "1 lata") */
  otherQuantities: string[];
  recipes: string[];
}

const CATEGORY_ORDER: (FoodCategory | "Otros")[] = [
  "Verduras",
  "Frutas",
  "Proteínas",
  "Lácteos",
  "Cereales y tubérculos",
  "Legumbres",
  "Grasas y frutos secos",
  "Snacks y dulces",
  "Bebidas",
  "Preparaciones",
  "Otros",
];

const CATEGORY_BY_NAME = new Map(FOODS.map((f) => [normalizeText(f.name), f.category]));

export function itemKey(name: string): string {
  return normalizeText(name);
}

export function buildShoppingList(
  days: Pick<MealPlanDay, "items">[],
  recipesById: Map<string, Pick<Recipe, "name" | "servings" | "ingredients">>,
): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();

  const add = (ingredient: FoodEntry, factor: number, recipeName: string) => {
    const key = itemKey(ingredient.name);
    if (!key) return;
    let item = map.get(key);
    if (!item) {
      item = {
        key,
        name: ingredient.name,
        category: CATEGORY_BY_NAME.get(key) ?? "Otros",
        otherQuantities: [],
        recipes: [],
      };
      map.set(key, item);
    }
    if (ingredient.portionGrams) {
      item.grams = (item.grams ?? 0) + ingredient.portionGrams * factor;
    } else if (ingredient.portionDescription) {
      const times = factor === 1 ? "" : ` × ${Math.round(factor * 100) / 100}`;
      item.otherQuantities.push(`${ingredient.portionDescription}${times}`);
    }
    if (!item.recipes.includes(recipeName)) item.recipes.push(recipeName);
  };

  for (const day of days) {
    for (const planItem of day.items ?? []) {
      const recipe = recipesById.get(planItem.recipeId);
      if (!recipe) continue; // receta borrada
      const factor = planItem.servings / (recipe.servings || 1);
      for (const ingredient of recipe.ingredients) add(ingredient, factor, recipe.name);
    }
  }

  return [...map.values()]
    .map((item) => (item.grams !== undefined ? { ...item, grams: Math.ceil(item.grams) } : item))
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name, "es"),
    );
}

/** "1,2 kg" / "350 g" */
export function formatGramsAmount(grams: number): string {
  if (grams >= 1000) return `${(Math.round(grams / 100) / 10).toLocaleString("es-CL")} kg`;
  return `${Math.round(grams)} g`;
}
