/**
 * discord_nudge.test.js — js/discord_nudge.js (carte Discord de fin de partie).
 *
 * Ce qui compte : la carte suit une victoire, jamais un abandon ; elle ne
 * revient pas à chaque partie du jour (une fois, plus une pour le 6/6) ; le ✕
 * la fait taire pour de bon ; elle se cache avec la navigation de fin de partie ;
 * et le compteur de membres reste muet sous les seuils.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  NUDGE_HIDDEN_KEY,
  NUDGE_SHOWN_KEY,
  countsLine,
  fetchDiscordCounts,
  mountDiscordNudge,
  pickNudgeVariant,
} from "../js/discord_nudge.js";
import { DISCORD_INVITE_URL } from "../js/gameCore.js";
import { LAST_RESULT_KEY } from "../js/share_result.js";

const TODAY = "2026-11-11";
const ALL_SCOPES = ["Classic", "Emoji", "silhouette", "AllOut", "Personae", "Music"];

function setResult({ id = "g1", result = "win", isExpert = false } = {}) {
  localStorage.setItem(
    LAST_RESULT_KEY,
    JSON.stringify({
      scope: "Classic",
      id,
      mode: "Classic",
      result,
      attempts: 3,
      isExpert,
      day: TODAY,
    })
  );
  localStorage.setItem("gameId_Classic", id);
}

function setNav(visible = true) {
  document.body.innerHTML = `<div id="modeNavigationContainer" style="display: ${visible ? "flex" : "none"}"></div>`;
  return document.getElementById("modeNavigationContainer");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete window._personadleApi;
  document.body.innerHTML = "";
  window.history.pushState({}, "", "/classiqueMode/classiqueMode.html");
});

describe("pickNudgeVariant", () => {
  const win = { id: "g1", result: "win" };
  const some = { done: 2, total: 6 };
  const all = { done: 6, total: 6 };

  it("shows after a win, never after a give-up or without a result", () => {
    expect(
      pickNudgeVariant({ result: win, progress: some, record: null, hidden: false, today: TODAY })
    ).toBe("win");
    expect(
      pickNudgeVariant({
        result: { id: "g1", result: "giveup" },
        progress: some,
        record: null,
        hidden: false,
        today: TODAY,
      })
    ).toBeNull();
    expect(
      pickNudgeVariant({ result: null, progress: some, record: null, hidden: false, today: TODAY })
    ).toBeNull();
  });

  it("turns into the 6/6 card once every mode is played", () => {
    expect(
      pickNudgeVariant({ result: win, progress: all, record: null, hidden: false, today: TODAY })
    ).toBe("perfect_day");
  });

  it("comes once a day, again for the same game, and once more for the 6/6", () => {
    const shown = { day: TODAY, id: "g1", variant: "win" };
    const other = { id: "g2", result: "win" };
    expect(
      pickNudgeVariant({
        result: other,
        progress: some,
        record: shown,
        hidden: false,
        today: TODAY,
      })
    ).toBeNull();
    expect(
      pickNudgeVariant({ result: win, progress: some, record: shown, hidden: false, today: TODAY })
    ).toBe("win");
    expect(
      pickNudgeVariant({ result: other, progress: all, record: shown, hidden: false, today: TODAY })
    ).toBe("perfect_day");
    const shownPerfect = { day: TODAY, id: "g2", variant: "perfect_day" };
    expect(
      pickNudgeVariant({
        result: { id: "g3", result: "win" },
        progress: all,
        record: shownPerfect,
        hidden: false,
        today: TODAY,
      })
    ).toBeNull();
    // Le lendemain, on repart de zéro.
    expect(
      pickNudgeVariant({
        result: other,
        progress: some,
        record: shown,
        hidden: false,
        today: "2026-11-12",
      })
    ).toBe("win");
  });

  it("stays silent for good once hidden", () => {
    expect(
      pickNudgeVariant({ result: win, progress: all, record: null, hidden: true, today: TODAY })
    ).toBeNull();
  });
});

describe("countsLine", () => {
  it("prints members, and the online count only above its threshold", () => {
    expect(countsLine({ members: 69, online: 7 })).toBe("69 members · 7 online now");
    expect(countsLine({ members: 69, online: 2 })).toBe("69 members");
  });

  it("prints nothing for a tiny or unknown server", () => {
    expect(countsLine({ members: 12, online: 9 })).toBeNull();
    expect(countsLine({ members: null, online: null })).toBeNull();
    expect(countsLine(null)).toBeNull();
  });
});

describe("fetchDiscordCounts", () => {
  it("asks the API once and serves the cached answer for 5 minutes", async () => {
    let calls = 0;
    const api = { discord: { counts: async () => (calls++, { members: 69, online: 7 }) } };
    expect(await fetchDiscordCounts({ api, storage: sessionStorage, now: 1_000 })).toEqual({
      members: 69,
      online: 7,
    });
    expect(
      await fetchDiscordCounts({ api, storage: sessionStorage, now: 1_000 + 299_000 })
    ).toEqual({
      members: 69,
      online: 7,
    });
    expect(calls).toBe(1);
    await fetchDiscordCounts({ api, storage: sessionStorage, now: 1_000 + 300_000 });
    expect(calls).toBe(2);
  });

  it("never throws: null when the API is missing or fails", async () => {
    expect(await fetchDiscordCounts({ api: undefined, storage: sessionStorage })).toBeNull();
    const api = {
      discord: {
        counts: async () => {
          throw new Error("offline");
        },
      },
    };
    expect(await fetchDiscordCounts({ api, storage: sessionStorage })).toBeNull();
  });
});

describe("mountDiscordNudge", () => {
  it("puts the card right after the end-of-game navigation, linking to the server", () => {
    const nav = setNav();
    setResult();
    const card = mountDiscordNudge(document, { today: TODAY });
    expect(card).not.toBeNull();
    expect(nav.nextElementSibling).toBe(card);
    expect(card.classList.contains("discord-nudge--win")).toBe(true);
    const cta = card.querySelector(".discord-nudge__cta");
    expect(cta.getAttribute("href")).toBe(DISCORD_INVITE_URL);
    expect(cta.getAttribute("target")).toBe("_blank");
    expect(JSON.parse(localStorage.getItem(NUDGE_SHOWN_KEY))).toEqual({
      day: TODAY,
      id: "g1",
      variant: "win",
    });
  });

  it("does not stack: mounting again replaces the card", () => {
    setNav();
    setResult();
    mountDiscordNudge(document, { today: TODAY });
    mountDiscordNudge(document, { today: TODAY });
    expect(document.querySelectorAll("#discordNudge")).toHaveLength(1);
  });

  it("shows the 6/6 card when every mode is done today", () => {
    setNav();
    setResult();
    for (const scope of ALL_SCOPES) localStorage.setItem(`dailyDone_${scope}`, TODAY);
    const card = mountDiscordNudge(document, { today: TODAY });
    expect(card.classList.contains("discord-nudge--perfect_day")).toBe(true);
    expect(card.querySelector(".discord-nudge__title").textContent).toContain("6/6");
  });

  it("is absent after a give-up and on the Expert page of a normal result", () => {
    setNav();
    setResult({ result: "giveup" });
    expect(mountDiscordNudge(document, { today: TODAY })).toBeNull();

    setResult();
    window.history.pushState({}, "", "/classiqueMode/classiqueMode.html?expert=1");
    expect(mountDiscordNudge(document, { today: TODAY })).toBeNull();
  });

  it("✕ hides it for good", () => {
    setNav();
    setResult();
    const card = mountDiscordNudge(document, { today: TODAY });
    card.querySelector(".discord-nudge__close").click();
    expect(document.getElementById("discordNudge")).toBeNull();
    expect(localStorage.getItem(NUDGE_HIDDEN_KEY)).toBe("1");
    expect(mountDiscordNudge(document, { today: TODAY })).toBeNull();
  });

  it("hides with the navigation when a new game starts", async () => {
    const nav = setNav();
    setResult();
    const card = mountDiscordNudge(document, { today: TODAY });
    expect(card.hidden).toBe(false);
    nav.style.display = "none";
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver : microtâche
    expect(card.hidden).toBe(true);
  });
});
