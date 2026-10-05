"use client";

// Detalle de receta guardada: registrar como comida, agregar al plan, editar, borrar

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useDocument } from "@/lib/hooks";
import { deleteRecipe, paths } from "@/lib/db";
import type { Recipe } from "@/types";
import { Page, PageHeader, EmptyState, ErrorNote } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { EditIcon, PlanIcon, TrashIcon } from "@/components/ui/icons";
import { RecipeView } from "@/components/recipes/recipe-view";
import { AddToPlanSheet, LogRecipeSheet } from "@/components/recipes/recipe-actions";

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const { data: recipe, loading } = useDocument<Recipe>(user ? `${paths.recipes(user.uid)}/${id}` : null);
  const [sheet, setSheet] = useState<"log" | "plan" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <FullScreenSpinner />;
  if (!recipe || !user) {
    return (
      <Page>
        <PageHeader title="Receta" back="/recipes" />
        <EmptyState title="Esta receta no existe" description="Puede que la hayas borrado." />
      </Page>
    );
  }

  const remove = async () => {
    try {
      await deleteRecipe(user.uid, recipe.id);
      router.replace("/recipes");
    } catch (err) {
      console.error(err);
      setError("No se pudo borrar la receta.");
    }
  };

  return (
    <Page>
      <PageHeader
        title={recipe.name}
        back="/recipes"
        action={
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle"
            aria-label="Editar receta"
          >
            <EditIcon size={20} />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setSheet("log")}>Registrar comida</Button>
        <Button variant="secondary" onClick={() => setSheet("plan")}>
          <PlanIcon size={18} /> Al plan
        </Button>
      </div>
      <RecipeView recipe={recipe} />
      {error && <ErrorNote>{error}</ErrorNote>}
      {confirmDelete ? (
        <div className="rounded-2xl bg-danger-muted p-4 flex flex-col gap-3">
          <p className="text-sm text-danger font-medium">
            ¿Borrar esta receta? Las comidas ya registradas no se borran.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={remove}>
              Sí, borrar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="self-start text-danger" onClick={() => setConfirmDelete(true)}>
          <TrashIcon size={16} /> Borrar receta
        </Button>
      )}
      {sheet === "log" && <LogRecipeSheet open onClose={() => setSheet(null)} recipe={recipe} uid={user.uid} />}
      {sheet === "plan" && <AddToPlanSheet open onClose={() => setSheet(null)} recipe={recipe} uid={user.uid} />}
    </Page>
  );
}
