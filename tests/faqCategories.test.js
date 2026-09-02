import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * faqCategories.test.js — Les catégories de la FAQ sont affectées PAR INDEX.
 *
 * `pages/faq.html` associe chaque `<h2 class="faq-category">` à une clé via
 * `CAT_KEYS[i]`, où `i` est la position du titre dans le DOM. Insérer une
 * catégorie au milieu sans l'ajouter au tableau décale donc TOUTES les
 * suivantes : les onglets filtrent les mauvaises questions, sans qu'aucune
 * erreur ne soit levée.
 *
 * Ce test compare les trois listes qui doivent rester alignées : les titres du
 * HTML, `CAT_KEYS`, et les onglets. C'est la seule façon de voir un décalage
 * qui, dans chaque fichier pris isolément, paraît cohérent.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "pages/faq.html"), "utf8");

/** Clés i18n des catégories, dans leur ordre d'apparition dans le DOM. */
function domCategoryKeys() {
  // Uniquement les vrais titres : on exige l'ouverture de balise, pour ne pas
  // ramasser les commentaires du script qui citent la classe.
  const re = /<h2 class="faq-category" data-i18n="faq\.cat_([a-z]+)"/g;
  return [...html.matchAll(re)].map((m) => m[1]);
}

/** Contenu du tableau CAT_KEYS déclaré dans le script de la page. */
function declaredCatKeys() {
  const m = html.match(/var CAT_KEYS=\[([^\]]+)\]/);
  if (!m) throw new Error("CAT_KEYS introuvable dans pages/faq.html");
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
}

/** Catégories proposées par les onglets de filtre, hors « all ». */
function tabCategories() {
  const m = html.match(/var tabData=\[([\s\S]*?)\];/);
  if (!m) throw new Error("tabData introuvable dans pages/faq.html");
  return [...m[1].matchAll(/cat:'([a-z]+)'/g)].map((x) => x[1]).filter((c) => c !== "all");
}

describe("FAQ — catégories, clés et onglets alignés", () => {
  it("CAT_KEYS suit exactement l'ordre des titres du DOM", () => {
    // L'égalité doit porter sur l'ORDRE, pas seulement sur le contenu : c'est
    // l'index qui sert d'identifiant.
    expect(declaredCatKeys()).toEqual(domCategoryKeys());
  });

  it("chaque catégorie a son onglet, et réciproquement", () => {
    expect([...tabCategories()].sort()).toEqual([...domCategoryKeys()].sort());
  });

  it("les catégories Mode Expert et Scores sont présentes", () => {
    const keys = domCategoryKeys();
    expect(keys).toContain("expert");
    expect(keys).toContain("scoring");
  });

  it("chaque question de la FAQ a sa réponse", () => {
    // Une question dont la réponse manque s'affiche vide, sans erreur.
    const qs = [...html.matchAll(/data-i18n="faq\.(q\d+)"/g)].map((m) => m[1]);
    const as = new Set([...html.matchAll(/data-i18n="faq\.(a\d+)"/g)].map((m) => m[1]));
    const orphans = qs.filter((q) => !as.has("a" + q.slice(1)));
    expect(orphans).toEqual([]);
  });

  it("toutes les clés FAQ du HTML existent dans en.json", () => {
    const en = JSON.parse(readFileSync(join(ROOT, "lang/en.json"), "utf8"));
    const used = [...html.matchAll(/data-i18n="faq\.([a-z0-9_]+)"/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((k) => en.faq?.[k] === undefined);
    expect(missing).toEqual([]);
  });
});
