"use client";

// ============================================================
// Editor de alimentos: ajustar porciones / valores antes de guardar
// ============================================================
// Cada ítem guarda la estimación original (`base`) y la versión editada
// (`food`). Cambiar los gramos escala todos los macros proporcionalmente
// desde `base`, así no se acumulan errores de redondeo.

import { useId, useState } from "react";
import type { FoodEntry } from "@/types";
import { scaleFood, sumFoods } from "@/lib/meals";
import { formatInt } from "@/lib/macros";
import { MacroInline } from "@/components/meal/macro-bar";
import { MacroSplitBar } from "@/components/meal/meal-section";
import { Stepper } from "@/components/ui/choice";
import { inputClasses, parseNumberInput } from "@/components/ui/field";
import { ChevronRightIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type FoodOrigin = "ai_photo" | "ai_text" | "text_search" | "manual" | "recipe";

export interface DraftFood {
  key: string;
  origin: FoodOrigin;
  base: FoodEntry;
  food: FoodEntry;
  /** Multiplicador de porción cuando no hay gramos conocidos */
  factor: number;
}

let keySeq = 0;
export function makeDraft(food: FoodEntry, origin: FoodOrigin): DraftFood {
  keySeq += 1;
  return { key: `f${Date.now()}-${keySeq}`, origin, base: food, food, factor: 1 };
}

export function FoodEditorList({
  items,
  onChange,
}: {
  items: DraftFood[];
  onChange: (items: DraftFood[]) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(items.length === 1 ? items[0].key : null);

  const update = (key: string, patch: Partial<DraftFood>) =>
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  return (
    <ul className="flex flex-col gap-2" aria-label="Alimentos">
      {items.map((item) => (
        <FoodRow
          key={item.key}
          item={item}
          open={openKey === item.key}
          onToggle={() => setOpenKey(openKey === item.key ? null : item.key)}
          onChange={(patch) => update(item.key, patch)}
          onRemove={() => onChange(items.filter((it) => it.key !== item.key))}
        />
      ))}
    </ul>
  );
}

function FoodRow({
  item,
  open,
  onToggle,
  onChange,
  onRemove,
}: {
  item: DraftFood;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftFood>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const { food, base } = item;
  const hasGrams = Boolean(base.portionGrams);

  const setGrams = (value: string) => {
    const grams = parseNumberInput(value);
    if (!grams || grams <= 0 || !base.portionGrams) {
      onChange({ food: { ...food, portionGrams: grams && grams > 0 ? grams : undefined } });
      return;
    }
    const scaled = scaleFood(base, grams / base.portionGrams);
    onChange({ food: { ...scaled, name: food.name, portionGrams: Math.round(grams), portionDescription: `${Math.round(grams)} g` } });
  };

  const setFactor = (factor: number) => {
    const scaled = scaleFood(base, factor);
    const desc = factor === 1 ? base.portionDescription : `${factor.toLocaleString("es-CL")} × ${base.portionDescription}`;
    onChange({ factor, food: { ...scaled, name: food.name, portionDescription: desc } });
  };

  // Editar un valor a mano fija la nueva base (desde ahí se escala)
  const setValue = (key: "calories" | "proteinG" | "carbsG" | "fatG", value: string) => {
    const n = Math.max(parseNumberInput(value) ?? 0, 0);
    const next = { ...food, [key]: key === "calories" ? Math.round(n) : n };
    onChange({ food: next, base: next, factor: 1 });
  };

  return (
    <li className="rounded-2xl border border-border-subtle bg-bg-surface" data-testid="food-row">
      <div className="flex items-start gap-2 p-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="flex-1 min-w-0 text-left flex flex-col gap-1.5 cursor-pointer"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-medium truncate">{food.name || "Sin nombre"}</span>
            <span className="text-sm font-semibold tabular shrink-0">
              {formatInt(food.calories)} <span className="font-normal text-text-secondary">kcal</span>
            </span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-secondary truncate">{food.portionDescription}</span>
            <MacroInline proteinG={food.proteinG} carbsG={food.carbsG} fatG={food.fatG} />
          </span>
          <MacroSplitBar proteinG={food.proteinG} carbsG={food.carbsG} fatG={food.fatG} />
        </button>
        <ChevronRightIcon
          size={18}
          className={cn("mt-1 text-text-disabled transition-transform shrink-0", open && "rotate-90")}
        />
      </div>

      {open && (
        <div id={`${id}-panel`} className="flex flex-col gap-4 px-3.5 pb-3.5 border-t border-border-subtle pt-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">Nombre</span>
            <input
              className={inputClasses}
              value={food.name}
              maxLength={120}
              onChange={(e) => onChange({ food: { ...food, name: e.target.value } })}
            />
          </label>

          {hasGrams ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary" id={`${id}-grams`}>
                Porción (gramos)
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24 shrink-0">
                  <input
                    aria-labelledby={`${id}-grams`}
                    className={cn(inputClasses, "text-center tabular")}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={food.portionGrams ?? ""}
                    onChange={(e) => setGrams(e.target.value)}
                  />
                </div>
                <div className="flex gap-1.5">
                  {[0.5, 0.75, 1.25, 1.5].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setGrams(String(Math.round((base.portionGrams ?? 0) * f)))}
                      className="h-9 px-2 rounded-lg bg-bg-subtle text-xs font-medium text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      ×{f.toLocaleString("es-CL")}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs text-text-disabled">
                Estimado original: {base.portionGrams} g · {formatInt(base.calories)} kcal
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-text-secondary">Porciones</span>
              <Stepper
                label="porciones"
                value={item.factor}
                min={0.25}
                max={10}
                step={0.25}
                onChange={setFactor}
                format={(v) => `×${v.toLocaleString("es-CL")}`}
              />
            </div>
          )}

          <fieldset className="grid grid-cols-4 gap-2">
            <legend className="text-xs font-medium text-text-secondary mb-1.5">Valores (editar si la IA se equivocó)</legend>
            {(
              [
                ["calories", "kcal"],
                ["proteinG", "Prot. g"],
                ["carbsG", "Carb. g"],
                ["fatG", "Grasa g"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[11px] text-text-secondary">{label}</span>
                <input
                  className={cn(inputClasses, "h-10 px-2 text-sm text-center tabular")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={food[key]}
                  onChange={(e) => setValue(key, e.target.value)}
                />
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            onClick={onRemove}
            className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-danger cursor-pointer"
          >
            <TrashIcon size={16} /> Quitar alimento
          </button>
        </div>
      )}
    </li>
  );
}

/** Resumen compacto de totales de la lista */
export function DraftTotals({ items }: { items: DraftFood[] }) {
  const t = sumFoods(items.map((i) => i.food));
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg-subtle px-4 py-3">
      <div>
        <p className="text-xs text-text-secondary">Total</p>
        <p className="text-xl font-bold tabular" data-testid="draft-total-calories">
          {formatInt(t.calories)} <span className="text-sm font-normal text-text-secondary">kcal</span>
        </p>
      </div>
      <MacroInline proteinG={t.proteinG} carbsG={t.carbsG} fatG={t.fatG} />
    </div>
  );
}

/** Origen de la comida completa a partir de sus alimentos */
export function mealSourceFromDraft(items: DraftFood[]): FoodOrigin {
  const order: FoodOrigin[] = ["ai_photo", "ai_text", "recipe", "text_search", "manual"];
  return order.find((o) => items.some((i) => i.origin === o)) ?? "manual";
}
