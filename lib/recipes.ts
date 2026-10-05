// ============================================================
// recipes.ts — Totales de recetas, sugerencias y conversión a comida
// ============================================================

import type { FoodEntry, Recipe } from "@/types";
import { sumFoods, type MacroTotals } from "@/lib/meals";
import { FOODS, foodItemToEntry } from "@/lib/food-db";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Totales de la receta completa y por porción */
export function computeRecipeTotals(ingredients: FoodEntry[], servings: number) {
  const total = sumFoods(ingredients);
  const s = Number.isFinite(servings) && servings > 0 ? servings : 1;
  return {
    totalCalories: total.calories,
    totalProteinG: total.proteinG,
    totalCarbsG: total.carbsG,
    totalFatG: total.fatG,
    caloriesPerServing: Math.round(total.calories / s),
    proteinGPerServing: round1(total.proteinG / s),
    carbsGPerServing: round1(total.carbsG / s),
    fatGPerServing: round1(total.fatG / s),
  };
}

export function perServing(recipe: Pick<Recipe, "caloriesPerServing" | "proteinGPerServing" | "carbsGPerServing" | "fatGPerServing">, servings = 1): MacroTotals {
  return {
    calories: Math.round(recipe.caloriesPerServing * servings),
    proteinG: round1(recipe.proteinGPerServing * servings),
    carbsG: round1(recipe.carbsGPerServing * servings),
    fatG: round1(recipe.fatGPerServing * servings),
  };
}

/** Una receta comida como un único alimento ("Lentejas — 1,5 porciones") */
export function recipeToFoodEntry(recipe: Pick<Recipe, "name" | "caloriesPerServing" | "proteinGPerServing" | "carbsGPerServing" | "fatGPerServing">, servings: number): FoodEntry {
  const t = perServing(recipe, servings);
  return {
    name: recipe.name,
    portionDescription: `${servings.toLocaleString("es-CL")} ${servings === 1 ? "porción" : "porciones"}`,
    calories: t.calories,
    proteinG: t.proteinG,
    carbsG: t.carbsG,
    fatG: t.fatG,
  };
}

// ----- Recetas sugeridas ------------------------------------------------------
// Construidas desde la base de alimentos para que los valores sean coherentes.

export interface SuggestedRecipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  tags: string[];
  ingredients: FoodEntry[];
}

function ing(name: string, grams: number): FoodEntry {
  const food = FOODS.find((f) => f.name === name);
  if (!food) throw new Error(`Ingrediente sugerido inexistente: ${name}`);
  return foodItemToEntry(food, grams);
}

export const SUGGESTED_RECIPES: SuggestedRecipe[] = [
  {
    id: "avena-platano",
    name: "Avena con plátano y maní",
    description: "Cocina la avena en la leche, agrega el plátano en rodajas y la mantequilla de maní.",
    servings: 1,
    tags: ["desayuno"],
    ingredients: [ing("Avena", 50), ing("Leche semidescremada", 240), ing("Plátano", 120), ing("Mantequilla de maní", 16)],
  },
  {
    id: "pollo-arroz-brocoli",
    name: "Pollo con arroz y brócoli",
    description: "Pechuga a la plancha con arroz blanco y brócoli al vapor, aliñado con aceite de oliva.",
    servings: 2,
    tags: ["almuerzo", "alto en proteína"],
    ingredients: [
      ing("Pechuga de pollo cocida", 300),
      ing("Arroz blanco cocido", 320),
      ing("Brócoli cocido", 300),
      ing("Aceite de oliva", 13),
    ],
  },
  {
    id: "ensalada-atun",
    name: "Ensalada de atún",
    description: "Lechuga, tomate, pepino y palta con atún en agua y un chorrito de aceite de oliva.",
    servings: 1,
    tags: ["cena", "liviano"],
    ingredients: [
      ing("Atún en agua", 120),
      ing("Lechuga", 100),
      ing("Tomate", 120),
      ing("Pepino", 100),
      ing("Palta", 70),
      ing("Aceite de oliva", 7),
    ],
  },
  {
    id: "lentejas-arroz",
    name: "Lentejas con arroz",
    description: "Lentejas guisadas con zanahoria y cebolla, servidas con arroz.",
    servings: 4,
    tags: ["almuerzo", "vegetariano"],
    ingredients: [
      ing("Lentejas cocidas", 800),
      ing("Arroz blanco cocido", 480),
      ing("Zanahoria", 120),
      ing("Cebolla", 100),
      ing("Aceite vegetal", 13),
    ],
  },
  {
    id: "salmon-papas",
    name: "Salmón con papas y ensalada",
    description: "Salmón al horno con papas cocidas y ensalada chilena.",
    servings: 2,
    tags: ["cena", "omega 3"],
    ingredients: [ing("Salmón", 300), ing("Papa cocida", 300), ing("Ensalada chilena", 300)],
  },
  {
    id: "yogur-granola",
    name: "Yogur griego con frutos rojos",
    description: "Yogur griego natural con arándanos, frutillas y un poco de granola.",
    servings: 1,
    tags: ["snack", "desayuno"],
    ingredients: [ing("Yogur griego natural", 150), ing("Arándanos", 75), ing("Frutillas", 75), ing("Granola", 25)],
  },
];
