// ============================================================
// Estrategia de login con Google (puro, testeable)
// ============================================================
// En escritorio se usa popup. En móvil (y en PWA instalada) el popup suele
// fallar o quedar bloqueado, así que se prefiere `signInWithRedirect`; pero
// el redirect solo funciona si `authDomain` es el mismo dominio que sirve la
// app (el handler de Firebase se proxea en `/__/auth/*`, ver next.config.ts):
// con `<proyecto>.firebaseapp.com` Safari/Chrome bloquean el almacenamiento de
// terceros y el usuario vuelve sin sesión. Por eso, mientras `authDomain` no
// coincida con el host, se sigue usando popup.

export type SignInMethod = "popup" | "redirect";

export interface SignInContext {
  userAgent: string;
  /** Equipos táctiles: iPadOS se presenta como Mac de escritorio */
  maxTouchPoints?: number;
  /** App abierta desde el ícono de la pantalla de inicio (PWA instalada) */
  standalone: boolean;
  authDomain: string | undefined;
  /** `window.location.host` (incluye el puerto si lo hay) */
  host: string;
  /** Pruebas locales/E2E con emuladores de Firebase */
  emulators: boolean;
}

export function isMobileUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** `authDomain` apunta al mismo dominio que sirve la app (proxy `/__/auth` activo) */
export function usesSameDomainAuth(authDomain: string | undefined, host: string): boolean {
  return !!authDomain && authDomain.trim().toLowerCase() === host.trim().toLowerCase();
}

export function pickSignInMethod(ctx: SignInContext): SignInMethod {
  if (ctx.emulators || !usesSameDomainAuth(ctx.authDomain, ctx.host)) return "popup";
  return ctx.standalone || isMobileUserAgent(ctx.userAgent, ctx.maxTouchPoints) ? "redirect" : "popup";
}

/** Si el popup falla (bloqueado, entorno sin soporte), ¿se puede reintentar por redirect? */
export function canFallbackToRedirect(ctx: SignInContext): boolean {
  return !ctx.emulators && usesSameDomainAuth(ctx.authDomain, ctx.host);
}

/** Códigos de error del popup que justifican reintentar por redirect */
export function shouldFallbackToRedirect(code: string | undefined): boolean {
  return code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment";
}

/**
 * Navegadores integrados en apps (Instagram, Facebook, TikTok, WebViews…):
 * Google rechaza el login OAuth ahí (`disallowed_useragent`).
 * Una PWA instalada en iOS tampoco trae "Safari" en el UA, pero sí funciona.
 */
export function isEmbeddedBrowser(userAgent: string, standalone = false): boolean {
  if (standalone) return false;
  if (/FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Snapchat|TikTok|BytedanceWebview|Twitter|LinkedInApp|Line\//i.test(userAgent)) {
    return true;
  }
  if (/; wv\)/i.test(userAgent)) return true; // Android WebView
  return /iPhone|iPad|iPod/i.test(userAgent) && !/Safari\//i.test(userAgent); // WKWebView
}

/** Mensaje para el usuario según el código de error de Firebase Auth; `null` = no mostrar nada */
export function authErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return null;
    case "auth/popup-blocked":
      return "Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión. Revisa tu internet e intenta de nuevo.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado para iniciar sesión. Avísale a quien administra la app.";
    case "auth/web-storage-unsupported":
      return "Tu navegador bloquea el almacenamiento necesario. Activa las cookies y no uses el modo privado, o prueba en Safari/Chrome.";
    case "auth/operation-not-supported-in-this-environment":
      return "Este navegador no permite iniciar sesión con Google. Ábrelo en Safari o Chrome.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
    case "auth/user-disabled":
      return "Tu cuenta está deshabilitada.";
    default:
      return "No se pudo iniciar sesión. Intenta de nuevo.";
  }
}
