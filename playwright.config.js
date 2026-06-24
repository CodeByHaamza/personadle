import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright (tests end-to-end).
 *
 * ⚠️ Scaffold optionnel — non lancé par `npm test` ni par la CI par défaut.
 * Pour l'activer :
 *   npm i -D @playwright/test
 *   npx playwright install --with-deps chromium
 *   npm run test:e2e
 *
 * Le webServer sert le site statique sur le port 8080. Les pages qui ont besoin
 * du backend PHP nécessiteront un serveur PHP en plus (php -S) — voir tests-e2e/README.md.
 */
export default defineConfig({
  testDir: "./tests-e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  webServer: {
    command: "python3 -m http.server 8080",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
