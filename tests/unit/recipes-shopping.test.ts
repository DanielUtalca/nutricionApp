import { describe, expect, it } from "vitest";
import { SUGGESTED_RECIPES, computeRecipeTotals, recipeToFoodEntry } from "@/lib/recipes";
import { buildShoppingList, formatGramsAmount } from "@/lib/shopping";
import type { FoodEntry, MealPlanItem } from "@/types";

const food = (name: string, grams: number | undefined, calories: number, desc = `${grams} g`): FoodEntry => ({
  name,
  portionDescription: desc,
  ...(grams ? { portionGrams: grams } : {}),
  calories,
  proteinG: 10,
  carbsG: 10,
  fatG: 2,
});

describe("computeRecipeTotals", () => {
  it("calcula totales y por porción", () => {
    const totals = computeRecipeTotals([food("Arroz", 320, 416), food("Pollo", 300, 495)], 2);
    expect(totals).toMatchObject({
      totalCalories: 911,
      caloriesPerServing: 456,
      totalProteinG: 20,
      proteinGPerServing: 10,
    });
  });

  it("porciones inválidas se tratan como 1", () => {
    expect(computeRecipeTotals([food("A", 100, 100)], 0).caloriesPerServing).toBe(100);
  });
});

describe("recipeToFoodEntry", () => {
  it("escala por porciones consumidas", () => {
    const entry = recipeToFoodEntry(
      { name: "Lentejas", caloriesPerServing: 300, proteinGPerServing: 15, carbsGPerServing: 45, fatGPerServing: 5 },
      1.5,
    );
    expect(entry).toMatchObject({ name: "Lentejas", calories: 450, proteinG: 22.5, portionDescription: "1,5 porciones" });
  });
});

describe("SUGGESTED_RECIPES", () => {
  it("todas tienen ingredientes válidos y calorías razonables por porción", () => {
    for (const r of SUGGESTED_RECIPES) {
      const t = computeRecipeTotals(r.ingredients, r.servings);
      expect(t.caloriesPerServing, r.name).toBeGreaterThan(150);
      expect(t.caloriesPerServing, r.name).toBeLessThan(900);
    }
  });
});

describe("buildShoppingList", () => {
  const recipes = new Map([
    ["r1", { name: "Pollo con arroz", servings: 2, ingredients: [food("Arroz blanco cocido", 320, 416), food("Pechuga de pollo cocida", 300, 495)] }],
    ["r2", { name: "Arroz con huevo", servings: 1, ingredients: [food("Arroz blanco cocido", 160, 208), food("Huevo", undefined, 72, "1 unidad")] }],
  ]);
  const item = (recipeId: string, servings: number): MealPlanItem => ({
    id: `${recipeId}-${servings}`,
    mealType: "lunch",
    recipeId,
    recipeName: "",
    servings,
    caloriesPerServing: 0,
    proteinGPerServing: 0,
    carbsGPerServing: 0,
    fatGPerServing: 0,
  });

  it("suma ingredientes iguales entre recetas y días, escalados por porciones", () => {
    const list = buildShoppingList(
      [{ items: [item("r1", 2)] }, { items: [item("r1", 1), item("r2", 2)] }],
      recipes,
    );
    const rice = list.find((i) => i.name === "Arroz blanco cocido")!;
    // r1: 320 g × (2/2) + 320 × (1/2) = 480; r2: 160 × 2 = 320 → 800 g
    expect(rice.grams).toBe(800);
    expect(rice.recipes).toEqual(["Pollo con arroz", "Arroz con huevo"]);
    expect(list.find((i) => i.name === "Pechuga de pollo cocida")!.grams).toBe(450);
  });

  it("conserva cantidades sin gramos", () => {
    const list = buildShoppingList([{ items: [item("r2", 2)] }], recipes);
    expect(list.find((i) => i.name === "Huevo")!.otherQuantities).toEqual(["1 unidad × 2"]);
  });

  it("agrupa por categoría (verduras/proteínas antes que cereales)", () => {
    const list = buildShoppingList([{ items: [item("r1", 2)] }], recipes);
    expect(list.map((i) => i.category)).toEqual(["Proteínas", "Cereales y tubérculos"]);
  });

  it("ignora recetas borradas y planes vacíos", () => {
    expect(buildShoppingList([{ items: [item("borrada", 1)] }, { items: [] }], recipes)).toEqual([]);
  });

  it("formatGramsAmount", () => {
    expect(formatGramsAmount(350)).toBe("350 g");
    expect(formatGramsAmount(1240)).toBe("1,2 kg");
  });
});
