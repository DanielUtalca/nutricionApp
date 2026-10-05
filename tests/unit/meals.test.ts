import { describe, expect, it } from "vitest";
import {
  groupMealsByType,
  mealTotalsFields,
  progress,
  scaleFood,
  suggestMealType,
  sumFoods,
  sumMeals,
} from "@/lib/meals";
import type { FoodEntry } from "@/types";

const rice: FoodEntry = {
  name: "Arroz blanco",
  portionDescription: "200 g",
  portionGrams: 200,
  calories: 260,
  proteinG: 5.4,
  carbsG: 56.4,
  fatG: 0.6,
};
const chicken: FoodEntry = {
  name: "Pechuga de pollo",
  portionDescription: "150 g",
  portionGrams: 150,
  calories: 248,
  proteinG: 46.5,
  carbsG: 0,
  fatG: 5.4,
};

describe("sumFoods", () => {
  it("suma calorías y macros", () => {
    expect(sumFoods([rice, chicken])).toEqual({
      calories: 508,
      proteinG: 51.9,
      carbsG: 56.4,
      fatG: 6,
    });
  });

  it("lista vacía = ceros", () => {
    expect(sumFoods([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("evita errores de coma flotante", () => {
    const tiny = { ...rice, proteinG: 0.1, carbsG: 0.2, fatG: 0.7 };
    expect(sumFoods([tiny, tiny, tiny]).proteinG).toBe(0.3);
  });
});

describe("sumMeals / mealTotalsFields", () => {
  it("suma totales guardados de comidas", () => {
    const meal = mealTotalsFields([rice, chicken]);
    expect(sumMeals([meal, meal])).toEqual({ calories: 1016, proteinG: 103.8, carbsG: 112.8, fatG: 12 });
  });
});

describe("scaleFood", () => {
  it("escala porción y macros", () => {
    expect(scaleFood(rice, 0.75)).toMatchObject({
      portionGrams: 150,
      calories: 195,
      proteinG: 4.1,
      carbsG: 42.3,
      fatG: 0.5,
    });
  });

  it("ignora factores inválidos", () => {
    expect(scaleFood(rice, 0)).toMatchObject({ calories: 260 });
    expect(scaleFood(rice, Number.NaN)).toMatchObject({ calories: 260 });
  });
});

describe("groupMealsByType", () => {
  it("agrupa y conserva el orden", () => {
    const groups = groupMealsByType([
      { id: "a", type: "lunch" as const },
      { id: "b", type: "breakfast" as const },
      { id: "c", type: "lunch" as const },
    ]);
    expect(groups.lunch.map((m) => m.id)).toEqual(["a", "c"]);
    expect(groups.breakfast).toHaveLength(1);
    expect(groups.dinner).toEqual([]);
  });
});

describe("suggestMealType", () => {
  it.each([
    [8, "breakfast"],
    [13, "lunch"],
    [17, "snack"],
    [21, "dinner"],
    [2, "snack"],
  ])("a las %i h sugiere %s", (hour, type) => {
    expect(suggestMealType(new Date(2026, 9, 4, hour))).toBe(type);
  });
});

describe("progress", () => {
  it("calcula proporción y tolera meta 0", () => {
    expect(progress(500, 2000)).toBe(0.25);
    expect(progress(2500, 2000)).toBe(1.25);
    expect(progress(100, 0)).toBe(0);
  });
});
