import type { NextConfig } from "next";

// Cabeceras de seguridad básicas para todas las rutas.
// (No se define CSP estricta: el login con popup de Google/Firebase
// necesita iframes y scripts de varios dominios de Google.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // La cámara solo la usa la propia app (input capture); nada de micrófono/ubicación
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // El indicador flotante de `next dev` tapa la pestaña "Hoy" del bottom nav
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
