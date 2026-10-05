import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reportes y artefactos generados por Playwright (el HTML trae JS empaquetado)
    "playwright-report/**",
    "playwright-report-prod/**",
    "test-results/**",
    "test-results-prod/**",
    "blob-report/**",
  ]),
]);

export default eslintConfig;
