"use client";

// Hojas para usar una receta: registrarla como comida o agregarla al plan

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMeal, savePlanItems, paths } from "@/lib/db";
import { useDocument } from "@/lib/hooks";
import { addDays, formatDayLabel, todayKey, weekDays, type DateKey } from "@/lib/dates";
import { perServing, recipeToFoodEntry } from "@/lib/recipes";
import { suggestMealType } from "@/lib/meals";
import { formatInt } from "@/lib/macros";
import type { MealPlanDay, MealType, Recipe } from "@/types";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/choice";
import { ErrorNote } from "@/components/ui/page";
import { MealTypePicker } from "@/components/log/meal-type-picker";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/id";

type RecipeLike = Pick<
  Recipe,
  "id" | "name" | "caloriesPerServing" | "proteinGPerServing" | "carbsGPerServing" | "fatGPerServing"
>;

function ServingsRow({ value, onChange, recipe }: { value: number; onChange: (n: number) => void; recipe: RecipeLike }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Porciones</p>
        <p className="text-xs text-text-secondary tabular">{formatInt(perServing(recipe, value).calories)} kcal</p>
      </div>
      <Stepper label="porciones" value={value} min={0.5} max={10} step={0.5} onChange={onChange} format={(v) => v.toLocaleString("es-CL")} />
    </div>
  );
}

export function LogRecipeSheet({
  open,
  onClose,
  recipe,
  uid,
  date = todayKey(),
  defaultType,
  defaultServings = 1,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  recipe: RecipeLike;
  uid: string;
  date?: DateKey;
  defaultType?: MealType;
  defaultServings?: number;
  onLogged?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [type, setType] = useState<MealType>(defaultType ?? suggestMealType());
  const [servings, setServings] = useState(defaultServings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await addMeal(uid, { date, type, foods: [recipeToFoodEntry(recipe, servings)], source: "recipe", title: recipe.name });
      await onLogged?.();
      onClose();
      router.push(date === todayKey() ? "/home" : `/home?date=${date}`);
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Registrar como comida">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          {recipe.name} · {formatDayLabel(date)}
        </p>
        <MealTypePicker value={type} onChange={setType} />
        <ServingsRow value={servings} onChange={setServings} recipe={recipe} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button size="lg" fullWidth onClick={save} loading={saving}>
          Registrar
        </Button>
      </div>
    </Sheet>
  );
}

export function AddToPlanSheet({
  open,
  onClose,
  recipe,
  uid,
}: {
  open: boolean;
  onClose: () => void;
  recipe: RecipeLike;
  uid: string;
}) {
  const today = todayKey();
  // Esta semana y la próxima, desde hoy
  const days = [...weekDays(today), ...weekDays(addDays(today, 7))].filter((d) => d >= today);
  const [date, setDate] = useState<DateKey>(today);
  const [type, setType] = useState<MealType>("lunch");
  const [servings, setServings] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: plan } = useDocument<MealPlanDay>(open ? `${paths.mealPlans(uid)}/${date}` : null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const items = plan?.items ?? [];
      await savePlanItems(uid, date, [
        ...items,
        {
          id: newId(),
          mealType: type,
          recipeId: recipe.id,
          recipeName: recipe.name,
          servings,
          caloriesPerServing: recipe.caloriesPerServing,
          proteinGPerServing: recipe.proteinGPerServing,
          carbsGPerServing: recipe.carbsGPerServing,
          fatGPerServing: recipe.fatGPerServing,
        },
      ]);
      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo agregar al plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Agregar al plan">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="radiogroup" aria-label="Día">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === date}
              onClick={() => setDate(d)}
              className={cn(
                "shrink-0 h-10 px-3 rounded-xl text-sm font-medium border cursor-pointer whitespace-nowrap",
                d === date ? "bg-primary text-on-primary border-primary" : "bg-bg-surface border-border text-text-secondary",
              )}
            >
              {formatDayLabel(d, today)}
            </button>
          ))}
        </div>
        <MealTypePicker value={type} onChange={setType} />
        <ServingsRow value={servings} onChange={setServings} recipe={recipe} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button size="lg" fullWidth onClick={save} loading={saving}>
          Agregar al plan
        </Button>
      </div>
    </Sheet>
  );
}
