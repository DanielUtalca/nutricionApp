import "server-only";
import { getAdminAuth } from "@/lib/firebase-admin";
import { HttpError } from "@/lib/server/http";

/**
 * Verifica el ID token de Firebase enviado como `Authorization: Bearer <token>`
 * y devuelve el uid. Lanza HttpError 401 si falta o no es válido.
 */
export async function requireUid(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    throw new HttpError(401, "unauthenticated", "Debes iniciar sesión.");
  }
  try {
    // checkRevoked: un token de una sesión cerrada/revocada no sirve
    const decoded = await getAdminAuth().verifyIdToken(match[1], true);
    return decoded.uid;
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    if (code.startsWith("auth/")) {
      throw new HttpError(401, "unauthenticated", "Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    // Error de configuración del Admin SDK (credenciales faltantes, etc.)
    console.error("No se pudo verificar el token:", (err as Error).message);
    throw new HttpError(503, "auth_unavailable", "No se pudo verificar tu sesión. Intenta más tarde.");
  }
}
