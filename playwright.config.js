import { defineConfig } from "@playwright/test";

/**
 * Configuration Playwright (tests end-to-end).
 *
 * Cible la stack Docker en cours (`make up`). Par défaut http://localhost:8080
 * (le port APP_PORT par défaut de docker-compose.yml / .env.example — surchargeable
 * via PLAYWRIGHT_BASE_URL si ton .env change APP_PORT). Lance d'abord :
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
