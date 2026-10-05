import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { HttpError } from "@/lib/server/http";

// La cuota gratuita de Gemini es por proyecto y se comparte entre todos.
// Este tope diario por usuario evita que una sola persona la agote.
// Documento: users/{uid}/aiUsage/{YYYY-MM-DD}  (solo escribe el servidor)

export const DEFAULT_DAILY_LIMIT = 40;

export function dailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT_PER_USER);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_LIMIT;
}

/** Día actual en hora de Chile, para que el contador se reinicie a medianoche local */
export function usageDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(now);
}

function usageRef(uid: string, day: string) {
  return getAdminDb().doc(`users/${uid}/aiUsage/${day}`);
}

/** Suma 1 al uso del día o lanza 429 si se alcanzó el tope */
export async function consumeDailyQuota(uid: string): Promise<{ day: string; used: number; limit: number }> {
  const day = usageDayKey();
  const limit = dailyLimit();
  const ref = usageRef(uid, day);
  const used = await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.get("count") as number | undefined) ?? 0;
    if (count >= limit) {
      throw new HttpError(
        429,
        "daily_limit",
        `Llegaste al máximo de ${limit} análisis con IA por hoy. Puedes seguir registrando a mano o con la búsqueda.`,
      );
    }
    tx.set(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return count + 1;
  });
  return { day, used, limit };
}

/** Devuelve el intento si el fallo no fue culpa del usuario (IA caída, cuota global) */
export async function refundDailyQuota(uid: string, day: string): Promise<void> {
  try {
    await usageRef(uid, day).update({ count: FieldValue.increment(-1) });
  } catch (err) {
    console.error("No se pudo devolver la cuota de IA:", (err as Error).message);
  }
}
