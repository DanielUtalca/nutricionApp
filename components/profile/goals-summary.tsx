import type { NutritionGoals } from "@/lib/nutrition";
import { MACROS, MACRO_KEYS, formatInt } from "@/lib/macros";
import { cn } from "@/lib/cn";

/** Resumen de metas diarias: calorías protagonistas + macros + detalle del cálculo */
export function GoalsSummary({
  goals,
  showBreakdown = true,
  className,
}: {
  goals: Pick<NutritionGoals, "calories" | "proteinG" | "carbsG" | "fatG"> &
    Partial<Pick<NutritionGoals, "bmr" | "tdee" | "activityMultiplier" | "waterL">>;
  showBreakdown?: boolean;
  className?: string;
}) {
  const grams = { protein: goals.proteinG, carbs: goals.carbsG, fat: goals.fatG };
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="text-center">
        <p className="text-sm text-text-secondary">Tu meta diaria</p>
        <p className="text-5xl font-bold tracking-tight tabular" data-testid="goal-calories">
          {formatInt(goals.calories)}
        </p>
        <p className="text-sm text-text-secondary">kcal</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MACRO_KEYS.map((key) => (
          <div key={key} className="rounded-xl p-3 text-center bg-bg-subtle">
            <p className="text-xl font-bold">{grams[key]} g</p>
            <p className="flex items-center justify-center gap-1.5 text-xs text-text-secondary">
              <span aria-hidden className={cn("w-2 h-2 shrink-0 rounded-full", MACROS[key].bgClass)} />
              {MACROS[key].label}
            </p>
          </div>
        ))}
      </div>

      {showBreakdown && goals.bmr !== undefined && goals.tdee !== undefined && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-xl bg-bg-subtle p-4">
          <dt className="text-text-secondary">Metabolismo basal</dt>
          <dd className="text-right font-medium tabular">{formatInt(goals.bmr)} kcal</dd>
          <dt className="text-text-secondary">Factor de actividad</dt>
          <dd className="text-right font-medium tabular">× {goals.activityMultiplier}</dd>
          <dt className="text-text-secondary">Gasto diario estimado</dt>
          <dd className="text-right font-medium tabular">{formatInt(goals.tdee)} kcal</dd>
          {goals.waterL !== undefined && (
            <>
              <dt className="text-text-secondary">Agua</dt>
              <dd className="text-right font-medium tabular">
                {goals.waterL.toLocaleString("es-CL")} L
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
