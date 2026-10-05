// Metadatos de presentación de macros: colores fijos en toda la app
// (proteína azul, carbos ámbar, grasa morado — ver CLAUDE.md §8)

export type MacroKey = "protein" | "carbs" | "fat";

export const MACROS: Record<
  MacroKey,
  { label: string; short: string; textClass: string; bgClass: string; mutedBgClass: string; color: string }
> = {
  protein: {
    label: "Proteína",
    short: "P",
    textClass: "text-protein",
    bgClass: "bg-protein",
    mutedBgClass: "bg-protein-muted",
    color: "var(--color-protein)",
  },
  carbs: {
    label: "Carbohidratos",
    short: "C",
    textClass: "text-carbs",
    bgClass: "bg-carbs",
    mutedBgClass: "bg-carbs-muted",
    color: "var(--color-carbs)",
  },
  fat: {
    label: "Grasa",
    short: "G",
    textClass: "text-fat",
    bgClass: "bg-fat",
    mutedBgClass: "bg-fat-muted",
    color: "var(--color-fat)",
  },
};

export const MACRO_KEYS: MacroKey[] = ["protein", "carbs", "fat"];

/** Formatea un número entero con separador de miles chileno (1.234) */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("es-CL");
}

/** Gramos con un decimal solo si hace falta (12 g, 3,5 g) */
export function formatGrams(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded.toLocaleString("es-CL", { maximumFractionDigits: 1 })} g`;
}
