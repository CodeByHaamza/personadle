/**
 * profileFormat.test.js — Unit tests for profile/profile-format.js
 * (extracted from profile-page.js, where getStreakTier and formatSongTime
 * were also duplicated verbatim in profile-view.js).
 */

import { describe, it, expect } from "vitest";
import { getStreakTier, formatSongTime, bestModeOverall, needsAvatarOrigin, statsForUnlocks } from "../profile/profile-format.js";

describe("getStreakTier", () => {
  it("returns tier 0 for no streak", () => {
    expect(getStreakTier(0)).toBe(0);
  });

  it("returns the correct tier at each threshold boundary", () => {
    expect(getStreakTier(1)).toBe(1);
    expect(getStreakTier(2)).toBe(1);
    expect(getStreakTier(3)).toBe(2);
    expect(getStreakTier(6)).toBe(2);
    expect(getStreakTier(7)).toBe(3);
    expect(getStreakTier(13)).toBe(3);
    expect(getStreakTier(14)).toBe(4);
    expect(getStreakTier(29)).toBe(4);
    expect(getStreakTier(30)).toBe(5);
    expect(getStreakTier(365)).toBe(5);
  });
});

describe("formatSongTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatSongTime(65)).toBe("1:05");
    expect(formatSongTime(9)).toBe("0:09");
    expect(formatSongTime(600)).toBe("10:00");
  });

  it("returns 0:00 for negative or non-finite input", () => {
    expect(formatSongTime(-5)).toBe("0:00");
    expect(formatSongTime(NaN)).toBe("0:00");
    expect(formatSongTime(Infinity)).toBe("0:00");
  });
});

describe("bestModeOverall", () => {
  const e = (mode, games, wins) => ({ mode, games, wins });

  it("retourne le mode au meilleur taux de victoire", () => {
    const best = bestModeOverall([e("classic", 10, 5), e("music", 4, 4), e("emoji", 8, 7)]);
    expect(best.mode).toBe("music");
    expect(best.rate).toBe(1);
  });

  it("ignore les modes sous le plancher de parties — un 1/1 ne fait pas 100 %", () => {
    const best = bestModeOverall([e("classic", 10, 8), e("music", 1, 1), e("emoji", 2, 2)]);
    expect(best.mode).toBe("classic");
  });

  it("à taux égal, le plus joué l'emporte", () => {
    const best = bestModeOverall([e("classic", 4, 2), e("music", 10, 5)]);
    expect(best.mode).toBe("music");
    expect(best.games).toBe(10);
  });

  it("null quand aucun mode n'atteint le plancher, ou sans données", () => {
    expect(bestModeOverall([e("classic", 2, 2)])).toBeNull();
    expect(bestModeOverall([])).toBeNull();
    expect(bestModeOverall(undefined)).toBeNull();
  });

  it("le plancher est paramétrable", () => {
    expect(bestModeOverall([e("classic", 2, 2)], 1).mode).toBe("classic");
  });

  it("tolère des compteurs absents ou non numériques", () => {
    expect(bestModeOverall([{ mode: "classic" }, e("music", 3, "2")]).mode).toBe("music");
  });
});

describe("needsAvatarOrigin — portrait recadré sans origine connue (052)", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgo=";
  it("vrai seulement pour une image encodée SANS portrait galerie d'origine", () => {
    expect(needsAvatarOrigin({ avatar: PNG })).toBe(true);
    expect(needsAvatarOrigin({ avatar: PNG, avatarSrc: "" })).toBe(true);
    expect(needsAvatarOrigin({ avatar: PNG, avatarSrc: "none" })).toBe(true);
  });
  it("faux dès que l'origine est connue, ou que le portrait est un chemin galerie, ou qu'il n'y a pas d'avatar", () => {
    expect(needsAvatarOrigin({ avatar: PNG, avatarSrc: "../img/avatar/Chie.jpg" })).toBe(false);
    expect(needsAvatarOrigin({ avatar: PNG, avatarSrc: "../img/avatar/Kanji.avif" })).toBe(false);
    expect(needsAvatarOrigin({ avatar: "../img/avatar/Arai.png" })).toBe(false);
    expect(needsAvatarOrigin({ avatar: "" })).toBe(false);
    expect(needsAvatarOrigin({})).toBe(false);
    expect(needsAvatarOrigin(null)).toBe(false);
  });
});

describe("statsForUnlocks — normal + Expert pour les déblocages (décision du 2026-09-19)", () => {
  it("additionne compteurs et modeWins, prend le max des records, et retire la clé expert", () => {
    const s = {
      wins: 30, giveups: 5, games: 35, perfectWins: 20, streakRecord: 4,
      modeWins: { AllOutAttack: 30 }, modeCount: { AllOutAttack: 35 }, streak: 2,
      expert: { wins: 10, giveups: 2, games: 12, perfectWins: 5, streakRecord: 9, modeWins: { AllOutAttack: 10, Music: 1 }, modeCount: { AllOutAttack: 12, Music: 1 } },
    };
    const v = statsForUnlocks(s);
    expect(v.wins).toBe(40);
    expect(v.perfectWins).toBe(25);
    expect(v.giveups).toBe(7);
    expect(v.games).toBe(47);
    expect(v.streakRecord).toBe(9);
    expect(v.modeWins).toEqual({ AllOutAttack: 40, Music: 1 });
    expect(v.modeCount).toEqual({ AllOutAttack: 47, Music: 1 });
    expect(v.streak).toBe(2); // les autres champs passent tels quels
    expect(v.expert).toBeUndefined();
    expect(s.wins, "pure : l'objet d'origine n'est pas modifié").toBe(30);
  });
  it("sans stats Expert (hors ligne, backend antérieur), la vue est le normal tel quel", () => {
    const s = { wins: 3, modeWins: { Music: 3 } };
    expect(statsForUnlocks(s)).toBe(s);
    expect(statsForUnlocks(undefined)).toEqual({});
  });
});
