import { expect, test } from "@playwright/test";

// Pruebas de humo sin sesión contra la URL de producción (ver playwright.prod.config.ts)

const BG = {
  light: "rgb(250, 250, 249)", // --bg-base claro (#fafaf9)
  dark: "rgb(24, 24, 27)", // --bg-base oscuro (#18181b)
};

test.describe("login y shell", () => {
  test("el login se ve bien en móvil, sin scroll horizontal y con el tema correcto", async ({ page }, testInfo) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "NutriTrack" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuar con Google/ })).toBeEnabled();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "scroll horizontal en móvil").toBeLessThanOrEqual(1);

    const scheme = testInfo.project.name.endsWith("dark") ? "dark" : "light";
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(BG[scheme]);
  });

  test("las rutas privadas sin sesión llevan a /login", async ({ page }) => {
    await page.goto("/home");
    await page.waitForURL(/\/login$/);
    await expect(page.getByRole("button", { name: /Continuar con Google/ })).toBeVisible();
  });

  test("no existen los ganchos de prueba (solo con emuladores) en producción", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Continuar con Google/ })).toBeVisible();
    expect(await page.evaluate(() => typeof (window as unknown as { __testSignIn?: unknown }).__testSignIn)).toBe("undefined");
  });

  test("las cabeceras de seguridad están presentes", async ({ request }) => {
    const res = await request.get("/login");
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["permissions-policy"]).toContain("camera=(self)");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});

test.describe("PWA", () => {
  test("el manifest declara una app instalable con íconos que existen", async ({ request, baseURL }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const manifest = await res.json();

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeTruthy();
    expect(new URL(manifest.start_url, baseURL).pathname.startsWith(new URL(manifest.scope ?? "/", baseURL).pathname)).toBe(true);

    const icons = manifest.icons as { src: string; sizes: string; purpose?: string; type?: string }[];
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && (i.purpose ?? "any") !== "maskable")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);

    for (const icon of icons) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.status(), icon.src).toBe(200);
      expect(iconRes.headers()["content-type"], icon.src).toMatch(/^image\//);
    }
  });

  test("el ícono de iOS y el color de tema están declarados en el <head>", async ({ page, request }) => {
    await page.goto("/login");
    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
    expect(touchIcon).toBeTruthy();
    expect((await request.get(touchIcon!)).status()).toBe(200);
    expect(await page.locator('meta[name="theme-color"]').count()).toBeGreaterThan(0);
    expect(await page.locator('meta[name="viewport"]').getAttribute("content")).toContain("width=device-width");
  });

  test("Chrome no reporta errores de instalabilidad", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Page.getInstallabilityErrors solo existe en Chromium");
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Continuar con Google/ })).toBeVisible();
    const client = await page.context().newCDPSession(page);
    const { installabilityErrors } = (await client.send("Page.getInstallabilityErrors")) as {
      installabilityErrors: { errorId: string; errorArguments: { name: string; value: string }[] }[];
    };
    expect(installabilityErrors, JSON.stringify(installabilityErrors)).toEqual([]);
  });
});

test.describe("API protegida", () => {
  test("rechaza peticiones sin token (401)", async ({ request }) => {
    const res = await request.post("/api/analyze-meal", { data: { description: "una manzana" } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  test("rechaza un token falso con 401 (un 503 indicaría credenciales de Firebase Admin rotas)", async ({ request }) => {
    const res = await request.post("/api/analyze-meal", {
      headers: { Authorization: "Bearer eyJhbGciOiJSUzI1NiJ9.e30.firma-falsa" },
      data: { description: "una manzana" },
    });
    expect(res.status(), await res.text()).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });
});

test.describe("login con Google: dominio de autenticación", () => {
  test("/__/auth/* se sirve desde el propio dominio y se puede incrustar", async ({ request }) => {
    for (const path of ["/__/auth/handler", "/__/auth/iframe"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()["content-type"], path).toContain("text/html");
      // Con DENY el navegador bloquearía el iframe de Firebase incluso siendo del mismo origen
      expect((res.headers()["x-frame-options"] ?? "").toUpperCase(), path).not.toBe("DENY");
    }
  });

  test("en móvil el botón redirige a Google por el dominio propio y Google acepta la URI", async ({ page, baseURL }) => {
    test.skip(!process.env.EXPECT_REDIRECT_LOGIN, "Requiere authDomain = dominio de la app (EXPECT_REDIRECT_LOGIN=1)");
    await page.goto("/login");
    await page.getByRole("button", { name: /Continuar con Google/ }).click();
    await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 });

    const redirectUri = new URL(page.url()).searchParams.get("redirect_uri");
    expect(redirectUri).toBe(`${new URL(baseURL!).origin}/__/auth/handler`);
    // Si la URI no está autorizada en Google Cloud, Google muestra este error
    await expect(page.locator("body")).not.toContainText(/redirect_uri_mismatch/i);
  });
});
