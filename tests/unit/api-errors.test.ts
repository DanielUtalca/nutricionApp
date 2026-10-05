import { describe, expect, it } from "vitest";
import { mapApiError, suggestsManualFallback } from "@/lib/api-errors";

describe("mapApiError", () => {
  it("usa el mensaje y el código que envía el servidor", () => {
    const body = { error: { code: "daily_limit", message: "Llegaste al máximo de 40 análisis.", retryAfterSeconds: 120 } };
    expect(mapApiError(429, body)).toEqual({
      code: "daily_limit",
      message: "Llegaste al máximo de 40 análisis.",
      retryAfterSeconds: 120,
    });
  });

  it("deduce el mensaje cuando Vercel responde 413 con HTML (cuerpo no JSON)", () => {
    const mapped = mapApiError(413, null);
    expect(mapped.code).toBe("too_large");
    expect(mapped.message).toMatch(/pesada/);
  });

  it("deduce timeout para el 504 de la plataforma", () => {
    const mapped = mapApiError(504, null);
    expect(mapped.code).toBe("timeout");
    expect(mapped.message).toMatch(/tardó demasiado/);
  });

  it("deduce no disponible para 502/503 sin JSON y error interno para otros 5xx", () => {
    expect(mapApiError(502, null).code).toBe("unavailable");
    expect(mapApiError(503, "<html>").code).toBe("unavailable");
    expect(mapApiError(500, undefined).code).toBe("internal");
  });

  it("explica sesión expirada y formato no soportado", () => {
    expect(mapApiError(401, null).code).toBe("unauthenticated");
    expect(mapApiError(415, null).code).toBe("unsupported_type");
  });

  it("toma Retry-After del header si el cuerpo no lo trae", () => {
    expect(mapApiError(429, null, "30").retryAfterSeconds).toBe(30);
    expect(mapApiError(429, null, "abc").retryAfterSeconds).toBeUndefined();
    expect(mapApiError(429, null, null).retryAfterSeconds).toBeUndefined();
  });

  it("ignora cuerpos con forma inesperada", () => {
    expect(mapApiError(400, { error: "texto" }).code).toBe("unknown");
    expect(mapApiError(400, { error: { code: 5, message: "" } }).message).toMatch(/No se pudo analizar/);
  });
});

describe("suggestsManualFallback", () => {
  it("ofrece alternativas cuando la IA no estará disponible un rato", () => {
    for (const code of ["daily_limit", "quota", "not_configured", "unavailable", "timeout", "network", "auth_unavailable"]) {
      expect(suggestsManualFallback(code, 0)).toBe(true);
    }
  });

  it("ofrece alternativas ante cualquier 5xx aunque el código sea desconocido", () => {
    expect(suggestsManualFallback("unknown", 500)).toBe(true);
    expect(suggestsManualFallback(undefined, 504)).toBe(true);
  });

  it("no las ofrece cuando basta con reintentar o cambiar la foto", () => {
    for (const code of ["rate_limited", "not_food", "no_foods", "too_large", "unsupported_type", "blocked", "missing_image"]) {
      expect(suggestsManualFallback(code, 422)).toBe(false);
    }
  });
});
