// ============================================================
// dates.ts — Fechas como claves "YYYY-MM-DD" en hora local
// ============================================================
// Las comidas, agua y pesos se agrupan por día local del usuario
// (no UTC), así una cena a las 23:00 no cae en el día siguiente.

export type DateKey = string; // YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  return toDateKey(parseDateKey(value)) === value;
}

/** Fecha local a mediodía (evita saltos por cambio de horario) */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Lunes de la semana que contiene la fecha */
export function startOfWeek(key: DateKey): DateKey {
  const date = parseDateKey(key);
  const offset = (date.getDay() + 6) % 7; // lunes = 0
  return addDays(key, -offset);
}

/** Los 7 días (lunes → domingo) de la semana que contiene la fecha */
export function weekDays(key: DateKey): DateKey[] {
  const monday = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Diferencia en días entre dos claves (b − a) */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86_400_000);
}

/** "Hoy", "Ayer", "Mañana" o "lun 3 oct" */
export function formatDayLabel(key: DateKey, today: DateKey = todayKey()): string {
  const diff = diffDays(today, key);
  if (diff === 0) return "Hoy";
  if (diff === -1) return "Ayer";
  if (diff === 1) return "Mañana";
  return parseDateKey(key)
    .toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "");
}

/** "3 oct" */
export function formatShortDate(key: DateKey): string {
  return parseDateKey(key)
    .toLocaleDateString("es-CL", { day: "numeric", month: "short" })
    .replace(/\./g, "");
}

/** "lun" */
export function formatWeekday(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString("es-CL", { weekday: "short" }).replace(/\./g, "");
}
