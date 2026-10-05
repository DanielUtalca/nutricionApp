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

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Por intento. Con el reintento (+1,5 s) el peor caso son ~45,5 s: cabe en el maxDuration de la ruta (60 s)
export const GEMINI_TIMEOUT_MS = 22_000;
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
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

const SYSTEM_PROMPT = `Eres un nutricionista que estima el contenido nutricional de comidas para una app de registro de dieta usada en Chile.
Reglas:
- Identifica cada alimento o preparación visible (o descrita) por separado. Usa nombres en español de Chile (ej. "palta", "marraqueta", "porotos").
- Estima la porción en gramos a partir del tamaño aparente (platos, cubiertos, manos como referencia) y descríbela de forma casera (ej. "1 taza", "1 filete mediano").
- Para cada alimento entrega calorías (kcal) y gramos de proteína, carbohidratos y grasa DE ESA PORCIÓN, coherentes entre sí (kcal ≈ 4·P + 4·C + 9·G).
- Considera aceites, salsas y aderezos visibles o mencionados.
- Si no hay comida o bebida, responde isFood=false y foods vacío.
- confidence: "high" si los alimentos y porciones son claros, "medium" si hay dudas razonables, "low" si es muy incierto.
- title: nombre corto del plato completo (máx. 5 palabras).
- notes: una frase breve solo si hay algo importante que el usuario deba revisar (ej. "no se ve si lleva aceite").`;

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

export async function analyzeWithGemini(
  input: AnalyzeInput,
  options: { fetchImpl?: typeof fetch; apiKey?: string; model?: string; retryDelayMs?: number } = {},
): Promise<AIAnalysisResult & { title?: string }> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIServiceError("El análisis con IA no está configurado en el servidor.", "not_configured", 503);
  }
  const model = options.model ?? (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const doFetch = options.fetchImpl ?? fetch;
  const retryDelayMs = options.retryDelayMs ?? Number(process.env.GEMINI_RETRY_DELAY_MS ?? GEMINI_DEFAULT_RETRY_DELAY_MS);

  const request = () =>
    doFetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
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
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });

  let res: Response;
  try {
    res = await request();
    // Los 500/503 de Gemini ("alta demanda") suelen ser momentáneos: un reintento
    if (res.status >= 500 && retryDelayMs >= 0) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
      res = await request();
    }
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AIServiceError("La IA tardó demasiado en responder. Intenta de nuevo.", "timeout", 504);
    }
    throw new AIServiceError("No se pudo contactar al servicio de IA.", "unavailable", 502);
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const status = res.status;
    const googleMessage = (body as { error?: { message?: string } })?.error?.message ?? "";
    // No se registra el cuerpo completo para no filtrar datos; solo estado y mensaje
    console.error(`Gemini respondió ${status}: ${googleMessage.slice(0, 200)}`);
    if (status === 429) {
      throw new AIServiceError(
        "Se alcanzó el límite gratuito de la IA por ahora. Prueba en un rato o registra la comida a mano.",
        "quota",
        429,
        retryAfterSeconds(res, body),
      );
    }
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
      );
    }
    if (status >= 500) {
      throw new AIServiceError("La IA está saturada en este momento. Intenta en un minuto.", "unavailable", 503);
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
    const blocked = candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT";
    throw new AIServiceError(
      blocked ? "La IA no pudo procesar esta imagen." : "La IA no devolvió resultados. Intenta de nuevo.",
      blocked ? "blocked" : "bad_response",
      blocked ? 422 : 502,
    );
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
      throw new AIServiceError("La respuesta de la IA vino incompleta. Intenta de nuevo.", "bad_response", 502);
    }
    throw err;
  }
}
