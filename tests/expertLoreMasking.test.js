/**
 * expertLoreMasking.test.js — une fiche de lore Personae Expert ne doit jamais
 * contenir le nom de sa propre persona, MASQUAGE APPLIQUÉ.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────
 * `maskTerms()` (js/gameCore.js) masque des MOTS ENTIERS : la frontière de fin
 * est `(?=$|[^\w])`. Un mot DÉRIVÉ du nom passe donc à travers, parce que les
 * lettres en plus font échouer la frontière. Constaté le 2026-09-24 : la fiche
 * anglaise de Terpsichore se terminait par
 *
 *     « Her name survives in English as terpsichorean, meaning anything
 *       pertaining to dance. »
 *
 * — la réponse, à deux lettres près, en clair, dans le mode dont tout l'intérêt
 * est de ne pas la donner. Même chose pour Moros / « morose » dans cinq langues
 * et pour Terpsichore en français et en allemand : huit fiches au total.
 *
 * Le trou n'était pas silencieux par hasard : le test E2E ne regarde QUE la
 * cible du jour. La fuite n'était donc visible que le jour où le tirage tombait
 * sur Terpsichore — elle a dormi jusqu'à ce que la CI tombe dessus. Ici on
 * audite les 942 fiches des six langues, tous les jours.
 *
 * ── La règle exacte ──────────────────────────────────────────────────────────
 * Une simple recherche de sous-chaîne produit des faux positifs : « Nella » (it)
 * contient « Ella », « inúmeros » (pt) contient « Eros ». Aucun des deux ne
 * donne quoi que ce soit au joueur.
 *
 * Le critère retenu : le nom fuit s'il apparaît à une position qui n'est PAS
 * précédée d'une lettre. C'est ce qui distingue un dérivé (terpsichore|an, le
 * nom commence le mot) d'une coïncidence de fin (N|ella, le nom est collé
 * derrière une lettre).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { maskTerms } from "../js/gameCore.js";

const LORE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "personaeMode", "database", "expert_lore");
const FICHIERS = readdirSync(LORE_DIR).filter((f) => f.endsWith(".json"));

/** Minuscules sans accents — même aplatissement que la comparaison du joueur. */
const plat = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Le nom apparaît-il dans le texte masqué, à une position non précédée d'une
 * lettre ? Renvoie l'extrait fautif, ou null.
 */
function fuite(nomBase, texteMasque) {
  const foin = plat(texteMasque);
  const aiguille = plat(nomBase);
  let i = foin.indexOf(aiguille);
  while (i !== -1) {
    const avant = i === 0 ? "" : foin[i - 1];
    if (!/[a-z0-9]/.test(avant)) {
      return texteMasque.slice(Math.max(0, i - 40), i + aiguille.length + 40).replace(/\s+/g, " ");
    }
    i = foin.indexOf(aiguille, i + 1);
  }
  return null;
}

describe("lore Personae Expert — le nom ne doit jamais rester lisible", () => {
  it("les six langues ont un fichier de lore", () => {
    expect(FICHIERS.length).toBe(6);
  });

  it("aucune fiche ne laisse passer le nom de sa persona, masquage appliqué", () => {
    const fuites = [];
    let auditees = 0;

    for (const fichier of FICHIERS) {
      const lang = fichier.replace(".json", "");
      const data = JSON.parse(readFileSync(join(LORE_DIR, fichier), "utf8"));

      for (const [nom, fiche] of Object.entries(data)) {
        if (nom.startsWith("_")) continue; // `_comment` : en-tête du fichier, pas une fiche
        auditees++;
        // Le mode retire la parenthèse du nom avant de comparer (« Orpheus
        // ( Female ) » → « Orpheus ») : on fait pareil.
        const base = nom.replace(/\s*\(.*?\)\s*/g, " ").trim();
        // Un nom très court se retrouve partout par hasard — le mode lui-même ne
        // le vérifie pas non plus (cf. tests-e2e/expert-personae.spec.js).
        if (base.length < 4) continue;

        const masque = maskTerms(fiche.mask ?? [], fiche.text ?? "", "▮▮▮");
        const extrait = fuite(base, masque);
        if (extrait) fuites.push(`[${lang}] ${nom} → …${extrait}…`);
      }
    }

    expect(auditees, "aucune fiche auditée — le dossier de lore est-il vide ?").toBeGreaterThan(500);
    expect(
      fuites,
      "fiche(s) donnant la réponse. Ajouter le mot dérivé à la liste `mask` de l'entrée :\n  " +
        fuites.join("\n  ")
    ).toEqual([]);
  });

  it("chaque fiche masque au moins son propre nom", () => {
    // Une liste `mask` vide ou oubliée laisserait le nom en clair dès la
    // première phrase — c'est en général là qu'il se trouve.
    const sansMasque = [];
    for (const fichier of FICHIERS) {
      const data = JSON.parse(readFileSync(join(LORE_DIR, fichier), "utf8"));
      for (const [nom, fiche] of Object.entries(data)) {
        if (nom.startsWith("_")) continue;
        if (!Array.isArray(fiche.mask) || fiche.mask.length === 0) {
          sansMasque.push(`[${fichier}] ${nom}`);
        }
      }
    }
    expect(sansMasque, "fiche(s) sans aucun terme à masquer").toEqual([]);
  });

  it("le masquage laisse bien une trace visible quand il agit", () => {
    // Garde-fou sur le mécanisme lui-même : si `maskTerms()` cessait de
    // remplacer quoi que ce soit, les deux tests ci-dessus passeraient au vert
    // uniquement parce que le texte masqué serait le texte brut… et ils
    // échoueraient. Celui-ci le dit explicitement.
    const texte = "Terpsichore is the Muse of dance.";
    expect(maskTerms(["Terpsichore"], texte, "▮▮▮")).toContain("▮▮▮");
    expect(maskTerms(["Terpsichore"], texte, "▮▮▮")).not.toContain("Terpsichore");
  });

  it("distingue un dérivé d'une coïncidence de fin de mot", () => {
    // Le cœur de la règle, sur deux cas réels du catalogue.
    expect(fuite("Terpsichore", "survives as terpsichorean, meaning dance")).not.toBeNull();
    expect(fuite("Ella", "Nella fiaba come Perrault la fissò")).toBeNull();
    expect(fuite("Eros", "Attraversa inúmeros mitos")).toBeNull();
  });
});
