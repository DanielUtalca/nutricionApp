"use client";

// ============================================================
// Registrar comida — /log?type=lunch&date=2026-10-04&mode=photo
// ============================================================
// 1. Agregar alimentos: foto (IA), búsqueda, descripción (IA) o manual
// 2. Revisar: ajustar porciones/valores y guardar en users/{uid}/meals

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addMeal } from "@/lib/db";
import { formatDayLabel, isDateKey, todayKey } from "@/lib/dates";
import { isMealType, suggestMealType, sumFoods } from "@/lib/meals";
import { formatInt } from "@/lib/macros";
import type { AnalyzeResponse } from "@/lib/api-client";
import type { FoodEntry, MealType } from "@/types";
import { Page, PageHeader, ErrorNote } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/choice";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { PlusIcon } from "@/components/ui/icons";
import { inputClasses } from "@/components/ui/field";
import { MealTypePicker } from "@/components/log/meal-type-picker";
import { PhotoPanel } from "@/components/log/photo-panel";
import { SearchPanel } from "@/components/log/search-panel";
import { DescribePanel } from "@/components/log/describe-panel";
import { ManualPanel } from "@/components/log/manual-panel";
import {
  DraftTotals,
  FoodEditorList,
  makeDraft,
  mealSourceFromDraft,
  type DraftFood,
} from "@/components/meal/food-editor";

type Tab = "photo" | "search" | "text" | "manual";
const TABS: { value: Tab; label: string }[] = [
  { value: "photo", label: "Foto" },
  { value: "search", label: "Buscar" },
  { value: "text", label: "Describir" },
  { value: "manual", label: "Manual" },
];

const CONFIDENCE_LABEL = {
  high: "Confianza alta",
  medium: "Confianza media — revisa las porciones",
  low: "Confianza baja — revisa bien los valores",
} as const;

export default function LogPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <LogContent />
    </Suspense>
  );
}

function LogContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const dateParam = params.get("date");
  const date = isDateKey(dateParam) ? dateParam : todayKey();
  const typeParam = params.get("type");
  const modeParam = params.get("mode");

  const [mealType, setMealType] = useState<MealType>(isMealType(typeParam) ? typeParam : suggestMealType());
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.value === modeParam) ? (modeParam as Tab) : "photo",
  );
  const [view, setView] = useState<"add" | "review">("add");
  const [items, setItems] = useState<DraftFood[]>([]);
  const [title, setTitle] = useState("");
  const [ai, setAi] = useState<{ confidence: "high" | "medium" | "low"; notes?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAIResult = ({ result, source }: AnalyzeResponse) => {
    setItems((prev) => [...prev, ...result.foods.map((f) => makeDraft(f, source))]);
    if (result.title && !title) setTitle(result.title);
    setAi({ confidence: result.confidence, notes: result.notes });
    setView("review");
  };

  const addFood = (food: FoodEntry, origin: "text_search" | "manual") => {
    setItems((prev) => [...prev, makeDraft(food, origin)]);
    if (origin === "manual") setView("review");
  };

  const save = async () => {
    if (!user || items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const source = mealSourceFromDraft(items);
      await addMeal(user.uid, {
        date,
        type: mealType,
        foods: items.map((i) => i.food),
        source,
        title: title.trim() || undefined,
        aiConfidence: source === "ai_photo" || source === "ai_text" ? ai?.confidence : undefined,
      });
      router.replace(date === todayKey() ? "/home" : `/home?date=${date}`);
    } catch (err) {
      console.error("Error guardando comida:", err);
      setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
      setSaving(false);
    }
  };

  const totals = sumFoods(items.map((i) => i.food));

  return (
    <Page withNav={false} className="pb-32">
      <PageHeader
        title={view === "add" ? "Registrar comida" : "Revisar y guardar"}
        subtitle={formatDayLabel(date)}
        back={view === "review" ? undefined : true}
        action={
          view === "review" ? (
            <Button variant="ghost" size="sm" onClick={() => setView("add")}>
              <PlusIcon size={16} /> Agregar
            </Button>
          ) : undefined
        }
      />

      <MealTypePicker value={mealType} onChange={setMealType} />

      {view === "add" ? (
        <>
          <Segmented ariaLabel="Forma de registro" value={tab} onChange={setTab} options={TABS} />
          {tab === "photo" && <PhotoPanel onResult={onAIResult} onFallback={setTab} />}
          {tab === "search" && <SearchPanel onAdd={(f) => addFood(f, "text_search")} />}
          {tab === "text" && <DescribePanel onResult={onAIResult} />}
          {tab === "manual" && <ManualPanel onAdd={(f) => addFood(f, "manual")} />}

          {items.length > 0 && (
            <div className="fixed bottom-0 inset-x-0 z-20 bg-bg-base/95 backdrop-blur border-t border-border-subtle pb-safe">
              <div className="max-w-md mx-auto px-4 pt-3">
                <Button size="lg" fullWidth onClick={() => setView("review")}>
                  Revisar {items.length} {items.length === 1 ? "alimento" : "alimentos"} · {formatInt(totals.calories)} kcal
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {ai && (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${ai.confidence === "high" ? "bg-primary-muted" : "bg-carbs-muted"}`}
            >
              <p className="font-medium">✨ {CONFIDENCE_LABEL[ai.confidence]}</p>
              {ai.notes && <p className="text-text-secondary mt-0.5">{ai.notes}</p>}
              <p className="text-text-secondary mt-0.5 text-xs">Toca un alimento para ajustar la porción.</p>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Nombre <span className="font-normal text-text-secondary">(opcional)</span>
            </span>
            <input
              className={inputClasses}
              placeholder="Ej: Almuerzo casero"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          {items.length > 0 ? (
            <>
              <FoodEditorList items={items} onChange={setItems} />
              <DraftTotals items={items} />
            </>
          ) : (
            <p className="text-sm text-text-secondary text-center py-6">No hay alimentos. Agrega alguno.</p>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="fixed bottom-0 inset-x-0 z-20 bg-bg-base/95 backdrop-blur border-t border-border-subtle pb-safe">
            <div className="max-w-md mx-auto px-4 pt-3 flex gap-2">
              <Button variant="secondary" size="lg" onClick={() => setView("add")}>
                Atrás
              </Button>
              <Button size="lg" className="flex-1" onClick={save} loading={saving} disabled={items.length === 0}>
                Guardar comida
              </Button>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
