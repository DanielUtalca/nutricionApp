"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const inputClasses =
  "w-full h-12 rounded-xl bg-bg-surface border border-border px-3.5 text-base text-text-primary placeholder:text-text-disabled outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-danger";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  suffix?: ReactNode;
}

/** Input con label, sufijo (unidad) y mensaje de error accesible */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, suffix, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClasses, suffix ? "pr-14" : undefined)}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-text-secondary">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export { inputClasses };

/** Convierte el valor de un input numérico a number (o undefined si está vacío) */
export function parseNumberInput(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
