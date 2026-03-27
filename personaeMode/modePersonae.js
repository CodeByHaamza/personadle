/**
 * modePersonae.js — Personae mode (Personadle).
 *
 * The player is shown an image of a Persona (the creature, not the wielder)
 * and must guess which character from the franchise uses that Persona.
 * Up to 3 wrong guesses are allowed; after that the "Give Up" button unlocks.
 *
 * Key features:
 *  - Opus filter buttons let players restrict guesses to specific games
 *  - Autocomplete filters out already-guessed names and out-of-scope characters
 *  - Badge tracking for Twin Blade (Yosuke/Yusuke), Crimson Legacy (Picaro variants)
 *  - Session state is persisted in localStorage so a refresh resumes the game
 *
 * Shared utilities are imported from js/gameCore.js.
 * This file contains only Personae-mode-specific logic.
 */

// === IMPORTS ===
import { personaeCharacters as originalCharacters } from "./database/personaeCharacters.js";
import { portraitsMapPersonae as portraitsMap } from "./database/portraitsMapPersonae.js";
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
} from "../js/gameCore.js";

// Collapsible opus filter panel (shared across all modes)
import { initFilterMenu } from "../js/filterMenu.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & STATE
// ─────────────────────────────────────────────────────────────────────────────

/** All specific opus codes available in Personae mode. */
const ALL_OPUS = ["P2IS","P2EP","P3","P3FES","P3P","P3R","P4","P4G","P4AU","P5","P5R","P5S","P5T","P5X"];

let activeFilters = [...ALL_OPUS];
let filteredCharacters = [];
let target = null;
let attempts = 0;
const maxAttempts = 3; // Give Up unlocks after this many wrong guesses
let gameOver = false;
let lastFiveTargets = [];

let sessionStartTime = Date.now();
const todayKey = new Date().toISOString().split("T")[0];
const statsKey = `statsLogged_Personae_${todayKey}`;

// DOM elements (assigned in DOMContentLoaded)
let victoryBox, victoryImage, victoryText;
let textbar, guessBtn, resetBtn, giveUpBtn, giveUpCounter, wrongList, personaImg;

// Profile compatibility: copy personaUserProfile → playerProfile if needed
if (!localStorage.getItem("playerProfile") && localStorage.getItem("personaUserProfile")) {
  localStorage.setItem("playerProfile", localStorage.getItem("personaUserProfile"));
}


// ─────────────────────────────────────────────────────────────────────────────
// FILTER / CHARACTER POOL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the subset of personae characters matching the active filters.
 * @returns {Object[]}
 */
function getFilteredCharacters() {
  return originalCharacters.filter((c) => {
    const op = Array.isArray(c.opus) ? c.opus : [c.opus];
    return op.some((o) => activeFilters.includes(o));
  });
}

/**
 * Selects a random character from the filtered pool (avoiding recent targets)
 * and loads their persona image.
 */
function pickCharacter() {
  filteredCharacters = getFilteredCharacters();
  const pool = filteredCharacters.filter((c) => !lastFiveTargets.includes(c.persona));
  const choices = pool.length > 0 ? pool : [...filteredCharacters];

  target = choices[Math.floor(Math.random() * choices.length)];
  lastFiveTargets.push(target.persona);
  if (lastFiveTargets.length > 5) lastFiveTargets.shift();

  personaImg.src = `./database/img/${target.image}.webp`;
  personaImg.alt = target.persona;

  localStorage.setItem("personaeTarget", JSON.stringify(target));
  localStorage.setItem("personaeAttempts", attempts);
  localStorage.setItem("personaeGameOver", "false");
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches an autocomplete dropdown that:
 *  - Filters out already-guessed characters (via `_guessed` flag)
 *  - Filters by the active opus filters
 *  - Prioritises first-name matches
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
    const accepted = activeFilters;
    const matches = [];

    for (let i = 0; i < personasList.length; i++) {
      const displayName = personasList[i];
      const lowerName = displayName.toLowerCase();
      const [firstName = "", lastName = ""] = lowerName.split(" ");

      const character = originalCharacters.find((c) => {
        const users = Array.isArray(c.user) ? c.user : [c.user];
        return users.some((u) => u.toLowerCase() === displayName.toLowerCase());
      });

      // Skip guessed or filtered-out characters
      if (!character || character._guessed) continue;
      const opus = Array.isArray(character.opus) ? character.opus : [character.opus];
      if (!opus.some((op) => accepted.includes(op))) continue;

      // Priority: first name start → last name / contains
      if (firstName.startsWith(lowerVal)) {
        matches.unshift(displayName);
      } else if (lastName.startsWith(lowerVal) || lowerName.includes(lowerVal)) {
        matches.push(displayName);
      }
    }

    matches.forEach((nom) => {
      const imageName = portraitsMap[nom] || nom.split(" ")[0];
      const option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img src="../database/portraits/${encodeURIComponent(imageName)}.webp" alt="${nom}">
        <span class="codename">${nom}</span>
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
 * Ends the game and shows the result.
 * On win: triggers confetti, logs stats, checks Twin Blade and Crimson Legacy badges.
 * On force (Give Up): shows defeat message.
 *
 * @param {boolean} [force=false] - True when the player gives up
 * @param {string}  [name=null]   - The correctly guessed character name
 */
function showVictory(force = false, name = null) {
  gameOver = true;
  textbar.disabled = true;
  guessBtn.disabled = true;
  giveUpBtn.disabled = true;

  // Show portrait of the winning/revealed character
  if (name) {
    const portraitName = encodeURIComponent(portraitsMap[name] || name.split(" ")[0]);
    victoryImage.src = `../database/portraits/${portraitName}.webp`;
    victoryImage.alt = name;
  }

  if (!force && target) {
    // ── Badge: Twin Blade (Yosuke & Yusuke Personae) ──────────────────────
    const norm = (s) => s.toLowerCase().trim();
    const targetName = norm(target.persona);
    const yosukePersonas = ["jiraiya", "susano-o", "takehaya susano-o"];
    const yusukePersonas = ["goemon", "kamu susano-o", "gorokichi"];

    const profile = JSON.parse(localStorage.getItem("personaUserProfile")) || {};
    let profileUpdated = false;

    if (yosukePersonas.includes(targetName) && !profile.foundYosuke) {
      profile.foundYosuke = true;
      profileUpdated = true;
    }
    if (yusukePersonas.includes(targetName) && !profile.foundYusuke) {
      profile.foundYusuke = true;
      profileUpdated = true;
    }

    // ── Badge: Crimson Legacy (Picaro variants) ────────────────────────────
    if (target.persona.toLowerCase().includes("picaro")) {
      if (!profile.picarosFound) profile.picarosFound = [];
      if (!profile.picarosFound.includes(target.persona)) {
        profile.picarosFound.push(target.persona);
        profileUpdated = true;
        console.log(`💾 Picaros: ${profile.picarosFound.length}/12`);
      }
    }

    if (profileUpdated) {
      localStorage.setItem("personaUserProfile", JSON.stringify(profile));
    }
  }

  // ── Result display ────────────────────────────────────────────────────────
  if (force) {
    victoryText.innerHTML = `❌ Too bad!&nbsp;<span class="user-name">${target.user}</span>'s Persona was&nbsp;<span class="persona-name">${target.persona}</span>.`;
    victoryText.className = "victory-message failure-text";
  } else {
    victoryText.innerHTML = `✅ Good Guess!&nbsp;<span class="persona-name">${target.persona}</span>&nbsp;is the Persona of&nbsp;<span class="user-name">${name}</span>!`;
    victoryText.className = "victory-message success-text";
    showConfettiExplosion({ count: 30, spreadFrom: "bottom" });
  }

  victoryBox.style.display = "block";
  setTimeout(() => victoryBox.scrollIntoView({ behavior: "smooth", block: "center" }), 500);

  revealNextLink({
    prevHref: "../silhouetteMode/silhouette.html",
    nextHref: "../musicsMode/musics.html",
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (!localStorage.getItem(statsKey)) {
    updateProfileStats({
      result: force ? "giveup" : "win",
      mode: "Personae",
      timeSpent: Math.floor((Date.now() - sessionStartTime) / 1000),
    });
    localStorage.removeItem("playerProfile");
    localStorage.setItem(statsKey, "true");
  }

  localStorage.setItem("personaeGameOver", "true");
}

/**
 * Appends a wrong-guess portrait to the wrong-guesses list.
 * @param {string} name
 */
function showWrong(name) {
  const imageName = portraitsMap[name] || name.split(" ")[0];
  showWrongMini(
    `../database/portraits/${encodeURIComponent(imageName)}.webp`,
    name,
    wrongList
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates one guess:
 *  - Correct: calls showVictory()
 *  - Wrong: calls showWrong() and marks character as guessed in autocomplete
 */
function handleGuess() {
  if (gameOver) return;
  const guess = textbar.value.trim();
  if (!guess) return;

  attempts++;
  localStorage.setItem("personaeAttempts", attempts);
  giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;

  if (attempts >= maxAttempts) {
    giveUpBtn.disabled = false;
    giveUpCounter.classList.add("activated");
  }

  const users = Array.isArray(target.user) ? target.user : [target.user];
  const found = users.some((u) => u.toLowerCase() === guess.toLowerCase());

  if (found) {
    showVictory(false, guess);
  } else {
    showWrong(guess);
  }

  textbar.value = "";

  // Mark guessed character so it disappears from autocomplete
  const guessedChar = originalCharacters.find((c) => {
    const u = Array.isArray(c.user) ? c.user : [c.user];
    return u.some((u) => u.toLowerCase() === guess.toLowerCase());
  });
  if (guessedChar) guessedChar._guessed = true;
  textbar.dispatchEvent(new Event("input")); // refresh autocomplete
}

/**
 * Give Up: reveals the answer.
 * Only active after `maxAttempts` wrong guesses.
 */
function giveUp() {
  if (attempts < maxAttempts || gameOver) return;
  gameOver = true;

  if (!localStorage.getItem(statsKey)) {
    updateProfileStats({
      result: "giveup",
      mode: "Personae",
      timeSpent: Math.floor((Date.now() - sessionStartTime) / 1000),
    });
    localStorage.removeItem("playerProfile");
    localStorage.setItem(statsKey, "true");
  }

  localStorage.setItem("personaeGameOver", "true");
  localStorage.setItem("personaeForceReveal", "true");
  showVictory(true, Array.isArray(target.user) ? target.user[0] : target.user);
}

/**
 * Resets all game state and picks a new character.
 * Called by Replay button, daily reset, and filter changes.
 */
function resetGame() {
  sessionStartTime = Date.now();

  localStorage.removeItem("personaeTarget");
  localStorage.removeItem("personaeAttempts");
  localStorage.removeItem("personaeGameOver");
  localStorage.removeItem("personaeForceReveal");
  localStorage.removeItem(statsKey);

  const nav = document.getElementById("modeNavigationContainer");
  if (nav) nav.style.display = "none";

  gameOver = false;
  attempts = 0;
  giveUpCounter.textContent = `(0 / ${maxAttempts})`;
  giveUpCounter.classList.remove("activated");
  giveUpBtn.disabled = true;
  textbar.disabled = false;
  textbar.value = "";
  guessBtn.disabled = false;
  wrongList.innerHTML = "";

  victoryBox.style.display = "none";
  victoryText.innerHTML = "";
  victoryImage.src = "";

  originalCharacters.forEach((c) => { c._guessed = false; });

  // Restore stored target if available (avoids picking a new one on soft reset)
  const stored = localStorage.getItem("personaeTarget");
  if (stored) {
    try {
      target = JSON.parse(stored);
      personaImg.src = `./database/img/${target.image}.webp`;
      personaImg.alt = target.persona;
      return;
    } catch (e) {
      console.warn("⚠️ Error reloading stored target:", e);
    }
  }

  pickCharacter();
}


// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE (personae-specific element)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies inline dark-mode overrides to the persona image box.
 * Called once on load; the global CSS handles the rest of dark-mode styling.
 */
function applyDarkModeStyles() {
  if (!document.body.classList.contains("darkmode")) return;
  const zone = document.querySelector(".persona-box");
  if (zone) {
    zone.style.backgroundColor = "#222";
    zone.style.border = "3px solid #888";
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Assign DOM references
  textbar = document.getElementById("textbar");
  personaImg = document.getElementById("personaImage");
  guessBtn = document.getElementById("guessButton");
  resetBtn = document.getElementById("resetButton");
  giveUpBtn = document.getElementById("giveUpButton");
  giveUpCounter = document.getElementById("giveUpCounter");
  wrongList = document.getElementById("wrongGuessList");
  victoryBox = document.getElementById("victoryBox");
  victoryImage = document.getElementById("victoryImage");
  victoryText = document.getElementById("victoryText");

  setupRulesModal();
  applyDarkModeStyles();

  // ── Filtre opus — panneau déroulant ──
  const _filterApi = initFilterMenu("personaeActiveFilters", ALL_OPUS, (newActive) => {
    activeFilters = newActive;
    resetGame();
  });
  activeFilters = _filterApi.getActive();

  guessBtn.addEventListener("click", handleGuess);
  resetBtn.addEventListener("click", resetGame);
  giveUpBtn.addEventListener("click", giveUp);

  initializeAutocomplete(textbar, personas.sort((a, b) => a.localeCompare(b)));

  // ── Restore session ──
  const stored = localStorage.getItem("personaeTarget");
  const storedAttempts = parseInt(localStorage.getItem("personaeAttempts")) || 0;
  const storedGameOver = localStorage.getItem("personaeGameOver") === "true";

  if (stored) {
    try {
      target = JSON.parse(stored);
      filteredCharacters = getFilteredCharacters();
      attempts = storedAttempts;
      giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;
      personaImg.src = `./database/img/${target.image}.webp`;
      personaImg.alt = target.persona;

      if (attempts >= maxAttempts) {
        giveUpBtn.disabled = false;
        giveUpCounter.classList.add("activated");
      }

      if (storedGameOver) {
        const force = localStorage.getItem("personaeForceReveal") === "true";
        showVictory(force, force ? null : (Array.isArray(target.user) ? target.user[0] : target.user));
      }
    } catch (e) {
      resetGame();
    }
  } else {
    resetGame();
  }

  // ── Daily reset ──
  checkResetOnLoad("lastPlayedDate_Personae", "Personae", () => {
    resetBtn.click();
  });
  setupDailyReset(() => {
    resetBtn?.click() ?? location.reload();
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// DEBUG (console only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Console utility: verifies every name in persona.js has a matching entry in
 * personaeCharacters.js and a portrait in portraitsMapPersonae.js.
 * Logs missing entries to the console to help catch data inconsistencies early.
 *
 * Usage (browser console): import('/personaeMode/modePersonae.js').then(m => m.debugAllPersonae())
 */
export function debugAllPersonae() {
  console.log("=== DEBUG PERSONAE MODE ===");
  const errors = [];
  for (const name of personas.sort()) {
    const match = originalCharacters.find((c) => {
      const u = Array.isArray(c.user) ? c.user : [c.user];
      return u.some((u) => u === name);
    });
    if (!match) { errors.push(`❌ ${name} — Absent dans personaeCharacters.js`); continue; }
    if (!portraitsMap[name]) errors.push(`❌ ${name} — Manque dans portraitsMapPersonae.js`);
    else console.log(`✅ OK: ${name}`);
  }
  if (errors.length) console.log(errors.join("\n"));
  else console.log("🎉 No errors!");
  console.log("=== END DEBUG ===");
}
// Auto-run in dev to catch data issues
debugAllPersonae();
