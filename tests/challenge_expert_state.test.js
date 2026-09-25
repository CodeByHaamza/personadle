/**
 * challenge_expert_state.test.js — accepter un défi efface l'état de SA dimension.
 *
 * Signalé en production le 2026-09-25 : après une partie Expert gagnée en mode
 * Musique, accepter un défi ami sur ce mode renvoyait sur la page qui annonçait
 * la victoire immédiatement, sans avoir joué.
 *
 * `installActiveChallenge()` efface bien l'état du mode pour que le joueur
 * reparte de zéro — mais il n'effaçait que la dimension NORMALE. Un défi Expert
 * laissait donc `…GameOver = "true"` de la partie Expert du jour, que la page
 * restaure au chargement.
 *
 * Deux garde-fous ici, et le second compte autant que le premier :
 *
 *  1. le comportement — la bonne dimension est effacée, l'autre est épargnée ;
 *  2. la table des clés Expert est VRAIE. Elle est écrite en toutes lettres
 *     faute de règle unique (le mode Musique ne suit pas la convention des cinq
 *     autres), donc rien n'empêcherait d'y laisser une clé imaginaire : le
 *     nettoyage porterait alors sur du vide, sans que rien n'échoue. Ce test
 *     relit les fichiers de mode pour vérifier que chaque clé y est réellement
 *     construite.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  installActiveChallenge,
  MODE_STATE_KEYS,
  MODE_STATE_KEYS_EXPERT,
  modeStateKeys,
} from "../js/gameCore.js";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Fichier source de chaque mode, pour relire comment il bâtit ses clés. */
const SOURCES = {
  classic: "classiqueMode/modeClassique.js",
  emoji: "emojiMode/emojiMode.js",
  silhouette: "silhouetteMode/modeSilhouette.js",
  alloutattack: "allOutAttackMode/modeAllOutAttack.js",
  personae: "personaeMode/modePersonae.js",
  music: "musicsMode/modeMusic.js",
};

beforeEach(() => {
  localStorage.clear();
});

describe("modeStateKeys", () => {
  it("rend les clés normales ou Expert selon la dimension", () => {
    expect(modeStateKeys("music", false)).toEqual(MODE_STATE_KEYS.music);
    expect(modeStateKeys("music", true)).toEqual(MODE_STATE_KEYS_EXPERT.music);
  });

  it("rend un tableau vide pour un mode inconnu, sans lever", () => {
    expect(modeStateKeys("inexistant", false)).toEqual([]);
    expect(modeStateKeys("inexistant", true)).toEqual([]);
  });

  it("les deux tables couvrent exactement les mêmes modes", () => {
    // Un mode présent d'un seul côté, c'est une dimension qu'on n'efface jamais.
    expect(Object.keys(MODE_STATE_KEYS_EXPERT).sort()).toEqual(Object.keys(MODE_STATE_KEYS).sort());
  });

  it("aucune clé Expert n'est identique à une clé normale", () => {
    // Si les deux se confondaient, effacer une dimension emporterait l'autre.
    for (const mode of Object.keys(MODE_STATE_KEYS)) {
      const communes = MODE_STATE_KEYS_EXPERT[mode].filter((k) =>
        MODE_STATE_KEYS[mode].includes(k)
      );
      expect(communes, `${mode} : clés partagées entre dimensions`).toEqual([]);
    }
  });
});

describe("la table des clés Expert dit la vérité", () => {
  // Sans ce test, une clé mal orthographiée ne casserait rien de visible : le
  // `removeItem` porterait sur une clé absente, l'état resterait, et le bug
  // reviendrait à l'identique.
  it("chaque clé Expert listée est réellement construite par son mode", () => {
    const introuvables = [];
    for (const [mode, cles] of Object.entries(MODE_STATE_KEYS_EXPERT)) {
      const src = readFileSync(join(RACINE, SOURCES[mode]), "utf8");
      for (const cle of cles) {
        // Cinq modes passent par EXPERT.key("nom") → "prefixExpert_nom".
        // Musique bâtit `${KEY_PREFIX}Nom` avec KEY_PREFIX = "musicExpert".
        const viaExpertKey =
          cle.includes("_") && src.includes(`EXPERT.key("${cle.split("_")[1]}")`);
        const viaPrefixe =
          mode === "music" && src.includes("`${KEY_PREFIX}" + cle.replace("musicExpert", "") + "`");
        if (!viaExpertKey && !viaPrefixe) introuvables.push(`${mode} → ${cle}`);
      }
    }
    expect(introuvables).toEqual([]);
  });
});

describe("installActiveChallenge — dimension effacée", () => {
  /** Remplit les deux dimensions du mode Musique comme une fin de partie. */
  function partieTerminéeDansLesDeuxDimensions() {
    for (const k of MODE_STATE_KEYS.music) localStorage.setItem(k, "normal");
    for (const k of MODE_STATE_KEYS_EXPERT.music) localStorage.setItem(k, "expert");
  }

  const defi = (isExpert) => ({
    msgId: 1,
    mode: "music",
    score: 3,
    senderId: 2,
    challengeTarget: "Sun",
    isExpert,
  });

  it("un défi EXPERT efface l'état Expert — c'est le bug signalé", () => {
    partieTerminéeDansLesDeuxDimensions();

    installActiveChallenge(defi(true));

    for (const k of MODE_STATE_KEYS_EXPERT.music) {
      expect(localStorage.getItem(k), `${k} aurait dû être effacée`).toBeNull();
    }
  });

  it("…et laisse la partie NORMALE du jour intacte", () => {
    // Les deux dimensions sont indépendantes : accepter un défi Expert ne doit
    // pas coûter au joueur sa partie normale en cours.
    partieTerminéeDansLesDeuxDimensions();

    installActiveChallenge(defi(true));

    for (const k of MODE_STATE_KEYS.music) {
      expect(localStorage.getItem(k), `${k} ne devait pas bouger`).toBe("normal");
    }
  });

  it("un défi NORMAL efface l'état normal et épargne l'Expert", () => {
    partieTerminéeDansLesDeuxDimensions();

    installActiveChallenge(defi(false));

    for (const k of MODE_STATE_KEYS.music) expect(localStorage.getItem(k)).toBeNull();
    for (const k of MODE_STATE_KEYS_EXPERT.music) expect(localStorage.getItem(k)).toBe("expert");
  });

  it("le drapeau Expert manquant vaut « normal », pas Expert", () => {
    // Un ancien défi, envoyé avant la dimension Expert, n'a pas ce champ.
    partieTerminéeDansLesDeuxDimensions();

    installActiveChallenge({ msgId: 9, mode: "music", score: 1, senderId: 2 });

    for (const k of MODE_STATE_KEYS.music) expect(localStorage.getItem(k)).toBeNull();
    for (const k of MODE_STATE_KEYS_EXPERT.music) expect(localStorage.getItem(k)).toBe("expert");
  });
});
