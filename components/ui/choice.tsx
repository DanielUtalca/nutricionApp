"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ChoiceCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  role?: "radio" | "checkbox";
  children?: ReactNode;
  className?: string;
}

/** Opción seleccionable grande (radio o checkbox) para formularios táctiles */
export function ChoiceCard({
  selected,
  onClick,
  title,
  description,
  icon,
  role = "radio",
  children,
  className,
}: ChoiceCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border transition-colors",
        selected ? "border-primary bg-primary-muted" : "border-border bg-bg-surface",
        className,
      )}
    >
      <button
        type="button"
        role={role}
        aria-checked={selected}
        onClick={onClick}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-primary"
      >
        {icon && (
          <span className="text-2xl leading-none w-8 text-center" aria-hidden>
            {icon}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-text-primary">{title}</span>
          {description && (
            <span className="block text-sm text-text-secondary">{description}</span>
          )}
        </span>
        <span
          aria-hidden
          className={cn(
            "w-5 h-5 shrink-0 border-2 flex items-center justify-center",
            role === "radio" ? "rounded-full" : "rounded-md",
            selected ? "border-primary bg-primary" : "border-border",
          )}
        >
          {selected && (
            <svg viewBox="0 0 16 16" className="w-3 h-3 text-on-primary" fill="none">
              <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
      {children}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}

/** Control segmentado (pestañas compactas) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex p-1 rounded-xl bg-bg-subtle gap-1", className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap px-2",
            value === opt.value
              ? "bg-bg-surface text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  format?: (value: number) => string;
}

/** Selector numérico con botones − / + */
export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label, format }: StepperProps) {
  const clamp = (n: number) => Math.min(Math.max(Math.round(n * 100) / 100, min), max);
  const btn =
    "w-10 h-10 rounded-full border border-border bg-bg-surface text-lg font-semibold text-text-primary flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-bg-subtle";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Disminuir ${label}`}
      >
        −
      </button>
      <span className="min-w-12 text-center text-lg font-bold tabular" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label={`Aumentar ${label}`}
      >
        +
      </button>
    </div>
  );
}
