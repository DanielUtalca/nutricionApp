import { describe, expect, it } from "vitest";
import {
  filterRange,
  measurementChange,
  niceTicks,
  waterProgress,
  weightStats,
} from "@/lib/progress";
import type { WeightLog } from "@/types";

const log = (date: string, weightKg: number, extra: Partial<WeightLog> = {}) =>
  ({ id: date, uid: "u", date, weightKg, ...extra }) as WeightLog;

describe("weightStats", () => {
  it("calcula último, primero y cambio sin importar el orden", () => {
    const stats = weightStats([log("2026-10-01", 74.2), log("2026-09-01", 76), log("2026-09-15", 75.1)]);
    expect(stats).toEqual({ latest: 74.2, first: 76, change: -1.8, min: 74.2, max: 76 });
  });

  it("null sin registros", () => {
    expect(weightStats([])).toBeNull();
  });
});

describe("filterRange", () => {
  const logs = [log("2025-09-01", 80), log("2026-07-01", 78), log("2026-09-20", 76), log("2026-10-04", 75)];

  it("1 mes = últimos 30 días", () => {
    expect(filterRange(logs, "1m", "2026-10-04").map((l) => l.date)).toEqual(["2026-09-20", "2026-10-04"]);
  });

  it("todo devuelve todo ordenado", () => {
    expect(filterRange(logs, "all", "2026-10-04")).toHaveLength(4);
  });
});

describe("niceTicks", () => {
  it("genera ticks redondos que cubren el rango", () => {
    const ticks = niceTicks(73.4, 76.8);
    expect(ticks[0]).toBeLessThanOrEqual(73.4);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(76.8);
    expect(ticks).toEqual([73, 74, 75, 76, 77]);
  });

  it("abre margen cuando todos los valores son iguales", () => {
    const ticks = niceTicks(75, 75);
    expect(ticks[0]).toBeLessThan(75);
    expect(ticks[ticks.length - 1]).toBeGreaterThan(75);
  });

  it("valores no finitos → sin ticks", () => {
    expect(niceTicks(Number.NaN, 3)).toEqual([]);
  });
});

describe("measurementChange", () => {
  it("usa solo registros con la medida", () => {
    const logs = [log("2026-09-01", 76, { waistCm: 86 }), log("2026-09-10", 75.5), log("2026-10-01", 75, { waistCm: 83.5 })];
    expect(measurementChange(logs, "waistCm")).toEqual({ latest: 83.5, change: -2.5 });
    expect(measurementChange(logs, "hipCm")).toBeNull();
  });
});

describe("waterProgress", () => {
  it("convierte ml a litros, proporción y vasos", () => {
    expect(waterProgress(1250, 2.5)).toEqual({ liters: 1.25, ratio: 0.5, glasses: 5 });
  });

  it("meta 0 no divide por cero", () => {
    expect(waterProgress(500, 0).ratio).toBe(0);
  });
});
