import { describe, expect, it } from "vitest";
import {
  MAX_ACTIVITY_MULTIPLIER,
  SEDENTARY_MULTIPLIER,
  calculateActivityMultiplier,
  calculateBMR,
  calculateGoals,
  calculateMacros,
  calculateTDEE,
  calculateTargetCalories,
  calculateWaterTarget,
  caloriesFromMacros,
  validateBodyProfile,
  type GoalsInput,
} from "@/lib/nutrition";

// Hombre de 25 años, 75 kg, 175 cm, entrena fuerza 3 veces por semana
const referenceMan: GoalsInput = {
  sex: "male",
  age: 25,
  weightKg: 75,
  heightCm: 175,
  goal: "maintain",
  isActive: true,
  activities: [{ type: "strength", timesPerWeek: 3 }],
};

describe("calculateBMR (Mifflin-St Jeor)", () => {
  it("calcula el BMR del hombre de referencia", () => {
    // 10·75 + 6.25·175 − 5·25 + 5 = 1723.75
    expect(calculateBMR(referenceMan)).toBeCloseTo(1723.75, 5);
  });

  it("aplica la constante −161 para mujeres", () => {
    // 10·60 + 6.25·165 − 5·30 − 161 = 1320.25
    expect(calculateBMR({ sex: "female", age: 30, weightKg: 60, heightCm: 165 })).toBeCloseTo(
      1320.25,
      5,
    );
  });

  it("la diferencia hombre/mujer con mismos datos es 166 kcal", () => {
    const body = { age: 40, weightKg: 70, heightCm: 170 };
    const diff =
      calculateBMR({ ...body, sex: "male" }) - calculateBMR({ ...body, sex: "female" });
    expect(diff).toBe(166);
  });

  it.each([
    ["age", 0],
    ["heightCm", -170],
    ["weightKg", Number.NaN],
  ])("rechaza %s inválido (%s)", (key, value) => {
    expect(() => calculateBMR({ ...referenceMan, [key]: value })).toThrow(RangeError);
  });
});

describe("calculateActivityMultiplier", () => {
  it("devuelve sedentario si no hace ejercicio, aunque tenga actividades guardadas", () => {
    expect(calculateActivityMultiplier(false, [{ type: "sport", timesPerWeek: 5 }])).toBe(
      SEDENTARY_MULTIPLIER,
    );
  });

  it("devuelve sedentario si es activo pero sin actividades", () => {
    expect(calculateActivityMultiplier(true, [])).toBe(SEDENTARY_MULTIPLIER);
  });

  it("3 sesiones de fuerza ≈ ligeramente activo (1.365)", () => {
    expect(calculateActivityMultiplier(true, referenceMan.activities)).toBe(1.365);
  });

  it("suma varias actividades", () => {
    const multiplier = calculateActivityMultiplier(true, [
      { type: "strength", timesPerWeek: 3 },
      { type: "cardio", timesPerWeek: 2 },
    ]);
    expect(multiplier).toBe(1.495); // 1.2 + 0.165 + 0.13
  });

  it("no supera el máximo aunque declare muchísimas sesiones", () => {
    const multiplier = calculateActivityMultiplier(true, [
      { type: "sport", timesPerWeek: 14 },
      { type: "cardio", timesPerWeek: 14 },
    ]);
    expect(multiplier).toBe(MAX_ACTIVITY_MULTIPLIER);
  });

  it("ignora sesiones negativas o no numéricas", () => {
    expect(
      calculateActivityMultiplier(true, [
        { type: "strength", timesPerWeek: -3 },
        { type: "cardio", timesPerWeek: Number.NaN },
      ]),
    ).toBe(SEDENTARY_MULTIPLIER);
  });
});

describe("calculateTDEE", () => {
  it("multiplica BMR por el factor de actividad", () => {
    expect(calculateTDEE(1723.75, 1.365)).toBeCloseTo(2352.91875, 5);
  });

  it("rechaza valores no positivos", () => {
    expect(() => calculateTDEE(0, 1.2)).toThrow(RangeError);
    expect(() => calculateTDEE(1500, 0)).toThrow(RangeError);
  });
});

describe("calculateTargetCalories", () => {
  it("aplica −20 % para bajar grasa", () => {
    expect(calculateTargetCalories(2500, 1600, "lose_fat")).toBe(2000);
  });

  it("aplica +10 % para ganar músculo", () => {
    expect(calculateTargetCalories(2500, 1600, "gain_muscle")).toBe(2750);
  });

  it("piso: nunca baja del BMR", () => {
    // 1800 × 0.8 = 1440 < BMR 1700 → se queda en 1700
    expect(calculateTargetCalories(1800, 1700, "lose_fat")).toBe(1700);
  });

  it("piso exacto: si el déficit iguala el BMR se respeta", () => {
    expect(calculateTargetCalories(2000, 1600, "lose_fat")).toBe(1600);
  });
});

describe("calculateMacros", () => {
  it("proteína por kg, grasa 25 % y carbos con el resto", () => {
    const macros = calculateMacros(2353, 75, "maintain");
    expect(macros).toEqual({ proteinG: 120, fatG: 65, carbsG: 322 });
  });

  it("los macros suman aproximadamente las calorías objetivo", () => {
    const { proteinG, carbsG, fatG } = calculateMacros(2353, 75, "maintain");
    expect(Math.abs(caloriesFromMacros(proteinG, carbsG, fatG) - 2353)).toBeLessThanOrEqual(6);
  });

  it("respeta la grasa mínima por kg cuando las calorías son bajas", () => {
    // 1200 × 0.25 / 9 = 33 g < 0.6 × 100 = 60 g
    expect(calculateMacros(1200, 100, "lose_fat").fatG).toBe(60);
  });

  it("los carbos nunca son negativos", () => {
    // 2 g/kg × 150 kg = 300 g proteína = 1200 kcal + grasa mínima 90 g = 810 kcal > 1500
    expect(calculateMacros(1500, 150, "lose_fat").carbsG).toBe(0);
  });
});

describe("calculateWaterTarget", () => {
  it("35 ml/kg redondeado a 0.25 L", () => {
    expect(calculateWaterTarget(75)).toBe(2.75); // 2.625 → 2.75
    expect(calculateWaterTarget(60)).toBe(2); // 2.1 → 2
  });

  it("se mantiene entre 1.5 y 4 L", () => {
    expect(calculateWaterTarget(35)).toBe(1.5);
    expect(calculateWaterTarget(200)).toBe(4);
  });
});

describe("calculateGoals", () => {
  it("hombre 25 años, 75 kg, 175 cm, fuerza 3×/semana, mantener", () => {
    expect(calculateGoals(referenceMan)).toEqual({
      bmr: 1724,
      activityMultiplier: 1.365,
      tdee: 2353,
      calories: 2353,
      proteinG: 120,
      carbsG: 322,
      fatG: 65,
      waterL: 2.75,
    });
  });

  it("mismo hombre, bajar grasa → −20 % y más proteína", () => {
    const goals = calculateGoals({ ...referenceMan, goal: "lose_fat" });
    expect(goals.calories).toBe(1882);
    expect(goals.proteinG).toBe(150);
    expect(goals.fatG).toBe(52);
    expect(goals.carbsG).toBe(204);
  });

  it("mismo hombre, ganar músculo → +10 %", () => {
    const goals = calculateGoals({ ...referenceMan, goal: "gain_muscle" });
    expect(goals.calories).toBe(2588);
    expect(goals.proteinG).toBe(135);
  });

  it("caso límite: sedentario bajando grasa queda en el piso = BMR", () => {
    const goals = calculateGoals({ ...referenceMan, goal: "lose_fat", isActive: false });
    // TDEE 2068.5 × 0.8 = 1654.8 < BMR 1723.75
    expect(goals.tdee).toBe(2069);
    expect(goals.calories).toBe(goals.bmr);
    expect(goals.calories).toBe(1724);
  });

  it("caso límite: persona mayor y liviana también respeta el piso", () => {
    const goals = calculateGoals({
      sex: "female",
      age: 80,
      weightKg: 45,
      heightCm: 150,
      goal: "lose_fat",
      isActive: false,
      activities: [],
    });
    expect(goals.calories).toBe(goals.bmr);
    expect(goals.carbsG).toBeGreaterThanOrEqual(0);
  });
});

describe("validateBodyProfile", () => {
  it("acepta un perfil válido", () => {
    expect(validateBodyProfile(referenceMan)).toEqual({});
  });

  it("reporta campos faltantes y fuera de rango", () => {
    const errors = validateBodyProfile({ age: 5, heightCm: 300 });
    expect(Object.keys(errors).sort()).toEqual(["age", "heightCm", "sex", "weightKg"]);
  });

  it("acepta los límites exactos", () => {
    expect(
      validateBodyProfile({ sex: "female", age: 14, heightCm: 230, weightKg: 30 }),
    ).toEqual({});
  });
});
