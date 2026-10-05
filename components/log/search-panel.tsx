"use client";

// Búsqueda de alimentos en la base local (sin conexión, sin cuota de IA)

import { useMemo, useState } from "react";
import { FOODS, foodItemToEntry, searchFoods, type FoodItem } from "@/lib/food-db";
import { formatInt } from "@/lib/macros";
import { inputClasses } from "@/components/ui/field";
import { CheckIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { FoodEntry } from "@/types";

const SUGGESTED = ["Huevo", "Marraqueta", "Palta", "Arroz blanco cocido", "Pechuga de pollo cocida", "Plátano"];

export function SearchPanel({ onAdd }: { onAdd: (food: FoodEntry) => void }) {
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Record<string, number>>({});
  const results = useMemo(
    () => (query.trim() ? searchFoods(query) : FOODS.filter((f) => SUGGESTED.includes(f.name))),
    [query],
  );

  const add = (item: FoodItem) => {
    onAdd(foodItemToEntry(item));
    setAdded((a) => ({ ...a, [item.id]: (a[item.id] ?? 0) + 1 }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
        <input
          type="search"
          className={cn(inputClasses, "pl-10")}
          placeholder="Buscar: palta, arroz, yogur…"
          aria-label="Buscar alimento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {!query.trim() && <p className="text-xs text-text-secondary">Frecuentes</p>}

      {results.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-8">
          No encontramos “{query}”. Prueba con otra palabra, descríbelo con IA o ingrésalo a mano.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-2xl bg-bg-surface border border-border-subtle">
          {results.map((item) => {
            const entry = foodItemToEntry(item);
            const count = added[item.id];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => add(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-bg-subtle first:rounded-t-2xl last:rounded-b-2xl"
                  aria-label={`Agregar ${item.name}, ${item.serving.label}, ${entry.calories} kcal`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{item.name}</span>
                    <span className="block text-xs text-text-secondary">
                      {item.serving.label} ({item.serving.grams} g) · {formatInt(entry.calories)} kcal
                      {item.approximate && " · aprox."}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      count ? "bg-primary text-on-primary" : "bg-primary-muted text-primary",
                    )}
                  >
                    {count ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-text-disabled text-center">Valores de referencia por porción típica; ajústalos al revisar.</p>
    </div>
  );
}
