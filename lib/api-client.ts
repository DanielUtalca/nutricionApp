"use client";

// Cliente de /api/analyze-meal: adjunta el ID token y traduce errores

import { auth } from "@/lib/firebase";
import type { AIAnalysisResult, MealSource } from "@/types";

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
  let res: Response;
  try {
    res = await fetch("/api/analyze-meal", { method: "POST", body, headers: { ...(await authHeader()), ...headers } });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Sin conexión. Revisa tu internet e intenta de nuevo.", 0, "network");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error ?? {};
    throw new ApiError(
      error.message ?? "No se pudo analizar la comida. Intenta de nuevo.",
      res.status,
      error.code ?? "unknown",
      error.retryAfterSeconds,
    );
  }
  return data as AnalyzeResponse;
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
