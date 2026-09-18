import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * tests-e2e/titles_i18n.spec.js — les titres parlent la langue du joueur (049).
 *
 * Avant : api/titles/index.php ne connaissait que fr/es/de/it, les joueurs
 * portugais lisaient l'anglais ; et les description_* écrites par les
 * migrations n'étaient jamais servies — le client affichait pour tous un texte
 * de condition anglais codé en dur. Ici, contre la vraie API :
 *   - les six langues renvoient un `name` et une `description` non vides ;
 *   - pt renvoie bien le portugais (pas l'anglais par repli) ;
 *   - une langue inconnue retombe sur l'anglais sans erreur ;
 *   - le Compendium expose `name.pt` pour un titre débloqué.
 *
 * Pré-requis : stack Docker (make up). Compte frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

async function call(ctx, method, url, options) {
  let res;
  for (let attempt = 0; attempt < 30; attempt++) {
    res = await ctx[method](url, options);
    if (res.status() !== 503) return res;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return res;
}

async function registerUser() {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `ti18n_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), "register doit réussir").toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id };
}

const bySlug = async (ctx, lang) => {
  const res = await call(ctx, "get", `/api/titles/?lang=${lang}`);
  expect(res.ok(), `GET /api/titles?lang=${lang}`).toBeTruthy();
  const list = await res.json();
  expect(Array.isArray(list)).toBeTruthy();
  const map = {};
  for (const t of list) map[t.slug] = t;
  return map;
};

test.describe("Titres — nom et description dans la langue du joueur", () => {
  let u;
  test.beforeAll(async () => {
    u = await registerUser();
  });
  test.afterAll(async () => {
    await u?.ctx.dispose();
  });

  test("les six langues renvoient un nom et une description pour chaque titre", async () => {
    for (const lang of ["en", "fr", "es", "de", "it", "pt"]) {
      const titles = await bySlug(u.ctx, lang);
      const slugs = Object.keys(titles);
      expect(slugs.length, lang).toBeGreaterThanOrEqual(22);
      for (const s of slugs) {
        expect(typeof titles[s].name === "string" && titles[s].name.trim() !== "", `${lang} ${s} name`).toBeTruthy();
        expect(
          typeof titles[s].description === "string" && titles[s].description.trim() !== "",
          `${lang} ${s} description`
        ).toBeTruthy();
      }
    }
  });

  test("pt renvoie du portugais, pas l'anglais par repli", async () => {
    const pt = await bySlug(u.ctx, "pt");
    const en = await bySlug(u.ctx, "en");
    expect(pt.aigis_i_am_not_afraid.name).toBe("Não Tenho Medo");
    expect(pt.naoto_case_never_closed.name).toBe("O Caso Nunca Se Encerra");
    expect(pt.aigis_i_am_not_afraid.description).toMatch(/^Vença 50 partidas no Clássico/);
    expect(pt.velvet_room_thou_art_i.description).not.toBe(en.velvet_room_thou_art_i.description);
    // Un nom volontairement identique dans toutes les langues reste identique.
    expect(pt.sees.name).toBe("S.E.E.S.");
  });

  test("une langue inconnue retombe sur l'anglais, sans erreur", async () => {
    const xx = await bySlug(u.ctx, "xx");
    const en = await bySlug(u.ctx, "en");
    expect(xx.aigis_i_am_not_afraid.name).toBe(en.aigis_i_am_not_afraid.name);
    expect(xx.aigis_i_am_not_afraid.description).toBe(en.aigis_i_am_not_afraid.description);
    expect(en.aigis_i_am_not_afraid.name).toBe("I Am Not Afraid");
  });

  test("le Compendium expose le nom portugais d'un titre débloqué", async () => {
    // Un compte neuf n'a aucun titre : l'admin lui accorde « I Am Not Afraid »
    // (api/admin/users/:id/titles), puis on lit le Compendium public.
    const admin = await pwRequest.newContext({ baseURL: BASE });
    const login = await call(admin, "post", "/api/auth/login", {
      data: { identifier: "admin@personadle.local", password: "admintest123" },
    });
    expect(login.ok(), "login admin (base fraîche : make up)").toBeTruthy();
    const en = await bySlug(u.ctx, "en");
    const grant = await call(admin, "post", `/api/admin/users/${u.userId}/titles`, {
      data: { title_id: en.aigis_i_am_not_afraid.id },
      headers: await csrfHeader(admin),
    });
    expect(grant.ok(), await grant.text()).toBeTruthy();
    await admin.dispose();

    const res = await call(u.ctx, "get", `/api/user/compendium?id=${u.userId}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const data = body.data ?? body;
    const t = (data.titles || []).find((x) => x.slug === "aigis_i_am_not_afraid");
    expect(t, "le titre accordé apparaît dans le Compendium").toBeTruthy();
    expect(t.name.pt).toBe("Não Tenho Medo");
    expect(t.name.en).toBe("I Am Not Afraid");
  });
});
