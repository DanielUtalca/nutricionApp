// ============================================================
// parse.ts — Validación de la respuesta de la IA (puro, testeable)
// ============================================================
// Nunca confiamos en el JSON del modelo tal cual: se valida con Zod,
// se acotan los números, se limpian textos y los totales se recalculan
// a partir de los alimentos (el modelo a veces suma mal).

import { z } from "zod";
import type { AIAnalysisResult, FoodEntry } from "@/types";
import { sumFoods } from "@/lib/meals";

/** Límites de cordura por alimento (una porción individual) */
export const FOOD_LIMITS = {
  calories: 3000,
  grams: 3000,
  macroG: 400,
  maxFoods: 20,
} as const;

// El modelo puede devolver números como string ("120") o null: se coercionan
const num = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? 0 : typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z.number().finite().transform((n) => Math.min(Math.max(n, 0), max)),
  );

const text = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v : v == null ? "" : String(v)), z.string())
    .transform((s) => s.replace(/\s+/g, " ").trim().slice(0, max));

const foodSchema = z.object({
  name: text(120),
  portionDescription: text(60).optional(),
  portionGrams: num(FOOD_LIMITS.grams).optional(),
  calories: num(FOOD_LIMITS.calories),
  proteinG: num(FOOD_LIMITS.macroG),
  carbsG: num(FOOD_LIMITS.macroG),
  fatG: num(FOOD_LIMITS.macroG),
});

export const analysisSchema = z.object({
  isFood: z.boolean().optional().default(true),
  title: text(120).optional(),
  foods: z.array(z.unknown()).default([]),
  confidence: z.enum(["high", "medium", "low"]).catch("medium").default("medium"),
  notes: text(300).optional(),
});

export class AIParseError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_json" | "invalid_shape" | "not_food" | "no_foods",
  ) {
    super(message);
    this.name = "AIParseError";
  }
}

/** Extrae el primer objeto JSON del texto (tolera ```json ... ``` y texto extra) */
export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* cae al error de abajo */
      }
    }
    throw new AIParseError("La IA devolvió una respuesta que no es JSON.", "invalid_json");
  }
}

/** "huevos revueltos" → "Huevos revueltos" */
function capitalize(s: string) {
  return s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1) : s;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Valida y normaliza la respuesta del modelo */
export function parseAnalysis(raw: string | unknown): AIAnalysisResult & { title?: string } {
  const data = typeof raw === "string" ? extractJson(raw) : raw;
  const parsed = analysisSchema.safeParse(data);
  if (!parsed.success) {
    throw new AIParseError("La respuesta de la IA no tiene el formato esperado.", "invalid_shape");
  }
  const result = parsed.data;

  if (result.isFood === false) {
    throw new AIParseError("No parece haber comida en la imagen.", "not_food");
  }

  // Se descartan alimentos inválidos individualmente en vez de fallar todo
  const foods: FoodEntry[] = [];
  for (const item of result.foods.slice(0, FOOD_LIMITS.maxFoods)) {
    const food = foodSchema.safeParse(item);
    if (!food.success || !food.data.name) continue;
    const f = food.data;
    const grams = f.portionGrams ? Math.round(f.portionGrams) : undefined;
    foods.push({
      name: capitalize(f.name),
      portionDescription: f.portionDescription || (grams ? `${grams} g` : "1 porción"),
      ...(grams ? { portionGrams: grams } : {}),
      calories: Math.round(f.calories),
      proteinG: round1(f.proteinG),
      carbsG: round1(f.carbsG),
      fatG: round1(f.fatG),
    });
  }

  if (foods.length === 0) {
    throw new AIParseError("La IA no identificó alimentos.", "no_foods");
  }

  const totals = sumFoods(foods);
  return {
    title: result.title ? capitalize(result.title) : undefined,
    foods,
    totalCalories: totals.calories,
    totalProteinG: totals.proteinG,
    totalCarbsG: totals.carbsG,
    totalFatG: totals.fatG,
    confidence: result.confidence,
    notes: result.notes || undefined,
  };
}
