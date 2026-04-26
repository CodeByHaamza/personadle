// === IMPORTS ===
import { silhouetteCharacters as originalCharacters } from "./database/silhouetteCharacters.js";
import { portraitsMapSilhouette as portraitsMap } from "./database/portraitsMapSilhouette.js";
import { personas } from "./database/persona.js";
import { updateProfileStats } from "../profile/profileStats.js";

// Shared game utilities
import {
  showConfettiExplosion,
  revealNextLink,
  setupRulesModal,
  setupDailyReset,
  checkResetOnLoad,
  showWrongMini,
  buildGameSession,
  savePendingSession,
  getDailyTarget,
  showChallengeButton,
  showCommunityStats,
} from "../js/gameCore.js";

// Collapsible opus filter panel (shared across all modes)
import { initFilterMenu } from "../js/filterMenu.js";
import { checkChallengeCompletion } from "../js/challenge-result.js";
import { trackUniqueDay } from "../profile/badges/badgesManager.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & STATE
// ─────────────────────────────────────────────────────────────────────────────

const modeName = "silhouette";
const todayKey = `statsLogged_${modeName}_${new Date().toISOString().split("T")[0]}`;
let statsAlreadyLogged = localStorage.getItem(todayKey) === "true";
let sessionStartTime = Date.now();

/** All specific opus codes available in Silhouette mode. */
const ALL_OPUS = ["P1","P2IS","P2EP","P3","P3FES","P3P","P3R","P4","P4G","P4AU","P4D","P5","P5R","P5S","P5T","P5X","PQ","PQ2"];

let activeFilters = [...ALL_OPUS];

let filteredCharacters = [];
let target = null;
let attempts = 0;
const maxAttempts = 5;    // Give Up unlocks after this many wrong guesses
let currentZoom = 1.8;    // Initial zoom level (decreases on each wrong guess)
const maxZoomOut = 1;
let gameOver = false;
let currentPickToken = 0; // Anti-race-condition token for image preloading
let lastFiveTargets = []; // Prevents the same character from appearing twice in a row

// ─────────────────────────────────────────────────────────────────────────────
// DOM ELEMENT REFERENCES (safe to resolve at module scope since module loads
// after the HTML parser, but <script type="module"> defers automatically)
// ─────────────────────────────────────────────────────────────────────────────

const textbar = document.getElementById("textbar");
const silhouetteImg = document.getElementById("silhouetteImage");
const guessBtn = document.getElementById("guessButton");
const resetBtn = document.getElementById("resetButton");
const giveUpBtn = document.getElementById("giveUpButton");
const giveUpCounter = document.getElementById("giveUpCounter");
const wrongList = document.getElementById("wrongGuessList");
const silhouetteBox = document.querySelector(".silhouette-box");

// Initially hidden while the first image loads
silhouetteImg.style.visibility = "hidden";
silhouetteImg.style.transform = `scale(${currentZoom})`;
silhouetteImg.style.transition = "none";


// ─────────────────────────────────────────────────────────────────────────────
// FILTER / CHARACTER POOL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the subset of characters matching the active opus filters.
 * @returns {Object[]}
 */
function getFilteredCharacters() {
  return originalCharacters.filter((c) => {
    const op = Array.isArray(c.opus) ? c.opus : [c.opus];
    return op.some((o) => activeFilters.includes(o));
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// SILHOUETTE IMAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Applies CSS scale transform to the silhouette image. */
function applyZoom(zoomFactor) {
  silhouetteImg.style.transform = `scale(${zoomFactor})`;
}

/**
 * Picks a random character (avoiding the last 5) and loads their silhouette.
 * Uses a token to cancel in-flight loads if pickCharacter() is called again.
 */
function pickCharacter(random = false) {
  filteredCharacters = getFilteredCharacters();
  if (filteredCharacters.length === 0) {
    console.error("❌ No characters available after filtering.");
    return;
  }

  target = random
    ? filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)]
    : getDailyTarget(originalCharacters, 'Silhouette');

  currentZoom = 1.8;

  // Hide image during load to prevent flash
  silhouetteImg.style.visibility = "hidden";
  silhouetteImg.style.transition = "none";
  silhouetteImg.style.transform = `scale(${currentZoom})`;
  silhouetteImg.style.filter = "brightness(0)";
  silhouetteImg.src = "";

  const myToken = ++currentPickToken;

  const tempImage = new Image();
  tempImage.onload = () => {
    if (myToken !== currentPickToken) return; // superseded by a newer pick
    silhouetteImg.src = tempImage.src;
    silhouetteImg.alt = "Silhouette";
    silhouetteImg.style.visibility = "visible";
    silhouetteImg.style.transition = "transform 0.3s ease-out";
  };
  tempImage.onerror = () => {
    if (myToken !== currentPickToken) return;
    console.error(`❌ Image not found for ${target.nom}`);
  };
  tempImage.src = `./database/img/${encodeURIComponent(target.image)}.webp`;

  localStorage.setItem("silhouetteTarget", JSON.stringify(target));
  localStorage.setItem("silhouetteAttempts", attempts);
  localStorage.setItem("silhouetteGameOver", "false");
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches an autocomplete dropdown that:
 *  - Filters out already-guessed characters (via `_guessed` flag)
 *  - Filters by the active opus filters
 *  - Shows codename + optional real name for characters like "Crow (Akechi)"
 *
 * @param {HTMLInputElement} input        - The text input to enhance
 * @param {string[]}         personasList - Sorted list of all guessable names
 */
function initializeAutocomplete(input, personasList) {
  let currentFocus = -1;

  input.addEventListener("input", function () {
    closeList();
    const val = this.value.trim();
    if (!val) return;

    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);

    const lowerVal = val.toLowerCase();
    const matches = [];

    for (let i = 0; i < personasList.length; i++) {
      const displayName = personasList[i];
      const lowerName = displayName.toLowerCase();

      const character = originalCharacters.find(
        (c) => c.nom.trim().toLowerCase() === displayName.trim().toLowerCase()
      );

      // Skip already-guessed characters and those outside active filters
      if (
        !character ||
        character._guessed ||
        !lowerName.includes(lowerVal) ||
        !character.opus.some((o) => activeFilters.includes(o))
      ) continue;

      const [firstName, lastName] = displayName.split(" ");
      let priority = 3;
      if (firstName?.toLowerCase().startsWith(lowerVal)) priority = 1;
      else if (lastName?.toLowerCase().startsWith(lowerVal)) priority = 2;
      matches.push({ name: displayName, priority });
    }

    matches.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    matches.forEach(({ name: nom }) => {
      const imageName = portraitsMap[nom] || nom.split(" ")[0];
      const portraitName = encodeURIComponent(imageName);
      // Characters like "Crow (Akechi)" show the real name in parentheses
      const realName = nom.includes("(") ? nom.split("(")[1].replace(")", "") : "";

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img src="../database/portraits/${portraitName}.webp" alt="${nom}">
        <span style="display: flex; flex-direction: column;">
          <span class="codename">${nom.split(" (")[0]}</span>
          ${realName ? `<span class="realname">(${realName})</span>` : ""}
        </span>
        <input type='hidden' value='${nom}'>
      `;

      option.addEventListener("click", function () {
        input.value = this.querySelector("input").value;
        handleGuess();
        closeList();
      });

      list.appendChild(option);
    });

    currentFocus = -1;
  });

  input.addEventListener("keydown", function (e) {
    const items = document.querySelectorAll("#autocomplete-list .list-options");
    if (!items.length) return;

    if (e.key === "ArrowDown") { currentFocus++; updateActive(items); }
    else if (e.key === "ArrowUp") { currentFocus--; updateActive(items); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (currentFocus > -1) items[currentFocus].click();
      else items[0]?.click();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#autocomplete-list") && e.target !== input) closeList();
  });

  function updateActive(items) {
    items.forEach((i) => i.classList.remove("autocomplete-active"));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function closeList() {
    const lists = document.getElementsByClassName("autocomplete-items");
    for (let i = 0; i < lists.length; i++) lists[i].parentNode.removeChild(lists[i]);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// VICTORY / DEFEAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ends the game, reveals the character's full image, and displays the result.
 * On a win: checks the Persona Q Explorer badge, shows confetti.
 * On a loss (forceReveal): just reveals the answer.
 *
 * @param {boolean} [force=false] - True when the player gives up
 */
function showVictory(force = false) {
  gameOver = true;
  textbar.disabled = true;
  guessBtn.disabled = true;
  giveUpBtn.disabled = true;

  // Reveal full image (remove brightness filter and reset zoom)
  silhouetteImg.style.transform = "scale(1)";
  silhouetteImg.style.filter = "none";

  // Build result message
  document.querySelectorAll(".victory-message").forEach((e) => e.remove());
  const message = document.createElement("div");
  message.className = "victory-box";
  message.innerHTML = force
    ? `<span class="failure-text">${(window.i18n || { t: (k, v) => k }).t('modes.silhouette.giveup_reveal', { name: target.nom })}</span>`
    : `<span class="success-text">${(window.i18n || { t: (k, v) => k }).t('modes.silhouette.correct', { name: target.nom })}</span>`;
  silhouetteBox.insertAdjacentElement("afterend", message);

  if (!force) {
    if (!statsAlreadyLogged) {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
      updateProfileStats({ result: "win", mode: modeName, timeSpent });
      savePendingSession(buildGameSession({
        mode: modeName, targetName: target.nom, result: "win",
        attempts, timeMs: timeSpent * 1000,
      }));
      localStorage.setItem(todayKey, "true");
      statsAlreadyLogged = true;
    }

    // ── Badge: Persona Q Explorer ──────────────────────────────────────────
    const pqCharacters = ["Rei", "Zen", "Hikari", "Nagi"];
    if (pqCharacters.includes(target.nom)) {
      const profile = JSON.parse(localStorage.getItem("personaUserProfile")) || {};
      if (!profile.foundPQCharacters) profile.foundPQCharacters = [];
      if (!profile.foundPQCharacters.includes(target.nom)) {
        profile.foundPQCharacters.push(target.nom);
        localStorage.setItem("personaUserProfile", JSON.stringify(profile));
        console.log(`🎬 PQ progress: ${profile.foundPQCharacters.length}/4`);
      }
    }

    // 🎭 SHAPESHIFTER — track character per mode
    if (target.nom) {
      const cmap = JSON.parse(localStorage.getItem("characterModeMap") || "{}");
      if (!cmap[target.nom]) cmap[target.nom] = [];
      if (!cmap[target.nom].includes("silhouette")) cmap[target.nom].push("silhouette");
      localStorage.setItem("characterModeMap", JSON.stringify(cmap));
    }

    const _pSil = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
    trackUniqueDay(_pSil, () => localStorage.setItem("personaUserProfile", JSON.stringify(_pSil)));
    showConfettiExplosion();
    showChallengeButton('silhouette', attempts);
    let winCount = parseInt(localStorage.getItem("silhouetteWins") || "0");
    localStorage.setItem("silhouetteWins", winCount + 1);
  }

  checkChallengeCompletion('silhouette', attempts, !force);
  showCommunityStats(modeName, target.nom);
  revealNextLink({
    prevHref: "../allOutAttackMode/allOutAttack.html",
    nextHref: "../personaeMode/personae.html",
  });

  localStorage.setItem("silhouetteGameOver", "true");
  localStorage.setItem("silhouetteForceReveal", String(force));
}


// ─────────────────────────────────────────────────────────────────────────────
// WRONG GUESS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks a character as guessed and shows their portrait in the wrong-guess list.
 * @param {string} name - The guessed character name (lowercased)
 */
function showWrong(name) {
  const char = originalCharacters.find((c) => c.nom.toLowerCase() === name.toLowerCase());
  if (!char || char._guessed) return;
  char._guessed = true;

  const imageName = portraitsMap[char.nom] || char.nom.split(" ")[0];
  showWrongMini(
    `../database/portraits/${encodeURIComponent(imageName)}.webp`,
    char.nom,
    wrongList
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes one guess:
 *  - Increments attempt counter and updates the give-up counter
 *  - On correct: calls showVictory()
 *  - On wrong: calls showWrong() and zooms out the silhouette
 */
function handleGuess() {
  if (gameOver) return;
  const guess = textbar.value.trim().toLowerCase();
  if (!guess) return;

  attempts++;
  localStorage.setItem("silhouetteAttempts", attempts);
  giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;

  if (attempts >= maxAttempts) {
    giveUpBtn.disabled = false;
    giveUpBtn.style.cursor = "pointer";
    giveUpCounter.classList.add("activated");
  }

  if (guess === target.nom.toLowerCase()) {
    showVictory();
  } else {
    showWrong(guess);
    if (currentZoom > maxZoomOut) {
      currentZoom = Math.max(maxZoomOut, currentZoom - 0.2);
      applyZoom(currentZoom);
    }
  }

  textbar.value = "";
  textbar.dispatchEvent(new Event("input")); // refresh autocomplete filter
}

/**
 * Give Up: reveals the answer and logs a giveup stat.
 * Only active after `maxAttempts` wrong guesses.
 */
function giveUp() {
  if (attempts < maxAttempts || gameOver) return;
  showVictory(true);

  if (!statsAlreadyLogged) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({ result: "giveup", mode: modeName, timeSpent });
    savePendingSession(buildGameSession({
      mode: modeName, targetName: target.nom, result: "giveup",
      attempts, timeMs: timeSpent * 1000,
    }));
    localStorage.setItem(todayKey, "true");
    statsAlreadyLogged = true;
  }
}

/**
 * Resets all game state and picks a new character.
 * Called by the Replay button and the daily reset.
 */
function resetGame(random = false) {
  const nav = document.getElementById("modeNavigationContainer");
  if (nav) nav.style.display = "none";

  localStorage.removeItem("silhouetteForceReveal");

  gameOver = false;
  attempts = 0;
  giveUpCounter.textContent = `(0 / ${maxAttempts})`;
  giveUpCounter.classList.remove("activated");
  giveUpBtn.disabled = true;
  giveUpBtn.style.cursor = "not-allowed";
  textbar.disabled = false;
  guessBtn.disabled = false;
  wrongList.innerHTML = "";
  textbar.value = "";

  // Remove old victory/defeat messages
  document.querySelectorAll(".victory-message, .victory-box").forEach((e) => e.remove());

  // Reset _guessed flags so all characters are available again
  originalCharacters.forEach((c) => { c._guessed = false; });

  pickCharacter(random);
}


// ─────────────────────────────────────────────────────────────────────────────
// FILTER BUTTONS (silhouette-specific wiring)
// ─────────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE (silhouette-specific element)
// ─────────────────────────────────────────────────────────────────────────────

function applyDarkModeStyles() {
  if (!document.body.classList.contains("darkmode")) return;
  const zone = document.querySelector(".silhouette-box");
  if (zone) {
    zone.style.backgroundColor = "#222";
    zone.style.border = "3px solid #888";
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__i18nReady) await window.__i18nReady;
  setupRulesModal();
  // ── Filtre opus — panneau déroulant ──
  const _filterApi = initFilterMenu("silhouetteActiveFilters", ALL_OPUS, (newActive) => {
    activeFilters = newActive;
    resetGame();
  });
  activeFilters = _filterApi.getActive();
  applyDarkModeStyles();

  guessBtn.addEventListener("click", handleGuess);
  giveUpBtn.addEventListener("click", giveUp);

  resetBtn.addEventListener("click", () => {
    localStorage.removeItem("silhouetteTarget");
    localStorage.removeItem("silhouetteAttempts");
    localStorage.removeItem("silhouetteGameOver");
    localStorage.removeItem(todayKey);
    statsAlreadyLogged = false;
    sessionStartTime = Date.now();
    resetGame(true);
  });

  // Bind autocomplete to the sorted persona name list
  initializeAutocomplete(textbar, personas.sort((a, b) => a.localeCompare(b)));

  // ── Restore session ──
  const stored = localStorage.getItem("silhouetteTarget");
  const storedAttempts = parseInt(localStorage.getItem("silhouetteAttempts")) || 0;
  const storedGameOver = localStorage.getItem("silhouetteGameOver") === "true";

  if (stored) {
    try {
      target = JSON.parse(stored);
      filteredCharacters = getFilteredCharacters();
      currentZoom = Math.max(maxZoomOut, 1.8 - 0.2 * storedAttempts);
      attempts = storedAttempts;

      silhouetteImg.style.visibility = "hidden";
      silhouetteImg.style.transition = "none";
      silhouetteImg.style.transform = `scale(1.8)`;
      silhouetteImg.src = `./database/img/${encodeURIComponent(target.image)}.webp`;
      silhouetteImg.alt = "Silhouette";
      silhouetteImg.style.filter = storedGameOver ? "none" : "brightness(0)";

      giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;
      if (attempts >= maxAttempts) {
        giveUpBtn.disabled = false;
        giveUpBtn.style.cursor = "pointer";
        giveUpCounter.classList.add("activated");
      }

      if (storedGameOver) {
        showVictory(localStorage.getItem("silhouetteForceReveal") === "true");
      }

      silhouetteImg.onload = () => {
        silhouetteImg.style.visibility = "visible";
        silhouetteImg.style.transition = "transform 0.3s ease-out";
      };
    } catch (e) {
      resetGame();
    }
  } else {
    resetGame();
  }

  // ── Daily reset ──
  checkResetOnLoad("lastPlayedDate_Shadow", "Shadow", () => {
    resetBtn.click();
  });
  setupDailyReset(() => {
    resetBtn?.click() ?? location.reload();
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// DEBUG (console only)
// ─────────────────────────────────────────────────────────────────────────────

function debugAllSilhouettes() {
  console.log("🔍 === DEBUG SILHOUETTE MODE ===");
  const usableNames = [...personas].sort((a, b) => a.localeCompare(b));
  const accepted = activeFilters;
  const foundInSilhouette = new Set(originalCharacters.map((c) => c.nom));
  const foundInMap = new Set(Object.keys(portraitsMap));
  const errors = [];

  for (const name of usableNames) {
    if (!foundInSilhouette.has(name)) { errors.push(`❌ ${name} — Not in silhouetteCharacters.js`); continue; }
    if (!foundInMap.has(name)) { errors.push(`❌ ${name} — Missing portrait in portraitsMapSilhouette`); continue; }
    const char = originalCharacters.find((c) => c.nom === name);
    const passes = (Array.isArray(char.opus) ? char.opus : [char.opus]).some((o) => accepted.includes(o));
    if (!passes) console.warn(`⚠️ ${name} — Does not match active filters`);
    else console.log(`✅ ${name}`);
  }

  if (errors.length) errors.forEach((e) => console.error(e));
  console.log("=== END DEBUG ===");
}
