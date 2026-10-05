"use client";

// ============================================================
// Detalle de comida — /meals/{id}: ajustar porciones, cambiar tipo o borrar
// ============================================================

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useDocument } from "@/lib/hooks";
import { deleteMeal, paths, updateMeal } from "@/lib/db";
import { formatDayLabel, todayKey } from "@/lib/dates";
import type { Meal, MealType } from "@/types";
import { Page, PageHeader, ErrorNote, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { inputClasses } from "@/components/ui/field";
import { TrashIcon } from "@/components/ui/icons";
import { MealTypePicker } from "@/components/log/meal-type-picker";
import { DraftTotals, FoodEditorList, makeDraft, type DraftFood } from "@/components/meal/food-editor";
import { mealDisplayName } from "@/components/meal/meal-section";

export default function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: meal, loading } = useDocument<Meal>(user ? `${paths.meals(user.uid)}/${id}` : null);

  if (loading) return <FullScreenSpinner />;
  if (!meal) {
    return (
      <Page withNav={false}>
        <PageHeader title="Comida" back="/home" />
        <EmptyState title="Esta comida no existe" description="Puede que la hayas borrado." />
      </Page>
    );
  }
  // key: reinicia el formulario si cambia la comida
  return <MealEditor key={meal.id} meal={meal} uid={user!.uid} />;
}

function MealEditor({ meal, uid }: { meal: Meal; uid: string }) {
  const router = useRouter();
  const [type, setType] = useState<MealType>(meal.type);
  const [title, setTitle] = useState(meal.title ?? "");
  const [items, setItems] = useState<DraftFood[]>(() =>
    meal.foods.map((f) => makeDraft(f, meal.source === "recipe" ? "recipe" : "manual")),
  );
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => router.replace(meal.date === todayKey() ? "/home" : `/home?date=${meal.date}`);

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      await updateMeal(uid, meal.id, { date: meal.date, type, title, foods: items.map((i) => i.food) });
      back();
    } catch (err) {
      console.error(err);
      setError("No se pudieron guardar los cambios.");
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await deleteMeal(uid, meal.id);
      back();
    } catch (err) {
      console.error(err);
      setError("No se pudo borrar la comida.");
      setBusy(null);
    }
  };

  return (
    <Page withNav={false} className="pb-32">
      <PageHeader title={mealDisplayName(meal)} subtitle={formatDayLabel(meal.date)} back />
      <MealTypePicker value={type} onChange={setType} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Nombre</span>
        <input
          className={inputClasses}
          placeholder="Ej: Almuerzo casero"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <FoodEditorList items={items} onChange={setItems} />
      {items.length > 0 && <DraftTotals items={items} />}
      {error && <ErrorNote>{error}</ErrorNote>}

      {confirmDelete ? (
        <div className="rounded-2xl bg-danger-muted p-4 flex flex-col gap-3">
          <p className="text-sm text-danger font-medium">¿Borrar esta comida? No se puede deshacer.</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={remove} loading={busy === "delete"}>
              Sí, borrar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="self-start text-danger" onClick={() => setConfirmDelete(true)}>
          <TrashIcon size={16} /> Borrar comida
        </Button>
      )}

      <div className="fixed bottom-0 inset-x-0 z-20 bg-bg-base/95 backdrop-blur border-t border-border-subtle pb-safe">
        <div className="max-w-md mx-auto px-4 pt-3">
          <Button size="lg" fullWidth onClick={save} loading={busy === "save"} disabled={items.length === 0}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </Page>
  );
}
