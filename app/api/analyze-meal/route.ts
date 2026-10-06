// ============================================================
// POST /api/analyze-meal
// ============================================================
// Analiza una comida con Gemini y devuelve alimentos + calorías + macros.
//
// Entrada (requiere `Authorization: Bearer <Firebase ID token>`):
//   - multipart/form-data con `image` (JPEG/PNG/WebP ≤ 3 MB) y `hint` opcional
//   - application/json con { "description": "2 huevos revueltos y pan" }
//
// La imagen NO se guarda en ningún lado: se lee en memoria, se envía a
// Gemini y se descarta. Solo el cliente guarda el resultado en Firestore.

import { requireUid } from "@/lib/server/auth";
import { consumeDailyQuota, refundDailyQuota } from "@/lib/server/ai-quota";
import { createRateLimiter } from "@/lib/server/rate-limit";
import { HttpError, errorResponse, httpErrorResponse } from "@/lib/server/http";
import { analyzeWithGemini, AIServiceError, type AnalyzeInput } from "@/lib/ai/gemini";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_HINT_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_LABEL,
  detectImageType,
} from "@/lib/ai/image";

// Gemini: modelo principal + respaldos en ≤ 48 s en total (lib/ai/gemini.ts) + auth y cuota
export const maxDuration = 60;

// Ráfagas: máx. 6 análisis por minuto por usuario (Flash-Lite free ≈ 15 RPM por proyecto)
const limiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

/** Margen para el overhead de multipart sobre el tamaño de la imagen */
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

async function readInput(request: Request): Promise<AnalyzeInput> {
  const contentType = request.headers.get("content-type") ?? "";
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "too_large", `La imagen es demasiado grande (máx. ${MAX_IMAGE_LABEL}).`);
  }

  if (contentType.startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "bad_request", "No se pudo leer la imagen enviada.");
    }
    const file = form.get("image");
    if (!(file instanceof Blob) || file.size === 0) {
      throw new HttpError(400, "missing_image", "Falta la imagen.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new HttpError(413, "too_large", `La imagen es demasiado grande (máx. ${MAX_IMAGE_LABEL}).`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = detectImageType(bytes);
    if (!mimeType) {
      throw new HttpError(415, "unsupported_type", "Formato no soportado. Usa una foto JPG, PNG o WebP.");
    }
    const hintRaw = form.get("hint");
    const hint = typeof hintRaw === "string" ? hintRaw.trim().slice(0, MAX_HINT_LENGTH) : "";
    return {
      kind: "image",
      mimeType,
      base64: Buffer.from(bytes).toString("base64"),
      hint: hint || undefined,
    };
  }

  if (contentType.startsWith("application/json")) {
    const body = (await request.json().catch(() => null)) as { description?: unknown } | null;
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (description.length < 3) {
      throw new HttpError(400, "missing_description", "Describe lo que comiste.");
    }
    return { kind: "text", description: description.slice(0, MAX_DESCRIPTION_LENGTH) };
  }

  throw new HttpError(415, "unsupported_type", "Envía una imagen (multipart) o una descripción (JSON).");
}

export async function POST(request: Request): Promise<Response> {
  let uid: string;
  let quotaDay: string | undefined;
  try {
    uid = await requireUid(request);

    const rate = limiter.check(uid);
    if (!rate.ok) {
      throw new HttpError(
        429,
        "rate_limited",
        "Vas muy rápido. Espera unos segundos antes de analizar otra comida.",
        rate.retryAfterSeconds,
      );
    }

    const input = await readInput(request);
    try {
      quotaDay = (await consumeDailyQuota(uid)).day;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Si el contador no está disponible no se bloquea al usuario (queda el límite por minuto)
      console.error("No se pudo registrar la cuota diaria de IA:", (err as Error)?.message);
    }

    const result = await analyzeWithGemini(input);
    return Response.json(
      { result, source: input.kind === "image" ? "ai_photo" : "ai_text" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AIServiceError) {
      // Si falló por algo ajeno al usuario no se le descuenta el intento
      if (quotaDay && (err.status >= 500 || err.code === "quota")) {
        await refundDailyQuota(uid!, quotaDay);
      }
      return errorResponse(err.status, err.code, err.message, err.retryAfterSeconds);
    }
    if (err instanceof HttpError) return httpErrorResponse(err);
    console.error("Error inesperado en analyze-meal:", (err as Error)?.message);
    return errorResponse(500, "internal", "Ocurrió un error inesperado. Intenta de nuevo.");
  }
}
