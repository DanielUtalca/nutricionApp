// ============================================================
// gemini.ts — Llamada a Gemini (solo servidor)
// ============================================================
// Usa la API REST generateContent con salida estructurada (JSON schema).
// Se evita el SDK para no depender de cambios de versión: la API REST
// es estable y la respuesta se valida igual con Zod (lib/ai/parse.ts).

import "server-only";
import { parseAnalysis, AIParseError } from "@/lib/ai/parse";
import type { AIAnalysisResult } from "@/types";

/**
 * Modelo por defecto: Flash-Lite estable vigente a oct-2026 según
 * https://ai.google.dev/gemini-api/docs/models. Se puede cambiar sin tocar
 * código con la variable GEMINI_MODEL (Google renombra versiones seguido).
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Modelos de respaldo, en orden. En el plan gratuito un modelo responde seguido
 * 503 ("high demand") o se cuelga mientras otro responde en 2-5 s; cada modelo
 * tiene su propia capacidad y cuota, así que se pasa al siguiente en vez de
 * esperar. Gemma 4 corre aparte y fue el más estable en las pruebas (oct-2026).
 * Configurable con GEMINI_FALLBACK_MODELS (separados por coma; "none" = sin respaldo).
 */
export const DEFAULT_GEMINI_FALLBACK_MODELS = ["gemma-4-26b-a4b-it", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Por intento: Flash-Lite responde en 2-8 s y Gemma en ~10 s; si un modelo se cuelga conviene probar el siguiente
export const GEMINI_TIMEOUT_MS = 15_000;
// Tiempo total de todos los intentos: cabe en el maxDuration de la ruta (60 s) y en el timeout del cliente (55 s)
export const GEMINI_TOTAL_BUDGET_MS = 48_000;
// No se empieza un intento con menos tiempo que esto
const MIN_ATTEMPT_MS = 4_000;
// Espera antes de reintentar cuando hay un solo modelo configurado
export const GEMINI_DEFAULT_RETRY_DELAY_MS = 1500;

export type AIErrorCode =
  | "not_configured"
  | "quota"
  | "unavailable"
  | "blocked"
  | "timeout"
  | "bad_response"
  | "not_food"
  | "no_foods";

export class AIServiceError extends Error {
  constructor(
    message: string,
    readonly code: AIErrorCode,
    readonly status: number,
    readonly retryAfterSeconds?: number,
    /** true si otro modelo podría responder (saturación, cuota del modelo, timeout, modelo retirado) */
    readonly tryNextModel = false,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

const UNAVAILABLE_MESSAGE = "La IA está saturada en este momento. Intenta en un minuto.";

const SYSTEM_PROMPT = `Eres un nutricionista que estima el contenido nutricional de comidas para una app de registro de dieta usada en Chile.

Antes de estimar, examina la imagen (o la descripción) con calma y sigue estos pasos:
1. Inventario: enumera TODOS los componentes comestibles que se ven o se mencionan, uno por uno. Revisa cada zona del plato, incluidos los elementos pequeños o parcialmente tapados: proteína (carne, pollo, pescado, huevo, legumbres), acompañamientos (arroz, papas, pasta, pan), verduras y ensaladas, salsas, aderezos, quesos, palta, aceite visible, y la bebida si aparece.
2. Preparación: para cada componente, deduce cómo fue cocinado (frito, al horno, a la plancha, cocido, crudo) porque cambia mucho las calorías. Si hay brillo o charcos de aceite, considéralo.
3. Porción: estima el tamaño usando el plato, los cubiertos o las manos como referencia. Descríbelo de forma casera (ej. "1 taza", "1 filete mediano", "2 cucharadas").
4. Valores: para cada componente entrega calorías (kcal) y gramos de proteína, carbohidratos y grasa DE ESA PORCIÓN, coherentes entre sí (kcal ≈ 4·P + 4·C + 9·G). Usa valores típicos de tablas nutricionales, no de porciones de restaurante extra grandes salvo que se vea así.

Reglas:
- Nombres en español de Chile (ej. "palta", "marraqueta", "porotos", "charquicán").
- Si un componente no se ve con claridad pero es probable (ej. aceite de cocción, pan de acompañamiento), inclúyelo y explícalo en notes en vez de omitirlo.
- Si no hay comida o bebida, responde isFood=false y foods vacío.
- confidence: "high" si los componentes y porciones son claros; "medium" si hay dudas razonables sobre algún componente o porción; "low" si la imagen es borrosa, muy oscura o muy incierta.
- title: nombre corto del plato completo (máx. 5 palabras).
- notes: una o dos frases con lo que el usuario debe revisar (ej. "no se ve si lleva aceite", "la porción de arroz es una estimación"). Si las indicaciones del usuario corrigen algo, respétalas.`;

// Esquema de salida (subconjunto OpenAPI que acepta Gemini)
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isFood: { type: "BOOLEAN" },
    title: { type: "STRING" },
    foods: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          portionDescription: { type: "STRING" },
          portionGrams: { type: "NUMBER" },
          calories: { type: "NUMBER" },
          proteinG: { type: "NUMBER" },
          carbsG: { type: "NUMBER" },
          fatG: { type: "NUMBER" },
        },
        required: ["name", "portionDescription", "portionGrams", "calories", "proteinG", "carbsG", "fatG"],
      },
    },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    notes: { type: "STRING" },
  },
  required: ["isFood", "foods", "confidence"],
} as const;

export type AnalyzeInput =
  | { kind: "image"; mimeType: string; base64: string; hint?: string }
  | { kind: "text"; description: string };

type AnalysisWithTitle = AIAnalysisResult & { title?: string };

function buildParts(input: AnalyzeInput) {
  if (input.kind === "image") {
    const instruction = input.hint
      ? `Analiza esta foto de comida. Indicaciones del usuario (pueden corregir lo que se ve): "${input.hint}"`
      : "Analiza esta foto de comida.";
    return [{ inline_data: { mime_type: input.mimeType, data: input.base64 } }, { text: instruction }];
  }
  return [{ text: `Estima la comida descrita por el usuario: "${input.description}"` }];
}

/** Retry-After de una respuesta 429 de Google (header o RetryInfo del cuerpo) */
function retryAfterSeconds(res: Response, body: unknown): number | undefined {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;
  const details = (body as { error?: { details?: { retryDelay?: string }[] } })?.error?.details;
  const delay = details?.find((d) => d.retryDelay)?.retryDelay;
  const seconds = delay ? Number.parseFloat(delay) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds) : undefined;
}

/** Modelo principal + respaldos, sin repetidos */
export function geminiModelChain(primary?: string, fallbacks?: string): string[] {
  const main = primary || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const raw = (fallbacks ?? process.env.GEMINI_FALLBACK_MODELS ?? "").trim();
  let extra: string[];
  if (raw.toLowerCase() === "none") extra = [];
  else if (raw) extra = raw.split(",").map((m) => m.trim()).filter(Boolean);
  else extra = DEFAULT_GEMINI_FALLBACK_MODELS;
  return [...new Set([main, ...extra])];
}

type AttemptOptions = { doFetch: typeof fetch; apiKey: string; model: string; timeoutMs: number };

/** Un intento contra un modelo. Lanza AIServiceError con tryNextModel si conviene probar otro */
async function analyzeOnce(input: AnalyzeInput, { doFetch, apiKey, model, timeoutMs }: AttemptOptions): Promise<AnalysisWithTitle> {
  let res: Response;
  let body: unknown;
  try {
    res = await doFetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: buildParts(input) }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await res.json().catch(() => null);
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error(`Gemini (${model}) no respondió en ${timeoutMs} ms`);
      throw new AIServiceError("La IA tardó demasiado en responder. Intenta de nuevo.", "timeout", 504, undefined, true);
    }
    console.error(`Gemini (${model}): error de red`);
    throw new AIServiceError("No se pudo contactar al servicio de IA.", "unavailable", 502, undefined, true);
  }

  if (!res.ok) {
    const status = res.status;
    const googleMessage = (body as { error?: { message?: string } })?.error?.message ?? "";
    // No se registra el cuerpo completo para no filtrar datos; solo estado y mensaje
    console.error(`Gemini (${model}) respondió ${status}: ${googleMessage.slice(0, 200)}`);
    if (status === 429) {
      throw new AIServiceError(
        "Se alcanzó el límite gratuito de la IA por ahora. Prueba en un rato o registra la comida a mano.",
        "quota",
        429,
        retryAfterSeconds(res, body),
        true,
      );
    }
    // Problemas de clave o permisos afectan a todos los modelos: no se prueba otro
    if (status === 400 && /api key/i.test(googleMessage)) {
      throw new AIServiceError("La clave de la IA no es válida (revisar configuración).", "not_configured", 503);
    }
    if (status === 401 || status === 403) {
      throw new AIServiceError("El servidor no tiene acceso a la IA (revisar clave o permisos).", "not_configured", 503);
    }
    if (status === 404) {
      throw new AIServiceError(
        `El modelo "${model}" no está disponible. Actualiza GEMINI_MODEL.`,
        "not_configured",
        503,
        undefined,
        true,
      );
    }
    if (status >= 500) {
      throw new AIServiceError(UNAVAILABLE_MESSAGE, "unavailable", 503, undefined, true);
    }
    throw new AIServiceError("La IA rechazó la petición.", "bad_response", 502);
  }

  const data = body as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  } | null;

  if (data?.promptFeedback?.blockReason) {
    throw new AIServiceError("La IA no pudo procesar esta imagen.", "blocked", 422);
  }
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
      throw new AIServiceError("La IA no pudo procesar esta imagen.", "blocked", 422);
    }
    throw new AIServiceError("La IA no devolvió resultados. Intenta de nuevo.", "bad_response", 502, undefined, true);
  }

  try {
    return parseAnalysis(text);
  } catch (err) {
    if (err instanceof AIParseError) {
      if (err.code === "not_food") {
        throw new AIServiceError("No encontramos comida en la foto. Prueba con otra imagen.", "not_food", 422);
      }
      if (err.code === "no_foods") {
        throw new AIServiceError("La IA no reconoció alimentos. Prueba con otra foto o descríbelo.", "no_foods", 422);
      }
      throw new AIServiceError("La respuesta de la IA vino incompleta. Intenta de nuevo.", "bad_response", 502, undefined, true);
    }
    throw err;
  }
}

/**
 * Error final cuando ningún modelo respondió, priorizando lo más útil para el
 * usuario: saturación > timeout > cuota > modelo inexistente > respuesta inválida.
 */
function pickFinalError(errors: AIServiceError[]): AIServiceError {
  const priority: AIErrorCode[] = ["unavailable", "timeout", "quota", "not_configured", "bad_response"];
  for (const code of priority) {
    const matching = errors.filter((e) => e.code === code);
    if (matching.length === 0) continue;
    if (code === "unavailable") return new AIServiceError(UNAVAILABLE_MESSAGE, "unavailable", 503);
    if (code === "quota") {
      const waits = matching.map((e) => e.retryAfterSeconds).filter((n): n is number => n !== undefined);
      return new AIServiceError(matching[0].message, "quota", 429, waits.length ? Math.min(...waits) : undefined);
    }
    return matching[0];
  }
  return errors[errors.length - 1];
}

export async function analyzeWithGemini(
  input: AnalyzeInput,
  options: {
    fetchImpl?: typeof fetch;
    apiKey?: string;
    model?: string;
    fallbackModels?: string;
    retryDelayMs?: number;
    budgetMs?: number;
  } = {},
): Promise<AnalysisWithTitle> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIServiceError("El análisis con IA no está configurado en el servidor.", "not_configured", 503);
  }
  const chain = geminiModelChain(options.model, options.fallbackModels);
  const doFetch = options.fetchImpl ?? fetch;
  const retryDelayMs = options.retryDelayMs ?? Number(process.env.GEMINI_RETRY_DELAY_MS ?? GEMINI_DEFAULT_RETRY_DELAY_MS);
  const deadline = Date.now() + (options.budgetMs ?? GEMINI_TOTAL_BUDGET_MS);

  // Con un solo modelo se conserva un reintento tras una espera corta (los 503 suelen ser momentáneos)
  const attempts = chain.length === 1 ? [chain[0], chain[0]] : chain;
  const errors: AIServiceError[] = [];

  for (const [i, model] of attempts.entries()) {
    if (i > 0 && chain.length === 1) {
      if (errors[errors.length - 1].code !== "unavailable" || retryDelayMs < 0) break;
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
    const remaining = deadline - Date.now();
    if (i > 0 && remaining < MIN_ATTEMPT_MS) break;
    try {
      const result = await analyzeOnce(input, {
        doFetch,
        apiKey,
        model,
        timeoutMs: Math.max(1, Math.min(GEMINI_TIMEOUT_MS, remaining)),
      });
      if (i > 0) console.warn(`Gemini: respondió el modelo de respaldo ${model}`);
      return result;
    } catch (err) {
      if (!(err instanceof AIServiceError) || !err.tryNextModel) throw err;
      errors.push(err);
    }
  }
  throw pickFinalError(errors);
}
