import Link from "next/link";
import type { Meal, MealSource, MealType } from "@/types";
import { MEAL_LABELS, sumMeals } from "@/lib/meals";
import { MACROS, formatInt } from "@/lib/macros";
import { Card } from "@/components/ui/card";
import { MacroInline } from "@/components/meal/macro-bar";
import { CameraIcon, PlusIcon, RecipesIcon, SearchIcon, SparkIcon, EditIcon } from "@/components/ui/icons";
import type { DateKey } from "@/lib/dates";

const SOURCE_ICON: Record<MealSource, typeof CameraIcon> = {
  ai_photo: CameraIcon,
  ai_text: SparkIcon,
  manual: EditIcon,
  text_search: SearchIcon,
  recipe: RecipesIcon,
};

export function mealDisplayName(meal: Pick<Meal, "title" | "foods">): string {
  if (meal.title) return meal.title;
  const names = meal.foods.map((f) => f.name);
  if (names.length <= 2) return names.join(" y ") || "Comida";
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;
}

/** Barra apilada con el reparto calórico de macros (2px de separación entre tramos) */
export function MacroSplitBar({ proteinG, carbsG, fatG }: { proteinG: number; carbsG: number; fatG: number }) {
  const kcal = { protein: proteinG * 4, carbs: carbsG * 4, fat: fatG * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (total <= 0) return null;
  return (
    <div className="flex h-1.5 gap-0.5" aria-hidden>
      {(Object.keys(kcal) as (keyof typeof kcal)[]).map((key) =>
        kcal[key] > 0 ? (
          <span
            key={key}
            className={`h-full rounded-full ${MACROS[key].bgClass}`}
            style={{ flexGrow: kcal[key] / total, flexBasis: 0 }}
          />
        ) : null,
      )}
    </div>
  );
}

export function MealSection({ type, meals, date }: { type: MealType; meals: Meal[]; date: DateKey }) {
  const totals = sumMeals(meals);
  const { title, emoji } = MEAL_LABELS[type];

  return (
    <Card className="p-4" data-testid={`meal-section-${type}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl w-9 h-9 rounded-xl bg-bg-subtle flex items-center justify-center" aria-hidden>
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-text-secondary tabular">
            {meals.length > 0 ? `${formatInt(totals.calories)} kcal` : "Sin registros"}
          </p>
        </div>
        <Link
          href={`/log?type=${type}&date=${date}`}
          aria-label={`Agregar a ${title}`}
          className="w-10 h-10 rounded-full bg-primary-muted text-primary flex items-center justify-center hover:brightness-95 active:scale-95 transition"
        >
          <PlusIcon size={20} strokeWidth={2.4} />
        </Link>
      </div>

      {meals.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y divide-border-subtle">
          {meals.map((meal) => {
            const Icon = SOURCE_ICON[meal.source] ?? EditIcon;
            return (
              <li key={meal.id}>
                <Link
                  href={`/meals/${meal.id}`}
                  className="flex items-start gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-bg-subtle transition-colors"
                >
                  <span className="mt-0.5 w-8 h-8 shrink-0 rounded-lg bg-bg-subtle text-text-secondary flex items-center justify-center">
                    <Icon size={16} />
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium truncate">{mealDisplayName(meal)}</span>
                      <span className="text-sm font-semibold tabular shrink-0">
                        {formatInt(meal.totalCalories)}
                        <span className="font-normal text-text-secondary"> kcal</span>
                      </span>
                    </span>
                    <MacroSplitBar
                      proteinG={meal.totalProteinG}
                      carbsG={meal.totalCarbsG}
                      fatG={meal.totalFatG}
                    />
                    <MacroInline
                      proteinG={meal.totalProteinG}
                      carbsG={meal.totalCarbsG}
                      fatG={meal.totalFatG}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
