// ============================================================
// Errores de /api/analyze-meal vistos desde el cliente (puro, testeable)
// ============================================================
// El servidor responde `{ error: { code, message, retryAfterSeconds } }`, pero
// la plataforma (Vercel) puede cortar antes con su propia página HTML: 413 si el
// cuerpo es demasiado grande, 504 si la función tarda más que maxDuration, 502/503
// si hay un problema de infraestructura. En esos casos no hay JSON y el mensaje
// se deduce del código HTTP para que el usuario vea algo útil.

export interface MappedApiError {
  message: string;
  code: string;
  retryAfterSeconds?: number;
}

export const OFFLINE_MESSAGE = "Sin conexión. Revisa tu internet e intenta de nuevo.";
export const TIMEOUT_MESSAGE = "El análisis tardó demasiado. Intenta de nuevo.";

function readServerError(body: unknown): { code?: string; message?: string; retryAfterSeconds?: number } | null {
  const error = (body as { error?: unknown } | null)?.error;
  if (!error || typeof error !== "object") return null;
  const { code, message, retryAfterSeconds } = error as Record<string, unknown>;
  return {
    code: typeof code === "string" ? code : undefined,
    message: typeof message === "string" && message ? message : undefined,
    retryAfterSeconds: typeof retryAfterSeconds === "number" ? retryAfterSeconds : undefined,
  };
}

function fromStatus(status: number): { code: string; message: string } {
  if (status === 401) return { code: "unauthenticated", message: "Tu sesión expiró. Vuelve a iniciar sesión." };
  if (status === 413) return { code: "too_large", message: "La foto es demasiado pesada. Prueba con otra o tómala de nuevo." };
  if (status === 415) return { code: "unsupported_type", message: "Formato no soportado. Usa una foto JPG, PNG o WebP." };
  if (status === 429) return { code: "rate_limited", message: "Vas muy rápido. Espera unos segundos antes de analizar otra comida." };
  if (status === 504) return { code: "timeout", message: TIMEOUT_MESSAGE };
  if (status === 502 || status === 503) {
    return { code: "unavailable", message: "El servicio no está disponible en este momento. Intenta en un minuto." };
  }
  if (status >= 500) return { code: "internal", message: "Ocurrió un error en el servidor. Intenta de nuevo." };
  return { code: "unknown", message: "No se pudo analizar la comida. Intenta de nuevo." };
}

/** Traduce una respuesta HTTP de error (con o sin cuerpo JSON de la app) a un mensaje claro */
export function mapApiError(status: number, body: unknown, retryAfterHeader?: string | null): MappedApiError {
  const server = readServerError(body);
  const fallback = fromStatus(status);
  const headerSeconds = Number(retryAfterHeader);
  return {
    message: server?.message ?? fallback.message,
    code: server?.code ?? fallback.code,
    retryAfterSeconds:
      server?.retryAfterSeconds ?? (Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds : undefined),
  };
}

const MANUAL_FALLBACK_CODES = new Set([
  "daily_limit",
  "quota",
  "not_configured",
  "unavailable",
  "timeout",
  "internal",
  "network",
  "auth_unavailable",
  "bad_response",
]);

/**
 * ¿Conviene ofrecer "Buscar alimento / Ingresar a mano"? Sí cuando la IA no
 * va a estar disponible por un rato (cuota, caída, timeout, sin conexión);
 * no cuando basta con reintentar (ritmo por minuto) o con cambiar la foto.
 */
export function suggestsManualFallback(code: string | undefined, status: number): boolean {
  if (code && MANUAL_FALLBACK_CODES.has(code)) return true;
  return status >= 500;
}
