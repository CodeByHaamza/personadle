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
        "js/social-link.js",
        "profile/profileStats.js",
        "profile/formatPlayTime.js",
        "scripts/validate_characters.js",
      ],
      // Seuils minimaux (sous le niveau actuel ~77% → marge). `npm run test:coverage`
      // échoue si la couverture passe sous ces valeurs (anti-régression des tests).
      //
      // NOTE : `perFile: true` a été testé mais désactivé — dans vitest 2.1.x, le
      // groupe de seuils "global" s'applique quand même fichier par fichier à TOUS
      // les fichiers de `include` (pas seulement ceux sans override dédié), donc
      // activer perFile casse la CI sur cloud-sync.js (branches ~23%) et
      // streak-recovery.js (~51%) même avec un override par fichier plus permissif.
      // Le seuil agrégé reste la seule option viable tant que ces deux fichiers
      // n'ont pas une couverture plus complète.
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 65,
        statements: 70,
      },
    },
  },
});
