// ============================================================
// nutrition.ts — Cálculo de BMR, TDEE y metas diarias
// ============================================================
// Funciones puras (sin Firebase ni React) para poder testearlas y
// reutilizarlas en onboarding, perfil y route handlers.
//
// - BMR: ecuación de Mifflin-St Jeor
// - TDEE: BMR × multiplicador de actividad. El multiplicador parte de
//   sedentario (1.2) y suma un incremento por cada sesión semanal según el
//   tipo de ejercicio declarado, en vez del genérico "poco/muy activo".
// - Metas: déficit/superávit según objetivo, nunca por debajo del BMR.
// - Macros: proteína por kg de peso, grasa como % de calorías, carbos = resto.

import type { ActivityEntry, ActivityType, Goal, Sex } from "@/types";

// ----- Constantes ------------------------------------------------------------

/** Multiplicador base para una persona sin ejercicio planificado */
export const SEDENTARY_MULTIPLIER = 1.2;

/** Tope del multiplicador (atleta con doble sesión diaria) */
export const MAX_ACTIVITY_MULTIPLIER = 1.9;

/** Máximo de sesiones por semana que se consideran por tipo de actividad */
export const MAX_SESSIONS_PER_WEEK = 14;

/**
 * Incremento del multiplicador por cada sesión semanal (~45-60 min).
 * Calibrado para que 3 sesiones/semana ≈ "ligeramente activo" (1.375) y
 * 5-6 sesiones de deporte/cardio ≈ "moderado/muy activo" (1.55-1.6).
 */
export const SESSION_INCREMENT: Record<ActivityType, number> = {
  strength: 0.055, // gym/fuerza: gasto alto en la sesión, poco cardio
  sport: 0.065, // fútbol, básquet, tenis, pádel…
  cardio: 0.065, // trote, bici, natación
  other: 0.045, // yoga, pilates, caminatas largas
};

/** Ajuste calórico sobre el TDEE según objetivo */
export const GOAL_CALORIE_FACTOR: Record<Goal, number> = {
  lose_fat: 0.8, // −20 %
  maintain: 1,
  gain_muscle: 1.1, // +10 %
};

/** Proteína diaria en gramos por kg de peso corporal */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose_fat: 2.0, // más alta para preservar masa magra en déficit
  maintain: 1.6,
  gain_muscle: 1.8,
};

/** Fracción de las calorías que va a grasa */
export const FAT_CALORIE_SHARE = 0.25;

/** Mínimo de grasa (g/kg) para no bajar de un nivel saludable */
export const MIN_FAT_G_PER_KG = 0.6;

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Límites razonables de entrada (también usados en formularios) */
export const PROFILE_LIMITS = {
  age: { min: 14, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
} as const;

// ----- Tipos -----------------------------------------------------------------

export interface BodyProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}

export interface GoalsInput extends BodyProfile {
  goal: Goal;
  isActive: boolean;
  activities: ActivityEntry[];
}

export interface NutritionGoals {
  bmr: number;
  activityMultiplier: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterL: number;
}

// ----- Validación ------------------------------------------------------------

export type ProfileErrors = Partial<Record<keyof BodyProfile, string>>;

/** Devuelve los errores de un perfil (objeto vacío si es válido) */
export function validateBodyProfile(profile: Partial<BodyProfile>): ProfileErrors {
  const errors: ProfileErrors = {};
  const check = (key: keyof typeof PROFILE_LIMITS, label: string, unit: string) => {
    const value = profile[key];
    const { min, max } = PROFILE_LIMITS[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors[key] = `Ingresa tu ${label}`;
    } else if (value < min || value > max) {
      errors[key] = `Debe estar entre ${min} y ${max} ${unit}`.trim();
    }
  };
  check("age", "edad", "años");
  check("heightCm", "altura", "cm");
  check("weightKg", "peso", "kg");
  if (profile.sex !== "male" && profile.sex !== "female") {
    errors.sex = "Selecciona tu sexo";
  }
  return errors;
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} debe ser un número positivo (recibido: ${value})`);
  }
}

// ----- Cálculos --------------------------------------------------------------

/**
 * BMR (metabolismo basal) con Mifflin-St Jeor, en kcal/día sin redondear.
 *   Hombre: 10·kg + 6.25·cm − 5·edad + 5
 *   Mujer:  10·kg + 6.25·cm − 5·edad − 161
 */
export function calculateBMR({ sex, age, heightCm, weightKg }: BodyProfile): number {
  assertPositive(age, "age");
  assertPositive(heightCm, "heightCm");
  assertPositive(weightKg, "weightKg");
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

/** Multiplicador de actividad a partir de la actividad declarada */
export function calculateActivityMultiplier(
  isActive: boolean,
  activities: ActivityEntry[],
): number {
  if (!isActive) return SEDENTARY_MULTIPLIER;

  const extra = activities.reduce((sum, { type, timesPerWeek }) => {
    const increment = SESSION_INCREMENT[type] ?? 0;
    const sessions = Number.isFinite(timesPerWeek)
      ? Math.min(Math.max(timesPerWeek, 0), MAX_SESSIONS_PER_WEEK)
      : 0;
    return sum + increment * sessions;
  }, 0);

  const multiplier = Math.min(SEDENTARY_MULTIPLIER + extra, MAX_ACTIVITY_MULTIPLIER);
  return Math.round(multiplier * 1000) / 1000;
}

/** TDEE (gasto energético total diario), en kcal/día sin redondear */
export function calculateTDEE(bmr: number, activityMultiplier: number): number {
  assertPositive(bmr, "bmr");
  assertPositive(activityMultiplier, "activityMultiplier");
  return bmr * activityMultiplier;
}

/**
 * Calorías objetivo según la meta. Nunca por debajo del BMR: comer menos
 * que el metabolismo basal no es una recomendación segura sin supervisión.
 */
export function calculateTargetCalories(tdee: number, bmr: number, goal: Goal): number {
  const target = tdee * GOAL_CALORIE_FACTOR[goal];
  return Math.round(Math.max(target, bmr));
}

/** Reparte calorías en macros (gramos enteros) */
export function calculateMacros(
  calories: number,
  weightKg: number,
  goal: Goal,
): { proteinG: number; carbsG: number; fatG: number } {
  const proteinG = Math.round(weightKg * PROTEIN_G_PER_KG[goal]);
  const fatG = Math.round(
    Math.max((calories * FAT_CALORIE_SHARE) / KCAL_PER_G.fat, weightKg * MIN_FAT_G_PER_KG),
  );
  const remaining = calories - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(Math.round(remaining / KCAL_PER_G.carbs), 0);
  return { proteinG, carbsG, fatG };
}

/** Meta de agua: 35 ml por kg, redondeada a 0.25 L, entre 1.5 y 4 L */
export function calculateWaterTarget(weightKg: number): number {
  const liters = (weightKg * 35) / 1000;
  const rounded = Math.round(liters * 4) / 4;
  return Math.min(Math.max(rounded, 1.5), 4);
}

/** Cálculo completo de metas diarias a partir del perfil */
export function calculateGoals(input: GoalsInput): NutritionGoals {
  const bmrRaw = calculateBMR(input);
  const activityMultiplier = calculateActivityMultiplier(input.isActive, input.activities);
  const tdeeRaw = calculateTDEE(bmrRaw, activityMultiplier);
  const calories = calculateTargetCalories(tdeeRaw, bmrRaw, input.goal);
  const macros = calculateMacros(calories, input.weightKg, input.goal);

  return {
    bmr: Math.round(bmrRaw),
    activityMultiplier,
    tdee: Math.round(tdeeRaw),
    calories,
    ...macros,
    waterL: calculateWaterTarget(input.weightKg),
  };
}

/** Calorías que aportan unos macros (útil para validar entradas manuales) */
export function caloriesFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(
    proteinG * KCAL_PER_G.protein + carbsG * KCAL_PER_G.carbs + fatG * KCAL_PER_G.fat,
  );
}
