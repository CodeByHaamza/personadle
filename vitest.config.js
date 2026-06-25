import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use jsdom to simulate a browser environment (window, document, localStorage…)
    environment: "jsdom",

    // Make browser globals (describe, it, expect…) available without imports
    globals: true,

    // Only look for tests inside the tests/ directory
    include: ["tests/**/*.test.js"],

    coverage: {
      provider: "v8",
      include: [
        "js/gameCore.js",
        "js/streak-recovery.js",
        "js/cloud-sync.js",
        "profile/profileStats.js",
        "profile/formatPlayTime.js",
        "scripts/validate_characters.js",
      ],
      // Seuils minimaux (sous le niveau actuel ~77% → marge). `npm run test:coverage`
      // échoue si la couverture passe sous ces valeurs (anti-régression des tests).
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 65,
        statements: 70,
      },
    },
  },
});
