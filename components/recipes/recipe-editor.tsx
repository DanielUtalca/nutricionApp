"use client";

// Editor de recetas: nombre, porciones, etiquetas e ingredientes
// (desde la base de alimentos o manuales), con totales por porción.

import { useState } from "react";
import type { RecipeInput } from "@/lib/db";
import { computeRecipeTotals } from "@/lib/recipes";
import { formatInt } from "@/lib/macros";
import { Button } from "@/components/ui/button";
import { Segmented, Stepper } from "@/components/ui/choice";
import { Field, inputClasses } from "@/components/ui/field";
import { ErrorNote } from "@/components/ui/page";
import { SectionTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { PlusIcon } from "@/components/ui/icons";
import { MacroInline } from "@/components/meal/macro-bar";
import { FoodEditorList, makeDraft, type DraftFood } from "@/components/meal/food-editor";
import { SearchPanel } from "@/components/log/search-panel";
import { ManualPanel } from "@/components/log/manual-panel";
import { cn } from "@/lib/cn";

export function RecipeEditor({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: RecipeInput;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [items, setItems] = useState<DraftFood[]>(() =>
    (initial?.ingredients ?? []).map((f) => makeDraft(f, "manual")),
  );
  const [adding, setAdding] = useState(false);
  const [addTab, setAddTab] = useState<"search" | "manual">("search");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingredients = items.map((i) => i.food);
  const totals = computeRecipeTotals(ingredients, servings);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Ponle un nombre a la receta.");
    if (items.length === 0) return setError("Agrega al menos un ingrediente.");
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name,
        description,
        servings,
        ingredients,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        suggestedId: initial?.suggestedId,
      });
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la receta.");
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Nombre" placeholder="Ej: Pollo al horno con papas" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            Preparación <span className="font-normal text-text-secondary">(opcional)</span>
          </span>
          <textarea
            className={cn(inputClasses, "h-auto min-h-24 py-3 resize-y")}
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Pasos, tiempos, tips…"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Rinde</span>
          <Stepper
            label="porciones"
            value={servings}
            min={1}
            max={20}
            onChange={setServings}
            format={(v) => `${v} ${v === 1 ? "porción" : "porciones"}`}
          />
        </div>
        <Field
          label="Etiquetas"
          placeholder="almuerzo, alto en proteína"
          hint="Separadas por coma"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <div className="flex flex-col gap-3">
          <SectionTitle
            action={
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                <PlusIcon size={16} /> Ingrediente
              </Button>
            }
          >
            Ingredientes (receta completa)
          </SectionTitle>
          {items.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-6 rounded-2xl border border-dashed border-border">
              Aún no hay ingredientes.
            </p>
          ) : (
            <FoodEditorList items={items} onChange={setItems} />
          )}
        </div>

        <div className="rounded-2xl bg-bg-subtle px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-text-secondary">Por porción</p>
            <p className="text-xl font-bold tabular" data-testid="recipe-kcal-serving">
              {formatInt(totals.caloriesPerServing)} <span className="text-sm font-normal text-text-secondary">kcal</span>
            </p>
          </div>
          <MacroInline proteinG={totals.proteinGPerServing} carbsG={totals.carbsGPerServing} fatG={totals.fatGPerServing} />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" size="lg" fullWidth loading={saving}>
          {submitLabel}
        </Button>
      </form>

      {/* Fuera del <form>: el panel manual tiene su propio formulario y el
          submit no debe propagarse al de la receta (ni Enter en la búsqueda) */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Agregar ingrediente">
          <div className="flex flex-col gap-4">
            <Segmented
              ariaLabel="Origen del ingrediente"
              value={addTab}
              onChange={setAddTab}
              options={[
                { value: "search", label: "Buscar" },
                { value: "manual", label: "Manual" },
              ]}
            />
            {addTab === "search" ? (
              <SearchPanel onAdd={(f) => setItems((prev) => [...prev, makeDraft(f, "text_search")])} />
            ) : (
              <ManualPanel
                onAdd={(f) => {
                  setItems((prev) => [...prev, makeDraft(f, "manual")]);
                  setAdding(false);
                }}
              />
            )}
            {addTab === "search" && (
              <Button variant="secondary" onClick={() => setAdding(false)}>
                Listo
              </Button>
            )}
          </div>
      </Sheet>
    </>
  );
}
