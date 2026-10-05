// ============================================================
// db.ts — Acceso a Firestore desde el cliente
// ============================================================
// Todas las rutas cuelgan de users/{uid}; las reglas de seguridad
// garantizan que cada usuario solo lee y escribe lo suyo.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DateKey } from "@/lib/dates";
import { mealTotalsFields } from "@/lib/meals";
import type { FoodEntry, MealSource, MealType } from "@/types";

export const paths = {
  user: (uid: string) => `users/${uid}`,
  meals: (uid: string) => `users/${uid}/meals`,
  weightLogs: (uid: string) => `users/${uid}/weightLogs`,
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
function cleanFoods(foods: FoodEntry[]): FoodEntry[] {
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
