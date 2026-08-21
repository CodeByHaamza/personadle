/**
 * expertWiring.test.js — le CÂBLAGE du cycle de vie d'une partie, pas la primitive.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Pourquoi ce fichier existe
 * ─────────────────────────────────────────────────────────────────────────────
 * La revue de la PR #69 a trouvé trois bugs que les 725 tests d'alors laissaient
 * passer, tous de la même famille : `startGame()` / `isGameLogged()` étaient
 * couverts par 11 tests unitaires impeccables… qui ne disaient rien de QUI les
 * appelle, ni QUAND.
 *
 *   - Émoji ne réarmait pas la partie au changement de jour → à partir du 2e jour,
 *     la partie quotidienne n'était plus jamais enregistrée. Aucune erreur, aucun
 *     log : elle disparaissait, c'est tout.
 *   - `lastPlayedDate_*` n'était pas scopé par mode Expert dans 4 modes sur 6 →
 *     ouvrir une variante consommait le reset quotidien de l'autre.
 *   - Le profil lisait `localStorage["user"]`, une clé qui n'existe pas → toute la
 *     section Expert était morte.
 *
 * Un test unitaire de plus sur `startGame()` n'en aurait attrapé aucun. Ce fichier
 * teste donc deux choses que les tests de primitives ne peuvent pas voir :
 *
 *   1. Le CONTRAT DE VIE : « nouveau jour ⇒ la partie est réarmée », vérifié sur
 *      la fonction que les 6 modes partagent.
 *   2. Les INVARIANTS DE CÂBLAGE : chaque mode appelle bien ce contrat, avec une
 *      clé scopée Expert. Vérifiés en lisant les sources — c'est le seul moyen de
 *      couvrir six fichiers de mode sans monter six DOM complets, et ça protège
 *      le 7e mode que personne n'a encore écrit.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkResetOnLoad, startGame, markGameLogged, isGameLogged } from "../js/gameCore.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Les 6 modes et leur fichier de logique. */
const MODES = [
  ["Classique", "classiqueMode/modeClassique.js"],
  ["Émoji", "emojiMode/emojiMode.js"],
  ["Silhouette", "silhouetteMode/modeSilhouette.js"],
  ["All-Out Attack", "allOutAttackMode/modeAllOutAttack.js"],
  ["Personae", "personaeMode/modePersonae.js"],
  ["Music", "musicsMode/modeMusic.js"],
];

const source = (rel) => readFileSync(join(ROOT, rel), "utf8");

/**
 * Source privée de ses commentaires — sinon un invariant se satisfait d'une simple
 * mention en prose, ce qui en fait un test qui ment.
 */
const code = (rel) =>
  source(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. LE CONTRAT DE VIE — « nouveau jour ⇒ la partie est réarmée »
// ─────────────────────────────────────────────────────────────────────────────

describe("checkResetOnLoad — cycle de vie d'une partie", () => {
  it("réarme l'enregistrement quand un nouveau jour commence", () => {
    // Hier : une partie jouée et enregistrée.
    startGame("Classic");
    markGameLogged("Classic");
    expect(isGameLogged("Classic")).toBe(true);
    localStorage.setItem("lastPlayedDate_Classic", "2020-01-01");

    checkResetOnLoad("lastPlayedDate_Classic", "Classic", () => {});

    // Aujourd'hui : c'est une NOUVELLE partie, elle doit pouvoir être enregistrée.
    // Sans ce réarmement, la partie du jour disparaissait en silence (bug Émoji).
    expect(isGameLogged("Classic")).toBe(false);
  });

  it("ne réarme rien le même jour — un F5 ne doit pas rendre la partie re-loggable", () => {
    startGame("Classic");
    markGameLogged("Classic");
    const today = localStorage.getItem("lastPlayedDate_Classic");
    checkResetOnLoad("lastPlayedDate_Classic", "Classic", () => {});
    // 1er appel : pose la date du jour. 2e appel (le F5) : ne doit rien réarmer.
    expect(today).toBeNull();
    markGameLogged("Classic");
    checkResetOnLoad("lastPlayedDate_Classic", "Classic", () => {});
    expect(isGameLogged("Classic")).toBe(true);
  });

  it("appelle onReset une seule fois par jour", () => {
    const onReset = vi.fn();
    localStorage.setItem("lastPlayedDate_Classic", "2020-01-01");
    checkResetOnLoad("lastPlayedDate_Classic", "Classic", onReset);
    checkResetOnLoad("lastPlayedDate_Classic", "Classic", onReset);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("réarme la portée passée, et elle seule", () => {
    startGame("Classic");
    markGameLogged("Classic");
    startGame("ClassicExpert");
    markGameLogged("ClassicExpert");
    localStorage.setItem("k", "2020-01-01");

    checkResetOnLoad("k", "ClassicExpert", () => {});

    expect(isGameLogged("ClassicExpert")).toBe(false);
    expect(isGameLogged("Classic")).toBe(true); // le mode normal n'est pas touché
  });

  it("les deux variantes d'un mode ont un reset quotidien indépendant", () => {
    // Le bug : avec une clé de date partagée, ouvrir l'Expert un nouveau jour
    // marquait la journée comme faite pour le mode normal aussi — qui restituait
    // alors la partie terminée de la veille sans jamais tirer la cible du jour.
    const normal = vi.fn();
    const expert = vi.fn();
    localStorage.setItem("lastPlayedDate_Classic", "2020-01-01");
    localStorage.setItem("classicExpert_lastPlayedDate_Classic", "2020-01-01");

    checkResetOnLoad("classicExpert_lastPlayedDate_Classic", "ClassicExpert", expert);
    checkResetOnLoad("lastPlayedDate_Classic", "Classic", normal);

    expect(expert).toHaveBeenCalledTimes(1);
    expect(normal).toHaveBeenCalledTimes(1); // ← valait 0 avant le correctif
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. INVARIANTS DE CÂBLAGE — les 6 modes respectent-ils le contrat ?
// ─────────────────────────────────────────────────────────────────────────────

describe("câblage du reset quotidien dans les 6 modes", () => {
  it.each(MODES)("%s appelle checkResetOnLoad", (_nom, rel) => {
    expect(code(rel)).toMatch(/checkResetOnLoad\(/);
  });

  it.each(MODES)("%s scope sa clé lastPlayedDate par mode Expert", (_nom, rel) => {
    // Toute occurrence doit passer par EXPERT.key(...) — qui préfixe en Expert et
    // rend la clé historique inchangée en normal — ou par un template contenant la
    // clé de stats Expert (Music). On retire les formes correctes, il ne doit rien
    // rester : ce qui reste est une clé partagée entre les deux variantes.
    const restant = code(rel)
      .replace(/EXPERT\.key\(\s*["'`]lastPlayedDate_[A-Za-z]+["'`]\s*\)/g, "")
      .replace(/`lastPlayedDate_\$\{STATS_(?:SCOPE|KEY)\}`/g, "");
    const brutes = [...restant.matchAll(/["'`]lastPlayedDate_[A-Za-z]+["'`]/g)].map((m) => m[0]);
    expect(brutes, `clés non scopées dans ${rel} : ${brutes.join(", ")}`).toEqual([]);
  });

  it.each(MODES)(
    "%s passe une portée de stats à checkResetOnLoad, pas un littéral",
    (_nom, rel) => {
      // 2e argument : STATS_SCOPE / STATS_KEY (dérivés de EXPERT.statsKey), jamais
      // "Classic" ou "silhouette" en dur — un littéral ne distingue pas l'Expert.
      const appel = code(rel).match(/checkResetOnLoad\(([\s\S]*?)\)\s*;/);
      expect(appel, `aucun appel checkResetOnLoad lisible dans ${rel}`).not.toBeNull();
      expect(appel[1], `2e argument non scopé dans ${rel}`).toMatch(/STATS_SCOPE|STATS_KEY/);
    }
  );
});

describe("câblage de l'enregistrement de session dans les 6 modes", () => {
  it.each(MODES)("%s ne garde pas de copie périmée de isGameLogged", (_nom, rel) => {
    // Une copie en variable capturée au chargement du module ne voit pas le
    // réarmement fait plus tard par checkResetOnLoad() : elle bloquait
    // l'enregistrement de la journée (Classique, Silhouette).
    expect(code(rel)).not.toMatch(/let\s+statsAlreadyLogged\s*=/);
  });

  it.each(MODES)("%s passe l'identité de partie comme clé d'idempotence", (_nom, rel) => {
    // clientSessionId absent ⇒ client_session_id NULL en base ⇒ plus aucune
    // protection contre le double-insert depuis la migration 032.
    expect(code(rel)).toMatch(/clientSessionId:\s*markGameLogged\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. INVARIANTS CÔTÉ AFFICHAGE / API
// ─────────────────────────────────────────────────────────────────────────────

describe("profil — source de l'identifiant joueur", () => {
  it("ne lit pas localStorage['user'], une clé que rien n'écrit", () => {
    // Le bug : `JSON.parse(localStorage.getItem("user"))?.id` valait toujours
    // undefined, donc renderExpertStats() sortait avant l'appel API et toute la
    // section Mode Expert était invisible — sans la moindre erreur.
    expect(code("profile/profile-page.js")).not.toMatch(
      /localStorage\.getItem\(\s*["']user["']\s*\)/
    );
  });

  it("aucun module ne lit une clé localStorage que personne n'écrit", () => {
    // Garde générique : la même faute sur une autre clé serait tout aussi muette.
    const fichiers = [
      "profile/profile-page.js",
      "js/auth.js",
      "js/api.js",
      "js/gameCore.js",
      "js/cloud-sync.js",
    ];
    const lus = new Set();
    const ecrits = new Set();
    for (const f of fichiers) {
      const src = code(f);
      for (const m of src.matchAll(/localStorage\.getItem\(\s*["']([A-Za-z_]\w*)["']\s*\)/g)) {
        lus.add(m[1]);
      }
      for (const m of src.matchAll(/localStorage\.setItem\(\s*["']([A-Za-z_]\w*)["']/g)) {
        ecrits.add(m[1]);
      }
    }
    // Clés écrites ailleurs que dans ces 5 fichiers (modes de jeu, badges…).
    const externes = new Set([
      "personaUserProfile",
      "playerProfile",
      "activeChallenge",
      "daltonianMode",
      "pendingSessions",
      "profileMusicId",
      "lang",
      "theme",
      "darkmode",
    ]);
    const orphelines = [...lus].filter((k) => !ecrits.has(k) && !externes.has(k));
    expect(orphelines, `clés lues mais jamais écrites : ${orphelines.join(", ")}`).toEqual([]);
  });
});

describe("modes Expert — alignement des clés de hash client ⇄ serveur", () => {
  // Une clé de hash qui diverge de api/lib/daily_target.php ne casse rien de
  // visible : le joueur joue une cible, le serveur en attendait une autre, et
  // CHAQUE partie part en log `anti_cheat`. Personne ne s'en aperçoit avant
  // d'ouvrir la table des erreurs.
  const ATTENDUES = [
    "ClassicExpert",
    "EmojiExpert",
    "SilhouetteExpert",
    "AllOutAttackExpert",
    "PersonaeExpert",
    "MusicExpert",
  ];

  it.each(ATTENDUES)("%s est connue de api/lib/daily_target.php", (cle) => {
    expect(source("api/lib/daily_target.php")).toContain(`'${cle}'`);
  });

  it("les 6 modes Expert ont un cas dans daily_target.php", () => {
    const src = source("api/lib/daily_target.php");
    for (const mode of [
      "classic_expert",
      "emoji_expert",
      "silhouette_expert",
      "alloutattack_expert",
      "personae_expert",
      "music_expert",
    ]) {
      expect(src, `cas manquant : ${mode}`).toContain(`case '${mode}'`);
    }
  });

  it("sessions.php accepte exactement ces 6 modes en Expert", () => {
    const src = source("api/sessions.php");
    const liste = src.match(/\$expertModes\s*=\s*\[([^\]]+)\]/);
    expect(liste).not.toBeNull();
    const modes = [...liste[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(modes).toEqual(
      ["alloutattack", "classic", "emoji", "music", "personae", "silhouette"].sort()
    );
  });
});
