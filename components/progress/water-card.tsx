"use client";

// Hidratación del día: botones rápidos (+vaso / +botella), deshacer y meta

import { useState } from "react";
import { useDocument } from "@/lib/hooks";
import { addWater, paths, removeWaterEntry } from "@/lib/db";
import { BOTTLE_ML, GLASS_ML, formatLiters, waterProgress } from "@/lib/progress";
import type { DateKey } from "@/lib/dates";
import type { WaterLog } from "@/types";
import { Card } from "@/components/ui/card";
import { DropIcon } from "@/components/ui/icons";

export function WaterCard({ uid, date, targetL }: { uid: string; date: DateKey; targetL: number }) {
  const { data } = useDocument<WaterLog>(`${paths.water(uid)}/${date}`);
  const [error, setError] = useState<string | null>(null);
  const totalMl = Math.max(data?.totalMl ?? 0, 0);
  const { liters, ratio } = waterProgress(totalMl, targetL);
  const entries = data?.entries ?? [];
  const last = entries.length
    ? entries.reduce((a, b) => (a.at.toMillis() >= b.at.toMillis() ? a : b))
    : null;
  const done = ratio >= 1;

  const run = (fn: () => Promise<void>) => {
    setError(null);
    // No se espera: con caché offline el listener refleja el cambio al instante
    fn().catch((err) => {
      console.error("Error registrando agua:", err);
      setError("No se pudo registrar el agua.");
    });
  };

  return (
    <Card className="p-4 flex flex-col gap-3" data-testid="water-card">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-water-muted text-water flex items-center justify-center" aria-hidden>
          <DropIcon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-tight">Agua</h3>
          <p className="text-xs text-text-secondary tabular" data-testid="water-total">
            {formatLiters(liters)} de {formatLiters(targetL)}
            {done && <span className="text-primary font-medium"> · ¡Meta cumplida!</span>}
          </p>
        </div>
        {last && (
          <button
            type="button"
            onClick={() => run(() => removeWaterEntry(uid, date, last))}
            className="text-xs font-medium text-text-secondary hover:text-text-primary px-2 h-8 rounded-lg hover:bg-bg-subtle cursor-pointer"
          >
            Deshacer
          </button>
        )}
      </div>

      <div
        className="h-2 rounded-full bg-water-muted overflow-hidden"
        role="progressbar"
        aria-label="Agua del día"
        aria-valuemin={0}
        aria-valuemax={targetL}
        aria-valuenow={liters}
        aria-valuetext={`${formatLiters(liters)} de ${formatLiters(targetL)}`}
      >
        <div
          className="h-full rounded-full bg-water transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => run(() => addWater(uid, date, GLASS_ML))}
          className="h-11 rounded-xl bg-water-muted text-sm font-semibold hover:brightness-95 active:scale-[0.98] transition cursor-pointer"
        >
          + Vaso <span className="font-normal text-text-secondary">{GLASS_ML} ml</span>
        </button>
        <button
          type="button"
          onClick={() => run(() => addWater(uid, date, BOTTLE_ML))}
          className="h-11 rounded-xl bg-water-muted text-sm font-semibold hover:brightness-95 active:scale-[0.98] transition cursor-pointer"
        >
          + Botella <span className="font-normal text-text-secondary">{BOTTLE_ML} ml</span>
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
  );
}
