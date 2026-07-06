import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Smoke test pour admin/admin.js et les modules qu'il importe (admin-api.js,
 * catalogs.js, event-codes.js, error-logs.js, audit-log.js,
 * deletion-requests.js, rate-limits.js) — extraits d'un seul fichier de
 * 1850 lignes vers 8 modules ES6.
 *
 * Avant cette extraction, admin.js n'avait AUCUNE couverture Vitest (seul un
 * sous-ensemble de panneaux est couvert par les tests E2E Playwright, qui ont
 * besoin de Docker). Ce test ne vérifie pas le comportement métier de chaque
 * panneau (ça reste le rôle de l'E2E), mais garantit que le graphe d'imports
 * est correct et que le bootstrap ne lève pas d'exception — la classe de bug
 * la plus probable lors d'un découpage mécanique (mauvais export, import
 * manquant, référence à une variable renommée dans un seul des deux fichiers).
 */
describe("admin/admin.js — bootstrap smoke test", () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.innerHTML = readFileSync(join(ROOT, "admin/index.html"), "utf8");

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );
  });

  it("imports and bootstraps without throwing (anonymous — redirects home)", async () => {
    // Pas de window._currentUser.is_admin → init() redirige vers l'accueil et
    // s'arrête tôt, mais tout le graphe d'imports (7 modules) est déjà résolu
    // à ce stade — une erreur d'import/export lève ici.
    await expect(import("../admin/admin.js")).resolves.toBeDefined();
    // Laisser le microtask de init() (await initAuth()) se résoudre.
    await new Promise((r) => setTimeout(r, 0));
  });

  it("bootstraps the full user-list flow for an admin user without throwing", async () => {
    const adminUser = { id: 1, pseudo: "AdminTest", is_admin: true };

    global.fetch = vi.fn((url) => {
      const u = String(url);
      if (u.includes("/api/auth/me"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: adminUser }) });
      if (u.includes("/api/admin/users?"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ users: [], total: 0 }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    await import("../admin/admin.js");
    // init() : await initAuth() puis Promise.all(catalog loaders) puis loadUsers() —
    // laisser plusieurs microtasks/macrotasks se dérouler.
    await new Promise((r) => setTimeout(r, 20));

    expect(document.getElementById("admin-app").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("admin-username").textContent).toBe("AdminTest");

    // Ouvre chacun des 5 panneaux extraits dans leur propre module
    // (event-codes.js, error-logs.js, audit-log.js, deletion-requests.js,
    // rate-limits.js) : vérifie que le câblage des boutons vers les fonctions
    // importées n'a pas été cassé par le découpage.
    for (const [btnId, panelId] of [
      ["btn-codes", "codes-panel"],
      ["btn-error-logs", "error-logs-panel"],
      ["btn-audit-log", "audit-log-panel"],
      ["btn-deletion-requests", "deletion-requests-panel"],
      ["btn-rate-limits", "rate-limits-panel"],
    ]) {
      document.getElementById(btnId).click();
      await new Promise((r) => setTimeout(r, 10));
      expect(document.getElementById(panelId).classList.contains("hidden")).toBe(false);
    }
  });
});
