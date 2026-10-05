"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addRecipe } from "@/lib/db";
import { Page, PageHeader } from "@/components/ui/page";
import { RecipeEditor } from "@/components/recipes/recipe-editor";

export default function NewRecipePage() {
  const { user } = useAuth();
  const router = useRouter();
  return (
    <Page>
      <PageHeader title="Nueva receta" back="/recipes" />
      <RecipeEditor
        submitLabel="Guardar receta"
        onSubmit={async (input) => {
          const id = await addRecipe(user!.uid, input);
          router.replace(`/recipes/${id}`);
        }}
      />
    </Page>
  );
}
