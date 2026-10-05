import { defineConfig } from "vitest/config";

// Tests de reglas de Firestore: requieren el emulador (npm run test:rules)
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
