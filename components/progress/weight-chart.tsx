"use client";

// ============================================================
// Gráfico de evolución del peso (SVG, una sola serie)
// ============================================================
// Línea 2px, área tenue, marcador final con anillo del color de superficie,
// rejilla de 1px recesiva, tooltip con crosshair al pasar el dedo/mouse
// (también navegable con flechas del teclado).

import { useEffect, useMemo, useRef, useState } from "react";
import { niceTicks } from "@/lib/progress";
import { diffDays, formatShortDate, type DateKey } from "@/lib/dates";

interface Point {
  date: DateKey;
  weightKg: number;
}

const HEIGHT = 220;
const PAD = { top: 16, right: 44, bottom: 28, left: 36 };

const fmtKg = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 1 });

export function WeightChart({ points }: { points: Point[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(entry.contentRect.width, 240)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const weights = points.map((p) => p.weightKg);
    const ticks = niceTicks(Math.min(...weights), Math.max(...weights), 4);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const first = points[0].date;
    const span = Math.max(diffDays(first, points[points.length - 1].date), 1);
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (d: DateKey) => PAD.left + (points.length === 1 ? plotW / 2 : (diffDays(first, d) / span) * plotW);
    const y = (w: number) => PAD.top + (1 - (w - yMin) / (yMax - yMin || 1)) * plotH;
    const xy = points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.weightKg) }));
    const line = xy.map((p, i) => `${i ? "L" : "M"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join("");
    const area = `${line}L${xy[xy.length - 1].cx.toFixed(1)},${PAD.top + plotH}L${xy[0].cx.toFixed(1)},${PAD.top + plotH}Z`;
    return { ticks, xy, line, area, y, plotH, plotW };
  }, [points, width]);

  if (!geo) return null;
  const { ticks, xy, line, area, y, plotH } = geo;
  const last = xy[xy.length - 1];
  const shown = active !== null ? xy[active] : null;

  const nearest = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    let best = 0;
    xy.forEach((p, i) => {
      if (Math.abs(p.cx - px) < Math.abs(xy[best].cx - px)) best = i;
    });
    setActive(best);
  };

  // Etiquetas del eje X: primera y última fecha (y una al medio si hay espacio)
  const xLabels = xy.length === 1 ? [xy[0]] : [xy[0], ...(width > 320 && xy.length > 2 ? [xy[Math.floor(xy.length / 2)]] : []), last];

  return (
    <div ref={wrapRef} className="relative select-none touch-pan-y">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Evolución del peso: de ${fmtKg(xy[0].weightKg)} kg el ${formatShortDate(xy[0].date)} a ${fmtKg(last.weightKg)} kg el ${formatShortDate(last.date)}. Usa las flechas para recorrer los registros.`}
        tabIndex={0}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        onPointerMove={(e) => nearest(e.clientX)}
        onPointerDown={(e) => nearest(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setActive((a) => Math.max((a ?? xy.length) - 1, 0));
          if (e.key === "ArrowRight") setActive((a) => Math.min((a ?? -1) + 1, xy.length - 1));
          if (e.key === "Escape") setActive(null);
        }}
        onBlur={() => setActive(null)}
      >
        {/* Rejilla + eje Y */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border-subtle)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-text-secondary text-[11px] tabular">
              {fmtKg(t)}
            </text>
          </g>
        ))}
        {/* Eje X */}
        {xLabels.map((p, i) => (
          <text
            key={`${p.date}-${i}`}
            x={p.cx}
            y={PAD.top + plotH + 18}
            textAnchor={xy.length === 1 ? "middle" : i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
            className="fill-text-secondary text-[11px]"
          >
            {formatShortDate(p.date)}
          </text>
        ))}

        <path d={area} fill="var(--color-primary)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Crosshair */}
        {shown && (
          <line x1={shown.cx} x2={shown.cx} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--text-disabled)" strokeWidth={1} />
        )}

        {/* Marcador final + etiqueta directa (solo el último valor) */}
        <circle cx={last.cx} cy={last.cy} r={5} fill="var(--color-primary)" stroke="var(--bg-surface)" strokeWidth={2} />
        {!shown && (
          <text x={last.cx + 9} y={last.cy} dy="0.32em" className="fill-text-primary text-[12px] font-semibold tabular">
            {fmtKg(last.weightKg)}
          </text>
        )}
        {shown && shown !== last && (
          <circle cx={shown.cx} cy={shown.cy} r={5} fill="var(--color-primary)" stroke="var(--bg-surface)" strokeWidth={2} />
        )}
      </svg>

      {shown && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-bg-surface border border-border shadow-md px-2.5 py-1.5 text-xs whitespace-nowrap"
          style={{ left: Math.min(Math.max(shown.cx, 50), width - 50) }}
          role="status"
        >
          <span className="font-semibold tabular">{fmtKg(shown.weightKg)} kg</span>
          <span className="text-text-secondary"> · {formatShortDate(shown.date)}</span>
        </div>
      )}
    </div>
  );
}
