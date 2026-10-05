"use client";

import { Segmented } from "@/components/ui/choice";
import { MEAL_LABELS, MEAL_TYPES } from "@/lib/meals";
import type { MealType } from "@/types";

export function MealTypePicker({ value, onChange }: { value: MealType; onChange: (t: MealType) => void }) {
  return (
    <Segmented
      ariaLabel="Tipo de comida"
      value={value}
      onChange={onChange}
      options={MEAL_TYPES.map((t) => ({ value: t, label: t === "snack" ? "Snack" : MEAL_LABELS[t].title }))}
    />
  );
}
