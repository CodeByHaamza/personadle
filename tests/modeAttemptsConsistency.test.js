import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * modeAttemptsConsistency.test.js — `attempts` veut dire la même chose partout.
 *
 * Contrat : `attempts` compte les RÉPONSES DONNÉES, la bonne comprise. Une
 * victoire au premier essai vaut donc **1**, jamais 0. Le serveur en dépend
 * directement — `api/lib/condition_check.php` définit une partie « parfaite »
 * par `attempts === 1`, et les portes des Modes Expert AOA / Personae / Musique
 * sont construites dessus.
 *
 * Ce que ce fichier a attrapé en 2.1, et qui ne cassait aucun test existant :
 *   - Émoji n'incrémentait que dans la branche « mauvaise réponse » : une
 *     victoire au premier essai envoyait 0 au serveur ;
 *   - Silhouette, Personae et Musique testaient `attempts === 0` pour le badge
 *     Critical Strike, alors qu'ils incrémentent AVANT de tester la victoire —
 *     le badge n'était donc jamais décerné. Il ne fonctionnait que dans
 *     Classique, soit 1 mode sur 5.
 *
 * Aucun de ces défauts ne lève d'erreur : un compteur décalé d'un cran produit
 * juste un badge qui ne tombe jamais et une progression Expert qui n'avance pas.
 * D'où une vérification structurelle sur le source des modes — la seule façon de
 * voir une incohérence ENTRE des fichiers qui, pris isolément, sont cohérents.
 *
 * ⚠️ ANGLE MORT ASSUMÉ : seul le second défaut (le `=== 0` du badge) est couvert
 * ici. Le premier — un incrément réservé à la branche « mauvaise réponse » — ne
 * l'est pas. Deux approches ont été essayées et écartées plutôt que gardées :
 *   - repérer un `attempts++` en tête de bloc `else` par regex → les template
 *     literals des chemins d'images contiennent des `}` qui faussent le comptage
 *     d'accolades ;
 *   - comparer la POSITION de l'incrément à celle du chemin de victoire dans le
 *     fichier → l'ordre du source ne dit rien de l'ordre d'exécution (Classique
 *     définit son gestionnaire de victoire avant son gestionnaire de saisie).
 * Le couvrir vraiment demanderait de simuler une partie complète dans le DOM.
 * Un test incapable d'échouer valant moins que pas de test, il n'y en a pas.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MODE_FILES = {
  classic: "classiqueMode/modeClassique.js",
  emoji: "emojiMode/emojiMode.js",
  silhouette: "silhouetteMode/modeSilhouette.js",
  alloutattack: "allOutAttackMode/modeAllOutAttack.js",
  personae: "personaeMode/modePersonae.js",
  music: "musicsMode/modeMusic.js",
};

const source = (relative) =>
  readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("`attempts` — même sémantique dans les 6 modes", () => {
  it("chaque mode incrémente `attempts`", () => {
    const missing = Object.entries(MODE_FILES)
      .filter(([, file]) => !/attempts\+\+/.test(source(file)))
      .map(([mode]) => mode);
    expect(missing).toEqual([]);
  });

  it("le badge « premier essai » teste 1, jamais 0", () => {
    // `attempts === 0` est le symptôme exact du décalage : il ne peut être vrai
    // que si le mode incrémente APRÈS avoir testé la victoire — ce qu'aucun ne
    // fait. Un tel test ne se déclenche donc jamais.
    const wrong = [];
    for (const [mode, file] of Object.entries(MODE_FILES)) {
      const src = source(file);
      if (!src.includes("hasWonFirstTry")) continue; // AOA n'a pas ce badge
      if (/attempts\s*===\s*0\s*&&[^\n]*hasWonFirstTry/.test(src)) wrong.push(mode);
    }
    expect(
      wrong,
      "ces modes ne décerneront jamais le badge Critical Strike (`attempts` vaut 1, pas 0)"
    ).toEqual([]);
  });

});
