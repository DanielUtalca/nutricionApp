"use client";

// Receta sugerida: ver y guardarla en "Mis recetas" para usarla en el plan

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addRecipe } from "@/lib/db";
import { SUGGESTED_RECIPES, computeRecipeTotals } from "@/lib/recipes";
import { Page, PageHeader, EmptyState, ErrorNote } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { RecipeView } from "@/components/recipes/recipe-view";

export default function SuggestedRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestion = SUGGESTED_RECIPES.find((r) => r.id === id);

  if (!suggestion) {
    return (
      <Page>
        <PageHeader title="Receta" back="/recipes" />
        <EmptyState title="Receta no encontrada" />
      </Page>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const newId = await addRecipe(user!.uid, {
        name: suggestion.name,
        description: suggestion.description,
        servings: suggestion.servings,
        ingredients: suggestion.ingredients,
        tags: suggestion.tags,
        suggestedId: suggestion.id,
      });
      router.replace(`/recipes/${newId}`);
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la receta.");
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader title={suggestion.name} subtitle="Receta sugerida" back="/recipes" />
      <Button size="lg" fullWidth onClick={save} loading={saving}>
        Guardar en mis recetas
      </Button>
      {error && <ErrorNote>{error}</ErrorNote>}
      <RecipeView recipe={{ ...suggestion, ...computeRecipeTotals(suggestion.ingredients, suggestion.servings) }} />
    </Page>
  );
}
