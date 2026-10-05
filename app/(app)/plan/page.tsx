"use client";

// ============================================================
// Plan — /plan: plan de comidas semanal (opcional) a partir de recetas
// ============================================================

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { where } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { useCollection } from "@/lib/hooks";
import { addMeal, addPlanItem, paths, savePlanItems } from "@/lib/db";
import { settleWrite } from "@/lib/offline";
import {
  addDays,
  formatDayLabel,
  formatShortDate,
  formatWeekday,
  isDateKey,
  parseDateKey,
  todayKey,
  weekDays,
  type DateKey,
} from "@/lib/dates";
import { MEAL_LABELS, MEAL_TYPES, progress } from "@/lib/meals";
import { perServing, recipeToFoodEntry } from "@/lib/recipes";
import { formatInt } from "@/lib/macros";
import type { MealPlanDay, MealPlanItem, MealType, Recipe } from "@/types";
import { Page, PageHeader, ErrorNote, EmptyState } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/choice";
import { Sheet } from "@/components/ui/sheet";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { CartIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { RecipeSummaryContent } from "@/components/recipes/recipe-card";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/id";

export default function PlanPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <PlanContent />
    </Suspense>
  );
}

function PlanContent() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const params = useSearchParams();
  const today = todayKey();
  const dayParam = params.get("day");
  const day: DateKey = isDateKey(dayParam) ? dayParam : today;
  const week = weekDays(day);
  const monday = week[0];

  const { data: plans, error } = useCollection<MealPlanDay>(
    user ? paths.mealPlans(user.uid) : null,
    [where("date", ">=", week[0]), where("date", "<=", week[6])],
    monday,
  );
  const { data: recipes } = useCollection<Recipe>(user ? paths.recipes(user.uid) : null, [], "all");

  const byDate = useMemo(() => new Map(plans.map((p) => [p.date, p])), [plans]);
  const items = byDate.get(day)?.items ?? [];
  const dayKcal = (d: DateKey) =>
    (byDate.get(d)?.items ?? []).reduce((sum, it) => sum + it.caloriesPerServing * it.servings, 0);

  const [picker, setPicker] = useState<MealType | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const goTo = (d: DateKey) => router.replace(d === today ? "/plan" : `/plan?day=${d}`, { scroll: false });

  const save = async (next: MealPlanItem[]) => {
    if (!user) return;
    setActionError(null);
    try {
      await settleWrite(savePlanItems(user.uid, day, next));
    } catch (err) {
      console.error(err);
      setActionError("No se pudo actualizar el plan.");
    }
  };

  // arrayUnion: seguro aunque el día aún no haya cargado (no pisa ítems)
  const addRecipe = async (recipe: Recipe, mealType: MealType) => {
    if (!user) return;
    setActionError(null);
    try {
      await settleWrite(
        addPlanItem(user.uid, day, {
        id: newId(),
        mealType,
        recipeId: recipe.id,
        recipeName: recipe.name,
        servings: 1,
        caloriesPerServing: recipe.caloriesPerServing,
        proteinGPerServing: recipe.proteinGPerServing,
        carbsGPerServing: recipe.carbsGPerServing,
        fatGPerServing: recipe.fatGPerServing,
        }),
      );
    } catch (err) {
      console.error(err);
      setActionError("No se pudo actualizar el plan.");
    }
  };

  const logItem = async (item: MealPlanItem) => {
    if (!user) return;
    setBusy(item.id);
    try {
      await settleWrite(
        addMeal(user.uid, {
          date: day,
          type: item.mealType,
          foods: [recipeToFoodEntry({ name: item.recipeName, ...item }, item.servings)],
          source: "recipe",
          title: item.recipeName,
        }),
      );
      await save(items.map((it) => (it.id === item.id ? { ...it, logged: true } : it)));
    } catch (err) {
      console.error(err);
      setActionError("No se pudo registrar la comida.");
    } finally {
      setBusy(null);
    }
  };

  if (!profile) return null;
  const planned = dayKcal(day);
  const ratio = progress(planned, profile.dailyCaloriesTarget);
  const weekLabel = `${formatShortDate(week[0])} – ${formatShortDate(week[6])}`;

  return (
    <Page>
      <PageHeader
        title="Plan"
        subtitle="Planifica tu semana con tus recetas"
        action={
          <Link
            href={`/shopping?week=${monday}`}
            className="h-10 px-3 rounded-xl border border-border bg-bg-surface text-sm font-semibold flex items-center gap-1.5"
          >
            <CartIcon size={18} /> Compras
          </Link>
        }
      />

      {/* Semana */}
      <Card className="p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(addDays(monday, -7))}
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer"
            aria-label="Semana anterior"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <span className="text-sm font-medium">{weekLabel}</span>
          <button
            type="button"
            onClick={() => goTo(addDays(monday, 7))}
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer"
            aria-label="Semana siguiente"
          >
            <ChevronRightIcon size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Día de la semana">
          {week.map((d) => {
            const kcal = dayKcal(d);
            const selected = d === day;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${formatDayLabel(d, today)}${kcal ? `, ${formatInt(kcal)} kcal planificadas` : ""}`}
                onClick={() => goTo(d)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl py-2 cursor-pointer transition-colors",
                  selected ? "bg-primary text-on-primary" : "hover:bg-bg-subtle",
                )}
              >
                <span className={cn("text-[11px] uppercase", selected ? "opacity-90" : "text-text-secondary")}>
                  {formatWeekday(d).slice(0, 2)}
                </span>
                <span className={cn("text-base font-semibold", d === today && !selected && "text-primary")}>
                  {parseDateKey(d).getDate()}
                </span>
                <span
                  aria-hidden
                  className={cn("w-1.5 h-1.5 rounded-full", kcal ? (selected ? "bg-on-primary" : "bg-primary") : "bg-transparent")}
                />
              </button>
            );
          })}
        </div>
      </Card>

      {/* Resumen del día */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{formatDayLabel(day, today)}</h2>
          <span className="text-sm tabular">
            <span className="font-semibold">{formatInt(planned)}</span>
            <span className="text-text-secondary"> / {formatInt(profile.dailyCaloriesTarget)} kcal planificadas</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-primary-muted overflow-hidden" aria-hidden>
          <div
            className={cn("h-full rounded-full", ratio > 1 ? "bg-danger" : "bg-primary")}
            style={{ width: `${Math.min(ratio, 1) * 100}%` }}
          />
        </div>
      </div>

      {(error || actionError) && <ErrorNote>{error ?? actionError}</ErrorNote>}

      {MEAL_TYPES.map((type) => {
        const typeItems = items.filter((it) => it.mealType === type);
        return (
          <Card key={type} className="p-4 flex flex-col gap-2" data-testid={`plan-${type}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">
                <span aria-hidden>{MEAL_LABELS[type].emoji}</span> {MEAL_LABELS[type].title}
              </h3>
              <button
                type="button"
                onClick={() => setPicker(type)}
                className="h-8 px-2.5 rounded-lg text-sm font-medium text-primary hover:bg-primary-muted flex items-center gap-1 cursor-pointer"
                aria-label={`Agregar receta a ${MEAL_LABELS[type].title}`}
              >
                <PlusIcon size={16} /> Receta
              </button>
            </div>
            {typeItems.length === 0 ? (
              <p className="text-xs text-text-disabled">Nada planificado</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle">
                {typeItems.map((item) => (
                  <li key={item.id} className="py-2.5 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/recipes/${item.recipeId}`} className="text-sm font-medium truncate hover:underline">
                        {item.recipeName}
                      </Link>
                      <span className="text-sm font-semibold tabular shrink-0">
                        {formatInt(perServing(item, item.servings).calories)}{" "}
                        <span className="font-normal text-text-secondary">kcal</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Stepper
                        label={`porciones de ${item.recipeName}`}
                        value={item.servings}
                        min={0.5}
                        max={10}
                        step={0.5}
                        onChange={(servings) => save(items.map((it) => (it.id === item.id ? { ...it, servings } : it)))}
                        format={(v) => `${v.toLocaleString("es-CL")} porc.`}
                      />
                      <div className="flex items-center gap-1">
                        {item.logged ? (
                          <span className="h-9 px-2.5 rounded-lg text-xs font-medium text-primary flex items-center gap-1">
                            <CheckIcon size={14} /> Registrada
                          </span>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => logItem(item)} loading={busy === item.id}>
                            Registrar
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => save(items.filter((it) => it.id !== item.id))}
                          className="w-9 h-9 rounded-lg text-text-disabled hover:text-danger hover:bg-danger-muted flex items-center justify-center cursor-pointer"
                          aria-label={`Quitar ${item.recipeName} del plan`}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      <Sheet open={picker !== null} onClose={() => setPicker(null)} title={picker ? `Agregar a ${MEAL_LABELS[picker].title}` : ""}>
        {recipes.length === 0 ? (
          <EmptyState
            title="No tienes recetas guardadas"
            description="Crea una receta o guarda una sugerida para planificarla."
            action={
              <Link href="/recipes" className="text-sm font-semibold text-primary">
                Ir a recetas
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2 pb-2">
            {[...recipes]
              .sort((a, b) => a.name.localeCompare(b.name, "es"))
              .map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (picker) addRecipe(r, picker);
                      setPicker(null);
                    }}
                    className="w-full flex text-left rounded-2xl border border-border-subtle p-3.5 hover:bg-bg-subtle cursor-pointer"
                  >
                    <RecipeSummaryContent recipe={r} />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Sheet>
    </Page>
  );
}
