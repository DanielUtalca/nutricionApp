// Límite de peticiones por ventana deslizante, en memoria.
// Es por instancia del servidor (en serverless se reinicia), así que es una
// protección contra ráfagas/doble clic; el tope diario real está en Firestore.

export interface RateLimiter {
  /** Registra un intento. Devuelve ok o los segundos a esperar. */
  check(key: string, now?: number): { ok: true } | { ok: false; retryAfterSeconds: number };
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      // Limpieza ocasional para que el mapa no crezca indefinidamente
      if (hits.size > 1000) {
        for (const [k, times] of hits) {
          if (times.every((t) => now - t >= windowMs)) hits.delete(k);
        }
      }
      return { ok: true };
    },
  };
}
