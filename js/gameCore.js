/**
 * gameCore.js — Shared utilities for all Personadle game modes.
 *
 * Every game mode (Classique, Emoji, Silhouette, AllOutAttack, Personae, Music)
 * imports from this file to avoid code duplication.
 *
 * Exported API:
 *   parisDateKey(d?)            → "YYYY-MM-DD" in Europe/Paris (DST-safe)
 *   msUntilNextParisMidnight()  → ms until next Paris midnight
 *   normalize(str)              → lowercase, accent-stripped, trimmed
 *   showConfettiExplosion(opts) → victory confetti burst + victory sound
 *   revealNextLink(opts)        → shows the mode-navigation bar
 *   setupRulesModal()           → wires the "?" button and modal close
 *   setupDailyReset(onReset)    → schedules an auto-reset at Paris midnight
 *   checkResetOnLoad(...)       → resets the game if a new day has started
 *   setupFilterButtons(...)     → wires opus filter-button click events
 *   showWrongMini(...)          → appends a shaking wrong-guess portrait
 */


// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES (Paris / Europe timezone, DST-safe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns today's date as "YYYY-MM-DD" using the Europe/Paris timezone.
 * Handles Daylight Saving Time automatically via Intl.DateTimeFormat.
 *
 * @param {Date} [d=new Date()] - Optional date to format (default: now)
 * @returns {string} e.g. "2025-03-26"
 */
export function parisDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns the number of milliseconds remaining until the next Paris midnight.
 * Used to schedule the automatic daily reset.
 *
 * @returns {number} Milliseconds until 00:00:00 Paris time
 */
export function msUntilNextParisMidnight() {
  const nowInParis = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  const midnight = new Date(nowInParis);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - nowInParis.getTime();
}


// ─────────────────────────────────────────────────────────────────────────────
// STRING UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a string for case-insensitive, accent-insensitive comparison.
 * Used in Music mode to compare song titles, but available to all modes.
 *
 * @param {string} str
 * @returns {string} Lowercase, accent-stripped, trimmed string
 *
 * @example
 * normalize("Brûle, ma Peine !") // "brule, ma peine !"
 */
export function normalize(str) {
  return str
    .normalize("NFD")                     // decompose accented chars
    .replace(/[\u0300-\u036f]/g, "")      // strip combining diacritics
    .replace(/[\u2018\u2019]/g, "'")      // unify curly apostrophes → straight
    .replace(/"/g, "")                    // remove double quotes
    .trim()
    .toLowerCase();
}


// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI / VICTORY CELEBRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plays the victory sound and launches an animated confetti burst.
 *
 * Two spawn styles are supported:
 *   - "sides"  (default): emojis launch from the left and right edges —
 *              used by Classique, Emoji, Silhouette, AllOutAttack.
 *   - "bottom": emojis launch from random positions along the bottom edge —
 *              used by Personae and Music.
 *
 * NOTE: `new Audio(path)` resolves relative to the *document* URL, not this
 * module's URL. All mode pages sit one level deep (e.g. classiqueMode/),
 * so "../assets/…" always resolves to the project root.
 *
 * @param {Object}   [opts]
 * @param {string[]} [opts.emojiList=["🎉","🎊","✨","💥","🌟"]] - Emojis to use
 * @param {number}   [opts.count=40]   - Total number of emoji particles
 * @param {string}   [opts.spreadFrom="sides"] - "sides" | "bottom"
 */
export function showConfettiExplosion({
  emojiList = ["🎉", "🎊", "✨", "💥", "🌟"],
  count = 40,
  spreadFrom = "sides",
} = {}) {
  // Play victory sound (path resolved relative to the HTML page)
  new Audio("../assets/sound_effect/Victory_sound.mp3").play().catch(() => {});

  for (let i = 0; i < count; i++) {
    const emoji = document.createElement("span");
    emoji.textContent = emojiList[Math.floor(Math.random() * emojiList.length)];
    emoji.classList.add("confetti-emoji");
    emoji.style.bottom = "0vh";

    if (spreadFrom === "sides") {
      // Bilateral: first half from left, second half from right
      const isLeft = i < count / 2;
      emoji.style.left = isLeft ? "0vw" : "100vw";
      const xTarget = isLeft
        ? Math.random() * 50 + 25
        : -(Math.random() * 50 + 25);
      emoji.style.setProperty("--x-move", xTarget + "vw");
    } else {
      // Bottom: random horizontal origin
      emoji.style.left = Math.random() * 100 + "vw";
      emoji.style.setProperty(
        "--x-move",
        (Math.random() * 100 - 50) + "vw"
      );
    }

    emoji.style.setProperty("--y-move", -(Math.random() * 50 + 30) + "vh");
    emoji.style.setProperty("--rotate", Math.random() * 360 + "deg");

    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 1000);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// MODE NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reveals the between-modes navigation bar and wires prev/next links.
 * Called after a win or give-up in every game mode.
 *
 * The container (#modeNavigationContainer) must already exist in the HTML
 * with display:none. It is made visible here and scrolled into view.
 *
 * @param {Object} [opts]
 * @param {string} [opts.nextHref=""]   - URL for the "next mode" button
 * @param {string} [opts.prevHref=null] - URL for the "prev mode" button
 *                                        (null/empty = button stays hidden)
 */
export function revealNextLink({ nextHref = "", prevHref = null } = {}) {
  const nav = document.getElementById("modeNavigationContainer");
  const nextButton = document.getElementById("nextModeButton");
  const prevButton = document.getElementById("prevModeButton");

  if (nextButton && nextHref) {
    nextButton.onclick = () => (location.href = nextHref);
  }

  if (prevButton) {
    if (prevHref) {
      prevButton.style.visibility = "visible";
      prevButton.onclick = () => (location.href = prevHref);
    } else {
      prevButton.style.visibility = "hidden";
      prevButton.onclick = null;
    }
  }

  if (nav) {
    nav.style.display = "flex";
    // Delay the scroll so the layout has time to update
    setTimeout(() => {
      nav.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1500);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// RULES MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires the "How to Play" rules modal:
 *  - Clicking #rulesButton opens the modal and adds "modal-open" to <body>
 *  - Clicking the × button or the backdrop closes it
 *
 * Safe to call even if the elements are missing (no-op).
 */
export function setupRulesModal() {
  const modal = document.getElementById("rulesModal");
  const btn = document.getElementById("rulesButton");
  if (!modal || !btn) return;

  const closeBtn = modal.querySelector(".close");

  const open = () => {
    modal.style.display = "block";
    document.body.classList.add("modal-open");
  };

  const close = () => {
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
  };

  btn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);

  // Close when clicking the semi-transparent backdrop
  window.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// DAILY RESET SCHEDULING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schedules a one-time callback at the next Paris midnight + 500 ms buffer.
 * Called once at page load; the callback is responsible for triggering
 * the mode-specific reset (e.g. clicking #resetButton or calling resetGame()).
 *
 * @param {Function} onReset - Called when midnight Paris is reached
 * @returns {number} The setTimeout timer ID (can be cleared if needed)
 */
export function setupDailyReset(onReset) {
  const ms = msUntilNextParisMidnight();
  console.log(`🕛 Next auto-reset in ~${Math.round(ms / 60000)} minutes (Paris)`);
  return setTimeout(onReset, ms + 500);
}

/**
 * Checks at page load whether a new Paris day has started since last visit.
 * If yes, cleans up yesterday's stats key, saves today's date, and triggers
 * the mode-specific reset callback.
 *
 * @param {string}   lastPlayedKey  - localStorage key storing the last-played date
 *                                    (e.g. "lastPlayedDate_Classic")
 * @param {string}   statsModeKey   - Mode identifier used in the stats key
 *                                    (e.g. "Classic" → "statsLogged_Classic_YYYY-MM-DD")
 * @param {Function} onReset        - Callback to run when a new day is detected
 */
export function checkResetOnLoad(lastPlayedKey, statsModeKey, onReset) {
  const storedDate = localStorage.getItem(lastPlayedKey);
  const today = new Date().toISOString().split("T")[0];

  if (storedDate !== today) {
    console.log(`📅 New day detected → auto-reset (${statsModeKey})`);

    // Remove yesterday's stats flag so it can be re-logged today
    if (storedDate) {
      localStorage.removeItem(`statsLogged_${statsModeKey}_${storedDate}`);
    }

    localStorage.setItem(lastPlayedKey, today);
    onReset();
  } else {
    console.log(`📅 Same day, no reset needed (${statsModeKey})`);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// OPUS FILTER BUTTONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires click events for the opus filter buttons (.filter-btn).
 *
 * On each click:
 *  1. Toggles the "active" CSS class on the clicked button
 *  2. Collects the full list of currently active filter values
 *  3. Persists them to localStorage
 *  4. Calls `onFilterChange` with the new filter array so the mode can
 *     re-filter its character pool and pick a new target
 *
 * The initial visual state (which buttons are active) must be set BEFORE
 * calling this function (see each mode's DOMContentLoaded handler).
 *
 * @param {string}   storageKey     - localStorage key for this mode's filters
 *                                    (e.g. "filters_Classic")
 * @param {Function} onFilterChange - Called with (string[]) newActiveFilters
 */
export function setupFilterButtons(storageKey, onFilterChange) {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");

      const activeFilters = Array.from(
        document.querySelectorAll(".filter-btn.active")
      ).map((b) => b.dataset.opus);

      localStorage.setItem(storageKey, JSON.stringify(activeFilters));
      onFilterChange(activeFilters);
    });
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// WRONG GUESS MINI PORTRAIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends a small "wrong guess" portrait to the wrong-guesses list and
 * triggers the shake animation after a brief delay.
 *
 * Used by Classique, Emoji, Silhouette, AllOutAttack, and Personae.
 * (Music mode has its own variant that also shows the song title.)
 *
 * @param {string}      imageSrc      - Full src URL for the portrait image
 * @param {string}      altText       - Alt text / character name
 * @param {HTMLElement} wrongListEl   - The container element (#wrongGuessList)
 * @param {string}      [fallbackSrc] - Fallback image src on load error
 */
export function showWrongMini(
  imageSrc,
  altText,
  wrongListEl,
  fallbackSrc = "../database/portraits/unknown.webp"
) {
  if (!wrongListEl) return;

  const div = document.createElement("div");
  div.className = "wrong-mini";

  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = altText;
  img.onerror = () => { img.src = fallbackSrc; };

  div.appendChild(img);
  wrongListEl.appendChild(div);

  // Small delay so the element is in the DOM before the class triggers CSS
  setTimeout(() => div.classList.add("shake"), 50);
}
