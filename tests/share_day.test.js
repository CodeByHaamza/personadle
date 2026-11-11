/**
 * share_day.test.js — « Partager ma journée » (js/share_day.js + recordDayResult
 * de js/gameCore.js), 2.4 lot 10.
 *
 * Ce qui compte : seule la PREMIÈRE partie normale de chaque mode compte (pas un
 * Replay, pas l'Expert) ; une partie de la veille finie après minuit n'efface pas
 * la journée ; le texte ne contient que des marques, jamais une cible ; et à 6/6
 * le bouton de fin de partie partage la journée.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DAY_RESULTS_KEY, recordDayResult } from "../js/gameCore.js";
import { buildDayShareText, isDayComplete, readDay } from "../js/share_day.js";
import { LAST_RESULT_KEY, mountShareButton } from "../js/share_result.js";

const TODAY = "2026-11-11";
const SCOPES = {
  classic: "Classic",
  emoji: "Emoji",
  silhouette: "silhouette",
  alloutattack: "AllOut",
  personae: "Personae",
  music: "Music",
};

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  window.history.pushState({}, "", "/classiqueMode/classiqueMode.html");
});

describe("recordDayResult", () => {
  it("keeps the first normal game of each mode only", () => {
    expect(recordDayResult({ mode: "Classic", result: "win", attempts: 3, day: TODAY })).toBe(true);
    // Replay du même mode le même jour : ignoré.
    expect(recordDayResult({ mode: "classic", result: "giveup", attempts: 9, day: TODAY })).toBe(
      false
    );
    // Expert : ignoré.
    expect(
      recordDayResult({ mode: "Emoji", result: "win", attempts: 1, isExpert: true, day: TODAY })
    ).toBe(false);
    expect(
      recordDayResult({ mode: "All Out Attack", result: "giveup", attempts: 8, day: TODAY })
    ).toBe(true);

    expect(JSON.parse(localStorage.getItem(DAY_RESULTS_KEY))).toEqual({
      day: TODAY,
      modes: {
        classic: { result: "win", attempts: 3 },
        alloutattack: { result: "giveup", attempts: 8 },
      },
    });
  });

  it("starts a new day, and never lets yesterday's late game wipe today", () => {
    recordDayResult({ mode: "Classic", result: "win", attempts: 2, day: "2026-11-10" });
    recordDayResult({ mode: "Emoji", result: "win", attempts: 4, day: TODAY });
    expect(JSON.parse(localStorage.getItem(DAY_RESULTS_KEY)).modes).toEqual({
      emoji: { result: "win", attempts: 4 },
    });
    expect(recordDayResult({ mode: "Music", result: "win", attempts: 1, day: "2026-11-10" })).toBe(
      false
    );
    expect(JSON.parse(localStorage.getItem(DAY_RESULTS_KEY)).day).toBe(TODAY);
  });

  it("ignores unknown modes and results", () => {
    expect(recordDayResult({ mode: "Tetris", result: "win", attempts: 1, day: TODAY })).toBe(false);
    expect(recordDayResult({ mode: "Classic", result: "abandon", attempts: 1, day: TODAY })).toBe(
      false
    );
  });
});

describe("readDay + buildDayShareText", () => {
  it("prints one line per mode, wins first-try marked, nothing else revealed", () => {
    recordDayResult({ mode: "Classic", result: "win", attempts: 3, day: TODAY });
    recordDayResult({ mode: "Emoji", result: "win", attempts: 1, day: TODAY });
    recordDayResult({ mode: "Silhouette", result: "giveup", attempts: 8, day: TODAY });
    // Joué ailleurs (ou avant cette version) : marqué joué sans résultat retenu.
    localStorage.setItem("dailyDone_Personae", TODAY);

    const day = readDay({ today: TODAY });
    expect(day.done).toBe(4);
    expect(day.wins).toBe(2);
    expect(buildDayShareText(day).split("\n")).toEqual([
      "PersonaDLE 📅 11/11 — 2/6",
      "🔤 Classic ✅ 3",
      "😄 Emoji 🎯 1",
      "👤 Silhouette 🏳️",
      "⚔️ AllOutAttack ⬜",
      "✨ Personae ✔️",
      "🎵 Music ⬜",
      "https://personadle.net",
    ]);
  });

  it("ignores a stored day that is not today", () => {
    recordDayResult({ mode: "Classic", result: "win", attempts: 3, day: "2026-11-10" });
    expect(readDay({ today: TODAY }).done).toBe(0);
  });

  it("is complete only when all six modes are played", () => {
    for (const k of Object.keys(SCOPES).slice(0, 5)) {
      recordDayResult({ mode: k, result: "win", attempts: 2, day: TODAY });
    }
    expect(isDayComplete({ today: TODAY })).toBe(false);
    recordDayResult({ mode: "music", result: "win", attempts: 2, day: TODAY });
    expect(isDayComplete({ today: TODAY })).toBe(true);
  });
});

describe("end-of-game share button at 6/6", () => {
  function finishedClassic() {
    document.body.innerHTML = '<div id="modeNavigationContainer"></div>';
    localStorage.setItem(
      LAST_RESULT_KEY,
      JSON.stringify({
        scope: "Classic",
        id: "g1",
        mode: "Classic",
        result: "win",
        attempts: 3,
        isExpert: false,
        day: TODAY,
      })
    );
    localStorage.setItem("gameId_Classic", "g1");
  }

  it("shares the single result before the day is complete", () => {
    finishedClassic();
    const btn = mountShareButton();
    expect(btn.classList.contains("btn-share-result--day")).toBe(false);
  });

  it("shares the whole day once all six modes are played", () => {
    finishedClassic();
    // isDayComplete() lit la vraie date de Paris : on marque les six modes pour elle.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    for (const scope of Object.values(SCOPES)) localStorage.setItem(`dailyDone_${scope}`, today);
    const btn = mountShareButton();
    expect(btn.classList.contains("btn-share-result--day")).toBe(true);
    expect(btn.textContent).toContain("Share my day");
  });
});
