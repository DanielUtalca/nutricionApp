import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Vercel (AWS Lambda) ejecuta Node sin `require()` de módulos ESM. firebase-admin 14 trae
// jwks-rsa ^4 → jose 6 (solo ESM) y su entrada `firebase-admin/auth` fallaba allí con
// ERR_REQUIRE_ESM (la API respondía 500). package.json fija jwks-rsa 3 con `overrides`.
// Este test carga los puntos de entrada en un Node con require(esm) desactivado: si una
// actualización de dependencias vuelve a exigirlo, falla aquí y no en producción.
describe("firebase-admin en runtimes sin require(esm)", () => {
  it("sus puntos de entrada cargan con --no-experimental-require-module", () => {
    const script = [
      "require('firebase-admin/app')",
      "require('firebase-admin/auth')",
      "require('firebase-admin/firestore')",
      "console.log('ok')",
    ].join(";");

    const out = execFileSync(process.execPath, ["--no-experimental-require-module", "-e", script], {
      encoding: "utf8",
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(out.trim()).toBe("ok");
  }, 30_000);
});
