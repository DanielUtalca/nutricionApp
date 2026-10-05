import type { FoodEntry } from "@/types";
import { MACROS, MACRO_KEYS, formatInt } from "@/lib/macros";
import { Card, SectionTitle } from "@/components/ui/card";
import { MacroSplitBar } from "@/components/meal/meal-section";
import { cn } from "@/lib/cn";

/** Detalle de receta: macros por porción, ingredientes y preparación */
export function RecipeView({
  recipe,
}: {
  recipe: {
    description?: string;
    servings: number;
    ingredients: FoodEntry[];
    caloriesPerServing: number;
    proteinGPerServing: number;
    carbsGPerServing: number;
    fatGPerServing: number;
    tags?: string[];
  };
}) {
  const total = recipe.caloriesPerServing * recipe.servings;
  // Aporte calórico de cada macro (para el % del reparto)
  const kcal = {
    protein: recipe.proteinGPerServing * 4,
    carbs: recipe.carbsGPerServing * 4,
    fat: recipe.fatGPerServing * 9,
  };
  const kcalSum = kcal.protein + kcal.carbs + kcal.fat || 1;
  const grams = { protein: recipe.proteinGPerServing, carbs: recipe.carbsGPerServing, fat: recipe.fatGPerServing };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-text-secondary">Por porción</p>
            <p className="text-4xl font-bold tracking-tight">
              {formatInt(recipe.caloriesPerServing)} <span className="text-base font-medium text-text-secondary">kcal</span>
            </p>
          </div>
          <p className="text-sm text-text-secondary text-right">
            Rinde {recipe.servings} {recipe.servings === 1 ? "porción" : "porciones"}
            <br />
            {formatInt(total)} kcal en total
          </p>
        </div>
        <MacroSplitBar proteinG={recipe.proteinGPerServing} carbsG={recipe.carbsGPerServing} fatG={recipe.fatGPerServing} />
        <div className="grid grid-cols-3 gap-2">
          {MACRO_KEYS.map((key) => (
            <div key={key} className="rounded-xl bg-bg-subtle p-3 text-center">
              <p className="text-lg font-bold">{grams[key].toLocaleString("es-CL")} g</p>
              <p className="flex items-center justify-center gap-1.5 text-xs text-text-secondary">
                <span aria-hidden className={cn("w-2 h-2 shrink-0 rounded-full", MACROS[key].bgClass)} />
                {MACROS[key].label}
              </p>
              <p className="text-[11px] text-text-disabled tabular">{Math.round((kcal[key] / kcalSum) * 100)} % kcal</p>
            </div>
          ))}
        </div>
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-bg-subtle text-text-secondary">
                {t}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 flex flex-col gap-2">
        <SectionTitle>Ingredientes</SectionTitle>
        <ul className="divide-y divide-border-subtle">
          {recipe.ingredients.map((ing, i) => (
            <li key={`${ing.name}-${i}`} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{ing.name}</span>
                <span className="block text-xs text-text-secondary">{ing.portionDescription}</span>
              </span>
              <span className="tabular text-text-secondary shrink-0">{formatInt(ing.calories)} kcal</span>
            </li>
          ))}
        </ul>
      </Card>

      {recipe.description && (
        <Card className="p-4 flex flex-col gap-2">
          <SectionTitle>Preparación</SectionTitle>
          <p className="text-sm leading-relaxed whitespace-pre-line">{recipe.description}</p>
        </Card>
      )}
    </div>
  );
}
