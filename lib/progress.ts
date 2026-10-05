// ============================================================
// progress.ts — Lógica pura de peso, medidas e hidratación
// ============================================================

import { addDays, type DateKey } from "@/lib/dates";
import type { WeightLog } from "@/types";

// ----- Peso ------------------------------------------------------------------

export type RangeKey = "1m" | "3m" | "1y" | "all";

export const RANGE_DAYS: Record<RangeKey, number | null> = { "1m": 30, "3m": 90, "1y": 365, all: null };

export function sortByDate<T extends { date: DateKey }>(logs: T[]): T[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date));
}

/** Registros dentro del rango (contando hacia atrás desde hoy) */
export function filterRange<T extends { date: DateKey }>(logs: T[], range: RangeKey, today: DateKey): T[] {
  const days = RANGE_DAYS[range];
  const sorted = sortByDate(logs);
  if (days === null) return sorted;
  const from = addDays(today, -days);
  return sorted.filter((l) => l.date >= from && l.date <= today);
}

export interface WeightStats {
  latest: number;
  first: number;
  change: number;
  min: number;
  max: number;
}

export function weightStats(logs: Pick<WeightLog, "date" | "weightKg">[]): WeightStats | null {
  if (logs.length === 0) return null;
  const sorted = sortByDate(logs);
  const weights = sorted.map((l) => l.weightKg);
  const latest = weights[weights.length - 1];
  const first = weights[0];
  return {
    latest,
    first,
    change: Math.round((latest - first) * 10) / 10,
    min: Math.min(...weights),
    max: Math.max(...weights),
  };
}

/**
 * Ticks "redondos" para un eje (1, 2, 2.5 o 5 × 10^n) que cubren [min, max].
 * Si min = max se abre un margen para que la línea no quede pegada al borde.
 */
export function niceTicks(min: number, max: number, target = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  let lo = min;
  let hi = max;
  if (hi - lo < 1) {
    lo -= 1;
    hi += 1;
  }
  const rawStep = (hi - lo) / target;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

/** Variación de una medida opcional entre el primer y último registro que la tengan */
export function measurementChange(
  logs: WeightLog[],
  key: "waistCm" | "hipCm" | "chestCm" | "armCm",
): { latest: number; change: number } | null {
  const withValue = sortByDate(logs).filter((l) => typeof l[key] === "number" && (l[key] as number) > 0);
  if (withValue.length === 0) return null;
  const latest = withValue[withValue.length - 1][key] as number;
  const first = withValue[0][key] as number;
  return { latest, change: Math.round((latest - first) * 10) / 10 };
}

// ----- Hidratación -------------------------------------------------------------

export const GLASS_ML = 250;
export const BOTTLE_ML = 500;

export function waterProgress(totalMl: number, targetL: number): { liters: number; ratio: number; glasses: number } {
  const liters = Math.round(totalMl / 10) / 100;
  return {
    liters,
    ratio: targetL > 0 ? totalMl / (targetL * 1000) : 0,
    glasses: Math.round((totalMl / GLASS_ML) * 10) / 10,
  };
}

/** "1,25 L" */
export function formatLiters(liters: number): string {
  return `${liters.toLocaleString("es-CL", { maximumFractionDigits: 2 })} L`;
}
