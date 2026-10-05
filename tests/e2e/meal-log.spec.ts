import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, newUserAtHome } from "./helpers";

const PHOTO = path.join(__dirname, "fixtures", "plate.jpg");

const AI_RESULT = {
  source: "ai_photo",
  result: {
    title: "Arroz con pollo",
    confidence: "medium",
    notes: "No se ve si lleva aceite.",
    foods: [
      { name: "Arroz blanco", portionDescription: "1 taza", portionGrams: 160, calories: 208, proteinG: 4.3, carbsG: 44.8, fatG: 0.5 },
      { name: "Pollo asado", portionDescription: "1 trutro", portionGrams: 120, calories: 250, proteinG: 31, carbsG: 0, fatG: 13 },
    ],
    totalCalories: 458,
    totalProteinG: 35.3,
    totalCarbsG: 44.8,
    totalFatG: 13.5,
  },
};

test("registro por foto: comprime, envía con token, permite ajustar porciones y guarda", async ({ page }, testInfo) => {
  await newUserAtHome(page, testInfo);

  let request: { bytes: number; auth: string; contentType: string } | null = null;
  await page.route("**/api/analyze-meal", async (route) => {
    const req = route.request();
    request = {
      bytes: req.postDataBuffer()?.length ?? 0,
      auth: req.headers()["authorization"] ?? "",
      contentType: req.headers()["content-type"] ?? "",
    };
    await route.fulfill({ json: AI_RESULT });
  });

  await page.getByRole("link", { name: "Foto" }).click();
  await expect(page.getByText("Tomar foto")).toBeVisible();
  await page.getByTestId("photo-input").setInputFiles(PHOTO);
  await expect(page.getByRole("img", { name: "Foto de tu comida" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: /Analizar con IA/ }).click();

  await expect(page.getByRole("heading", { name: "Revisar y guardar" })).toBeVisible();
  expect(request).not.toBeNull();
  expect(request!.auth).toMatch(/^Bearer .+/);
  expect(request!.contentType).toContain("multipart/form-data");
  // La foto de prueba pesa ~150 KB a 4000×3000; comprimida debe quedar mucho más chica
  expect(request!.bytes).toBeLessThan(120_000);

  await expect(page.getByText("No se ve si lleva aceite.")).toBeVisible();
  await expect(page.getByTestId("draft-total-calories")).toContainText("458");

  // Ajustar porción del arroz a la mitad → 104 kcal
  await page.getByTestId("food-row").first().getByRole("button").first().click();
  await page.getByRole("button", { name: "×0,5" }).click();
  await expect(page.getByTestId("draft-total-calories")).toContainText("354");

  await page.getByRole("button", { name: "Guardar comida" }).click();
  await expect(page.getByRole("region", { name: "Comidas del día" })).toBeVisible();
  await expect(page.getByTestId("calories-consumed")).toHaveText("354");
});

test("errores de cuota de la IA muestran mensaje claro y alternativas", async ({ page }, testInfo) => {
  await newUserAtHome(page, testInfo);
  await page.route("**/api/analyze-meal", (route) =>
    route.fulfill({
      status: 429,
      json: { error: { code: "quota", message: "Se alcanzó el límite gratuito de la IA por ahora." } },
    }),
  );
  await page.goto("/log?mode=photo");
  await page.getByTestId("photo-input").setInputFiles(PHOTO);
  await page.getByRole("button", { name: /Analizar con IA/ }).click();
  await expect(page.getByText("Se alcanzó el límite gratuito de la IA por ahora.")).toBeVisible();
  await page.getByRole("button", { name: "Buscar alimento" }).click();
  await expect(page.getByLabel("Buscar alimento")).toBeVisible();
});

test("búsqueda por texto y registro manual; editar y borrar comida", async ({ page }, testInfo) => {
  await newUserAtHome(page, testInfo);
  await page.getByRole("link", { name: "Agregar a Desayuno" }).click();

  await page.getByRole("radio", { name: "Buscar" }).click();
  await page.getByLabel("Buscar alimento").fill("platano");
  await page.getByRole("button", { name: /Agregar Plátano/ }).click(); // 107 kcal
  await page.getByRole("radio", { name: "Manual" }).click();
  await page.getByLabel("Alimento").fill("Café con azúcar");
  await page.getByLabel("Carbos").fill("10");
  await page.getByRole("button", { name: "Agregar alimento" }).click(); // 40 kcal (calculado)
  await expect(page.getByTestId("food-row")).toHaveCount(2);
  await expect(page.getByTestId("draft-total-calories")).toContainText("147");
  await page.getByRole("button", { name: "Guardar comida" }).click();

  const breakfast = page.getByTestId("meal-section-breakfast");
  await expect(breakfast).toContainText("147 kcal");

  // Editar: cambiar a snack
  await breakfast.getByRole("link", { name: /Plátano y Café con azúcar/ }).click();
  await page.getByRole("radio", { name: "Snack" }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByTestId("meal-section-snack")).toContainText("147 kcal");
  await expect(page.getByTestId("meal-section-breakfast")).toContainText("Sin registros");

  // Borrar
  await page.getByTestId("meal-section-snack").getByRole("link", { name: /Plátano/ }).click();
  await page.getByRole("button", { name: "Borrar comida" }).click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();
  await expect(page.getByTestId("calories-consumed")).toHaveText("0");
});
