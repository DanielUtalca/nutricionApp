"use client";

// Cliente de /api/analyze-meal: adjunta el ID token y traduce errores

import { auth } from "@/lib/firebase";
import { mapApiError, OFFLINE_MESSAGE, TIMEOUT_MESSAGE } from "@/lib/api-errors";
import type { AIAnalysisResult, MealSource } from "@/types";

/**
 * Tiempo máximo de espera. El servidor corta a los 60 s (maxDuration) y su peor
 * caso con reintento a Gemini ronda los 46 s: esperar un poco más que eso evita
 * dejar al usuario mirando "Analizando…" sin fin si la conexión se cuelga.
 */
export const REQUEST_TIMEOUT_MS = 55_000;

export interface AnalyzeResponse {
  result: AIAnalysisResult & { title?: string };
  source: Extract<MealSource, "ai_photo" | "ai_text">;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new ApiError("Debes iniciar sesión.", 401, "unauthenticated");
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

async function post(body: BodyInit, headers: Record<string, string>): Promise<AnalyzeResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError(OFFLINE_MESSAGE, 0, "network");
  }

  // AbortController + setTimeout (en vez de AbortSignal.timeout) para iOS < 16
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch("/api/analyze-meal", {
        method: "POST",
        body,
        headers: { ...(await authHeader()), ...headers },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (timedOut) throw new ApiError(TIMEOUT_MESSAGE, 0, "timeout");
      throw new ApiError(OFFLINE_MESSAGE, 0, "network");
    }

    // El cuerpo también cuenta para el timeout: si se corta aquí, `data` queda null
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapApiError(res.status, data, res.headers.get("retry-after"));
      throw new ApiError(mapped.message, res.status, mapped.code, mapped.retryAfterSeconds);
    }
    if (!data?.result) {
      throw new ApiError(
        timedOut ? TIMEOUT_MESSAGE : "La respuesta del servidor llegó incompleta. Intenta de nuevo.",
        res.status,
        timedOut ? "timeout" : "bad_response",
      );
    }
    return data as AnalyzeResponse;
  } finally {
    clearTimeout(timer);
  }
}

export function analyzeMealPhoto(image: Blob, hint?: string): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("image", image, "meal.jpg");
  if (hint?.trim()) form.append("hint", hint.trim());
  return post(form, {});
}

export function analyzeMealText(description: string): Promise<AnalyzeResponse> {
  return post(JSON.stringify({ description }), { "Content-Type": "application/json" });
}
