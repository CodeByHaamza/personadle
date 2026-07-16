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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
