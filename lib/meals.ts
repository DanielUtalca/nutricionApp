// ============================================================
// meals.ts — Lógica pura de comidas (totales, agrupación, porciones)
// ============================================================

import type { FoodEntry, Meal, MealType } from "@/types";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABELS: Record<MealType, { title: string; emoji: string }> = {
  breakfast: { title: "Desayuno", emoji: "☕" },
  lunch: { title: "Almuerzo", emoji: "🍽️" },
  dinner: { title: "Cena", emoji: "🌙" },
  snack: { title: "Snacks", emoji: "🍎" },
};

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (MEAL_TYPES as string[]).includes(value);
}

/** Tipo de comida sugerido según la hora local */
export function suggestMealType(date: Date = new Date()): MealType {
  const h = date.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 19 && h < 23) return "dinner";
  return "snack";
}

export interface MacroTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const ZERO_TOTALS: MacroTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Suma alimentos (calorías enteras, macros con 1 decimal) */
export function sumFoods(foods: FoodEntry[]): MacroTotals {
  const t = foods.reduce(
    (acc, f) => ({
      calories: acc.calories + (f.calories || 0),
      proteinG: acc.proteinG + (f.proteinG || 0),
      carbsG: acc.carbsG + (f.carbsG || 0),
      fatG: acc.fatG + (f.fatG || 0),
    }),
    ZERO_TOTALS,
  );
  return {
    calories: Math.round(t.calories),
    proteinG: round1(t.proteinG),
    carbsG: round1(t.carbsG),
    fatG: round1(t.fatG),
  };
}

/** Suma los totales guardados de varias comidas */
export function sumMeals(meals: Pick<Meal, "totalCalories" | "totalProteinG" | "totalCarbsG" | "totalFatG">[]): MacroTotals {
  return sumFoods(
    meals.map((m) => ({
      name: "",
      portionDescription: "",
      calories: m.totalCalories,
      proteinG: m.totalProteinG,
      carbsG: m.totalCarbsG,
      fatG: m.totalFatG,
    })),
  );
}

/** Agrupa comidas por tipo, conservando el orden de registro */
export function groupMealsByType<T extends Pick<Meal, "type">>(meals: T[]): Record<MealType, T[]> {
  const groups: Record<MealType, T[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const meal of meals) {
    (groups[meal.type] ?? groups.snack).push(meal);
  }
  return groups;
}

/**
 * Escala un alimento a una nueva porción. `factor` = nueva/porción original.
 * Ej: la IA estimó 200 g de arroz y el usuario corrige a 150 g → factor 0.75.
 */
export function scaleFood(food: FoodEntry, factor: number): FoodEntry {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return {
    ...food,
    portionGrams: food.portionGrams ? Math.round(food.portionGrams * f) : undefined,
    calories: Math.round(food.calories * f),
    proteinG: round1(food.proteinG * f),
    carbsG: round1(food.carbsG * f),
    fatG: round1(food.fatG * f),
  };
}

/** Campos de totales de una comida a partir de sus alimentos */
export function mealTotalsFields(foods: FoodEntry[]) {
  const t = sumFoods(foods);
  return {
    totalCalories: t.calories,
    totalProteinG: t.proteinG,
    totalCarbsG: t.carbsG,
    totalFatG: t.fatG,
  };
}

/** Progreso 0..1+ (puede pasar de 1 si se excede la meta) */
export function progress(consumed: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(consumed / target, 0);
}
