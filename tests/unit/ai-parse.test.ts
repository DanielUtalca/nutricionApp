import { describe, expect, it } from "vitest";
import { AIParseError, extractJson, parseAnalysis } from "@/lib/ai/parse";

const valid = {
  isFood: true,
  title: "Arroz con pollo",
  foods: [
    {
      name: "Arroz blanco",
      portionDescription: "1 taza",
      portionGrams: 160,
      calories: 208,
      proteinG: 4.3,
      carbsG: 44.8,
      fatG: 0.5,
    },
    {
      name: "Pechuga de pollo a la plancha",
      portionDescription: "1 filete",
      portionGrams: 150,
      calories: 248,
      proteinG: 46.5,
      carbsG: 0,
      fatG: 5.4,
    },
  ],
  confidence: "high",
};

describe("extractJson", () => {
  it("parsea JSON plano", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("tolera bloques ```json y texto alrededor", () => {
    expect(extractJson('Aquí tienes:\n```json\n{"a":1}\n```\nSaludos')).toEqual({ a: 1 });
  });

  it("falla con texto sin JSON", () => {
    expect(() => extractJson("no sé qué es esto")).toThrow(AIParseError);
  });
});

describe("parseAnalysis", () => {
  it("acepta una respuesta válida y recalcula totales", () => {
    const result = parseAnalysis(JSON.stringify({ ...valid, totalCalories: 99999 }));
    expect(result.foods).toHaveLength(2);
    expect(result.totalCalories).toBe(456);
    expect(result.totalProteinG).toBe(50.8);
    expect(result.totalCarbsG).toBe(44.8);
    expect(result.totalFatG).toBe(5.9);
    expect(result.confidence).toBe("high");
    expect(result.title).toBe("Arroz con pollo");
  });

  it("coerciona números en string y con coma decimal", () => {
    const result = parseAnalysis({
      foods: [{ name: "Palta", portionGrams: "70", calories: "112", proteinG: "1,4", carbsG: 6, fatG: "10.3" }],
    });
    expect(result.foods[0]).toMatchObject({ portionGrams: 70, calories: 112, proteinG: 1.4, fatG: 10.3 });
    expect(result.foods[0].portionDescription).toBe("70 g");
  });

  it("acota negativos a 0 y valores absurdos al máximo", () => {
    const result = parseAnalysis({
      foods: [{ name: "X", calories: -50, proteinG: 9999, carbsG: null, fatG: 1 }],
    });
    expect(result.foods[0]).toMatchObject({ calories: 0, proteinG: 400, carbsG: 0 });
  });

  it("descarta alimentos inválidos pero conserva los válidos", () => {
    const result = parseAnalysis({
      foods: [{ name: "", calories: 100 }, "basura", { name: "Manzana", calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3 }],
    });
    expect(result.foods.map((f) => f.name)).toEqual(["Manzana"]);
  });

  it("limpia espacios y recorta nombres largos", () => {
    const result = parseAnalysis({
      foods: [{ name: `  Pan   ${"x".repeat(300)}`, calories: 1, proteinG: 0, carbsG: 0, fatG: 0 }],
    });
    expect(result.foods[0].name.startsWith("Pan x")).toBe(true);
    expect(result.foods[0].name.length).toBe(120);
  });

  it("capitaliza nombres", () => {
    const result = parseAnalysis({ title: "desayuno", foods: [{ name: "huevos revueltos", calories: 1, proteinG: 0, carbsG: 0, fatG: 0 }] });
    expect(result.foods[0].name).toBe("Huevos revueltos");
    expect(result.title).toBe("Desayuno");
  });

  it("confianza desconocida se normaliza a medium", () => {
    expect(parseAnalysis({ ...valid, confidence: "very high" }).confidence).toBe("medium");
  });

  it("limita la cantidad de alimentos", () => {
    const foods = Array.from({ length: 50 }, (_, i) => ({ name: `A${i}`, calories: 1, proteinG: 0, carbsG: 0, fatG: 0 }));
    expect(parseAnalysis({ foods }).foods).toHaveLength(20);
  });

  it("rechaza imágenes sin comida", () => {
    expect(() => parseAnalysis({ isFood: false, foods: [] })).toThrow(
      expect.objectContaining({ code: "not_food" }),
    );
  });

  it("rechaza respuestas sin alimentos", () => {
    expect(() => parseAnalysis({ foods: [] })).toThrow(expect.objectContaining({ code: "no_foods" }));
  });

  it("rechaza formas inválidas", () => {
    expect(() => parseAnalysis({ foods: "arroz" })).toThrow(
      expect.objectContaining({ code: "invalid_shape" }),
    );
    expect(() => parseAnalysis("[1,2,3]")).toThrow(AIParseError);
  });
});
