import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ----- Mocks: Firebase Admin (auth) y cuota diaria -----------------------------
const verifyIdToken = vi.fn();
vi.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: () => ({ verifyIdToken }),
  getAdminDb: () => {
    throw new Error("no se usa en estos tests");
  },
}));

const consumeDailyQuota = vi.fn();
const refundDailyQuota = vi.fn();
vi.mock("@/lib/server/ai-quota", () => ({
  consumeDailyQuota: (...args: unknown[]) => consumeDailyQuota(...args),
  refundDailyQuota: (...args: unknown[]) => refundDailyQuota(...args),
}));

const { POST, maxDuration } = await import("@/app/api/analyze-meal/route");
const { GEMINI_TIMEOUT_MS, GEMINI_TOTAL_BUDGET_MS, GEMINI_DEFAULT_RETRY_DELAY_MS, DEFAULT_GEMINI_FALLBACK_MODELS } =
  await import("@/lib/ai/gemini");
// REQUEST_TIMEOUT_MS de lib/api-client.ts (no se importa: depende del SDK de Firebase del cliente)
const ANALYZE_TIMEOUT_MS = 55_000;
const { MAX_IMAGE_BYTES } = await import("@/lib/ai/image");
const { HttpError } = await import("@/lib/server/http");

// JPEG mínimo (solo importan los magic bytes para la validación)
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const geminiOk = (payload: unknown) =>
  new Response(
    JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const goodAnalysis = {
  isFood: true,
  title: "Huevos con palta",
  confidence: "high",
  foods: [
    { name: "Huevo revuelto", portionDescription: "2 unidades", portionGrams: 100, calories: 150, proteinG: 12.6, carbsG: 1, fatG: 10.5 },
    { name: "Palta", portionDescription: "1/2 unidad", portionGrams: 70, calories: 112, proteinG: 1.4, carbsG: 6, fatG: 10.3 },
  ],
};

let userCounter = 0;
function photoRequest({ token = "valid", bytes = JPEG, hint }: { token?: string | null; bytes?: Uint8Array<ArrayBuffer>; hint?: string } = {}) {
  const form = new FormData();
  form.append("image", new Blob([bytes], { type: "image/jpeg" }), "meal.jpg");
  if (hint) form.append("hint", hint);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/analyze-meal", { method: "POST", body: form, headers });
}

function textRequest(description: unknown, token = "valid") {
  return new Request("http://localhost/api/analyze-meal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  // Cada test usa un uid distinto para no chocar con el límite por minuto
  userCounter += 1;
  const uid = `user-${userCounter}`;
  verifyIdToken.mockReset().mockImplementation(async (token: string) => {
    if (token === "valid") return { uid };
    throw Object.assign(new Error("invalid token"), { code: "auth/argument-error" });
  });
  consumeDailyQuota.mockReset().mockResolvedValue({ day: "2026-10-04", used: 1, limit: 40 });
  refundDailyQuota.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "");
  vi.stubEnv("GEMINI_FALLBACK_MODELS", "");
  vi.stubEnv("GEMINI_RETRY_DELAY_MS", "0");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/analyze-meal — autenticación", () => {
  it("rechaza peticiones sin token (401) y no llama a la IA", async () => {
    const res = await POST(photoRequest({ token: null }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeDailyQuota).not.toHaveBeenCalled();
  });

  it("rechaza tokens inválidos (401)", async () => {
    const res = await POST(photoRequest({ token: "forged" }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifica el token pidiendo chequeo de revocación", async () => {
    fetchMock.mockResolvedValue(geminiOk(goodAnalysis));
    await POST(photoRequest());
    expect(verifyIdToken).toHaveBeenCalledWith("valid", true);
  });
});

describe("POST /api/analyze-meal — validación de entrada", () => {
  it("rechaza archivos que no son imágenes (415)", async () => {
    const res = await POST(photoRequest({ bytes: new TextEncoder().encode("<script>alert(1)</script>") }));
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza imágenes de más de 3 MB (413)", async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 10);
    big.set(JPEG);
    const res = await POST(photoRequest({ bytes: big }));
    expect(res.status).toBe(413);
    expect((await res.json()).error.message).toMatch(/3 MB/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acepta una imagen justo por debajo del tope", async () => {
    const nearLimit = new Uint8Array(MAX_IMAGE_BYTES - 1024);
    nearLimit.set(JPEG);
    fetchMock.mockResolvedValue(geminiOk(goodAnalysis));
    const res = await POST(photoRequest({ bytes: nearLimit }));
    expect(res.status).toBe(200);
  });

  it("mantiene el tope de imagen bajo el límite de cuerpo de Vercel (4,5 MB) con margen", () => {
    expect(MAX_IMAGE_BYTES + 64 * 1024).toBeLessThan(4.5 * 1024 * 1024);
  });

  it("el peor caso de Gemini (todos los modelos) cabe en maxDuration y en el timeout del cliente", () => {
    expect(GEMINI_TOTAL_BUDGET_MS + 5_000).toBeLessThan(maxDuration * 1000);
    expect(GEMINI_TOTAL_BUDGET_MS + 5_000).toBeLessThan(ANALYZE_TIMEOUT_MS);
    // Con un solo modelo: 2 intentos + espera
    expect(2 * GEMINI_TIMEOUT_MS + GEMINI_DEFAULT_RETRY_DELAY_MS).toBeLessThan(GEMINI_TOTAL_BUDGET_MS);
  });

  it("rechaza descripciones vacías (400)", async () => {
    const res = await POST(textRequest("  "));
    expect(res.status).toBe(400);
  });

  it("rechaza content-type no soportado (415)", async () => {
    const res = await POST(
      new Request("http://localhost/api/analyze-meal", {
        method: "POST",
        headers: { Authorization: "Bearer valid", "Content-Type": "text/plain" },
        body: "hola",
      }),
    );
    expect(res.status).toBe(415);
  });
});

describe("POST /api/analyze-meal — análisis", () => {
  it("analiza una foto y devuelve JSON validado con totales recalculados", async () => {
    fetchMock.mockResolvedValue(geminiOk(goodAnalysis));
    const res = await POST(photoRequest({ hint: "con aceite" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("ai_photo");
    expect(body.result.foods).toHaveLength(2);
    expect(body.result.totalCalories).toBe(262);
    expect(body.result.totalProteinG).toBe(14);

    // Se envía la imagen inline al modelo Flash-Lite por defecto, con la clave en header
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-3.5-flash-lite:generateContent");
    expect(url).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const sent = JSON.parse(init.body);
    expect(sent.contents[0].parts[0].inline_data.mime_type).toBe("image/jpeg");
    expect(sent.contents[0].parts[1].text).toContain("con aceite");
    expect(sent.generationConfig.responseMimeType).toBe("application/json");
  });

  it("analiza una descripción de texto", async () => {
    fetchMock.mockResolvedValue(geminiOk(goodAnalysis));
    const res = await POST(textRequest("dos huevos revueltos con media palta"));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("ai_text");
  });

  it("respeta GEMINI_MODEL si está configurado", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-9-flash-lite");
    fetchMock.mockResolvedValue(geminiOk(goodAnalysis));
    await POST(photoRequest());
    expect(fetchMock.mock.calls[0][0]).toContain("gemini-9-flash-lite:generateContent");
  });

  it("cuota de Gemini agotada en todos los modelos → 429 con mensaje claro y Retry-After; se devuelve el intento", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: "Resource has been exhausted",
            status: "RESOURCE_EXHAUSTED",
            details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "37s" }],
          },
        }),
        { status: 429 },
      ),
    );
    const res = await POST(photoRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("37");
    const body = await res.json();
    expect(body.error.code).toBe("quota");
    expect(body.error.message).toMatch(/límite gratuito/);
    expect(refundDailyQuota).toHaveBeenCalled();
  });

  it("tope diario por usuario → 429 sin llamar a la IA", async () => {
    consumeDailyQuota.mockRejectedValue(new HttpError(429, "daily_limit", "Llegaste al máximo"));
    const res = await POST(photoRequest());
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("daily_limit");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("límite por minuto: el 7.º análisis seguido devuelve 429", async () => {
    fetchMock.mockImplementation(async () => geminiOk(goodAnalysis));
    for (let i = 0; i < 6; i++) {
      expect((await POST(photoRequest())).status).toBe(200);
    }
    const res = await POST(photoRequest());
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("rate_limited");
  });

  it("foto sin comida → 422 not_food", async () => {
    fetchMock.mockResolvedValue(geminiOk({ isFood: false, foods: [], confidence: "high" }));
    const res = await POST(photoRequest());
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("not_food");
  });

  it("respuesta corrupta de la IA en todos los modelos → 502 y se devuelve el intento", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "lo siento, no puedo" }] } }] }), {
        status: 200,
      }),
    );
    const res = await POST(photoRequest());
    expect(res.status).toBe(502);
    expect(refundDailyQuota).toHaveBeenCalled();
  });

  it("IA caída en todos los modelos (500) → 503 unavailable tras probar cada respaldo", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 500 }));
    const res = await POST(photoRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1 + DEFAULT_GEMINI_FALLBACK_MODELS.length);
    expect(refundDailyQuota).toHaveBeenCalled();
  });

  it("modelo principal saturado (503) → responde el primer respaldo", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "high demand" } }), { status: 503 }))
      .mockResolvedValueOnce(geminiOk(goodAnalysis));
    const res = await POST(photoRequest());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("gemini-3.5-flash-lite:generateContent");
    expect(fetchMock.mock.calls[1][0]).toContain(`${DEFAULT_GEMINI_FALLBACK_MODELS[0]}:generateContent`);
  });

  it("cuota agotada solo en un modelo (429) → prueba el siguiente", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "exhausted" } }), { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(geminiOk(goodAnalysis));
    const res = await POST(photoRequest());
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("un modelo que se cuelga se corta y responde el respaldo", async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { name: "TimeoutError" }))
      .mockResolvedValueOnce(geminiOk(goodAnalysis));
    const res = await POST(photoRequest());
    expect(res.status).toBe(200);
    // Cada intento tiene su propio timeout
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("saturación + timeout mezclados → 503 unavailable (no 504)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("gemma")) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
      return new Response("{}", { status: 503 });
    });
    const res = await POST(photoRequest());
    expect(res.status).toBe(503);
  });

  it("GEMINI_FALLBACK_MODELS define la cadena; con un solo modelo se reintenta una vez", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "none");
    fetchMock.mockImplementation(async () => new Response("{}", { status: 503 }));
    expect((await POST(photoRequest())).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("gemini-3.5-flash-lite:generateContent");

    fetchMock.mockReset().mockImplementation(async () => new Response("{}", { status: 503 }));
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "modelo-a, modelo-b");
    await POST(photoRequest());
    expect(fetchMock.mock.calls.map(([url]) => String(url).match(/models\/([^:]+)/)?.[1])).toEqual([
      "gemini-3.5-flash-lite",
      "modelo-a",
      "modelo-b",
    ]);
  });

  it("errores 4xx no se reintentan ni pasan a otro modelo", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 }));
    await POST(photoRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clave inválida (403) no prueba otros modelos", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: "denied" } }), { status: 403 }));
    const res = await POST(photoRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("not_configured");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("foto sin comida no prueba otros modelos", async () => {
    fetchMock.mockResolvedValue(geminiOk({ isFood: false, foods: [], confidence: "high" }));
    await POST(photoRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("modelo principal retirado (404) → usa el respaldo", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 }))
      .mockResolvedValueOnce(geminiOk(goodAnalysis));
    expect((await POST(photoRequest())).status).toBe(200);
  });

  it("todos los modelos inexistentes (404) → 503 con indicación de actualizar GEMINI_MODEL", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 }));
    const res = await POST(photoRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toMatch(/GEMINI_MODEL/);
  });

  it("sin GEMINI_API_KEY → 503 not_configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(photoRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("si el contador diario falla, el análisis sigue funcionando", async () => {
    consumeDailyQuota.mockRejectedValue(new Error("firestore caído"));
    fetchMock.mockResolvedValue(geminiOk(goodAnalysis));
    const res = await POST(photoRequest());
    expect(res.status).toBe(200);
  });
});
