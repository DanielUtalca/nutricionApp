import type { NextConfig } from "next";

// Cabeceras de seguridad básicas para todas las rutas.
// (No se define CSP estricta: el login con Google/Firebase necesita iframes
// y scripts de varios dominios de Google.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // La cámara solo la usa la propia app (input capture); nada de micrófono/ubicación
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Proyecto de Firebase cuyo handler de Auth se sirve bajo nuestro propio dominio
const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // El indicador flotante de `next dev` tapa la pestaña "Hoy" del bottom nav
  devIndicators: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Firebase Auth incrusta `/__/auth/iframe` desde nuestra propia página (ver
      // rewrites): con DENY el navegador lo bloquea incluso siendo del mismo origen.
      // Gana la última regla que fija la misma cabecera.
      {
        source: "/__/auth/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
  // Login con Google en móvil: Safari, Chrome y las PWA bloquean el
  // almacenamiento de terceros, así que el flujo `signInWithRedirect` falla si
  // `authDomain` es `<proyecto>.firebaseapp.com`. Sirviendo el handler de Firebase
  // desde nuestro dominio (y apuntando `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` a él)
  // todo queda en el mismo origen.
  // https://firebase.google.com/docs/auth/web/redirect-best-practices
  async rewrites() {
    if (!firebaseProjectId) return [];
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${firebaseProjectId}.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
