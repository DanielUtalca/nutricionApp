/** Une clases condicionales (alternativa mínima a clsx) */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
