import { defineConfig, devices } from "@playwright/test";

// ============================================================
// Pruebas E2E con Playwright contra los emuladores de Firebase
// ============================================================
// - Auth y Firestore corren en emuladores (proyecto demo-nutritrack):
//   no se toca la base real ni hace falta login con Google real.
// - /api/analyze-meal se intercepta en el navegador para no gastar
//   cuota de Gemini (el handler real se prueba en tests/unit).
// - Se ejecuta todo en viewport móvil, en modo claro y oscuro.

const PORT = 3100;

const mobile = {
  ...devices["Pixel 7"],
  // Chromium ya instalado; Pixel 7 usa Chromium por defecto
  viewport: { width: 390, height: 844 },
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-light", use: { ...mobile, colorScheme: "light" } },
    { name: "mobile-dark", use: { ...mobile, colorScheme: "dark" } },
  ],
  webServer: [
    {
      command: "firebase emulators:start --only auth,firestore --project demo-nutritrack",
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-nutritrack",
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-nutritrack.firebaseapp.com",
        FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      },
    },
  ],
});
