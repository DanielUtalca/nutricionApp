import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  formatDayLabel,
  isDateKey,
  startOfWeek,
  toDateKey,
  weekDays,
} from "@/lib/dates";

describe("dates", () => {
  it("toDateKey usa la fecha local", () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("addDays cruza meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("startOfWeek devuelve el lunes", () => {
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28"); // domingo → lunes anterior
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28"); // lunes → mismo día
  });

  it("weekDays devuelve 7 días de lunes a domingo", () => {
    const days = weekDays("2026-10-01");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-09-28");
    expect(days[6]).toBe("2026-10-04");
  });

  it("diffDays", () => {
    expect(diffDays("2026-10-01", "2026-10-04")).toBe(3);
  });

  it("isDateKey valida formato y fechas reales", () => {
    expect(isDateKey("2026-10-04")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("04-10-2026")).toBe(false);
    expect(isDateKey(20261004)).toBe(false);
  });

  it("formatDayLabel usa Hoy/Ayer/Mañana", () => {
    expect(formatDayLabel("2026-10-04", "2026-10-04")).toBe("Hoy");
    expect(formatDayLabel("2026-10-03", "2026-10-04")).toBe("Ayer");
    expect(formatDayLabel("2026-10-05", "2026-10-04")).toBe("Mañana");
  });
});
