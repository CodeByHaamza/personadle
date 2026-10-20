/**
 * share_result.test.js — js/share_result.js (« Partager mon résultat »).
 *
 * Ce qui compte : le texte ne révèle jamais la cible, la grille est dans l'ordre
 * de jeu, et le bouton n'apparaît que pour la partie affichée (pas pour un
 * résultat resté d'une partie précédente).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LAST_RESULT_KEY,
  buildShareText,
  mountShareButton,
  readClassicGrid,
  readCurrentResult,
  shareText,
} from "../js/share_result.js";
import { buildGameSession, checkResetOnLoad, markGameLogged } from "../js/gameCore.js";

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  window.history.pushState({}, "", "/classiqueMode/classiqueMode.html");
});

describe("buildShareText", () => {
  it("prints the Classic grid, the try count and the site, never the target", () => {
    const text = buildShareText({
      mode: "Classic",
      result: "win",
      attempts: 2,
      day: "2026-10-20",
      grid: ["🟥🟨🟥", "🟩🟩🟩"],
    });
    expect(text.split("\n")).toEqual([
      "PersonaDLE 🔤 Classic — 20/10",
      "🟥🟨🟥",
      "🟩🟩🟩",
      "✅ 2 tries",
      "https://personadle.net",
    ]);
  });

  it("uses a miss/hit line for modes without a grid", () => {
    const text = buildShareText({ mode: "music", result: "win", attempts: 4, day: "2026-10-20" });
    expect(text).toContain("❌❌❌✅");
    expect(text).toContain("🎵 Music");
  });

  it("celebrates a first try", () => {
    const text = buildShareText({ mode: "emoji", result: "win", attempts: 1, day: "2026-10-20" });
    expect(text).toContain("✅\n");
    expect(text).toContain("First try");
  });

  it("says when the player gave up", () => {
    const text = buildShareText({
      mode: "silhouette",
      result: "giveup",
      attempts: 8,
      day: "2026-10-20",
    });
    expect(text).toContain("❌❌❌❌❌❌❌❌🏳️");
    expect(text).toContain("Gave up after 8 tries");
  });

  it("caps very long games", () => {
    const text = buildShareText({
      mode: "personae",
      result: "win",
      attempts: 30,
      day: "2026-10-20",
    });
    expect(text).toContain("❌".repeat(8) + "…✅");
    const grid = Array.from({ length: 12 }, () => "🟥");
    const lines = buildShareText({
      mode: "classic",
      result: "win",
      attempts: 12,
      day: "2026-10-20",
      grid,
    }).split("\n");
    expect(lines.filter((l) => l === "🟥")).toHaveLength(8);
    expect(lines).toContain("…");
  });

  it("flags Expert games", () => {
    expect(
      buildShareText({
        mode: "classic",
        result: "win",
        attempts: 3,
        isExpert: true,
        day: "2026-10-20",
      })
    ).toContain("⚡ Expert");
  });
});

describe("readClassicGrid", () => {
  it("reads cell colours in play order (rows are inserted newest first)", () => {
    document.body.innerHTML = `<div id="output">
      <div class="category-row"></div>
      <div class="guess-row"><div class="guess-cell correct"></div><div class="guess-cell correct"></div></div>
      <div class="guess-row"><div class="guess-cell wrong"></div><div class="guess-cell misplaced"></div></div>
    </div>`;
    expect(readClassicGrid()).toEqual(["🟥🟨", "🟩🟩"]);
  });
});

describe("result of the current game", () => {
  it("buildGameSession remembers the result of the game being logged", () => {
    checkResetOnLoad("lastPlayedDate_Classic", "Classic", () => {});
    buildGameSession({
      mode: "Classic",
      targetName: "X",
      result: "win",
      attempts: 3,
      clientSessionId: markGameLogged("Classic"),
    });
    const r = readCurrentResult();
    expect(r).toMatchObject({
      scope: "Classic",
      mode: "Classic",
      result: "win",
      attempts: 3,
      isExpert: false,
    });
    expect(JSON.stringify(r)).not.toContain('"X"'); // la cible n'est jamais retenue
  });

  it("ignores a result left by a previous game", () => {
    localStorage.setItem(
      LAST_RESULT_KEY,
      JSON.stringify({ scope: "Classic", id: "old", result: "win", attempts: 2 })
    );
    localStorage.setItem("gameId_Classic", "new");
    expect(readCurrentResult()).toBeNull();
  });

  it("does not remember a game without a session id (challenge plays are not logged)", () => {
    checkResetOnLoad("lastPlayedDate_Classic", "Classic", () => {});
    buildGameSession({ mode: "Classic", targetName: "X", result: "win", attempts: 3 });
    expect(localStorage.getItem(LAST_RESULT_KEY)).toBeNull();
  });
});

describe("mountShareButton", () => {
  const seed = (extra = {}) => {
    localStorage.setItem("gameId_Classic", "g1");
    localStorage.setItem(
      LAST_RESULT_KEY,
      JSON.stringify({
        scope: "Classic",
        id: "g1",
        mode: "Classic",
        result: "win",
        attempts: 2,
        isExpert: false,
        day: "2026-10-20",
        ...extra,
      })
    );
  };

  it("mounts once in the end-of-game navigation", () => {
    document.body.innerHTML = '<div id="modeNavigationContainer"></div>';
    seed();
    mountShareButton();
    mountShareButton();
    expect(document.querySelectorAll("#shareResultBtn")).toHaveLength(1);
  });

  it("stays hidden without a result for the displayed game", () => {
    document.body.innerHTML = '<div id="modeNavigationContainer"></div>';
    expect(mountShareButton()).toBeNull();
  });

  it("does not offer an Expert result on the normal page", () => {
    document.body.innerHTML = '<div id="modeNavigationContainer"></div>';
    seed({ isExpert: true });
    expect(mountShareButton()).toBeNull();
  });
});

describe("shareText", () => {
  it("falls back to the clipboard on desktop", async () => {
    const writeText = vi.fn().mockResolvedValue();
    expect(await shareText("abc", { clipboard: { writeText } })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("abc");
  });

  it("reports a failure instead of throwing", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    expect(await shareText("abc", { clipboard: { writeText } })).toBe("failed");
  });
});
