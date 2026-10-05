import { formatInt } from "@/lib/macros";
import { progress } from "@/lib/meals";

/**
 * Anillo de progreso diario de calorías.
 * El número protagonista es lo que queda por comer; si se excede la meta,
 * el arco y el texto pasan a rojo suave (sin alarmismo).
 */
export function CalorieRing({
  consumed,
  target,
  size = 196,
  stroke = 14,
}: {
  consumed: number;
  target: number;
  size?: number;
  stroke?: number;
}) {
  const ratio = progress(consumed, target);
  const over = consumed > target && target > 0;
  const remaining = Math.abs(target - consumed);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.min(ratio, 1) * c;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${formatInt(consumed)} de ${formatInt(target)} kcal consumidas. ${
        over ? `Excedido por ${formatInt(remaining)}` : `Quedan ${formatInt(remaining)}`
      } kcal.`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-primary-muted)"
          strokeWidth={stroke}
        />
        {dash > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? "var(--color-danger)" : "var(--color-primary)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={`text-[2.75rem] leading-none font-bold tracking-tight ${over ? "text-danger" : "text-text-primary"}`}
          data-testid="calories-remaining"
        >
          {formatInt(remaining)}
        </span>
        <span className="mt-1 text-sm text-text-secondary">
          {over ? "kcal de más" : "kcal restantes"}
        </span>
      </div>
    </div>
  );
}
