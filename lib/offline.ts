// ============================================================
// offline.ts — Escrituras que no se cuelgan sin conexión
// ============================================================
// Con la caché persistente de Firestore, una escritura queda guardada en
// el dispositivo al instante, pero su promesa solo se resuelve cuando el
// servidor confirma. Sin internet eso puede tardar indefinidamente.
// settleWrite espera la confirmación un rato y, si no llega, sigue: la
// escritura queda en cola y se sincroniza sola al volver la conexión.

export type WriteOutcome = "saved" | "queued";

export async function settleWrite(write: Promise<unknown>, timeoutMs = 3000): Promise<WriteOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<WriteOutcome>((resolve) => {
    timer = setTimeout(() => resolve("queued"), timeoutMs);
  });
  // Si falla después del timeout (p. ej. reglas), al menos queda registrado
  write.catch((err) => console.error("Escritura rechazada al sincronizar:", err));
  try {
    return await Promise.race([write.then(() => "saved" as const), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
