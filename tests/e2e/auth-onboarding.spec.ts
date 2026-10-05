import { expect, test } from "@playwright/test";
import { completeOnboarding, expectNoHorizontalScroll, signIn, uniqueEmail } from "./helpers";

test("sin sesión, las rutas privadas redirigen al login", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("la API de análisis rechaza peticiones sin sesión", async ({ request }) => {
  const res = await request.post("/api/analyze-meal", { data: { description: "pan con palta" } });
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe("unauthenticated");

  const forged = await request.post("/api/analyze-meal", {
    data: { description: "pan con palta" },
    headers: { Authorization: "Bearer token.falso.123" },
  });
  expect(forged.status()).toBe(401);
});

test("onboarding: valida datos, calcula metas y lleva al home", async ({ page }, testInfo) => {
  await signIn(page, uniqueEmail(testInfo), "Daniela Prueba");
  await expect(page).toHaveURL(/\/onboarding$/);

  // Validación del primer paso
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Ingresa tu edad")).toBeVisible();
  await page.getByLabel("Edad").fill("5");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Debe estar entre 14 y 100 años")).toBeVisible();
  await expectNoHorizontalScroll(page);

  await completeOnboarding(page);

  // Home: meta del hombre de referencia (25 años, 75 kg, 175 cm, fuerza 3×) = 2.353 kcal
  await expect(page.getByText("Hola, Daniela")).toBeVisible();
  await expect(page.getByTestId("calories-remaining")).toHaveText("2.353");
  await expect(page.getByTestId("macro-protein")).toContainText("/ 120 g");
  await expect(page.getByTestId("macro-carbs")).toContainText("/ 322 g");
  await expect(page.getByTestId("macro-fat")).toContainText("/ 65 g");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Al recargar no vuelve al onboarding
  await page.reload();
  await expect(page.getByRole("region", { name: "Comidas del día" })).toBeVisible();
});

test("cerrar sesión vuelve al login", async ({ page }, testInfo) => {
  await signIn(page, uniqueEmail(testInfo));
  await completeOnboarding(page);
  await page.getByRole("link", { name: "Perfil" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login$/);
});
