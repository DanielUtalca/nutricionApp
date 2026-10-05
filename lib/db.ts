// ============================================================
// db.ts — Acceso a Firestore desde el cliente
// ============================================================
// Todas las rutas cuelgan de users/{uid}; las reglas de seguridad
// garantizan que cada usuario solo lee y escribe lo suyo.

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DateKey } from "@/lib/dates";
import { mealTotalsFields } from "@/lib/meals";
import { computeRecipeTotals } from "@/lib/recipes";
import type { FoodEntry, MealPlanItem, MealSource, MealType, ShoppingListDoc, WaterEntry } from "@/types";

export const paths = {
  user: (uid: string) => `users/${uid}`,
  meals: (uid: string) => `users/${uid}/meals`,
  weightLogs: (uid: string) => `users/${uid}/weightLogs`,
  water: (uid: string) => `users/${uid}/water`,
  recipes: (uid: string) => `users/${uid}/recipes`,
  mealPlans: (uid: string) => `users/${uid}/mealPlans`,
  shoppingLists: (uid: string) => `users/${uid}/shoppingLists`,
};

// ----- Comidas -----------------------------------------------------------------

export interface MealInput {
  date: DateKey;
  type: MealType;
  foods: FoodEntry[];
  source: MealSource;
  title?: string;
  aiConfidence?: "high" | "medium" | "low";
}

/** Normaliza alimentos antes de guardar (sin campos vacíos ni negativos) */
export function cleanFoods(foods: FoodEntry[]): FoodEntry[] {
  const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  return foods.map((f) => ({
    name: f.name.trim().slice(0, 120) || "Alimento",
    portionDescription: f.portionDescription.trim().slice(0, 60),
    ...(f.portionGrams ? { portionGrams: Math.round(nonNeg(f.portionGrams)) } : {}),
    calories: Math.round(nonNeg(f.calories)),
    proteinG: Math.round(nonNeg(f.proteinG) * 10) / 10,
    carbsG: Math.round(nonNeg(f.carbsG) * 10) / 10,
    fatG: Math.round(nonNeg(f.fatG) * 10) / 10,
  }));
}

export async function addMeal(uid: string, input: MealInput): Promise<string> {
  const foods = cleanFoods(input.foods);
  const ref = await addDoc(collection(db, paths.meals(uid)), {
    uid,
    date: input.date,
    type: input.type,
    source: input.source,
    title: input.title?.trim().slice(0, 120) || undefined,
    aiConfidence: input.aiConfidence,
    foods,
    ...mealTotalsFields(foods),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMeal(
  uid: string,
  mealId: string,
  input: Pick<MealInput, "type" | "foods" | "date"> & { title?: string },
): Promise<void> {
  const foods = cleanFoods(input.foods);
  await updateDoc(doc(db, paths.meals(uid), mealId), {
    date: input.date,
    type: input.type,
    title: input.title?.trim().slice(0, 120) ?? "",
    foods,
    ...mealTotalsFields(foods),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMeal(uid: string, mealId: string): Promise<void> {
  await deleteDoc(doc(db, paths.meals(uid), mealId));
}

// ----- Peso ------------------------------------------------------------------

export interface WeightLogInput {
  date: DateKey;
  weightKg: number;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  notes?: string;
}

/** Un registro por día: el id del documento es la fecha (re-registrar sobrescribe) */
export async function addWeightLog(uid: string, input: WeightLogInput): Promise<void> {
  await setDoc(doc(db, paths.weightLogs(uid), input.date), {
    uid,
    ...input,
    createdAt: serverTimestamp(),
  });
}

export async function deleteWeightLog(uid: string, date: DateKey): Promise<void> {
  await deleteDoc(doc(db, paths.weightLogs(uid), date));
}

// ----- Agua --------------------------------------------------------------------
// increment/arrayUnion funcionan sin conexión (se sincronizan al volver)

export async function addWater(uid: string, date: DateKey, ml: number): Promise<void> {
  const entry: WaterEntry = { ml, at: Timestamp.now() };
  await setDoc(
    doc(db, paths.water(uid), date),
    { uid, date, totalMl: increment(ml), entries: arrayUnion(entry), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Deshace un registro de agua concreto (normalmente el último) */
export async function removeWaterEntry(uid: string, date: DateKey, entry: WaterEntry): Promise<void> {
  await updateDoc(doc(db, paths.water(uid), date), {
    totalMl: increment(-entry.ml),
    entries: arrayRemove(entry),
    updatedAt: serverTimestamp(),
  });
}

// ----- Recetas ---------------------------------------------------------------

export interface RecipeInput {
  name: string;
  description?: string;
  servings: number;
  ingredients: FoodEntry[];
  tags?: string[];
  suggestedId?: string;
}

function recipeFields(input: RecipeInput) {
  const ingredients = cleanFoods(input.ingredients);
  const servings = Math.min(Math.max(Math.round(input.servings * 4) / 4, 0.25), 50);
  return {
    name: input.name.trim().slice(0, 120) || "Receta",
    description: input.description?.trim().slice(0, 1000) ?? "",
    servings,
    ingredients,
    tags: (input.tags ?? []).map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 8),
    ...(input.suggestedId ? { suggestedId: input.suggestedId } : {}),
    ...computeRecipeTotals(ingredients, servings),
  };
}

export async function addRecipe(uid: string, input: RecipeInput): Promise<string> {
  const ref = await addDoc(collection(db, paths.recipes(uid)), {
    uid,
    ...recipeFields(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecipe(uid: string, recipeId: string, input: RecipeInput): Promise<void> {
  await updateDoc(doc(db, paths.recipes(uid), recipeId), { ...recipeFields(input), updatedAt: serverTimestamp() });
}

export async function deleteRecipe(uid: string, recipeId: string): Promise<void> {
  await deleteDoc(doc(db, paths.recipes(uid), recipeId));
}

// ----- Plan de comidas ---------------------------------------------------------
// Un documento por día con la lista completa de ítems (se reescribe entera:
// es de un solo usuario, así que "última escritura gana" es suficiente).

export async function savePlanItems(uid: string, date: DateKey, items: MealPlanItem[]): Promise<void> {
  await setDoc(doc(db, paths.mealPlans(uid), date), {
    uid,
    date,
    items: items.slice(0, 40),
    updatedAt: serverTimestamp(),
  });
}

// ----- Lista de compras ----------------------------------------------------------

export async function saveShoppingList(
  uid: string,
  weekStart: DateKey,
  data: Pick<ShoppingListDoc, "checked" | "extras">,
): Promise<void> {
  await setDoc(doc(db, paths.shoppingLists(uid), weekStart), {
    uid,
    weekStart,
    checked: data.checked.slice(0, 300),
    extras: data.extras.slice(0, 100).map((e) => ({ ...e, name: e.name.trim().slice(0, 80) })),
    updatedAt: serverTimestamp(),
  });
}
