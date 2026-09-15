/**
 * challenge_install.test.js — installActiveChallenge() et releaseStaleChallenge()
 * (js/gameCore.js), le geste unique des trois entrées d'un défi.
 *
 * Avant : js/challenge-notif.js (Accepter depuis la pop-up) et
 * profile/friends/friends.js (Accepter / Reprendre depuis la Boîte) écrivaient
 * chacun la case `activeChallenge` avec leur propre copie du même bloc — chaque
 * correctif a dû être porté deux fois, et aucun des deux ne libérait une case
 * PÉRIMÉE avant d'écrire par-dessus.
 *
 * Le trou concret : seule la page du mode nettoie une case de la veille
 * (initChallengeBanner). Un joueur qui accepte un défi lundi, n'y va pas, puis en
 * accepte un autre mardi depuis l'accueil, avait encore les filtres du défi de
 * lundi installés — le défi de mardi les sauvegardait comme « ses » filtres
 * d'origine, et lui rendait ceux-là à la fin. Ses vrais filtres étaient perdus.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FILTER_STORAGE_KEYS,
  MODE_STATE_KEYS,
  activeChallengeKey,
  installActiveChallenge,
  parisDateKey,
  readActiveChallenge,
  releaseStaleChallenge,
} from "../js/gameCore.js";

const slot = (isExpert = false) =>
  JSON.parse(localStorage.getItem(activeChallengeKey(isExpert)) || "null");

const base = () => ({
  msgId: 42,
  mode: "classic",
  score: 3,
  senderId: 7,
  challengeDate: "2026-09-14",
  challengeFilters: '["P4"]',
  challengeTarget: "Yu Narukami",
  isExpert: false,
});

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/index.html");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("installActiveChallenge — ce qui est écrit", () => {
  it("écrit la case datée du jour de JEU, avec cible, score, expéditeur et dimension", () => {
    const entry = installActiveChallenge(base());

    expect(slot()).toEqual(entry);
    expect(entry).toMatchObject({
      msgId: 42,
      mode: "classic",
      date: parisDateKey(),
      challengeDate: "2026-09-14",
      score: 3,
      senderId: 7,
      isExpert: false,
      target: "Yu Narukami",
    });
    expect(readActiveChallenge(false)?.msgId).toBe(42);
  });

  it("canonise le mode (« All Out Attack » → alloutattack) — sinon aucune table ne le retrouve", () => {
    localStorage.setItem("aoaAttempts", "4");
    installActiveChallenge({ ...base(), mode: "All Out Attack" });

    expect(slot().mode).toBe("alloutattack");
    expect(localStorage.getItem("aoaAttempts")).toBeNull(); // état AOA purgé
  });

  it("purge l'état du mode ciblé, et seulement lui", () => {
    for (const k of MODE_STATE_KEYS.classic) localStorage.setItem(k, "x");
    for (const k of MODE_STATE_KEYS.emoji) localStorage.setItem(k, "y");

    installActiveChallenge(base());

    for (const k of MODE_STATE_KEYS.classic) expect(localStorage.getItem(k)).toBeNull();
    for (const k of MODE_STATE_KEYS.emoji) expect(localStorage.getItem(k)).toBe("y");
  });

  it("sauvegarde les filtres du joueur et pose ceux de l'expéditeur", () => {
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P3","P5"]');

    installActiveChallenge(base());

    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P4"]');
    expect(slot().originalFilters).toBe('["P3","P5"]');
    expect(slot().filterKey).toBe(FILTER_STORAGE_KEYS.classic);
  });

  it('filtres jamais touchés (clé absente) : originalFilters reste null, jamais "[]"', () => {
    installActiveChallenge(base());
    expect(slot().originalFilters).toBeNull();
  });

  it("défi sans filtres (« [] » ou null) : ne touche pas aux filtres du joueur", () => {
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P3"]');
    installActiveChallenge({ ...base(), challengeFilters: "[]" });
    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P3"]');

    installActiveChallenge({ ...base(), challengeFilters: null });
    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P3"]');
  });

  it("un défi Expert va dans SA case et ne touche pas à la case normale", () => {
    installActiveChallenge(base());
    installActiveChallenge({ ...base(), msgId: 43, isExpert: true });

    expect(slot(false).msgId).toBe(42);
    expect(slot(true).msgId).toBe(43);
    expect(slot(true).isExpert).toBe(true);
  });

  it("ancien format sans cible : target null (le mode jouera la cible du jour)", () => {
    installActiveChallenge({ ...base(), challengeTarget: null });
    expect(slot().target).toBeNull();
  });
});

describe("case périmée déjà présente", () => {
  const stale = (over = {}) => ({
    msgId: 9,
    mode: "classic",
    date: "2020-01-01",
    score: 2,
    senderId: 3,
    filterKey: FILTER_STORAGE_KEYS.classic,
    originalFilters: '["P3","P5"]', // les VRAIS filtres du joueur
    isExpert: false,
    target: "Kanji Tatsumi",
    ...over,
  });

  it("releaseStaleChallenge : rend les filtres du joueur, purge l'état, libère la case", () => {
    localStorage.setItem(activeChallengeKey(false), JSON.stringify(stale()));
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P4"]'); // filtres du défi périmé
    localStorage.setItem("target", '{"nom":"Kanji Tatsumi"}');

    expect(releaseStaleChallenge(false)).toBe(true);

    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P3","P5"]');
    expect(localStorage.getItem("target")).toBeNull();
    expect(slot()).toBeNull();
  });

  it("releaseStaleChallenge ne touche pas à un défi encore valable aujourd'hui", () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify(stale({ date: parisDateKey() }))
    );
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P4"]');

    expect(releaseStaleChallenge(false)).toBe(false);

    expect(slot().msgId).toBe(9);
    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P4"]');
  });

  it("releaseStaleChallenge : case illisible → retirée, rien d'autre", () => {
    localStorage.setItem(activeChallengeKey(false), "{oops");
    expect(releaseStaleChallenge(false)).toBe(false);
    expect(localStorage.getItem(activeChallengeKey(false))).toBeNull();
  });

  it("installer un nouveau défi par-dessus une case de la veille rend d'abord au joueur SES filtres", () => {
    // Lundi : défi accepté, filtres du défi posés, les siens sauvegardés.
    localStorage.setItem(activeChallengeKey(false), JSON.stringify(stale()));
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P4"]');

    // Mardi, depuis l'accueil, sans être repassé par la page du mode.
    installActiveChallenge({ ...base(), challengeFilters: '["P2"]' });

    // Le nouveau défi a sauvegardé les filtres du JOUEUR, pas ceux du défi de lundi.
    expect(slot().msgId).toBe(42);
    expect(slot().originalFilters).toBe('["P3","P5"]');
    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P2"]');
  });

  it("une case périmée de l'AUTRE dimension n'est pas touchée", () => {
    localStorage.setItem(activeChallengeKey(true), JSON.stringify(stale({ isExpert: true })));

    installActiveChallenge(base());

    expect(slot(true).msgId).toBe(9);
  });

  it("le joueur ne touche jamais ses filtres : aucune clé ne naît d'une libération", () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify(stale({ originalFilters: null }))
    );
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P4"]');

    installActiveChallenge({ ...base(), challengeFilters: null });

    // Rien à restaurer (null) : la clé garde ce qu'elle avait, et surtout pas "[]".
    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P4"]');
  });
});

describe("les deux chemins d'acceptation écrivent la MÊME case", () => {
  it("friends.js (vocabulaire { mid, modeKey, date }) et gameCore produisent une case identique", async () => {
    // friends.js ré-exporte un adaptateur : c'est lui qu'Accepter/Reprendre appellent.
    window.history.replaceState({}, "", "/profile/friends/friends.html");
    const { installActiveChallenge: viaFriends } = await import("../profile/friends/friends.js");

    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P3"]');
    viaFriends({
      mid: 42,
      modeKey: "classic",
      date: "2026-09-14",
      score: 3,
      senderId: 7,
      challengeFilters: '["P4"]',
      challengeTarget: "Yu Narukami",
      isExpert: false,
    });
    const fromFriends = slot();

    localStorage.clear();
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P3"]');
    installActiveChallenge(base());
    const fromCore = slot();

    expect(fromFriends).toEqual(fromCore);
  });
});
