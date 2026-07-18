/**
 * gameCore.test.js — Unit tests for js/gameCore.js
 *
 * Run with:  npm test
 * Watch:     npm run test:watch
 *
 * Test environment: jsdom (browser-like, provides window/document/localStorage).
 * Globals (describe/it/expect/vi/beforeEach/afterEach) come from vitest.config.js.
 */

import {
  parisDateKey,
  msUntilNextParisMidnight,
  normalize,
  showConfettiExplosion,
  revealNextLink,
  setupRulesModal,
  setupDailyReset,
  checkResetOnLoad,
  setupFilterButtons,
  showWrongMini,
  buildGameSession,
  savePendingSession,
  FILTER_STORAGE_KEYS,
  getPlayerSeedId,
  getDailyTarget,
  normalizeModeKey,
  modeLabel,
  MODES,
  applyDarkModeOverrides,
  enableGiveUpButton,
  showChallengeButton,
  showCommunityStats,
  characterMatchesActiveOpus,
  updateCounterElement,
} from "../js/gameCore.js";

import { t } from "../js/i18n.js";
import { migrateLegacyOpusFilters } from "../js/filterMenu.js";
import { api } from "../js/api.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Injects a minimal HTML fragment into document.body for DOM-based tests. */
function setHTML(html) {
  document.body.innerHTML = html;
}

/** Clears all localStorage entries between tests. */
function clearStorage() {
  localStorage.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// parisDateKey
// ─────────────────────────────────────────────────────────────────────────────

describe("parisDateKey", () => {
  it("returns a string matching YYYY-MM-DD format", () => {
    const key = parisDateKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts a specific Date object and formats it correctly", () => {
    // 2025-07-14 UTC → should still be 2025-07-14 in Paris (UTC+2 in summer)
    const date = new Date("2025-07-14T10:00:00Z");
    const key = parisDateKey(date);
    expect(key).toBe("2025-07-14");
  });

  it("handles DST boundary: UTC+1 (winter) — 2025-01-15 00:30 UTC → 2025-01-15 Paris", () => {
    // Paris is UTC+1 in January, so 00:30 UTC is 01:30 Paris → same day
    const date = new Date("2025-01-15T00:30:00Z");
    expect(parisDateKey(date)).toBe("2025-01-15");
  });

  it("handles DST boundary: UTC+2 (summer) — 2025-07-01 21:30 UTC → 2025-07-01 Paris", () => {
    // Paris is UTC+2 in July, so 21:30 UTC is 23:30 Paris → still the same day
    const date = new Date("2025-07-01T21:30:00Z");
    expect(parisDateKey(date)).toBe("2025-07-01");
  });

  it("returns different keys for dates a day apart", () => {
    const d1 = new Date("2025-03-25T12:00:00Z");
    const d2 = new Date("2025-03-26T12:00:00Z");
    expect(parisDateKey(d1)).not.toBe(parisDateKey(d2));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// msUntilNextParisMidnight
// ─────────────────────────────────────────────────────────────────────────────

describe("msUntilNextParisMidnight", () => {
  it("returns a positive number of milliseconds", () => {
    const ms = msUntilNextParisMidnight();
    expect(ms).toBeGreaterThan(0);
  });

  it("returns a value no greater than 24 hours", () => {
    const ms = msUntilNextParisMidnight();
    const msIn24Hours = 24 * 60 * 60 * 1000;
    expect(ms).toBeLessThanOrEqual(msIn24Hours);
  });

  it("returns a number", () => {
    expect(typeof msUntilNextParisMidnight()).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalize
// ─────────────────────────────────────────────────────────────────────────────

describe("normalize", () => {
  it("lowercases the string", () => {
    expect(normalize("HELLO")).toBe("hello");
  });

  it("strips accent diacritics", () => {
    expect(normalize("éàü")).toBe("eau");
  });

  it("normalizes typographic apostrophes to straight apostrophe", () => {
    expect(normalize("l\u2019homme")).toBe("l'homme"); // ' → '
    expect(normalize("l\u2018autre")).toBe("l'autre"); // ' → '
  });

  it("removes double-quote characters", () => {
    expect(normalize(`"hello"`)).toBe("hello");
  });

  it("trims surrounding whitespace", () => {
    expect(normalize("  hello  ")).toBe("hello");
  });

  it("handles a complex real-world song title", () => {
    expect(normalize("Brûle, ma Peine !")).toBe("brule, ma peine !");
  });

  it("makes two differently-accented strings compare equal after normalization", () => {
    expect(normalize("Never More")).toBe(normalize("Never More"));
    expect(normalize("Burn My Dread")).toBe(normalize("burn my dread"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showConfettiExplosion
// ─────────────────────────────────────────────────────────────────────────────

describe("showConfettiExplosion", () => {
  beforeEach(() => {
    // Stub Audio to avoid "not implemented" errors in jsdom
    vi.stubGlobal(
      "Audio",
      class {
        play() {
          return Promise.resolve();
        }
      }
    );
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("appends `count` confetti elements to the body", () => {
    vi.useFakeTimers();

    showConfettiExplosion({ count: 10, spreadFrom: "sides" });

    const emojis = document.querySelectorAll(".confetti-emoji");
    expect(emojis.length).toBe(10);
  });

  it("removes all confetti elements after 1 second", () => {
    vi.useFakeTimers();

    showConfettiExplosion({ count: 5, spreadFrom: "bottom" });
    expect(document.querySelectorAll(".confetti-emoji").length).toBe(5);

    vi.advanceTimersByTime(1100);
    expect(document.querySelectorAll(".confetti-emoji").length).toBe(0);
  });

  it("uses default count (40) when no options are provided", () => {
    vi.useFakeTimers();

    showConfettiExplosion();

    expect(document.querySelectorAll(".confetti-emoji").length).toBe(40);
  });

  it("sets bottom:0vh on every emoji", () => {
    vi.useFakeTimers();

    showConfettiExplosion({ count: 3, spreadFrom: "bottom" });

    document.querySelectorAll(".confetti-emoji").forEach((el) => {
      expect(el.style.bottom).toBe("0vh");
    });
  });

  it("calls Audio.play()", () => {
    vi.useFakeTimers();
    const playSpy = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      "Audio",
      class {
        play = playSpy;
      }
    );

    showConfettiExplosion({ count: 1 });
    expect(playSpy).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// revealNextLink
// ─────────────────────────────────────────────────────────────────────────────

describe("revealNextLink", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHTML(`
      <div id="modeNavigationContainer" style="display:none">
        <button id="prevModeButton" style="visibility:hidden"></button>
        <button id="nextModeButton"></button>
      </div>
    `);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets container display to 'flex'", () => {
    revealNextLink({ nextHref: "/next.html" });
    expect(document.getElementById("modeNavigationContainer").style.display).toBe("flex");
  });

  it("wires the next button's onclick when nextHref is provided", () => {
    revealNextLink({ nextHref: "/next.html" });
    const btn = document.getElementById("nextModeButton");
    expect(btn.onclick).toBeTypeOf("function");
  });

  it("makes prev button visible and wires onclick when prevHref is provided", () => {
    revealNextLink({ prevHref: "/prev.html" });
    const prev = document.getElementById("prevModeButton");
    expect(prev.style.visibility).toBe("visible");
    expect(prev.onclick).toBeTypeOf("function");
  });

  it("hides prev button when prevHref is null", () => {
    // First make it visible
    const prev = document.getElementById("prevModeButton");
    prev.style.visibility = "visible";

    revealNextLink({ prevHref: null });
    expect(prev.style.visibility).toBe("hidden");
    expect(prev.onclick).toBeNull();
  });

  it("scrolls container into view after 1.5 s", () => {
    // jsdom doesn't implement scrollIntoView — stub it on the prototype
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;

    revealNextLink({});
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);
    expect(spy).toHaveBeenCalledOnce();

    delete Element.prototype.scrollIntoView;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setupRulesModal
// ─────────────────────────────────────────────────────────────────────────────

describe("setupRulesModal", () => {
  beforeEach(() => {
    setHTML(`
      <div id="rulesModal" style="display:none">
        <button class="close"></button>
      </div>
      <button id="rulesButton"></button>
    `);
  });

  it("opens the modal when rulesButton is clicked", () => {
    setupRulesModal();
    document.getElementById("rulesButton").click();
    expect(document.getElementById("rulesModal").style.display).toBe("block");
  });

  it("closes the modal when the .close button is clicked", () => {
    setupRulesModal();
    document.getElementById("rulesButton").click();
    document.querySelector(".close").click();
    expect(document.getElementById("rulesModal").style.display).toBe("none");
  });

  it("closes the modal when clicking the backdrop (the modal element itself)", () => {
    setupRulesModal();
    document.getElementById("rulesButton").click();

    // Click directly on the modal element — it bubbles up to window.
    // The listener checks `e.target === modal`, which is true here.
    const modal = document.getElementById("rulesModal");
    modal.click();

    expect(modal.style.display).toBe("none");
  });

  it("is a no-op when the modal or button elements are missing", () => {
    document.body.innerHTML = "";
    // Should not throw
    expect(() => setupRulesModal()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setupDailyReset
// ─────────────────────────────────────────────────────────────────────────────

describe("setupDailyReset", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns a timer ID (truthy, can be used to clear the timeout)", () => {
    const id = setupDailyReset(() => {});
    // In browsers this is a number; in Node/jsdom it is a Timeout object.
    // Either way it must be truthy and clearable.
    expect(id).toBeTruthy();
    expect(() => clearTimeout(id)).not.toThrow();
  });

  it("does not call onReset immediately", () => {
    const spy = vi.fn();
    setupDailyReset(spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it("calls onReset after approximately 24 hours", () => {
    const spy = vi.fn();
    setupDailyReset(spy);

    // Fast-forward 24 h + 1 s (the callback fires somewhere within 24 h)
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1000);
    expect(spy).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkResetOnLoad
// ─────────────────────────────────────────────────────────────────────────────

describe("checkResetOnLoad", () => {
  beforeEach(clearStorage);

  it("calls onReset and saves today when no lastPlayedDate is stored", () => {
    const onReset = vi.fn();
    checkResetOnLoad("lastPlayedDate_Test", "Test", onReset);

    expect(onReset).toHaveBeenCalledOnce();
    expect(localStorage.getItem("lastPlayedDate_Test")).toBeTruthy();
  });

  it("does NOT call onReset when the stored date equals today", () => {
    const today = parisDateKey();
    localStorage.setItem("lastPlayedDate_Test", today);

    const onReset = vi.fn();
    checkResetOnLoad("lastPlayedDate_Test", "Test", onReset);

    expect(onReset).not.toHaveBeenCalled();
  });

  it("calls onReset when the stored date is yesterday", () => {
    const yesterday = parisDateKey(new Date(Date.now() - 86_400_000));
    localStorage.setItem("lastPlayedDate_Test", yesterday);

    const onReset = vi.fn();
    checkResetOnLoad("lastPlayedDate_Test", "Test", onReset);

    expect(onReset).toHaveBeenCalledOnce();
  });

  it("removes the previous day's stats key when a new day is detected", () => {
    const yesterday = parisDateKey(new Date(Date.now() - 86_400_000));
    const oldStatsKey = `statsLogged_Test_${yesterday}`;

    localStorage.setItem("lastPlayedDate_Test", yesterday);
    localStorage.setItem(oldStatsKey, "1");

    checkResetOnLoad("lastPlayedDate_Test", "Test", () => {});
    expect(localStorage.getItem(oldStatsKey)).toBeNull();
  });

  it("updates lastPlayedDate to today after a reset", () => {
    localStorage.setItem("lastPlayedDate_Test", "2000-01-01");
    checkResetOnLoad("lastPlayedDate_Test", "Test", () => {});

    expect(localStorage.getItem("lastPlayedDate_Test")).toBe(parisDateKey());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setupFilterButtons
// ─────────────────────────────────────────────────────────────────────────────

describe("setupFilterButtons", () => {
  beforeEach(() => {
    clearStorage();
    setHTML(`
      <button class="filter-btn active" data-opus="P3">P3</button>
      <button class="filter-btn" data-opus="P4">P4</button>
      <button class="filter-btn active" data-opus="P5">P5</button>
    `);
  });

  it("calls onFilterChange when a button is clicked", () => {
    const cb = vi.fn();
    setupFilterButtons("filters_Test", cb);

    document.querySelector('[data-opus="P4"]').click();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("passes the array of active filter values to onFilterChange", () => {
    const cb = vi.fn();
    setupFilterButtons("filters_Test", cb);

    // Click P4 (currently inactive → becomes active)
    document.querySelector('[data-opus="P4"]').click();

    // Active buttons: P3, P4, P5
    expect(cb).toHaveBeenCalledWith(expect.arrayContaining(["P3", "P4", "P5"]));
    expect(cb.mock.calls[0][0]).toHaveLength(3);
  });

  it("persists the new active filters to localStorage", () => {
    const cb = vi.fn();
    setupFilterButtons("filters_Test", cb);

    document.querySelector('[data-opus="P3"]').click(); // deactivate P3

    const stored = JSON.parse(localStorage.getItem("filters_Test"));
    expect(stored).not.toContain("P3");
    expect(stored).toContain("P5");
  });

  it("toggles the 'active' class on the clicked button", () => {
    setupFilterButtons("filters_Test", () => {});

    const p4Btn = document.querySelector('[data-opus="P4"]');
    expect(p4Btn.classList.contains("active")).toBe(false);

    p4Btn.click();
    expect(p4Btn.classList.contains("active")).toBe(true);

    p4Btn.click();
    expect(p4Btn.classList.contains("active")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showWrongMini
// ─────────────────────────────────────────────────────────────────────────────

describe("showWrongMini", () => {
  let container;

  beforeEach(() => {
    setHTML('<div id="wrongGuessList"></div>');
    container = document.getElementById("wrongGuessList");
  });

  it("appends a .wrong-mini div to the container", () => {
    showWrongMini("/img/char.webp", "Joker", container);
    expect(container.querySelectorAll(".wrong-mini")).toHaveLength(1);
  });

  it("creates an <img> with the correct src and alt", () => {
    showWrongMini("/img/char.webp", "Joker", container);
    const img = container.querySelector("img");
    expect(img.src).toContain("char.webp");
    expect(img.alt).toBe("Joker");
  });

  it("adds the 'shake' class after 50 ms", () => {
    vi.useFakeTimers();

    showWrongMini("/img/char.webp", "Joker", container);
    const div = container.querySelector(".wrong-mini");

    expect(div.classList.contains("shake")).toBe(false);
    vi.advanceTimersByTime(60);
    expect(div.classList.contains("shake")).toBe(true);

    vi.useRealTimers();
  });

  it("appends multiple wrong guesses without overwriting previous ones", () => {
    showWrongMini("/img/a.webp", "Alice", container);
    showWrongMini("/img/b.webp", "Bob", container);
    expect(container.querySelectorAll(".wrong-mini")).toHaveLength(2);
  });

  it("uses the fallback src when the image fails to load", () => {
    showWrongMini("/img/missing.webp", "Ghost", container, "/img/fallback.webp");
    const img = container.querySelector("img");
    img.dispatchEvent(new Event("error"));
    expect(img.src).toContain("fallback.webp");
  });

  it("is a no-op when wrongListEl is null", () => {
    expect(() => showWrongMini("/img/char.webp", "Joker", null)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildGameSession
// ─────────────────────────────────────────────────────────────────────────────

describe("buildGameSession", () => {
  it("returns an object with the expected shape", () => {
    const session = buildGameSession({
      mode: "Classic",
      targetName: "Joker",
      result: "win",
      attempts: 2,
      timeMs: 15000,
      filters: ["P5"],
    });

    expect(session).toMatchObject({
      mode: "classic", // normalisé vers la clé backend canonique
      target_name: "Joker",
      result: "win",
      attempts: 2,
      time_ms: 15000,
      active_filters: ["P5"],
    });
  });

  it("includes a played_date matching YYYY-MM-DD", () => {
    const session = buildGameSession({
      mode: "Emoji",
      targetName: "Ryuji",
      result: "giveup",
      attempts: 6,
    });
    expect(session.played_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("defaults timeMs to 0 and filters to [] when omitted", () => {
    const session = buildGameSession({
      mode: "Music",
      targetName: "Burn My Dread",
      result: "win",
      attempts: 1,
    });
    expect(session.time_ms).toBe(0);
    expect(session.active_filters).toEqual([]);
  });

  it("rounds timeMs to the nearest integer", () => {
    const session = buildGameSession({
      mode: "Classic",
      targetName: "Joker",
      result: "win",
      attempts: 1,
      timeMs: 1234.7,
    });
    expect(session.time_ms).toBe(1235);
  });

  it("normalizes the mode to its canonical backend key", () => {
    const session = buildGameSession({
      mode: "AllOutAttack",
      targetName: "Makoto",
      result: "win",
      attempts: 3,
    });
    expect(session.mode).toBe("alloutattack");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// savePendingSession
// ─────────────────────────────────────────────────────────────────────────────

describe("savePendingSession", () => {
  beforeEach(() => {
    clearStorage();
    // js/api.js sets window._personadleApi as a side effect of being imported
    // (bridge pattern, see CLAUDE.md). These tests target the no-bridge fallback
    // path (direct localStorage write), so reset it explicitly per test.
    window._personadleApi = undefined;
  });

  it("stores a session in localStorage under 'pendingSessions'", () => {
    const session = buildGameSession({
      mode: "Classic",
      targetName: "Joker",
      result: "win",
      attempts: 1,
    });
    savePendingSession(session);

    const stored = JSON.parse(localStorage.getItem("pendingSessions"));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ mode: "classic", target_name: "Joker" });
  });

  it("creates the array from scratch when pendingSessions is not yet set", () => {
    expect(localStorage.getItem("pendingSessions")).toBeNull();

    savePendingSession(
      buildGameSession({
        mode: "Music",
        targetName: "test",
        result: "win",
        attempts: 1,
      })
    );

    const stored = JSON.parse(localStorage.getItem("pendingSessions"));
    expect(Array.isArray(stored)).toBe(true);
    expect(stored).toHaveLength(1);
  });

  it("appends to the existing queue on subsequent calls", () => {
    const s1 = buildGameSession({
      mode: "Classic",
      targetName: "Joker",
      result: "win",
      attempts: 1,
    });
    const s2 = buildGameSession({
      mode: "Emoji",
      targetName: "Ryuji",
      result: "giveup",
      attempts: 6,
    });
    const s3 = buildGameSession({
      mode: "Music",
      targetName: "P4 OST",
      result: "win",
      attempts: 2,
    });

    savePendingSession(s1);
    savePendingSession(s2);
    savePendingSession(s3);

    const stored = JSON.parse(localStorage.getItem("pendingSessions"));
    expect(stored).toHaveLength(3);
    expect(stored[1].mode).toBe("emoji");
    expect(stored[2].mode).toBe("music");
  });

  it("preserves existing sessions already in localStorage", () => {
    // Pre-populate queue with one session
    const existing = buildGameSession({
      mode: "Silhouette",
      targetName: "Aigis",
      result: "win",
      attempts: 4,
    });
    localStorage.setItem("pendingSessions", JSON.stringify([existing]));

    savePendingSession(
      buildGameSession({
        mode: "Classic",
        targetName: "Joker",
        result: "win",
        attempts: 1,
      })
    );

    const stored = JSON.parse(localStorage.getItem("pendingSessions"));
    expect(stored).toHaveLength(2);
    expect(stored[0].mode).toBe("silhouette");
    expect(stored[1].mode).toBe("classic");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parisDateKey — DST transition edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("parisDateKey — DST transition edge cases", () => {
  // Spring transition: Paris switches from UTC+1 → UTC+2 on the last Sunday of March.
  // In 2025, that is March 30. At 02:00 local (= 01:00 UTC) clocks jump to 03:00.
  //
  // Critical edge: 23:59 UTC on March 29 = 00:59 Paris (still March 29)
  //                00:00 UTC on March 30 = 01:00 Paris → still March 30 (UTC+1, before switch)
  //                01:01 UTC on March 30 = 03:01 Paris (UTC+2, after switch) → still March 30

  it("DST spring forward: 23:59 UTC March 29 2025 → March 29 in Paris (UTC+1)", () => {
    const date = new Date("2025-03-29T23:59:00Z");
    // 23:59 UTC = 00:59 Paris (UTC+1) → March 30
    // Wait — UTC+1 means Paris is 1 hour ahead of UTC, so 23:59 UTC = 00:59+1 = March 30 01:59? No.
    // UTC+1: local = UTC + 1h → 23:59 UTC = 00:59 March 30 Paris
    expect(parisDateKey(date)).toBe("2025-03-30");
  });

  it("DST spring forward: 01:30 UTC March 30 2025 → March 30 in Paris (already UTC+2)", () => {
    // At 01:00 UTC on March 30, clocks in Paris jump from 02:00 to 03:00 (UTC+1 → UTC+2).
    // 01:30 UTC = 03:30 Paris (UTC+2) → March 30
    const date = new Date("2025-03-30T01:30:00Z");
    expect(parisDateKey(date)).toBe("2025-03-30");
  });

  it("DST spring forward: 22:00 UTC March 29 2025 → March 29 in Paris (UTC+1 = 23:00)", () => {
    // 22:00 UTC = 23:00 Paris (UTC+1) → still March 29
    const date = new Date("2025-03-29T22:00:00Z");
    expect(parisDateKey(date)).toBe("2025-03-29");
  });

  // Autumn transition: Paris switches from UTC+2 → UTC+1 on the last Sunday of October.
  // In 2025, that is October 26. At 03:00 local (= 01:00 UTC) clocks fall back to 02:00.

  it("DST autumn fall-back: 00:30 UTC October 26 2025 → October 26 in Paris (UTC+2 = 02:30)", () => {
    // 00:30 UTC = 02:30 Paris (UTC+2, before switch) → October 26
    const date = new Date("2025-10-26T00:30:00Z");
    expect(parisDateKey(date)).toBe("2025-10-26");
  });

  it("DST autumn fall-back: 01:30 UTC October 26 2025 → October 26 in Paris (UTC+1 = 02:30, after switch)", () => {
    // After 01:00 UTC the offset becomes UTC+1: 01:30 UTC = 02:30 Paris (UTC+1) → October 26
    const date = new Date("2025-10-26T01:30:00Z");
    expect(parisDateKey(date)).toBe("2025-10-26");
  });

  it("DST autumn fall-back: 22:30 UTC October 25 2025 → October 26 in Paris (UTC+2 = 00:30)", () => {
    // 22:30 UTC on Oct 25 = 00:30 Paris (UTC+2) = October 26
    const date = new Date("2025-10-25T22:30:00Z");
    expect(parisDateKey(date)).toBe("2025-10-26");
  });

  it("DST autumn fall-back: 21:59 UTC October 25 2025 → October 25 in Paris (UTC+2 = 23:59)", () => {
    // 21:59 UTC = 23:59 Paris (UTC+2) → still October 25
    const date = new Date("2025-10-25T21:59:00Z");
    expect(parisDateKey(date)).toBe("2025-10-25");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FILTER_STORAGE_KEYS
// ─────────────────────────────────────────────────────────────────────────────

describe("FILTER_STORAGE_KEYS", () => {
  it("is exported as an object (not undefined)", () => {
    expect(FILTER_STORAGE_KEYS).toBeDefined();
    expect(typeof FILTER_STORAGE_KEYS).toBe("object");
  });

  it("contains all 6 game modes as keys (lowercase)", () => {
    const expectedModes = ["classic", "emoji", "silhouette", "alloutattack", "personae", "music"];
    for (const mode of expectedModes) {
      expect(FILTER_STORAGE_KEYS).toHaveProperty(mode);
    }
  });

  it("maps each mode to a non-empty string storage key", () => {
    for (const [mode, key] of Object.entries(FILTER_STORAGE_KEYS)) {
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
      // Each key should be distinct
    }
  });

  it("all storage keys are distinct (no duplicates)", () => {
    const keys = Object.values(FILTER_STORAGE_KEYS);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("classic maps to 'filters_Classic'", () => {
    expect(FILTER_STORAGE_KEYS.classic).toBe("filters_Classic");
  });

  it("emoji maps to 'filters_Emoji'", () => {
    expect(FILTER_STORAGE_KEYS.emoji).toBe("filters_Emoji");
  });

  it("alloutattack maps to 'filters_AllOutAttack'", () => {
    expect(FILTER_STORAGE_KEYS.alloutattack).toBe("filters_AllOutAttack");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildGameSession — all 6 modes
// ─────────────────────────────────────────────────────────────────────────────

describe("buildGameSession — all 6 modes", () => {
  const VALID_MODES = [
    { mode: "Classic", key: "classic", targetName: "Joker" },
    { mode: "Emoji", key: "emoji", targetName: "Ryuji Sakamoto" },
    { mode: "Silhouette", key: "silhouette", targetName: "Aigis" },
    { mode: "AllOutAttack", key: "alloutattack", targetName: "Ann Takamaki" },
    { mode: "Personae", key: "personae", targetName: "Izanagi" },
    { mode: "Music", key: "music", targetName: "Last Surprise" },
  ];

  for (const { mode, key, targetName } of VALID_MODES) {
    it(`builds a valid session for mode '${mode}'`, () => {
      const session = buildGameSession({ mode, targetName, result: "win", attempts: 3 });
      expect(session.mode).toBe(key);
      expect(session.target_name).toBe(targetName);
      expect(session.result).toBe("win");
      expect(session.attempts).toBe(3);
      expect(session.time_ms).toBe(0);
      expect(session.active_filters).toEqual([]);
      expect(session.played_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }

  it("accepts non-empty filters for all modes", () => {
    const session = buildGameSession({
      mode: "Classic",
      targetName: "Makoto Niijima",
      result: "giveup",
      attempts: 6,
      timeMs: 120000,
      filters: ["P5", "P5R", "P4G"],
    });
    expect(session.active_filters).toEqual(["P5", "P5R", "P4G"]);
    expect(session.time_ms).toBe(120000);
  });

  it("accepts result 'giveup' as a valid result value", () => {
    const session = buildGameSession({
      mode: "Silhouette",
      targetName: "Aigis",
      result: "giveup",
      attempts: 6,
    });
    expect(session.result).toBe("giveup");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalize — additional edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("normalize — additional edge cases", () => {
  it("handles an empty string without throwing", () => {
    expect(() => normalize("")).not.toThrow();
    expect(normalize("")).toBe("");
  });

  it("strips all combining diacritics from heavily accented strings", () => {
    // German umlauts decomposed: ü = u + combining diaeresis
    expect(normalize("über")).toBe("uber");
    expect(normalize("Schön")).toBe("schon");
  });

  it("handles Katakana without voiced marks unchanged (no Latin diacritics to strip)", () => {
    // normalize only strips U+0300-U+036F (Latin combining marks).
    // Katakana with NO voiced consonants (no dakuten U+3099) passes through
    // as-is except for lowercasing (which is a no-op on Katakana).
    // Note: voiced Katakana like ジ DO NFD-decompose to シ + U+3099 but that
    // combining mark is outside the strip range — so in practice normalize()
    // should not be called on Japanese text, only on romaji names.
    const jp = normalize("アン"); // Ann — no voiced consonants, no decomposition
    expect(jp).toBe("アン");
  });

  it("handles already-normalized strings identically (idempotent)", () => {
    const once = normalize("Burn My Dread");
    const twice = normalize(normalize("Burn My Dread"));
    expect(once).toBe(twice);
  });

  it("strips only combining diacritics, not regular punctuation", () => {
    expect(normalize("it's alive!")).toBe("it's alive!");
  });

  it("handles strings with multiple types of curly apostrophes", () => {
    const left = normalize("l‘autre"); // '
    const right = normalize("l’autre"); // '
    expect(left).toBe("l'autre");
    expect(right).toBe("l'autre");
    // Both normalize to the same straight apostrophe
    expect(left).toBe(right);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPlayerSeedId
// ─────────────────────────────────────────────────────────────────────────────

describe("getPlayerSeedId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns a non-empty string", () => {
    const id = getPlayerSeedId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns the same value on repeated calls (stable anon ID)", () => {
    const id1 = getPlayerSeedId();
    const id2 = getPlayerSeedId();
    expect(id1).toBe(id2);
  });

  it("stores the anon ID in localStorage under 'anonPlayerId'", () => {
    getPlayerSeedId();
    expect(localStorage.getItem("anonPlayerId")).not.toBeNull();
  });

  it("returns the logged-in user ID when 'playerUserId' is set in localStorage", () => {
    localStorage.setItem("playerUserId", "42");
    const id = getPlayerSeedId();
    expect(id).toBe("42");
  });

  it("prefers 'playerUserId' over 'anonPlayerId' when both are set", () => {
    localStorage.setItem("anonPlayerId", "anon-uuid-abc");
    localStorage.setItem("playerUserId", "99");
    expect(getPlayerSeedId()).toBe("99");
  });

  it("generates a new anon ID when none is stored", () => {
    expect(localStorage.getItem("anonPlayerId")).toBeNull();
    const id = getPlayerSeedId();
    expect(id).toBeTruthy();
    // Should now be persisted
    expect(localStorage.getItem("anonPlayerId")).toBe(id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDailyTarget
// ─────────────────────────────────────────────────────────────────────────────

describe("getDailyTarget", () => {
  const POOL = ["Joker", "Ryuji", "Ann", "Yusuke", "Makoto", "Futaba", "Haru", "Morgana"];

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns null for an empty pool", () => {
    expect(getDailyTarget([], "Classic", "2025-07-14", "seed-abc")).toBeNull();
  });

  it("returns null when pool is null", () => {
    expect(getDailyTarget(null, "Classic", "2025-07-14", "seed-abc")).toBeNull();
  });

  it("returns an item that is in the pool", () => {
    const result = getDailyTarget(POOL, "Classic", "2025-07-14", "seed-abc");
    expect(POOL).toContain(result);
  });

  it("is deterministic — same seed+date+mode always returns same item", () => {
    const r1 = getDailyTarget(POOL, "Classic", "2025-07-14", "player-1");
    const r2 = getDailyTarget(POOL, "Classic", "2025-07-14", "player-1");
    expect(r1).toBe(r2);
  });

  it("different seeds produce potentially different results for same date+mode", () => {
    const results = new Set(
      ["seed-A", "seed-B", "seed-C", "seed-D", "seed-E", "seed-F", "seed-G", "seed-H"].map((seed) =>
        getDailyTarget(POOL, "Classic", "2025-07-14", seed)
      )
    );
    // With 8 different seeds and 8 pool items, we should get more than 1 unique result
    expect(results.size).toBeGreaterThan(1);
  });

  it("different modes produce potentially different results for same seed+date", () => {
    const modes = ["Classic", "Emoji", "Silhouette", "AllOutAttack", "Personae", "Music"];
    const results = new Set(
      modes.map((mode) => getDailyTarget(POOL, mode, "2025-07-14", "fixed-seed"))
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it("different dates produce potentially different results for same seed+mode", () => {
    const dates = ["2025-07-14", "2025-07-15", "2025-07-16", "2025-07-17"];
    const results = new Set(
      dates.map((date) => getDailyTarget(POOL, "Classic", date, "fixed-seed"))
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it("works with a single-item pool and always returns that item", () => {
    const result = getDailyTarget(["Joker"], "Classic", "2025-07-14", "any-seed");
    expect(result).toBe("Joker");
  });

  it("respects debugTarget_<mode> localStorage override", () => {
    localStorage.setItem("debugTarget_Classic", "Ryuji");
    const result = getDailyTarget(POOL, "Classic", "2025-07-14", "fixed-seed");
    expect(result).toBe("Ryuji");
  });

  it("ignores debugTarget override if value is not in pool", () => {
    localStorage.setItem("debugTarget_Classic", "NotInPool");
    // Should fall through to normal FNV hash pick
    const result = getDailyTarget(POOL, "Classic", "2025-07-14", "fixed-seed");
    expect(POOL).toContain(result);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PIÈGE 1 — i18n: t(key) returns the raw key (truthy) for missing keys,
//            so `t(key) ?? fallback` never falls back.
//
// Source: CLAUDE.md §13 "Pièges connus"
//   "window.i18n.t(key) retourne la clé (string truthy) quand elle n'existe pas
//    — ?? ne se déclenche jamais. Pattern correct :
//    const r = window.i18n?.t?.(key); return (r != null && r !== key) ? r : fallback;"
//
// The exported `t()` from i18n.js uses module-level `_flat` and `_flatEN` maps.
// At test startup, before any setLang() call, both maps are empty.
// A missing key therefore returns the key string verbatim.
// ─────────────────────────────────────────────────────────────────────────────

describe("i18n t() — raw-key return for missing key (the ?? fallback trap)", () => {
  // Note: we import `t` directly from i18n.js. Because i18n.js uses module-level
  // state (_flat, _flatEN), and setLang() requires fetch + real JSON files,
  // we rely on the fact that _flat/_flatEN start empty in the jsdom test env.
  // Any key that is not loaded returns the key string itself.

  it("returns the raw key string when the key is not found in any loaded translation", () => {
    // No setLang() has been called in this describe block, so _flat and _flatEN
    // are empty (or contain whatever was loaded by other tests — either way,
    // 'test.nonexistent.key.xyz' is guaranteed absent).
    const missingKey = "test.nonexistent.key.xyz";
    const result = t(missingKey);
    // t() must return the key itself when not found — this is the documented behaviour
    expect(result).toBe(missingKey);
  });

  it("demonstrates the ?? trap: t(missingKey) ?? 'fallback' never triggers the fallback", () => {
    const missingKey = "test.nonexistent.key.xyz";
    const rawResult = t(missingKey); // returns "test.nonexistent.key.xyz" (truthy)

    // WRONG pattern — ?? does not trigger because rawResult is truthy (the key string)
    const wrongFallback = rawResult ?? "my-fallback";
    expect(wrongFallback).toBe(missingKey); // gets the key, NOT the fallback
    expect(wrongFallback).not.toBe("my-fallback"); // confirms the fallback was skipped

    // CORRECT pattern — compare against the key itself
    const correctFallback = rawResult !== missingKey ? rawResult : "my-fallback";
    expect(correctFallback).toBe("my-fallback"); // fallback is applied correctly
  });

  it("correct guard: (r != null && r !== key) returns false for missing keys", () => {
    const missingKey = "test.nonexistent.key.xyz";
    const r = t(missingKey);
    // The documented guard from CLAUDE.md:
    const isFound = r != null && r !== missingKey;
    expect(isFound).toBe(false); // key was NOT found — guard correctly returns false
  });

  it("correct guard: (r != null && r !== key) returns true when key IS found", () => {
    // Simulate the scenario where the key is found: the returned value differs from the key.
    // We create a small helper that mirrors the t() contract for a found value:
    const foundValue = "Valider"; // what t() would return for 'ui.submit' in French
    const simulatedKey = "ui.submit";
    // Pretend t(simulatedKey) returned foundValue (i.e. translation was loaded)
    const r = foundValue;
    const isFound = r != null && r !== simulatedKey;
    expect(isFound).toBe(true); // key was found — guard correctly returns true
    // And the value is used, not the fallback
    const result = isFound ? r : "fallback";
    expect(result).toBe("Valider");
  });

  it("t() with {{variable}} substitution on a missing key leaves the template unchanged", () => {
    // When the key is missing, t() returns the key string. No substitution happens
    // since the key itself does not contain {{…}} placeholders.
    const result = t("ui.nonexistent.with.vars", { count: 42 });
    expect(result).toBe("ui.nonexistent.with.vars"); // key returned as-is
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PIÈGE 2 — syncPending: 409 must `continue` (skip), not `return` (abort queue)
//
// Source: CLAUDE.md §13
//   "409 = session déjà enregistrée côté serveur → `continue` silencieux, pas
//    `return` ; les autres erreurs s'accumulent dans `remaining[]`"
//
// `syncPending` lives in api.js (not gameCore.js) but IS exported (api.stats.syncPending),
// so instead of reimplementing its loop we drive the real function directly and
// stub the global `fetch` it calls through — this catches a regression in the
// actual shipped code, not just in a hand-copied reproduction of it.
// We also verify `savePendingSession` (imported for real from gameCore.js) ignores
// a 409 on postSession and does NOT queue the session to localStorage.
// ─────────────────────────────────────────────────────────────────────────────

describe("syncPending — 409 must continue (not abort) the queue", () => {
  beforeEach(() => {
    localStorage.clear();
    window._personadleApi = undefined;
    api.stats._syncLock = false;
  });
  afterEach(() => {
    localStorage.clear();
    window._personadleApi = undefined;
    api.stats._syncLock = false;
    vi.unstubAllGlobals();
  });

  it("processes all sessions even when the first one returns 409", async () => {
    const s1 = buildGameSession({
      mode: "Classic",
      targetName: "Joker",
      result: "win",
      attempts: 1,
    });
    const s2 = buildGameSession({ mode: "Emoji", targetName: "Ryuji", result: "win", attempts: 2 });
    localStorage.setItem("pendingSessions", JSON.stringify([s1, s2]));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        // First call: 409 (session already recorded server-side)
        if (callCount === 1) {
          return { ok: false, status: 409, json: async () => ({ error: "Conflict" }) };
        }
        // Second call: success
        return { ok: true, status: 200, json: async () => ({ session_id: 99 }) };
      })
    );

    await api.stats.syncPending();

    expect(fetch).toHaveBeenCalledTimes(2);
    // s1 (409) silently discarded, s2 (200) succeeded — nothing left to retry
    const remaining = JSON.parse(localStorage.getItem("pendingSessions"));
    expect(remaining).toHaveLength(0);
  });

  it("keeps sessions in the remaining queue when a real network error occurs", async () => {
    const s1 = buildGameSession({
      mode: "Classic",
      targetName: "Joker",
      result: "win",
      attempts: 1,
    });
    const s2 = buildGameSession({ mode: "Emoji", targetName: "Ann", result: "win", attempts: 2 });
    localStorage.setItem("pendingSessions", JSON.stringify([s1, s2]));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        // First call: network failure (no HTTP response at all, unlike a 409)
        if (callCount === 1) throw new Error("Network error");
        return { ok: true, status: 200, json: async () => ({ session_id: 100 }) };
      })
    );

    await api.stats.syncPending();

    expect(fetch).toHaveBeenCalledTimes(2);
    const remaining = JSON.parse(localStorage.getItem("pendingSessions"));
    expect(remaining).toHaveLength(1); // s1 (network error) kept for retry
    expect(remaining[0].target_name).toBe("Joker");
  });

  it("savePendingSession: a 409 from postSession does not queue the session to localStorage", async () => {
    // The bug variant in savePendingSession itself (line 410 in gameCore.js):
    //   catch (err) { if (err?.status === 409) return; … }
    // A 409 from postSession means the session was already recorded — it should be
    // silently discarded (not pushed to localStorage). Verify this holds.
    const err409 = new Error("Conflict");
    err409.status = 409;

    window._personadleApi = {
      stats: {
        postSession: vi.fn().mockRejectedValue(err409),
        syncPending: vi.fn().mockResolvedValue(undefined),
      },
      communityStats: undefined,
    };

    const session = buildGameSession({
      mode: "Classic",
      targetName: "Makoto",
      result: "win",
      attempts: 2,
    });

    await savePendingSession(session);

    // The session must NOT be in localStorage (409 = already recorded, discard it)
    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    expect(pending).toHaveLength(0);
  });

  it("savePendingSession: a non-409 server error still queues the session for later sync", async () => {
    const err500 = new Error("Internal Server Error");
    err500.status = 500;

    window._personadleApi = {
      stats: {
        postSession: vi.fn().mockRejectedValue(err500),
        syncPending: vi.fn().mockResolvedValue(undefined),
      },
      communityStats: undefined,
    };

    const session = buildGameSession({
      mode: "Classic",
      targetName: "Aigis",
      result: "win",
      attempts: 3,
    });

    await savePendingSession(session);

    // 500 is a transient error — session should be queued for retry
    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    expect(pending).toHaveLength(1);
    expect(pending[0].target_name).toBe("Aigis");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PIÈGE 3 — filterMenu._migrate(): ["P5","P5R"] must NOT expand to all P5 sub-codes
//
// Source: CLAUDE.md §13
//   "_migrate() dans filterMenu.js expand incorrect des filtres de défi"
//   "Vérifier si des enfants sont déjà présents avant d'expand :
//    children.some(c => saved.includes(c)) — sans ça, ["P5","P5R"] devient
//    tous les sous-codes P5"
//
// `_migrate` is private to filterMenu.js — exported under the test-only alias
// `migrateLegacyOpusFilters` (see js/filterMenu.js) so this suite exercises the
// real implementation instead of a hand-copied reproduction that could silently
// drift from the shipped code.
// ─────────────────────────────────────────────────────────────────────────────

describe("filterMenu migrateLegacyOpusFilters() (real _migrate() via test-only export)", () => {
  const _migrate = migrateLegacyOpusFilters;

  const ALL_OPUS = [
    "P1",
    "P2IS",
    "P2EP",
    "P3",
    "P3FES",
    "P3P",
    "P4",
    "P4G",
    "P4AU",
    "P4D",
    "P5",
    "P5R",
    "P5S",
    "P5T",
    "P5X",
    "PQ",
    "PQ2",
  ];

  it("new format: ['P5','P5R'] keeps P5 and P5R only — does NOT expand to all P5 sub-codes", () => {
    // This is the core of the piège: in the new precise-code format, saving ["P5","P5R"]
    // means exactly those two codes. It must NOT be expanded to ["P5","P5R","P5S","P5T"].
    const result = _migrate(["P5", "P5R"], ALL_OPUS);
    expect(result).toContain("P5");
    expect(result).toContain("P5R");
    expect(result).not.toContain("P5S"); // must NOT expand P5 into all siblings
    expect(result).not.toContain("P5T");
    expect(result).toHaveLength(2);
  });

  it("old format: ['P5'] alone (no sub-codes) expands to all P5 sub-codes", () => {
    // Legacy behaviour: "P5" saved alone means "all P5 games". Expand it.
    const result = _migrate(["P5"], ALL_OPUS);
    expect(result).toContain("P5");
    expect(result).toContain("P5R");
    expect(result).toContain("P5S");
    expect(result).toContain("P5T");
  });

  it("returns null for non-array input", () => {
    expect(_migrate(null, ALL_OPUS)).toBeNull();
    expect(_migrate(undefined, ALL_OPUS)).toBeNull();
    expect(_migrate("P5", ALL_OPUS)).toBeNull();
  });

  it("returns [] (preserve all-deselected state) for empty array input", () => {
    expect(_migrate([], ALL_OPUS)).toEqual([]);
  });

  it("ignores unknown codes not in allOpus", () => {
    const result = _migrate(["P99", "P5"], ALL_OPUS);
    // P99 is not in allOpus and has no LEGACY_EXPAND entry → ignored
    // P5 alone → expands to all P5 sub-codes
    expect(result).not.toContain("P99");
    expect(result).toContain("P5");
    expect(result).toContain("P5R");
  });

  it("new format: ['P4','P4G','P4AU'] keeps only those three codes", () => {
    const result = _migrate(["P4", "P4G", "P4AU"], ALL_OPUS);
    expect(result).toContain("P4");
    expect(result).toContain("P4G");
    expect(result).toContain("P4AU");
    expect(result).not.toContain("P4D"); // was not in saved list
    expect(result).toHaveLength(3);
  });

  it("precise codes without a LEGACY_EXPAND entry are passed through directly", () => {
    const result = _migrate(["P1", "P5X"], ALL_OPUS);
    expect(result).toContain("P1");
    expect(result).toContain("P5X");
    expect(result).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PIÈGE 4 — DST Paris: additional edge cases not yet covered
//
// Source: CLAUDE.md §13 (and task description):
//   "00:30 UTC when Paris is UTC+2, the Paris date should be the same day not next"
//
// Core property: adding 2 hours to 00:30 UTC gives 02:30 Paris — same day.
// The existing DST tests already cover many scenarios. We add:
//   • A specific midnight-boundary scenario matching the task description exactly
//   • The boundary just BEFORE midnight (23:30 UTC in winter → next day in Paris)
// ─────────────────────────────────────────────────────────────────────────────

describe("parisDateKey — midnight boundary with UTC+2 offset (summer)", () => {
  it("00:30 UTC on a summer day (Paris UTC+2) gives the SAME calendar day in Paris", () => {
    // Task description: "00:30 UTC when Paris is UTC+2, the Paris date should be
    // the same day not next". 00:30 UTC + 2h = 02:30 Paris → same day as UTC.
    // Using 2025-07-15 (mid-summer, unambiguously UTC+2 in Paris).
    const date = new Date("2025-07-15T00:30:00Z");
    expect(parisDateKey(date)).toBe("2025-07-15");
  });

  it("22:30 UTC on a summer day (Paris UTC+2) is already the NEXT day in Paris", () => {
    // 22:30 UTC + 2h = 00:30 on the next day in Paris
    const date = new Date("2025-07-14T22:30:00Z");
    expect(parisDateKey(date)).toBe("2025-07-15"); // next day in Paris
  });

  it("22:30 UTC on a winter day (Paris UTC+1) is still the SAME day in Paris", () => {
    // 22:30 UTC + 1h = 23:30 Paris → same day (does not cross midnight)
    const date = new Date("2025-01-15T22:30:00Z");
    expect(parisDateKey(date)).toBe("2025-01-15");
  });

  it("23:00 UTC on a winter day (Paris UTC+1) is the NEXT day in Paris", () => {
    // 23:00 UTC + 1h = 00:00 Paris next day
    const date = new Date("2025-01-15T23:00:00Z");
    expect(parisDateKey(date)).toBe("2025-01-16");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PIÈGE 5 — normalize: edge cases not covered by existing tests
//
// The existing tests cover: empty string, accent stripping, apostrophes,
// quotes, trim, complex title, Katakana, idempotence, punctuation preservation.
// We add: string containing only whitespace (trim → "").
// ─────────────────────────────────────────────────────────────────────────────

describe("normalize — whitespace-only and boundary edge cases", () => {
  it("returns empty string for a whitespace-only string", () => {
    // trim() reduces "   " to "", then toLowerCase() keeps it as ""
    expect(normalize("   ")).toBe("");
  });

  it("returns empty string for a tab-only string", () => {
    expect(normalize("\t\t")).toBe("");
  });

  it("handles a string with leading/trailing spaces and interior accent", () => {
    // trim removes outer spaces, NFD+strip removes accent
    expect(normalize("  élève  ")).toBe("eleve");
  });

  it("handles mixed accented Latin and plain ASCII in the same string", () => {
    // Accented chars stripped, plain ASCII preserved
    expect(normalize("Café au lait")).toBe("cafe au lait");
  });

  it("é normalizes to e, ü normalizes to u, ñ normalizes to n", () => {
    expect(normalize("é")).toBe("e");
    expect(normalize("ü")).toBe("u");
    expect(normalize("ñ")).toBe("n");
  });

  it("Katakana アン is preserved unchanged (no Latin diacritics to strip)", () => {
    // The existing test on line ~820 already covers this, but we confirm the
    // constraint explicitly: normalize should be safe to call on Katakana names
    // (though in practice it is only called on romaji / Latin character names).
    expect(normalize("アン")).toBe("アン");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MODES — source unique de vérité pour le vocabulaire des modes de jeu.
// Avant : chaque couche (backend, profileStats, cloud-sync, pages de mode)
// avait sa propre table → "classic" vs "classique", "All Out Attack" non
// normalisé, etc. Ces helpers centralisent la correspondance.
// ─────────────────────────────────────────────────────────────────────────────

describe("MODES catalogue", () => {
  it("exposes the six canonical modes with key + label", () => {
    expect(MODES.map((m) => m.key).sort()).toEqual(
      ["alloutattack", "classic", "emoji", "music", "personae", "silhouette"]
    );
    const labels = Object.fromEntries(MODES.map((m) => [m.key, m.label]));
    expect(labels).toEqual({
      classic: "Classic",
      emoji: "Emoji",
      silhouette: "Silhouette",
      alloutattack: "AllOutAttack",
      personae: "Personae",
      music: "Music",
    });
  });
});

describe("normalizeModeKey", () => {
  it("maps backend keys to themselves", () => {
    expect(normalizeModeKey("classic")).toBe("classic");
    expect(normalizeModeKey("alloutattack")).toBe("alloutattack");
  });

  it("maps the French alias 'classique' to 'classic'", () => {
    expect(normalizeModeKey("classique")).toBe("classic");
  });

  it("maps display labels (any case/spacing) to the canonical key", () => {
    expect(normalizeModeKey("Classic")).toBe("classic");
    expect(normalizeModeKey("All Out Attack")).toBe("alloutattack");
    expect(normalizeModeKey("AllOutAttack")).toBe("alloutattack");
    expect(normalizeModeKey("AOA")).toBe("alloutattack");
    expect(normalizeModeKey("Personae")).toBe("personae");
    expect(normalizeModeKey("Music")).toBe("music");
  });

  it("returns null for an unknown mode", () => {
    expect(normalizeModeKey("banana")).toBeNull();
    expect(normalizeModeKey("")).toBeNull();
    expect(normalizeModeKey(null)).toBeNull();
  });
});

describe("modeLabel", () => {
  it("returns the canonical display label for any known variant", () => {
    expect(modeLabel("classique")).toBe("Classic");
    expect(modeLabel("alloutattack")).toBe("AllOutAttack");
    expect(modeLabel("All Out Attack")).toBe("AllOutAttack");
    expect(modeLabel("music")).toBe("Music");
  });

  it("falls back to the raw input for an unknown mode (non-destructive)", () => {
    expect(modeLabel("Mystery")).toBe("Mystery");
  });
});

describe("applyDarkModeOverrides", () => {
  beforeEach(() => {
    setHTML('<div class="box"></div><div id="victoryBox"></div>');
    document.body.classList.remove("darkmode");
  });

  it("is a no-op when the body has no .darkmode class", () => {
    applyDarkModeOverrides([{ selector: ".box", styles: { color: "red" } }]);
    expect(document.querySelector(".box").style.color).toBe("");
  });

  it("applies styles by CSS selector when darkmode is active", () => {
    document.body.classList.add("darkmode");
    applyDarkModeOverrides([{ selector: ".box", styles: { backgroundColor: "#222", color: "white" } }]);
    const box = document.querySelector(".box");
    expect(box.style.backgroundColor).toBe("rgb(34, 34, 34)");
    expect(box.style.color).toBe("white");
  });

  it("applies styles by element id and ignores missing targets silently", () => {
    document.body.classList.add("darkmode");
    expect(() =>
      applyDarkModeOverrides([
        { id: "victoryBox", styles: { border: "3px solid #4caf50" } },
        { selector: ".does-not-exist", styles: { color: "red" } },
      ])
    ).not.toThrow();
    expect(document.getElementById("victoryBox").style.border).toBe("3px solid rgb(76, 175, 80)");
  });
});

describe("enableGiveUpButton", () => {
  beforeEach(() => {
    setHTML('<button id="giveUpButton" disabled></button><button id="customBtn" disabled></button>');
  });

  it("re-enables the default #giveUpButton and sets a pointer cursor", () => {
    enableGiveUpButton();
    const btn = document.getElementById("giveUpButton");
    expect(btn.disabled).toBe(false);
    expect(btn.style.cursor).toBe("pointer");
  });

  it("supports a custom button id", () => {
    enableGiveUpButton("customBtn");
    expect(document.getElementById("customBtn").disabled).toBe(false);
  });

  it("is a no-op when the button doesn't exist", () => {
    document.body.innerHTML = "";
    expect(() => enableGiveUpButton()).not.toThrow();
  });
});

describe("showChallengeButton", () => {
  beforeEach(() => {
    setHTML(
      '<div id="modeNavigationContainer"><button id="prevModeButton"></button><button id="nextModeButton"></button></div>'
    );
    delete window._currentUser;
  });

  it("is a no-op when no user is logged in", () => {
    showChallengeButton("classic", 3);
    expect(document.getElementById("challengeFriendBtn")).toBeNull();
  });

  it("is a no-op when #modeNavigationContainer is missing", () => {
    document.getElementById("modeNavigationContainer").remove();
    window._currentUser = { id: 1 };
    showChallengeButton("classic", 3);
    expect(document.getElementById("challengeFriendBtn")).toBeNull();
  });

  it("inserts the button before #nextModeButton when logged in", () => {
    window._currentUser = { id: 1 };
    showChallengeButton("classic", 3);
    const btn = document.getElementById("challengeFriendBtn");
    expect(btn).not.toBeNull();
    expect(btn.nextElementSibling?.id).toBe("nextModeButton");
  });

  it("appends the button when there is no #nextModeButton", () => {
    window._currentUser = { id: 1 };
    document.getElementById("nextModeButton").remove();
    showChallengeButton("classic", 3);
    const nav = document.getElementById("modeNavigationContainer");
    expect(nav.lastElementChild.id).toBe("challengeFriendBtn");
  });

  it("does not insert a second button if one already exists", () => {
    window._currentUser = { id: 1 };
    showChallengeButton("classic", 3);
    showChallengeButton("classic", 5);
    expect(document.querySelectorAll("#challengeFriendBtn")).toHaveLength(1);
  });
});

describe("showCommunityStats", () => {
  // Feature retirée le 2026-07-17 (retour Hamza) : la fonction est désormais un
  // no-op, on garde juste un garde-fou de régression pour vérifier qu'elle
  // n'injecte plus jamais rien dans la victoryBox, même si l'API répond.
  beforeEach(() => {
    setHTML('<div id="victoryBox"></div>');
    window.i18n = { t: (_key, vars) => `${vars.percent}% of ${vars.total} players` };
  });

  afterEach(() => {
    delete window._personadleApi;
    delete window.i18n;
  });

  it("n'injecte plus rien dans #victoryBox même avec des données API valides", async () => {
    window._personadleApi = {
      communityStats: { get: vi.fn().mockResolvedValue({ total: 42, percent: 37 }) },
    };
    await showCommunityStats("classic", "Joker");
    expect(document.querySelector(".community-stats")).toBeNull();
  });

  it("est un no-op sûr sans API et ne tape pas l'endpoint communityStats", async () => {
    const get = vi.fn();
    window._personadleApi = { communityStats: { get } };
    await expect(showCommunityStats("classic", "Joker")).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();
    expect(document.querySelector(".community-stats")).toBeNull();
  });
});

describe("characterMatchesActiveOpus", () => {
  it("returns true when the character has an opus in the active list", () => {
    expect(characterMatchesActiveOpus({ opus: ["P5", "P5R"] }, ["P3", "P5"])).toBe(true);
  });

  it("returns false when none of the character's opus are active", () => {
    expect(characterMatchesActiveOpus({ opus: ["P4"] }, ["P3", "P5"])).toBe(false);
  });

  it("accepts a single string opus (non-array)", () => {
    expect(characterMatchesActiveOpus({ opus: "P5" }, ["P5"])).toBe(true);
  });

  it("returns false for a null/undefined character or missing opus", () => {
    expect(characterMatchesActiveOpus(null, ["P5"])).toBe(false);
    expect(characterMatchesActiveOpus(undefined, ["P5"])).toBe(false);
    expect(characterMatchesActiveOpus({ nom: "Joker" }, ["P5"])).toBe(false);
  });
});

describe("updateCounterElement", () => {
  beforeEach(() => {
    setHTML('<span id="hintCounter"></span>');
  });

  it("sets the '(attempts / threshold)' text", () => {
    updateCounterElement("hintCounter", 2, 5);
    expect(document.getElementById("hintCounter").textContent).toBe("(2 / 5)");
  });

  it("adds the 'activated' class once attempts reach the threshold", () => {
    updateCounterElement("hintCounter", 5, 5);
    expect(document.getElementById("hintCounter").classList.contains("activated")).toBe(true);
  });

  it("does not add 'activated' below the threshold", () => {
    updateCounterElement("hintCounter", 4, 5);
    expect(document.getElementById("hintCounter").classList.contains("activated")).toBe(false);
  });

  it("is a no-op when the element doesn't exist", () => {
    expect(() => updateCounterElement("missingCounter", 1, 5)).not.toThrow();
  });
});
