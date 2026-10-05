import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  canFallbackToRedirect,
  isEmbeddedBrowser,
  isMobileUserAgent,
  pickSignInMethod,
  shouldFallbackToRedirect,
  usesSameDomainAuth,
  type SignInContext,
} from "@/lib/auth-strategy";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  iphonePwa:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
  ipadSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const HOST = "nutricion-app-theta.vercel.app";

function ctx(overrides: Partial<SignInContext> = {}): SignInContext {
  return {
    userAgent: UA.iphoneSafari,
    standalone: false,
    authDomain: HOST,
    host: HOST,
    emulators: false,
    ...overrides,
  };
}

describe("isMobileUserAgent", () => {
  it("detecta iPhone, Android e iPad con UA de escritorio", () => {
    expect(isMobileUserAgent(UA.iphoneSafari)).toBe(true);
    expect(isMobileUserAgent(UA.androidChrome)).toBe(true);
    expect(isMobileUserAgent(UA.ipadSafari, 5)).toBe(true);
  });

  it("no marca como móvil a un Mac ni a Windows", () => {
    expect(isMobileUserAgent(UA.ipadSafari, 0)).toBe(false);
    expect(isMobileUserAgent(UA.desktopChrome)).toBe(false);
  });
});

describe("usesSameDomainAuth", () => {
  it("compara sin distinguir mayúsculas ni espacios", () => {
    expect(usesSameDomainAuth("Nutricion-App-Theta.vercel.app ", HOST)).toBe(true);
  });

  it("es falso con firebaseapp.com, con puerto o sin valor", () => {
    expect(usesSameDomainAuth("proyecto.firebaseapp.com", HOST)).toBe(false);
    expect(usesSameDomainAuth("localhost", "localhost:3000")).toBe(false);
    expect(usesSameDomainAuth(undefined, HOST)).toBe(false);
  });
});

describe("pickSignInMethod", () => {
  it("usa redirect en iPhone y Android con authDomain propio", () => {
    expect(pickSignInMethod(ctx())).toBe("redirect");
    expect(pickSignInMethod(ctx({ userAgent: UA.androidChrome }))).toBe("redirect");
    expect(pickSignInMethod(ctx({ userAgent: UA.ipadSafari, maxTouchPoints: 5 }))).toBe("redirect");
  });

  it("usa redirect en una PWA instalada aunque el UA no diga móvil", () => {
    expect(pickSignInMethod(ctx({ userAgent: UA.desktopChrome, standalone: true }))).toBe("redirect");
  });

  it("usa popup en escritorio", () => {
    expect(pickSignInMethod(ctx({ userAgent: UA.desktopChrome }))).toBe("popup");
  });

  it("usa popup en móvil mientras authDomain siga siendo firebaseapp.com", () => {
    expect(pickSignInMethod(ctx({ authDomain: "proyecto.firebaseapp.com" }))).toBe("popup");
    expect(pickSignInMethod(ctx({ authDomain: undefined }))).toBe("popup");
  });

  it("usa popup con emuladores", () => {
    expect(pickSignInMethod(ctx({ emulators: true }))).toBe("popup");
  });
});

describe("fallback a redirect", () => {
  it("solo si el proxy del mismo dominio está activo y no hay emuladores", () => {
    expect(canFallbackToRedirect(ctx({ userAgent: UA.desktopChrome }))).toBe(true);
    expect(canFallbackToRedirect(ctx({ authDomain: "proyecto.firebaseapp.com" }))).toBe(false);
    expect(canFallbackToRedirect(ctx({ emulators: true }))).toBe(false);
  });

  it("solo para popup bloqueado o entorno sin soporte", () => {
    expect(shouldFallbackToRedirect("auth/popup-blocked")).toBe(true);
    expect(shouldFallbackToRedirect("auth/operation-not-supported-in-this-environment")).toBe(true);
    expect(shouldFallbackToRedirect("auth/popup-closed-by-user")).toBe(false);
    expect(shouldFallbackToRedirect(undefined)).toBe(false);
  });
});

describe("isEmbeddedBrowser", () => {
  it("detecta navegadores integrados y WebViews", () => {
    expect(isEmbeddedBrowser(UA.iphoneInstagram)).toBe(true);
    expect(isEmbeddedBrowser(UA.androidWebView)).toBe(true);
    expect(isEmbeddedBrowser(UA.iphonePwa)).toBe(true); // iOS sin "Safari" fuera de modo standalone
  });

  it("no marca como integrados a Safari, Chrome ni a la PWA instalada", () => {
    expect(isEmbeddedBrowser(UA.iphoneSafari)).toBe(false);
    expect(isEmbeddedBrowser(UA.iphoneChrome)).toBe(false);
    expect(isEmbeddedBrowser(UA.androidChrome)).toBe(false);
    expect(isEmbeddedBrowser(UA.desktopChrome)).toBe(false);
    expect(isEmbeddedBrowser(UA.iphonePwa, true)).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("no muestra nada cuando el usuario cancela", () => {
    expect(authErrorMessage("auth/popup-closed-by-user")).toBeNull();
    expect(authErrorMessage("auth/cancelled-popup-request")).toBeNull();
  });

  it("explica los errores frecuentes en móvil", () => {
    expect(authErrorMessage("auth/popup-blocked")).toMatch(/ventanas emergentes/);
    expect(authErrorMessage("auth/network-request-failed")).toMatch(/conexión/);
    expect(authErrorMessage("auth/unauthorized-domain")).toMatch(/dominio/);
    expect(authErrorMessage("auth/web-storage-unsupported")).toMatch(/cookies/);
  });

  it("usa un mensaje genérico para códigos desconocidos", () => {
    expect(authErrorMessage("auth/algo-raro")).toBe("No se pudo iniciar sesión. Intenta de nuevo.");
    expect(authErrorMessage(undefined)).toBe("No se pudo iniciar sesión. Intenta de nuevo.");
  });
});
