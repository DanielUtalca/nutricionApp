import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, newUserAtHome } from "./helpers";

test("hidratación: sumar, deshacer y meta", async ({ page }, testInfo) => {
  await newUserAtHome(page, testInfo);
  const water = page.getByTestId("water-card");
  await water.getByRole("button", { name: /Vaso/ }).click();
  await water.getByRole("button", { name: /Botella/ }).click();
  await expect(page.getByTestId("water-total")).toContainText("0,75 L de 2,75 L");
  await water.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByTestId("water-total")).toContainText("0,25 L de 2,75 L");
});

test("peso: registrar, ver gráfico/tabla y recalcular metas", async ({ page }, testInfo) => {
  await newUserAtHome(page, testInfo);
  await page.getByRole("link", { name: /Peso y medidas/ }).click();
  // El onboarding crea el primer registro (75 kg)
  await expect(page.getByTestId("current-weight")).toContainText("75");

  await page.getByLabel("Peso", { exact: true }).fill("78");
  await page.getByText("+ Agregar medidas").click();
  await page.getByLabel("Cintura").fill("85");
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await expect(page.getByText(/Recalculamos tus metas/)).toBeVisible();
  await expect(page.getByTestId("current-weight")).toContainText("78");
  await expect(page.getByRole("img", { name: /Evolución del peso/ })).toBeVisible();
  await page.getByRole("button", { name: "Ver tabla" }).click();
  await expect(page.getByRole("table")).toContainText("85 cm");
  await expectNoHorizontalScroll(page);

  // Nueva meta con 78 kg: BMR 1753,75 × 1,365 = 2394
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page.getByTestId("goal-calories")).toHaveText("2.394");
});

test("recetas → plan → registrar y lista de compras", async ({ page }, testInfo) => {
  await newUserAtHome(page, testInfo);
  await page.getByRole("link", { name: "Recetas" }).click();
  await page.getByRole("link", { name: /Pollo con arroz y brócoli/ }).click();
  await page.getByRole("button", { name: "Guardar en mis recetas" }).click();
  await expect(page.getByRole("button", { name: "Registrar comida" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Plan de hoy: almuerzo, 2 porciones
  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByRole("button", { name: "Agregar receta a Almuerzo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Pollo con arroz y brócoli/ }).click();
  const lunch = page.getByTestId("plan-lunch");
  await expect(lunch).toContainText("566 kcal");
  // El stepper avanza de a media porción: 1 → 1,5 → 2
  await lunch.getByRole("button", { name: /Aumentar porciones/ }).click();
  await expect(lunch).toContainText("849 kcal");
  await lunch.getByRole("button", { name: /Aumentar porciones/ }).click();
  await expect(lunch).toContainText("1.132 kcal");

  // Lista de compras: 2 porciones = receta completa (300 g de pollo)
  await page.getByRole("link", { name: /Compras/ }).click();
  await expect(page.getByText("Pechuga de pollo cocida · 300 g")).toBeVisible();
  await page.getByRole("checkbox", { name: /Pechuga de pollo/ }).click();
  await expect(page.getByRole("checkbox", { name: /Pechuga de pollo/ })).toHaveAttribute("aria-checked", "true");
  await expectNoHorizontalScroll(page);

  // Registrar desde el plan
  await page.getByRole("link", { name: "Plan" }).click();
  await page.getByTestId("plan-lunch").getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByTestId("plan-lunch")).toContainText("Registrada");
  await page.getByRole("link", { name: "Hoy" }).click();
  await expect(page.getByTestId("calories-consumed")).toHaveText("1.132");
});

test("perfil: metas manuales y volver a automáticas", async ({ page }, testInfo) => {
  await newUserAtHome(page, testInfo);
  await page.getByRole("link", { name: "Perfil" }).click();
  await page.getByRole("button", { name: /Editar a mano/ }).click();
  await page.getByLabel("Calorías").fill("2000");
  await page.getByRole("button", { name: "Guardar metas" }).click();
  await expect(page.getByTestId("goal-calories")).toHaveText("2.000");
  await page.getByRole("button", { name: "Volver a metas automáticas" }).click();
  await expect(page.getByTestId("goal-calories")).toHaveText("2.353");

  await page.getByRole("link", { name: /Editar$/ }).click();
  await page.getByRole("radio", { name: /Bajar grasa/ }).click();
  await page.getByRole("button", { name: /Guardar y recalcular/ }).click();
  await expect(page.getByTestId("goal-calories")).toHaveText("1.882");
  await expectNoHorizontalScroll(page);
});
