"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useDocument } from "@/lib/hooks";
import { paths, updateRecipe } from "@/lib/db";
import type { Recipe } from "@/types";
import { Page, PageHeader, EmptyState } from "@/components/ui/page";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { RecipeEditor } from "@/components/recipes/recipe-editor";

export default function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const { data: recipe, loading } = useDocument<Recipe>(user ? `${paths.recipes(user.uid)}/${id}` : null);

  if (loading) return <FullScreenSpinner />;
  if (!recipe) {
    return (
      <Page>
        <PageHeader title="Editar receta" back="/recipes" />
        <EmptyState title="Esta receta no existe" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Editar receta" back={`/recipes/${id}`} />
      <RecipeEditor
        key={recipe.id}
        initial={recipe}
        submitLabel="Guardar cambios"
        onSubmit={async (input) => {
          await updateRecipe(user!.uid, id, input);
          router.replace(`/recipes/${id}`);
        }}
      />
    </Page>
  );
}
