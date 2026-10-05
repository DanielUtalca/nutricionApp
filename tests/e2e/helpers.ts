import { expect, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __testSignIn?: (email: string, name?: string) => Promise<void>;
  }
}

/** Email único por test y proyecto (cada test parte con un usuario nuevo) */
export function uniqueEmail(testInfo: TestInfo): string {
  const slug = testInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  return `${testInfo.project.name}-${slug}-${Date.now()}@e2e.test`;
}

/** Login con el emulador de Auth (solo existe con NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true) */
export async function signIn(page: Page, email: string, name = "Prueba E2E") {
  await page.goto("/login");
  await page.waitForFunction(() => typeof window.__testSignIn === "function");
  await page.evaluate(([e, n]) => window.__testSignIn!(e, n), [email, name] as const);
}

/** Completa el onboarding: hombre, 25 años, 175 cm, 75 kg, mantener, fuerza 3×/semana */
export async function completeOnboarding(page: Page) {
  await expect(page.getByRole("heading", { name: "Cuéntanos de ti" })).toBeVisible();
  await page.getByLabel("Edad").fill("25");
  await page.getByLabel("Altura").fill("175");
  await page.getByLabel("Peso").fill("75");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /Mantener/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: "Sí" }).click();
  await page.getByRole("checkbox", { name: /Fuerza/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("goal-calories")).toHaveText("2.353");
  await page.getByRole("button", { name: "Empezar" }).click();
  await expect(page.getByRole("region", { name: "Comidas del día" })).toBeVisible();
}

/** Usuario nuevo con onboarding completo, en /home */
export async function newUserAtHome(page: Page, testInfo: TestInfo) {
  await signIn(page, uniqueEmail(testInfo));
  await completeOnboarding(page);
}

/** La página no debe tener scroll horizontal en móvil */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "scroll horizontal en móvil").toBeLessThanOrEqual(1);
}
