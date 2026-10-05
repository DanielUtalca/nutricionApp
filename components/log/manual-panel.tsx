"use client";

// Registro manual: nombre, porción y valores nutricionales

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, parseNumberInput } from "@/components/ui/field";
import { caloriesFromMacros } from "@/lib/nutrition";
import type { FoodEntry } from "@/types";

const EMPTY = { name: "", portion: "", grams: "", calories: "", proteinG: "", carbsG: "", fatG: "" };

export function ManualPanel({ onAdd }: { onAdd: (food: FoodEntry) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const p = parseNumberInput(form.proteinG) ?? 0;
  const c = parseNumberInput(form.carbsG) ?? 0;
  const g = parseNumberInput(form.fatG) ?? 0;
  const estimated = caloriesFromMacros(p, c, g);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const kcal = parseNumberInput(form.calories) ?? estimated;
    if (!name) return setError("Ponle un nombre al alimento.");
    if (!(kcal >= 0) || kcal > 5000) return setError("Revisa las calorías (0 a 5.000).");
    if ([p, c, g].some((n) => n < 0 || n > 1000)) return setError("Revisa los gramos de macros.");
    const grams = parseNumberInput(form.grams);
    onAdd({
      name,
      portionDescription: form.portion.trim() || (grams ? `${grams} g` : "1 porción"),
      ...(grams && grams > 0 ? { portionGrams: Math.round(grams) } : {}),
      calories: Math.round(kcal),
      proteinG: p,
      carbsG: c,
      fatG: g,
    });
    setForm(EMPTY);
    setError(null);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Alimento" placeholder="Ej: Sándwich de pavo" value={form.name} onChange={set("name")} maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Porción" placeholder="1 unidad" value={form.portion} onChange={set("portion")} maxLength={60} />
        <Field label="Peso" type="number" inputMode="decimal" placeholder="150" suffix="g" value={form.grams} onChange={set("grams")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Proteína" type="number" inputMode="decimal" placeholder="0" suffix="g" value={form.proteinG} onChange={set("proteinG")} />
        <Field label="Carbos" type="number" inputMode="decimal" placeholder="0" suffix="g" value={form.carbsG} onChange={set("carbsG")} />
        <Field label="Grasa" type="number" inputMode="decimal" placeholder="0" suffix="g" value={form.fatG} onChange={set("fatG")} />
      </div>
      <Field
        label="Calorías"
        type="number"
        inputMode="numeric"
        placeholder={estimated ? String(estimated) : "0"}
        suffix="kcal"
        value={form.calories}
        onChange={set("calories")}
        hint={estimated ? `Si lo dejas vacío usamos ${estimated} kcal (calculado de los macros).` : undefined}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" fullWidth>
        Agregar alimento
      </Button>
    </form>
  );
}
