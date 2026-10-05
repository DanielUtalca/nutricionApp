"use client";

// ============================================================
// Lista de compras — /shopping?week=YYYY-MM-DD (lunes)
// ============================================================
// Se genera automáticamente desde las recetas planificadas en la semana.
// Lo marcado como comprado y los ítems extra se guardan por semana.

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { where } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useCollection, useDocument } from "@/lib/hooks";
import { paths, saveShoppingList } from "@/lib/db";
import { addDays, formatShortDate, isDateKey, startOfWeek, todayKey, weekDays } from "@/lib/dates";
import { buildShoppingList, formatGramsAmount, type ShoppingItem } from "@/lib/shopping";
import type { MealPlanDay, Recipe, ShoppingListDoc } from "@/types";
import { Page, PageHeader, ErrorNote, EmptyState } from "@/components/ui/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { inputClasses } from "@/components/ui/field";
import { CartIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/id";

export default function ShoppingPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <ShoppingContent />
    </Suspense>
  );
}

function CheckRow({
  checked,
  onToggle,
  title,
  detail,
  onRemove,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  detail?: string;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
      >
        <span
          aria-hidden
          className={cn(
            "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors",
            checked ? "bg-primary border-primary text-on-primary" : "border-border",
          )}
        >
          {checked && <CheckIcon size={14} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className={cn("block text-sm font-medium", checked && "line-through text-text-disabled")}>{title}</span>
          {detail && <span className="block text-xs text-text-secondary truncate">{detail}</span>}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-8 h-8 rounded-lg text-text-disabled hover:text-danger flex items-center justify-center cursor-pointer"
          aria-label={`Quitar ${title}`}
        >
          <CloseIcon size={16} />
        </button>
      )}
    </li>
  );
}

function quantityLabel(item: ShoppingItem): string {
  const parts = [];
  if (item.grams) parts.push(formatGramsAmount(item.grams));
  parts.push(...item.otherQuantities);
  return parts.join(" + ");
}

function ShoppingContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const weekParam = params.get("week");
  const monday = startOfWeek(isDateKey(weekParam) ? weekParam : todayKey());
  const week = weekDays(monday);

  const { data: plans, loading } = useCollection<MealPlanDay>(
    user ? paths.mealPlans(user.uid) : null,
    [where("date", ">=", week[0]), where("date", "<=", week[6])],
    monday,
  );
  const { data: recipes } = useCollection<Recipe>(user ? paths.recipes(user.uid) : null, [], "all");
  const { data: listDoc } = useDocument<ShoppingListDoc>(user ? `${paths.shoppingLists(user.uid)}/${monday}` : null);

  const items = useMemo(
    () => buildShoppingList(plans, new Map(recipes.map((r) => [r.id, r]))),
    [plans, recipes],
  );
  const checked = new Set(listDoc?.checked ?? []);
  const extras = listDoc?.extras ?? [];
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<string | null>(null);

  const persist = (next: { checked?: string[]; extras?: ShoppingListDoc["extras"] }) => {
    if (!user) return;
    setError(null);
    saveShoppingList(user.uid, monday, {
      checked: next.checked ?? [...checked],
      extras: next.extras ?? extras,
    }).catch((err) => {
      console.error(err);
      setError("No se pudo guardar la lista.");
    });
  };

  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    persist({ checked: [...next] });
  };

  const addExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItem.trim();
    if (!name) return;
    persist({ extras: [...extras, { id: newId(), name, checked: false }] });
    setNewItem("");
  };

  const pending = items.filter((i) => !checked.has(i.key)).length + extras.filter((e) => !e.checked).length;
  const goTo = (d: string) => router.replace(`/shopping?week=${d}`, { scroll: false });

  // Agrupar por categoría manteniendo el orden ya calculado
  const groups: { category: string; items: ShoppingItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.category === item.category) last.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }

  return (
    <Page>
      <PageHeader title="Lista de compras" subtitle={`${pending} pendientes`} back="/plan" />

      <div className="flex items-center justify-between rounded-2xl bg-bg-surface border border-border-subtle px-2 py-1.5">
        <button
          type="button"
          onClick={() => goTo(addDays(monday, -7))}
          className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer"
          aria-label="Semana anterior"
        >
          <ChevronLeftIcon size={20} />
        </button>
        <span className="text-sm font-medium">
          Semana {formatShortDate(week[0])} – {formatShortDate(week[6])}
        </span>
        <button
          type="button"
          onClick={() => goTo(addDays(monday, 7))}
          className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer"
          aria-label="Semana siguiente"
        >
          <ChevronRightIcon size={20} />
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {!loading && items.length === 0 && extras.length === 0 ? (
        <EmptyState
          icon={<CartIcon size={32} />}
          title="Nada que comprar esta semana"
          description="Agrega recetas al plan y aquí aparecerán sus ingredientes sumados."
          action={
            <Button variant="secondary" onClick={() => router.push(`/plan?day=${monday}`)}>
              Ir al plan
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <Card key={group.category} className="px-4 pt-3 pb-1">
            <SectionTitle>{group.category}</SectionTitle>
            <ul className="divide-y divide-border-subtle" data-testid="shopping-group">
              {group.items.map((item) => (
                <CheckRow
                  key={item.key}
                  checked={checked.has(item.key)}
                  onToggle={() => toggle(item.key)}
                  title={`${item.name} · ${quantityLabel(item)}`}
                  detail={item.recipes.join(", ")}
                />
              ))}
            </ul>
          </Card>
        ))
      )}

      <Card className="px-4 pt-3 pb-3 flex flex-col gap-2">
        <SectionTitle>Otros</SectionTitle>
        {extras.length > 0 && (
          <ul className="divide-y divide-border-subtle">
            {extras.map((extra) => (
              <CheckRow
                key={extra.id}
                checked={extra.checked}
                title={extra.name}
                onToggle={() =>
                  persist({ extras: extras.map((e) => (e.id === extra.id ? { ...e, checked: !e.checked } : e)) })
                }
                onRemove={() => persist({ extras: extras.filter((e) => e.id !== extra.id) })}
              />
            ))}
          </ul>
        )}
        <form onSubmit={addExtra} className="flex gap-2">
          <input
            className={inputClasses}
            placeholder="Agregar algo más (ej. detergente)"
            aria-label="Agregar ítem a la lista"
            value={newItem}
            maxLength={80}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <Button type="submit" variant="secondary" className="h-12 shrink-0">
            Agregar
          </Button>
        </form>
      </Card>

      {(checked.size > 0 || extras.some((e) => e.checked)) && (
        <Button
          variant="ghost"
          className="self-center"
          onClick={() => persist({ checked: [], extras: extras.map((e) => ({ ...e, checked: false })) })}
        >
          Desmarcar todo
        </Button>
      )}
    </Page>
  );
}
