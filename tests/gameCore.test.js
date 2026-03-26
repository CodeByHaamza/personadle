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
} from "../js/gameCore.js";


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
    const key  = parisDateKey(date);
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
    const ms           = msUntilNextParisMidnight();
    const msIn24Hours  = 24 * 60 * 60 * 1000;
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
    expect(normalize("l\u2018autre")).toBe("l'autre");  // ' → '
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
    vi.stubGlobal("Audio", class {
      play() { return Promise.resolve(); }
    });
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

    document.querySelectorAll(".confetti-emoji").forEach(el => {
      expect(el.style.bottom).toBe("0vh");
    });
  });

  it("calls Audio.play()", () => {
    vi.useFakeTimers();
    const playSpy = vi.fn(() => Promise.resolve());
    vi.stubGlobal("Audio", class { play = playSpy; });

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
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("lastPlayedDate_Test", today);

    const onReset = vi.fn();
    checkResetOnLoad("lastPlayedDate_Test", "Test", onReset);

    expect(onReset).not.toHaveBeenCalled();
  });

  it("calls onReset when the stored date is yesterday", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    localStorage.setItem("lastPlayedDate_Test", yesterday);

    const onReset = vi.fn();
    checkResetOnLoad("lastPlayedDate_Test", "Test", onReset);

    expect(onReset).toHaveBeenCalledOnce();
  });

  it("removes the previous day's stats key when a new day is detected", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    const oldStatsKey = `statsLogged_Test_${yesterday}`;

    localStorage.setItem("lastPlayedDate_Test", yesterday);
    localStorage.setItem(oldStatsKey, "1");

    checkResetOnLoad("lastPlayedDate_Test", "Test", () => {});
    expect(localStorage.getItem(oldStatsKey)).toBeNull();
  });

  it("updates lastPlayedDate to today after a reset", () => {
    localStorage.setItem("lastPlayedDate_Test", "2000-01-01");
    checkResetOnLoad("lastPlayedDate_Test", "Test", () => {});

    const today = new Date().toISOString().split("T")[0];
    expect(localStorage.getItem("lastPlayedDate_Test")).toBe(today);
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
    showWrongMini("/img/b.webp", "Bob",   container);
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
