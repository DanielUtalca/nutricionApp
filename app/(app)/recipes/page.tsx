"use client";

// ============================================================
// Recetas — /recipes: mis recetas + sugeridas
// ============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks";
import { paths } from "@/lib/db";
import { SUGGESTED_RECIPES, computeRecipeTotals } from "@/lib/recipes";
import { normalizeText } from "@/lib/food-db";
import type { Recipe } from "@/types";
import { Page, PageHeader, ErrorNote, EmptyState } from "@/components/ui/page";
import { SectionTitle } from "@/components/ui/card";
import { PlusIcon, RecipesIcon, SearchIcon } from "@/components/ui/icons";
import { inputClasses } from "@/components/ui/field";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { cn } from "@/lib/cn";

export default function RecipesPage() {
  const { user } = useAuth();
  const { data: recipes, loading, error } = useCollection<Recipe>(user ? paths.recipes(user.uid) : null, [], "all");
  const [query, setQuery] = useState("");

  const mine = useMemo(() => {
    const q = normalizeText(query);
    return [...recipes]
      .filter((r) => !q || normalizeText(`${r.name} ${(r.tags ?? []).join(" ")}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [recipes, query]);

  const savedSuggested = new Set(recipes.map((r) => r.suggestedId).filter(Boolean));
  const suggested = SUGGESTED_RECIPES.filter((s) => !savedSuggested.has(s.id)).map((s) => ({
    ...s,
    ...computeRecipeTotals(s.ingredients, s.servings),
  }));

  return (
    <Page>
      <PageHeader
        title="Recetas"
        subtitle="Tus recetas con info nutricional"
        action={
          <Link
            href="/recipes/new"
            className="h-10 pl-3 pr-4 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <PlusIcon size={18} /> Nueva
          </Link>
        }
      />

      {recipes.length > 3 && (
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          <input
            type="search"
            className={cn(inputClasses, "pl-10")}
            placeholder="Buscar en mis recetas"
            aria-label="Buscar en mis recetas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <section className="flex flex-col gap-3" aria-label="Mis recetas">
        <SectionTitle>Mis recetas</SectionTitle>
        {loading ? (
          <div className="h-24" />
        ) : mine.length === 0 ? (
          <EmptyState
            icon={<RecipesIcon size={32} />}
            title={query ? "Sin resultados" : "Aún no tienes recetas"}
            description={query ? undefined : "Crea una o guarda alguna de las sugeridas de abajo."}
          />
        ) : (
          mine.map((r) => <RecipeCard key={r.id} recipe={r} href={`/recipes/${r.id}`} />)
        )}
      </section>

      {suggested.length > 0 && !query && (
        <section className="flex flex-col gap-3" aria-label="Recetas sugeridas">
          <SectionTitle>Sugeridas</SectionTitle>
          {suggested.map((r) => (
            <RecipeCard key={r.id} recipe={r} href={`/recipes/suggested/${r.id}`} />
          ))}
        </section>
      )}
    </Page>
  );
}
