import { defineConfig, devices } from "@playwright/test";

// ============================================================
// Pruebas de humo contra una URL desplegada (producción)
// ============================================================
// Uso:   PROD_URL=https://nutricion-app-theta.vercel.app npm run test:prod
//
// - No levanta servidores ni emuladores: solo apunta a PROD_URL.
// - No inicia sesión (el login real de Google no se puede automatizar y
//   `__testSignIn` no existe fuera de los emuladores): solo prueba lo público.
// - No llama a la IA ni gasta cuota de Gemini.
// - Viewport móvil 390×844, en modo claro y oscuro.
//
// Con EXPECT_REDIRECT_LOGIN=1 también comprueba que, en móvil, el botón de
// Google redirige por el dominio propio (requiere authDomain = dominio de la app
// y la URI de redirección autorizada en Google Cloud).

const baseURL = process.env.PROD_URL?.replace(/\/+$/, "");
if (!baseURL) {
  throw new Error("Define PROD_URL, p. ej. PROD_URL=https://nutricion-app-theta.vercel.app npm run test:prod");
}

const mobile = {
  ...devices["Pixel 7"],
  viewport: { width: 390, height: 844 },
};

export default defineConfig({
  testDir: "tests/prod",
  outputDir: "test-results-prod",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-prod" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-light", use: { ...mobile, colorScheme: "light" } },
    { name: "mobile-dark", use: { ...mobile, colorScheme: "dark" } },
  ],
});
