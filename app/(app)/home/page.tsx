"use client";

// ============================================================
// Home — /home: totales del día vs. meta, en tiempo real
// ============================================================

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { where } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { useCollection } from "@/lib/hooks";
import { paths } from "@/lib/db";
import { addDays, formatDayLabel, formatShortDate, isDateKey, todayKey } from "@/lib/dates";
import { MEAL_TYPES, groupMealsByType, sumMeals } from "@/lib/meals";
import { formatInt } from "@/lib/macros";
import type { Meal } from "@/types";
import { Page, ErrorNote } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { CalorieRing } from "@/components/meal/calorie-ring";
import { MacroBar } from "@/components/meal/macro-bar";
import { MealSection } from "@/components/meal/meal-section";

export default function HomePage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const params = useSearchParams();
  const today = todayKey();
  const dateParam = params.get("date");
  const date = isDateKey(dateParam) ? dateParam : today;

  const { data: meals, loading, error } = useCollection<Meal>(
    user ? paths.meals(user.uid) : null,
    [where("date", "==", date)],
    date,
  );

  // Orden de registro (sin índice compuesto: se ordena en el cliente)
  const sorted = useMemo(
    () => [...meals].sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
    [meals],
  );
  const groups = groupMealsByType(sorted);
  const totals = sumMeals(sorted);

  const goToDate = (d: string) => router.replace(d === today ? "/home" : `/home?date=${d}`, { scroll: false });

  if (!profile) return null;
  const firstName = (profile.displayName || user?.displayName || "").split(" ")[0];

  return (
    <Page>
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary truncate">
            {firstName ? `Hola, ${firstName}` : "Hola"}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{formatDayLabel(date, today)}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToDate(addDays(date, -1))}
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer"
            aria-label="Día anterior"
          >
            <ChevronLeftIcon />
          </button>
          <span className="text-sm text-text-secondary w-14 text-center tabular">{formatShortDate(date)}</span>
          <button
            type="button"
            onClick={() => goToDate(addDays(date, 1))}
            disabled={date >= today}
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Día siguiente"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Resumen del día */}
      <Card className={`p-5 flex flex-col gap-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="flex flex-col items-center gap-4">
          <CalorieRing consumed={totals.calories} target={profile.dailyCaloriesTarget} />
          <dl className="grid grid-cols-2 w-full text-center divide-x divide-border-subtle">
            <div>
              <dt className="text-xs text-text-secondary">Consumidas</dt>
              <dd className="text-lg font-semibold tabular" data-testid="calories-consumed">
                {formatInt(totals.calories)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Meta</dt>
              <dd className="text-lg font-semibold tabular">{formatInt(profile.dailyCaloriesTarget)}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col gap-3.5">
          <MacroBar macro="protein" consumed={totals.proteinG} target={profile.dailyProteinGTarget} />
          <MacroBar macro="carbs" consumed={totals.carbsG} target={profile.dailyCarbsGTarget} />
          <MacroBar macro="fat" consumed={totals.fatG} target={profile.dailyFatGTarget} />
        </div>
      </Card>

      {/* Comidas del día por tipo */}
      <section aria-label="Comidas del día" className="flex flex-col gap-3">
        {MEAL_TYPES.map((type) => (
          <MealSection key={type} type={type} meals={groups[type]} date={date} />
        ))}
      </section>

      {/* Acceso rápido: registrar por foto */}
      <Link
        href={`/log?mode=photo&date=${date}`}
        className="fixed z-20 right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] h-14 pl-4 pr-5 rounded-full bg-primary text-on-primary shadow-md flex items-center gap-2 font-semibold active:scale-95 transition"
        style={{ right: "max(1rem, calc((100vw - 28rem) / 2 + 1rem))" }}
      >
        <CameraIcon size={22} />
        Foto
      </Link>
    </Page>
  );
}
