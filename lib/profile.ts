// ============================================================
// profile.ts — Helpers de perfil (puros, sin Firebase)
// ============================================================

import type { ActivityType, Goal, User } from "@/types";
import { calculateGoals, type GoalsInput } from "@/lib/nutrition";

export const GOAL_LABELS: Record<Goal, { title: string; description: string; emoji: string }> = {
  lose_fat: { title: "Bajar grasa", description: "Déficit moderado (−20 %)", emoji: "🔥" },
  maintain: { title: "Mantener", description: "Comer lo que gastas", emoji: "⚖️" },
  gain_muscle: { title: "Ganar músculo", description: "Superávit ligero (+10 %)", emoji: "💪" },
};

export const ACTIVITY_LABELS: Record<ActivityType, { title: string; hint: string; emoji: string }> =
  {
    strength: { title: "Fuerza / Gym", hint: "Pesas, calistenia", emoji: "🏋️" },
    sport: { title: "Deporte", hint: "Fútbol, básquet, tenis, pádel", emoji: "⚽" },
    cardio: { title: "Trote / cardio", hint: "Correr, bici, natación", emoji: "🏃" },
    other: { title: "Otro", hint: "Yoga, pilates, caminatas", emoji: "🧘" },
  };

export const ACTIVITY_TYPES = Object.keys(ACTIVITY_LABELS) as ActivityType[];

/** El perfil está completo cuando hay datos corporales y metas calculadas */
export function isProfileComplete(profile: Partial<User> | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.onboardingCompleted &&
      profile.age &&
      profile.heightCm &&
      profile.weightKg &&
      profile.dailyCaloriesTarget,
  );
}

/** Campos de Firestore a escribir tras (re)calcular metas */
export function goalsToProfileFields(input: GoalsInput) {
  const goals = calculateGoals(input);
  return {
    dailyCaloriesTarget: goals.calories,
    dailyProteinGTarget: goals.proteinG,
    dailyCarbsGTarget: goals.carbsG,
    dailyFatGTarget: goals.fatG,
    dailyWaterLTarget: goals.waterL,
    bmr: goals.bmr,
    tdee: goals.tdee,
    activityMultiplier: goals.activityMultiplier,
    goalsCustomized: false,
  };
}
