// ============================================================
// db.ts — Acceso a Firestore desde el cliente
// ============================================================
// Todas las rutas cuelgan de users/{uid}; las reglas de seguridad
// garantizan que cada usuario solo lee y escribe lo suyo.

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DateKey } from "@/lib/dates";

export const paths = {
  user: (uid: string) => `users/${uid}`,
  weightLogs: (uid: string) => `users/${uid}/weightLogs`,
};

// ----- Peso ------------------------------------------------------------------

export interface WeightLogInput {
  date: DateKey;
  weightKg: number;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  notes?: string;
}

/** Un registro por día: el id del documento es la fecha (re-registrar sobrescribe) */
export async function addWeightLog(uid: string, input: WeightLogInput): Promise<void> {
  await setDoc(doc(db, paths.weightLogs(uid), input.date), {
    uid,
    ...input,
    createdAt: serverTimestamp(),
  });
}
