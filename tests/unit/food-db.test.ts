import { describe, expect, it } from "vitest";
import { FOODS, foodItemToEntry, normalizeText, searchFoods } from "@/lib/food-db";
import { caloriesFromMacros } from "@/lib/nutrition";

describe("food-db", () => {
  it("los ids son únicos", () => {
    const ids = FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("las calorías son coherentes con los macros (±20 % o ±15 kcal)", () => {
    for (const food of FOODS) {
      const { calories, proteinG, carbsG, fatG } = food.per100;
      const fromMacros = caloriesFromMacros(proteinG, carbsG, fatG);
      // El alcohol (cerveza, vino) aporta 7 kcal/g que no están en los macros
      if (["Cerveza", "Vino tinto"].includes(food.name)) continue;
      const tolerance = Math.max(calories * 0.2, 15);
      expect(Math.abs(calories - fromMacros), food.name).toBeLessThanOrEqual(tolerance);
    }
  });

  it("normalizeText quita tildes y mayúsculas", () => {
    expect(normalizeText("  Plátano  MADURO ")).toBe("platano maduro");
  });

  it("busca sin tildes y por alias", () => {
    expect(searchFoods("platano")[0].name).toBe("Plátano");
    expect(searchFoods("aguacate")[0].name).toBe("Palta");
    expect(searchFoods("pan").map((f) => f.name)).toContain("Marraqueta");
  });

  it("requiere que coincidan todas las palabras", () => {
    const results = searchFoods("arroz integral");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Arroz integral cocido");
  });

  it("prioriza nombres que empiezan con la búsqueda", () => {
    expect(searchFoods("leche")[0].name.startsWith("Leche")).toBe(true);
  });

  it("consulta vacía = sin resultados", () => {
    expect(searchFoods("   ")).toEqual([]);
  });

  it("foodItemToEntry escala por gramos", () => {
    const rice = FOODS.find((f) => f.name === "Arroz blanco cocido")!;
    expect(foodItemToEntry(rice)).toMatchObject({
      portionGrams: 160,
      calories: 208,
      proteinG: 4.3,
      carbsG: 44.8,
      portionDescription: "1 taza (160 g)",
    });
    expect(foodItemToEntry(rice, 50)).toMatchObject({ calories: 65, portionDescription: "50 g" });
  });
});
