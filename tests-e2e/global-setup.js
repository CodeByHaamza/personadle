import { mkdirSync } from "node:fs";
import { request as pwRequest } from "@playwright/test";
import { registerAndUnlockExpert } from "./helpers/expert-unlock.js";

/**
 * tests-e2e/global-setup.js — comptes pré-débloqués pour les 6 Modes Expert.
 *
 * Depuis la porte d'entrée du Mode Expert (js/gameCore.js::applyExpertGate),
 * un visiteur anonyme sur `?expert=1` est redirigé vers le mode normal. Les
 * specs expert-*.spec.js testent le GAMEPLAY Expert, pas cette redirection —
 * elles ont donc besoin d'un compte déjà débloqué. Ce setup tourne une seule
 * fois avant toute la suite : un compte par mode, débloqué via l'API réelle
 * (helpers/expert-unlock.js), avec son état de session sauvegardé dans
 * `playwright/.auth/<mode>.json` — chaque spec s'y branche via
 * `test.use({ storageState })`.
 */
const MODES = ["classic", "silhouette", "emoji", "alloutattack", "personae", "music"];

export default async function globalSetup(config) {
  const baseURL =
    config.projects?.[0]?.use?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://localhost:8080";

  mkdirSync("playwright/.auth", { recursive: true });

  for (const mode of MODES) {
    const ctx = await pwRequest.newContext({ baseURL });
    try {
      await registerAndUnlockExpert(ctx, mode);
      await ctx.storageState({ path: `playwright/.auth/${mode}.json` });
    } finally {
      await ctx.dispose();
    }
  }
}
