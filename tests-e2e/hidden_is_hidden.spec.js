import { test, expect } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * Ce qui est marqué caché doit être caché. Sur toutes les pages, à toutes les
 * largeurs.
 *
 * ── Pourquoi ce test existe ─────────────────────────────────────────────────
 * `[hidden]` n'est `display: none` que dans la feuille du NAVIGATEUR : n'importe
 * quelle règle d'auteur posant un `display` la bat, même une règle qui ne visait
 * pas cet élément. Et `.hidden` n'était défini nulle part globalement — chaque
 * page l'avait rustiné dans son coin.
 *
 * Deux bugs mesurés en production le 2026-09-27, même cause :
 *
 *   1. `#deleteAccountBtn` — « Supprimer mon compte », volontairement `hidden`
 *      depuis son déménagement dans les ⚙ Paramètres, **visible en bas du profil
 *      sous 480 px** : la media query donne `display: flex` à `.btn-danger` pour
 *      la cible tactile. Soit exactement ce que le déménagement voulait éviter.
 *   2. `#navFriendsBadge` — une pastille rouge **vide** sur l'icône Amis de la
 *      barre du bas, sur les huit pages, à toutes les largeurs.
 *
 * Aucun test unitaire ne pouvait les attraper : la classe était bien posée, le
 * DOM était juste, c'est la **peinture** qui désobéissait. Il fallait un vrai
 * navigateur et une vraie cascade.
 *
 * Le test est volontairement générique — il ne liste pas les deux coupables, il
 * interdit la classe entière de bug. Un futur `display:` posé sans y penser sur
 * un sélecteur large le fera échouer, et c'est le but.
 */

// Les six modes plus les pages joueur. On ne teste pas `admin/` : hors périmètre
// (outil interne mono-langue, cf. CLAUDE.md §5).
const PAGES = [
  ["accueil", "/index.html"],
  ["Classique", "/classiqueMode/classiqueMode.html"],
  ["Émoji", "/emojiMode/emojiMode.html"],
  ["Silhouette", "/silhouetteMode/silhouette.html"],
  ["All-Out Attack", "/allOutAttackMode/allOutAttack.html"],
  ["Personae", "/personaeMode/personae.html"],
  ["Musiques", "/musicsMode/musics.html"],
  ["profil", "/profile/profile.html"],
  ["amis", "/profile/friends/friends.html"],
];

// 390 : l'écran de référence du dépôt. 480 : la borne de media query où la règle
// fautive prenait le relais — c'est là que le bouton apparaissait. 481 : juste
// au-dessus, pour que le test distingue les deux côtés. 1280 : desktop.
const LARGEURS = [390, 480, 481, 1280];

/** Tout ce qui porte `.hidden` ou `[hidden]` et se peint quand même. */
async function fantomes(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".hidden, [hidden]")]
      .filter((el) => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return s.display !== "none" && b.width > 0 && b.height > 0;
      })
      .map((el) => {
        const b = el.getBoundingClientRect();
        const classes =
          typeof el.className === "string"
            ? el.className.trim().split(/\s+/).slice(0, 3).join(".")
            : "";
        return (
          `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${classes ? "." + classes : ""}` +
          ` (display:${getComputedStyle(el).display}, ${Math.round(b.width)}×${Math.round(b.height)})`
        );
      })
  );
}

test.describe("Ce qui est caché reste caché", () => {
  for (const [nom, url] of PAGES) {
    for (const largeur of LARGEURS) {
      test(`${nom} à ${largeur} px`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 } });
        const page = await ctx.newPage();
        await gotoSettled(page, url);
        await page.waitForTimeout(400);

        const vus = await fantomes(page);
        expect(
          vus,
          `éléments marqués cachés mais peints — une règle \`display\` d'auteur bat le \`hidden\` :\n  ${vus.join("\n  ")}`
        ).toEqual([]);

        await ctx.close();
      });
    }
  }

  test("le bouton de suppression de compte n'est jamais visible sur la page profil", async ({
    browser,
  }) => {
    // Le cas nommé, en plus du test générique : c'est celui qui a un coût réel si
    // la règle disparaît. Le bouton reste dans le DOM à dessein — il porte la
    // logique (saisie du pseudo, appel DELETE) et sert de relais aux ⚙ Paramètres
    // — mais il ne doit jamais être atteignable au doigt depuis la page.
    for (const largeur of [360, 390, 480, 768, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 } });
      const page = await ctx.newPage();
      await gotoSettled(page, "/profile/profile.html");
      await page.waitForTimeout(300);

      const btn = page.locator("#deleteAccountBtn");
      expect(await btn.count(), "le relais doit rester dans le DOM").toBe(1);
      expect(
        await btn.isVisible(),
        `« Supprimer mon compte » est visible à ${largeur} px — il appartient aux ⚙ Paramètres`
      ).toBe(false);

      await ctx.close();
    }
  });

  test("masqué, le relais reçoit toujours le clic des ⚙ Paramètres", async ({ browser }) => {
    // Le seul risque du correctif est ici. La modale Paramètres ne fabrique pas sa
    // propre logique de suppression : elle fait `deleteAccountBtn.click()`
    // (profile-page.js, `window._personadleDanger.deleteAccount`). Si masquer le
    // bouton empêchait ce clic programmatique, plus personne ne pourrait supprimer
    // son compte — une capacité qu'on doit au joueur, RGPD comprise.
    //
    // Un `.click()` sur un élément en `display: none` fonctionne bien (contrôlé
    // contre la production : comportement identique avec et sans la règle), mais
    // c'est le genre d'invariant qu'on veut voir échouer si quelqu'un remplace un
    // jour le relais par un vrai bouton visible.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.waitForTimeout(400);

    const recu = await page.evaluate(() => {
      const btn = document.getElementById("deleteAccountBtn");
      if (!btn || !window._personadleDanger) return null;
      let vu = false;
      btn.addEventListener("click", () => (vu = true), { once: true });
      window._personadleDanger.deleteAccount();
      return vu;
    });

    expect(recu, "window._personadleDanger.deleteAccount doit exister").not.toBeNull();
    expect(
      recu,
      "le relais masqué ne reçoit plus le clic — la suppression de compte est morte"
    ).toBe(true);

    await ctx.close();
  });
});
