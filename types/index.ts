// ============================================================
// Tipos base de la app de nutrición
// Modelo de datos según CLAUDE.md — sin lógica, solo interfaces
// ============================================================

import { Timestamp } from "firebase/firestore";

// ----- Enums ----------------------------------------------------------------

export type Goal = "lose_fat" | "maintain" | "gain_muscle";

export type ActivityType = "strength" | "sport" | "cardio" | "other";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type Sex = "male" | "female";

export type MealSource = "ai_photo" | "ai_text" | "manual" | "text_search" | "recipe";

// ----- Actividad física detallada ------------------------------------------

export interface ActivityEntry {
  type: ActivityType;
  timesPerWeek: number;
}

// ----- Usuario ---------------------------------------------------------------

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;

  // Perfil corporal
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;

  // Actividad física detallada
  isActive: boolean;
  activities: ActivityEntry[];

  // Metas calculadas (BMR Mifflin-St Jeor + ajuste actividad)
  dailyCaloriesTarget: number;
  dailyProteinGTarget: number;
  dailyCarbsGTarget: number;
  dailyFatGTarget: number;

  // Resultado del último cálculo (informativo, se muestra en el perfil)
  bmr?: number;
  tdee?: number;
  activityMultiplier?: number;
  /** true si el usuario editó las metas a mano (no se pisan al recalcular sin avisar) */
  goalsCustomized?: boolean;

  // Hidratación
  dailyWaterLTarget: number;

  /** true cuando terminó el onboarding */
  onboardingCompleted?: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----- Entrada de alimento individual ----------------------------------------

export interface FoodEntry {
  name: string;
  portionDescription: string; // ej: "1 taza", "200g"
  portionGrams?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// ----- Comida registrada -----------------------------------------------------
// Documento: users/{uid}/meals/{mealId}

export interface Meal {
  id: string;
  uid: string;
  date: string; // formato YYYY-MM-DD
  type: MealType;
  foods: FoodEntry[];

  // Totales calculados (suma de foods)
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;

  // Nombre corto para mostrar (ej. "Arroz con pollo"); si falta se usan los alimentos
  title?: string;

  // Origen del registro. La foto NO se guarda: se envía directo a la IA
  // y solo persisten los datos nutricionales resultantes.
  source: MealSource;

  /** Confianza reportada por la IA (solo source = ai_photo | ai_text) */
  aiConfidence?: "high" | "medium" | "low";

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----- Registro de peso -------------------------------------------------------
// Documento: users/{uid}/weightLogs/{YYYY-MM-DD} (un registro por día)

export interface WeightLog {
  id: string;
  uid: string;
  date: string; // formato YYYY-MM-DD
  weightKg: number;

  // Medidas corporales opcionales (en cm)
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;

  notes?: string;
  createdAt: Timestamp;
}

// ----- Receta guardada -------------------------------------------------------
// Documento: users/{uid}/recipes/{recipeId}

// Un ingrediente es un FoodEntry: nombre, porción (texto + gramos) y macros
export type RecipeIngredient = FoodEntry;

export interface Recipe {
  id: string;
  uid: string;
  name: string;
  description?: string;
  servings: number;

  ingredients: RecipeIngredient[];

  // Totales por porción
  caloriesPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;

  // Totales completos (suma de todos los ingredientes)
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;

  tags?: string[]; // ej: ["almuerzo", "alto en proteína"]
  /** id de la receta sugerida de la que se copió (si aplica) */
  suggestedId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----- Plan de comidas --------------------------------------------------------
// Documento: users/{uid}/mealPlans/{YYYY-MM-DD}

export interface MealPlanItem {
  id: string;
  mealType: MealType;
  recipeId: string;
  /** Copia del nombre y macros por porción, para mostrar sin leer la receta */
  recipeName: string;
  servings: number;
  caloriesPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
  /** true cuando ya se registró como comida ese día */
  logged?: boolean;
}

export interface MealPlanDay {
  id: string;
  uid: string;
  date: string;
  items: MealPlanItem[];
  updatedAt: Timestamp;
}

// ----- Lista de compras ---------------------------------------------------------
// Documento: users/{uid}/shoppingLists/{YYYY-MM-DD del lunes}

export interface ShoppingListDoc {
  id: string;
  uid: string;
  weekStart: string;
  /** Claves de ítems generados que ya se compraron */
  checked: string[];
  /** Ítems agregados a mano */
  extras: { id: string; name: string; checked: boolean }[];
  updatedAt: Timestamp;
}

// ----- Hidratación -----------------------------------------------------------
// Documento: users/{uid}/water/{YYYY-MM-DD}

export interface WaterEntry {
  ml: number;
  at: Timestamp;
}

export interface WaterLog {
  id: string;
  uid: string;
  date: string; // formato YYYY-MM-DD
  /** Total del día en mililitros (entero, evita errores de coma flotante) */
  totalMl: number;
  entries: WaterEntry[];
  updatedAt: Timestamp;
}

// ----- Respuesta de la IA (analyze-meal) ------------------------------------

export interface AIAnalysisResult {
  foods: FoodEntry[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  confidence: "high" | "medium" | "low";
  notes?: string;
}
