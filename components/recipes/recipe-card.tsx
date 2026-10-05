import Link from "next/link";
import type { Recipe } from "@/types";
import { formatInt } from "@/lib/macros";
import { MacroInline } from "@/components/meal/macro-bar";
import { MacroSplitBar } from "@/components/meal/meal-section";

type RecipeSummary = Pick<
  Recipe,
  "name" | "servings" | "caloriesPerServing" | "proteinGPerServing" | "carbsGPerServing" | "fatGPerServing" | "tags"
>;

export function RecipeSummaryContent({ recipe }: { recipe: RecipeSummary }) {
  return (
    <span className="flex flex-col gap-1.5 min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-semibold truncate">{recipe.name}</span>
        <span className="text-sm font-semibold tabular shrink-0">
          {formatInt(recipe.caloriesPerServing)} <span className="font-normal text-text-secondary">kcal/porción</span>
        </span>
      </span>
      <MacroSplitBar proteinG={recipe.proteinGPerServing} carbsG={recipe.carbsGPerServing} fatG={recipe.fatGPerServing} />
      <span className="flex items-center justify-between gap-2">
        <MacroInline proteinG={recipe.proteinGPerServing} carbsG={recipe.carbsGPerServing} fatG={recipe.fatGPerServing} />
        <span className="text-xs text-text-secondary truncate min-w-0">
          {recipe.servings} {recipe.servings === 1 ? "porción" : "porciones"}
          {recipe.tags?.length ? ` · ${recipe.tags.slice(0, 2).join(", ")}` : ""}
        </span>
      </span>
    </span>
  );
}

export function RecipeCard({ recipe, href }: { recipe: RecipeSummary; href: string }) {
  return (
    <Link
      href={href}
      className="flex rounded-2xl bg-bg-surface border border-border-subtle shadow-sm p-4 hover:bg-bg-subtle transition-colors"
    >
      <RecipeSummaryContent recipe={recipe} />
    </Link>
  );
}
