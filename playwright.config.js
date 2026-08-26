import { defineConfig } from "@playwright/test";

/**
 * Configuration Playwright (tests end-to-end).
 *
 * Cible la stack Docker en cours (`make up`). Par défaut http://localhost:8080
 * (le port APP_PORT défini dans .env — surchargeable via PLAYWRIGHT_BASE_URL).
 * Lance d'abord :
 *   make up
 *   npm i -D @playwright/test && npx playwright install chromium   # 1re fois
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests-e2e",
  globalSetup: "./tests-e2e/global-setup.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080",
    // Service worker bloqué : après un bump de CACHE_VERSION il s'active et les
    // pages se rechargent seules (écouteur SW_UPDATED), en plein milieu d'un test.
    // Les assertions tombaient alors sur une page en pleine navigation, et l'échec
    // se déplaçait d'un test à l'autre à chaque exécution. Ce n'est pas le SW qu'on
    // teste ici — le comportement hors-ligne mériterait sa propre suite dédiée.
    serviceWorkers: "block",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
