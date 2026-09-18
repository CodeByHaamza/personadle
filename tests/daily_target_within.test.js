/**
 * daily_target_within.test.js — La cible du jour respecte les filtres d'opus du
 * joueur (getDailyTargetWithin, js/gameCore.js), sur les VRAIS catalogues des six
 * modes.
 *
 * Avant : Classic, Émoji, Silhouette et Music tiraient la cible du jour dans le
 * catalogue complet quels que soient les filtres. Un joueur « P5 uniquement »
 * pouvait donc recevoir un personnage P3 que l'autocomplétion ne proposait jamais
 * — la partie du jour lui était injouable, alors que l'aide des filtres promet
 * « seuls les jeux gardés peuvent tomber ». AOA et Personae re-tiraient déjà dans
 * le pool filtré ; c'est maintenant le geste des six.
 *
 * La contrepartie serveur (personadle_pick_within_filters, api/lib/daily_target.php)
 * doit rester identique : parité vérifiée sur 1296 cas (4 dates × 4 seeds × 9 modes
 * × 9 filtres, 775 re-tirages effectifs, 0 écart) au moment du changement — voir
 * tests/php/DailyTargetTest.php pour les propriétés figées côté PHP.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDailyTarget, getDailyTargetWithin } from "../js/gameCore.js";
import { characters } from "../database/characters_clean.js";
import { silhouetteCharacters } from "../silhouetteMode/database/silhouetteCharacters.js";
import { songs } from "../musicsMode/database/songs.js";
import { expertLyrics } from "../musicsMode/database/expert_lyrics.js";
import { personas as aoaPool } from "../allOutAttackMode/database/personas_allOut.js";
import { aoaCharacters } from "../allOutAttackMode/database/aoaCharacters.js";
import { personaeCharacters } from "../personaeMode/database/personaeCharacters.js";

const inOpus = (entry, filters) => {
  const ops = Array.isArray(entry.opus) ? entry.opus : [entry.opus];
  return ops.some((o) => filters.includes(o));
};
const DATES = ["2026-09-17", "2026-03-29", "2026-12-31", "2027-02-28", "2026-07-14"];
const SEEDS = ["1", "42", "12345", "9f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8"];

beforeEach(() => localStorage.clear());

describe("getDailyTargetWithin — contrat", () => {
  const pool = ["A", "B", "C", "D", "E", "F"];

  it("rend la cible du catalogue complet quand elle est dans le pool filtré", () => {
    for (const seed of SEEDS) {
      const daily = getDailyTarget(pool, "Test", "2026-09-17", seed);
      expect(getDailyTargetWithin(pool, [daily], "Test", (x) => x, "2026-09-17", seed)).toBe(daily);
      expect(getDailyTargetWithin(pool, pool, "Test", (x) => x, "2026-09-17", seed)).toBe(daily);
    }
  });

  it("re-tire DANS le pool filtré quand la cible complète en est exclue, avec la même graine", () => {
    for (const seed of SEEDS) {
      const daily = getDailyTarget(pool, "Test", "2026-09-17", seed);
      const filtered = pool.filter((x) => x !== daily);
      const got = getDailyTargetWithin(pool, filtered, "Test", (x) => x, "2026-09-17", seed);
      expect(filtered).toContain(got);
      expect(got).toBe(getDailyTarget(filtered, "Test", "2026-09-17", seed));
    }
  });

  it("est déterministe : deux appels, même résultat (stable au rechargement)", () => {
    const filtered = ["B", "D"];
    const a = getDailyTargetWithin(pool, filtered, "Test", (x) => x, "2026-09-17", "42");
    const b = getDailyTargetWithin(pool, filtered, "Test", (x) => x, "2026-09-17", "42");
    expect(a).toBe(b);
  });

  it("pool filtré vide ou absent → cible du catalogue complet (le mode affiche déjà « aucun résultat »)", () => {
    const daily = getDailyTarget(pool, "Test", "2026-09-17", "42");
    expect(getDailyTargetWithin(pool, [], "Test", (x) => x, "2026-09-17", "42")).toBe(daily);
    expect(getDailyTargetWithin(pool, null, "Test", (x) => x, "2026-09-17", "42")).toBe(daily);
    expect(getDailyTargetWithin(pool, undefined, "Test", (x) => x, "2026-09-17", "42")).toBe(daily);
  });

  it("catalogue vide → null, pas d'exception", () => {
    expect(getDailyTargetWithin([], [], "Test")).toBeNull();
  });

  it("compare par identité fournie (keyOf) pour des objets, pas par référence", () => {
    const objs = pool.map((nom) => ({ nom, opus: [nom < "D" ? "P3" : "P5"] }));
    const filtered = objs.filter((c) => inOpus(c, ["P5"])).map((c) => ({ ...c })); // copies
    const got = getDailyTargetWithin(objs, filtered, "Test", (c) => c?.nom, "2026-09-17", "42");
    expect(["D", "E", "F"]).toContain(got.nom);
  });

  it("la clé de hash distingue normal et Expert (tirages indépendants)", () => {
    const filtered = pool.slice(1);
    const normal = getDailyTargetWithin(pool, filtered, "Classic", (x) => x, "2026-09-17", "42");
    const expert = getDailyTargetWithin(pool, filtered, "ClassicExpert", (x) => x, "2026-09-17", "42");
    // Pas forcément différents sur 5 entrées, mais chacun stable et dans le pool
    expect(filtered).toContain(normal);
    expect(filtered).toContain(expert);
  });
});

describe("sur les vrais catalogues — la cible du jour est TOUJOURS jouable avec ses filtres", () => {
  const emojiChars = characters.filter((c) => c.emoji);
  const expertChars = characters.filter((c) => String(c.quote ?? "").trim());
  const expertSongs = songs.filter((s) => expertLyrics[s.titre]);
  const aoaOpus = Object.fromEntries(aoaCharacters.map((c) => [c.nom, c.opus]));

  const MODES = [
    ["Classic", characters, (c) => c?.nom, (c, f) => inOpus(c, f)],
    ["ClassicExpert", expertChars, (c) => c?.nom, (c, f) => inOpus(c, f)],
    ["Emoji", emojiChars, (c) => c?.nom, (c, f) => inOpus(c, f)],
    ["Silhouette", silhouetteCharacters, (c) => c?.nom, (c, f) => inOpus(c, f)],
    ["Music", songs, (s) => s?.titre, (s, f) => inOpus(s, f)],
    ["MusicExpert", expertSongs, (s) => s?.titre, (s, f) => inOpus(s, f)],
    ["AllOutAttack", aoaPool, (n) => n, (n, f) => inOpus({ opus: aoaOpus[n] ?? [] }, f)],
    // Identité d'entrée, pas le nom : Hermes / Susano-o / Prometheus sont portés
    // par deux personnages d'opus différents (cf. CLAUDE.md §4).
    ["Personae", personaeCharacters, (c) => c, (c, f) => inOpus(c, f)],
  ];
  const FILTERS = [["P5"], ["P1"], ["P3", "P3FES", "P3P"], ["P4G"], ["P2IS", "P2EP"], ["P5R"], ["PTS"]];

  for (const [mode, pool, keyOf, matches] of MODES) {
    it(`${mode} : avec un filtre restreint, la cible appartient à un opus actif (${DATES.length * SEEDS.length * FILTERS.length} tirages)`, () => {
      let fallbacks = 0;
      for (const date of DATES) {
        for (const seed of SEEDS) {
          for (const f of FILTERS) {
            const filtered = pool.filter((e) => matches(e, f));
            if (!filtered.length) continue; // filtre sans entrée pour ce mode
            const daily = getDailyTarget(pool, mode, date, seed);
            const got = getDailyTargetWithin(pool, filtered, mode, keyOf, date, seed);
            expect(got, `${mode} ${date} ${seed} ${f}`).not.toBeNull();
            expect(matches(got, f), `${mode} ${date} ${seed} ${f} → ${keyOf(got)}`).toBe(true);
            if (keyOf(got) !== keyOf(daily)) fallbacks++;
          }
        }
      }
      expect(fallbacks, "au moins un re-tirage doit avoir été exercé").toBeGreaterThan(0);
    });

    it(`${mode} : sans filtre (tout actif), c'est exactement la cible du catalogue complet`, () => {
      for (const date of DATES) {
        for (const seed of SEEDS) {
          const daily = getDailyTarget(pool, mode, date, seed);
          expect(keyOf(getDailyTargetWithin(pool, pool, mode, keyOf, date, seed))).toBe(keyOf(daily));
        }
      }
    });
  }

  it("Personae : un persona homonyme d'un autre opus ne fait pas passer la cible pour « présente »", () => {
    // Le Prometheus de Futaba (P5R) et celui de Baofu (P2EP) partagent le nom.
    // Pour un joueur « P2 uniquement », la cible doit être une entrée P2 — jamais
    // celle de Futaba au motif qu'« un Prometheus » est dans le pool filtré.
    const filtered = personaeCharacters.filter((c) => inOpus(c, ["P2IS", "P2EP"]));
    expect(filtered.some((c) => c.persona === "Prometheus")).toBe(true);
    for (const date of DATES) {
      for (const seed of SEEDS) {
        const got = getDailyTargetWithin(personaeCharacters, filtered, "Personae", undefined, date, seed);
        expect(inOpus(got, ["P2IS", "P2EP"]), `${date} ${seed} → ${got.persona} [${got.opus}]`).toBe(true);
        expect(filtered).toContain(got); // la même RÉFÉRENCE, pas un homonyme
      }
    }
  });

  it("un joueur « P5 uniquement » en Classique reçoit un personnage P5 tous les jours d'une semaine", () => {
    const filtered = characters.filter((c) => inOpus(c, ["P5"]));
    for (let d = 1; d <= 7; d++) {
      const date = `2026-09-0${d}`;
      const got = getDailyTargetWithin(characters, filtered, "Classic", (c) => c?.nom, date, "42");
      expect(got.opus).toContain("P5");
    }
  });
});
