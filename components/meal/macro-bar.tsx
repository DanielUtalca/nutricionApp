import { MACROS, type MacroKey } from "@/lib/macros";
import { progress } from "@/lib/meals";
import { cn } from "@/lib/cn";

/** Barra horizontal de un macro: consumido vs meta, en su color fijo */
export function MacroBar({
  macro,
  consumed,
  target,
  compact = false,
}: {
  macro: MacroKey;
  consumed: number;
  target: number;
  compact?: boolean;
}) {
  const meta = MACROS[macro];
  const ratio = progress(consumed, target);
  const over = consumed > target && target > 0;
  const shown = Math.round(consumed);

  return (
    <div className="flex flex-col gap-1.5" data-testid={`macro-${macro}`}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden className={cn("w-2 h-2 shrink-0 rounded-full", meta.bgClass)} />
          {meta.label}
        </span>
        <span className="tabular">
          <span className="font-semibold text-text-primary">{shown}</span>
          <span className="text-text-secondary"> / {target} g</span>
          {over && !compact && (
            <span className="ml-1.5 text-xs font-medium text-danger">+{Math.round(consumed - target)}</span>
          )}
        </span>
      </div>
      <div
        className={cn("h-2 rounded-full overflow-hidden", meta.mutedBgClass)}
        role="progressbar"
        aria-label={meta.label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={shown}
        aria-valuetext={`${shown} de ${target} gramos`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", meta.bgClass)}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Mini-resumen de macros en línea: "P 30 · C 45 · G 12" con puntos de color */
export function MacroInline({
  proteinG,
  carbsG,
  fatG,
  className,
}: {
  proteinG: number;
  carbsG: number;
  fatG: number;
  className?: string;
}) {
  const items: [MacroKey, number][] = [
    ["protein", proteinG],
    ["carbs", carbsG],
    ["fat", fatG],
  ];
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-xs text-text-secondary tabular whitespace-nowrap shrink-0", className)}>
      {items.map(([key, value]) => (
        <span key={key} className="inline-flex items-center gap-1" title={MACROS[key].label}>
          <span aria-hidden className={cn("w-1.5 h-1.5 shrink-0 rounded-full", MACROS[key].bgClass)} />
          <span className="sr-only">{MACROS[key].label}</span>
          {Math.round(value)} g
        </span>
      ))}
    </span>
  );
}
