/**
 * modeMusic.js — Music mode (Personadle).
 *
 * The player listens to a short audio clip and must identify the Persona song.
 * Up to 3 wrong guesses are allowed; after that the "Give Up" button unlocks.
 *
 * Shared utilities are imported from js/gameCore.js.
 * This file contains only Music-specific logic.
 */

// === IMPORTS ===
import { songs as originalSongs } from "./database/songs.js";
import { musicTitles }            from "./database/musicTitles.js";
import { updateProfileStats }     from "../profile/profileStats.js";

import {
  normalize,
  showConfettiExplosion,
  revealNextLink,
  setupRulesModal,
  setupDailyReset,
  checkResetOnLoad,
} from "../js/gameCore.js";


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps each top-level opus filter key to the actual game IDs it covers.
 * Must stay in sync with the filter buttons in musics.html.
 */
const validOpus = {
  P1:  ["P1"],
  P2:  ["P2IS", "P2EP"],
  P3:  ["P3", "P3P", "P3FES", "P3R"],
  P4:  ["P4", "P4G", "P4AU", "P4D"],
  P5:  ["P5", "P5R", "P5S", "P5T"],
  P5X: ["P5X"],
  PQ:  ["PQ", "PQ2"],
};

/** Maximum number of guesses before the "Give Up" button is enabled. */
const MAX_ATTEMPTS = 3;

/** Confetti emojis used in Music mode victory celebration. */
const MUSIC_EMOJIS = ["🎵", "🎶", "🎉", "✨"];


// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

/** Currently active opus filters (persisted to localStorage). */
let activeFilters = ["P3", "P4", "P5", "P5X"];

/** Filtered song pool based on activeFilters. */
let filteredSongs = [];

/** The song to guess for this session. */
let target = null;

/** Number of guesses made so far. */
let attempts = 0;

/** Whether the game is over (win or give-up). */
let gameOver = false;

/** Timestamp when the game session started (for stats). */
let sessionStartTime = Date.now();

/**
 * localStorage key used to prevent double-logging stats for the same day.
 * Rebuilt each session so it always uses today's date.
 */
let todayKey = `statsLogged_Music_${new Date().toISOString().split("T")[0]}`;

/** Rolling list of the last 5 target song titles (anti-repeat guard). */
let lastFiveTargets = [];

/** Titles already guessed in this session (hidden from autocomplete). */
let triedTitles = [];


// ─────────────────────────────────────────────────────────────────────────────
// DOM REFERENCES (assigned in DOMContentLoaded)
// ─────────────────────────────────────────────────────────────────────────────

let audioBox, audioPlayer, textbar, guessBtn, resetBtn, giveUpBtn;
let giveUpCounter, wrongList, victoryBox, victoryImage, victoryText;


// ─────────────────────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {

  // ── DOM element references ─────────────────────────────────────────────────
  textbar      = document.getElementById("textbar");
  audioBox     = document.getElementById("audioBox");
  audioPlayer  = document.getElementById("audioPlayer");
  guessBtn     = document.getElementById("guessButton");
  resetBtn     = document.getElementById("resetButton");
  giveUpBtn    = document.getElementById("giveUpButton");
  giveUpCounter = document.getElementById("giveUpCounter");
  wrongList    = document.getElementById("wrongGuessList");
  victoryBox   = document.getElementById("victoryBox");
  victoryImage = document.getElementById("victoryImage");
  victoryText  = document.getElementById("victoryText");

  // ── Restore opus filters from localStorage ─────────────────────────────────
  const storedFilters = localStorage.getItem("musicActiveFilters");
  if (storedFilters) {
    try {
      const parsed = JSON.parse(storedFilters);
      if (Array.isArray(parsed)) activeFilters = parsed;
    } catch (e) {
      console.warn("⚠️ Could not parse stored Music filters:", e);
    }
  }

  // ── Restore session state ──────────────────────────────────────────────────
  const savedTarget     = localStorage.getItem("musicTarget");
  const savedAttempts   = localStorage.getItem("musicAttempts");
  const savedGameOver   = localStorage.getItem("musicGameOver");
  const savedTried      = localStorage.getItem("musicTriedTitles");
  const savedForceReveal = localStorage.getItem("musicForceReveal");

  if (savedTarget) {
    // Resume an in-progress or finished game
    target     = JSON.parse(savedTarget);
    attempts   = savedAttempts   ? parseInt(savedAttempts, 10) : 0;
    triedTitles = savedTried     ? JSON.parse(savedTried)      : [];
    gameOver   = savedGameOver === "true";

    audioPlayer.src = `./database/music/song/${target.fichier}`;
    audioPlayer.load();

    giveUpCounter.textContent = `(${attempts} / ${MAX_ATTEMPTS})`;
    if (attempts >= MAX_ATTEMPTS) {
      giveUpBtn.disabled = false;
      giveUpCounter.classList.add("activated");
    }

    if (gameOver || savedForceReveal === "true") {
      showVictory(savedForceReveal === "true");
    }
  } else {
    resetGame();
  }

  // ── UI wiring ──────────────────────────────────────────────────────────────
  setupFilterButtons();
  applyDarkModeStyles();
  setupRulesModal();                          // ← shared utility

  guessBtn.addEventListener("click", handleGuess);
  resetBtn.addEventListener("click", resetGame);
  giveUpBtn.addEventListener("click", giveUp);

  initializeAutocomplete(textbar);

  // ── Daily reset checks ─────────────────────────────────────────────────────
  checkResetOnLoad(                           // ← shared utility
    "lastPlayedDate_Music",
    "Music",
    () => resetBtn.click()
  );

  setupDailyReset(() => {                     // ← shared utility
    console.log("🔄 Auto-reset triggered at Paris midnight (Music)");
    resetBtn ? resetBtn.click() : location.reload();
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// SONG POOL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns songs whose opus belongs to at least one of the active filters.
 *
 * @returns {Object[]} Filtered array of song objects
 */
function getFilteredSongs() {
  const accepted = activeFilters.flatMap(o => validOpus[o]);
  return originalSongs.filter(song => {
    const ops = Array.isArray(song.opus) ? song.opus : [song.opus];
    return ops.some(op => accepted.includes(op));
  });
}

/**
 * Picks a random song from the filtered pool, avoiding the last 5 targets.
 * Saves the new target and resets the audio player.
 */
function pickSong() {
  filteredSongs = getFilteredSongs();

  // Avoid repeating the last 5 played songs
  const pool    = filteredSongs.filter(s => !lastFiveTargets.includes(s.titre));
  const choices = pool.length > 0 ? pool : [...filteredSongs];

  target = choices[Math.floor(Math.random() * choices.length)];

  lastFiveTargets.push(target.titre);
  if (lastFiveTargets.length > 5) lastFiveTargets.shift();

  audioPlayer.src = `./database/music/song/${target.fichier}`;
  audioPlayer.load();

  localStorage.setItem("musicTarget",   JSON.stringify(target));
  localStorage.setItem("musicAttempts", attempts);
  localStorage.setItem("musicGameOver", "false");
}


// ─────────────────────────────────────────────────────────────────────────────
// VICTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ends the game, logs stats, checks badges, and shows the victory/reveal box.
 *
 * @param {boolean} [force=false] - true if triggered by "Give Up"
 */
function showVictory(force = false) {
  gameOver = true;

  // ── Badge logic ────────────────────────────────────────────────────────────
  let profile    = JSON.parse(localStorage.getItem("personaUserProfile")) || {};
  let hasChanges = false;

  const currentTitle = target ? normalize(target.titre) : "";

  // 💀 UNSOLVED CASE — Give Up on "Never More" (P4 final boss theme)
  if (force && currentTitle === normalize("Never More")) {
    if (!profile.lostToNeverMore) {
      profile.lostToNeverMore = true;
      hasChanges = true;
      console.log("🌫️ Badge Trigger: The fog remains... (Adachi wins)");
    }
  }

  // 🔥 MEMENTO MORI — Find "Burn My Dread" (P3 title theme)
  if (!force && currentTitle === normalize("Burn My Dread")) {
    if (!profile.foundBurnMyDread) {
      profile.foundBurnMyDread = true;
      hasChanges = true;
      console.log("🔥 Badge Trigger: Burn My Dread found!");
    }
  }

  // 🌙 HIPPOCAMPUS RELOAD — Find the ZUTOMAYO collab track
  if (!force && currentTitle.includes("zutomayo")) {
    if (!profile.foundZutomayo) {
      profile.foundZutomayo = true;
      hasChanges = true;
      console.log("🌙 Badge Trigger: Zutomayo found!");
    }
  }

  if (hasChanges) {
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));
  }

  // ── Stats logging (once per day) ───────────────────────────────────────────
  if (!localStorage.getItem(todayKey)) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({
      result:    force ? "giveup" : "win",
      mode:      "Music",
      timeSpent,
    });
    localStorage.setItem(todayKey, "1");
  }

  // ── Dynamic badge check ────────────────────────────────────────────────────
  import("../profile/badges/badgesManager.js")
    .then(module => {
      const currentProfile = JSON.parse(localStorage.getItem("personaUserProfile"));
      module.checkBadges(currentProfile, updatedProfile => {
        localStorage.setItem("personaUserProfile", JSON.stringify(updatedProfile));
      });
    })
    .catch(err => console.error("⚠️ Could not load badgesManager:", err));

  // ── UI ─────────────────────────────────────────────────────────────────────
  textbar.disabled  = true;
  guessBtn.disabled = true;
  giveUpBtn.disabled = true;

  victoryImage.src = `./database/img/${target.image}`;
  victoryImage.alt = target.titre;

  const vocal    = target.vocalist?.trim();
  const vocalLine = vocal ? `<br>🧑‍🎤 Vocal: <strong>${vocal}</strong>` : "";
  const linkLine  = target.lien
    ? `<br>🔗 <a href="${target.lien}" target="_blank" class="victory-link">Listen here</a>`
    : "";

  victoryText.innerHTML = force
    ? `💡 It was: <strong>${target.titre}</strong>${vocalLine}${linkLine}`
    : `🎉 Correct! It was: <strong>${target.titre}</strong>${vocalLine}${linkLine}`;

  victoryBox.style.display = "block";

  setTimeout(() => {
    victoryBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 500);

  // Confetti only on a win (not give-up)
  if (!force) {
    showConfettiExplosion({                   // ← shared utility
      emojiList:  MUSIC_EMOJIS,
      count:      30,
      spreadFrom: "bottom",
    });
  }

  localStorage.setItem("musicGameOver", "true");

  revealNextLink({ prevHref: "../personaeMode/personae.html" }); // ← shared utility
}


// ─────────────────────────────────────────────────────────────────────────────
// WRONG GUESS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows a wrong-guess card below the input with the album art and song title.
 * Music mode shows the full title (not just a portrait), so this is kept local
 * rather than using the shared showWrongMini helper.
 *
 * @param {string} name - The song title that was guessed
 */
function showWrong(name) {
  const match = originalSongs.find(
    song => song.titre.toLowerCase() === name.toLowerCase()
  );

  const div = document.createElement("div");
  div.className = "wrong-mini";

  if (match) {
    div.innerHTML = `
      <img src="./database/img/${match.image}" alt="${name}" class="wrong-img">
      <span class="wrong-name">${name}</span>
    `;
  } else {
    div.textContent = name;
  }

  wrongList.appendChild(div);
  setTimeout(() => div.classList.add("shake"), 50);
}


// ─────────────────────────────────────────────────────────────────────────────
// GAME LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles a guess submission.
 * Increments the attempt counter, compares the guess to the target,
 * and shows a win or wrong-answer card.
 */
function handleGuess() {
  if (gameOver) return;

  const guess = textbar.value.trim();
  if (!guess) return;

  if (!triedTitles.includes(guess)) triedTitles.push(guess);

  attempts++;
  localStorage.setItem("musicAttempts",    attempts);
  localStorage.setItem("musicTriedTitles", JSON.stringify(triedTitles));

  giveUpCounter.textContent = `(${attempts} / ${MAX_ATTEMPTS})`;

  if (attempts >= MAX_ATTEMPTS) {
    giveUpBtn.disabled = false;
    giveUpCounter.classList.add("activated");
  }

  if (normalize(guess) === normalize(target.titre)) {
    showVictory(false);
  } else {
    showWrong(guess);
  }

  textbar.value = "";
}

/**
 * Triggered when the player clicks "Give Up".
 * Only allowed after MAX_ATTEMPTS wrong guesses.
 */
function giveUp() {
  if (attempts < MAX_ATTEMPTS || gameOver) return;

  gameOver = true;
  localStorage.setItem("musicForceReveal", "true");

  // Log stats if not already done
  if (!localStorage.getItem(todayKey)) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({ result: "giveup", mode: "Music", timeSpent });
    localStorage.setItem(todayKey, "1");
  }

  showVictory(true);
}

/**
 * Resets all state and starts a new round.
 * Called on page load (no saved target), by filter changes, and by daily reset.
 */
function resetGame() {
  // Clear all Music-mode localStorage keys
  localStorage.removeItem("musicTarget");
  localStorage.removeItem("musicAttempts");
  localStorage.removeItem("musicGameOver");
  localStorage.removeItem("musicTriedTitles");
  localStorage.removeItem("musicForceReveal");
  localStorage.removeItem(todayKey);

  // Rebuild todayKey for the new session (in case day changed)
  todayKey = `statsLogged_Music_${new Date().toISOString().split("T")[0]}`;

  // Reset in-memory state
  gameOver          = false;
  attempts          = 0;
  triedTitles       = [];
  sessionStartTime  = Date.now();

  // Reset UI
  giveUpCounter.textContent = `(0 / ${MAX_ATTEMPTS})`;
  giveUpCounter.classList.remove("activated");
  giveUpBtn.disabled  = true;
  textbar.disabled    = false;
  guessBtn.disabled   = false;
  wrongList.innerHTML = "";
  textbar.value       = "";
  victoryBox.style.display = "none";
  victoryText.innerHTML    = "";
  victoryImage.src         = "";

  // Hide the between-modes navigation bar
  const navContainer = document.getElementById("modeNavigationContainer");
  if (navContainer) navContainer.style.display = "none";

  pickSong();
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires the song-title autocomplete dropdown to the given text input.
 *
 * Specific to Music mode because:
 *  - It filters by `triedTitles` (already guessed) and active opus filters
 *  - It renders album-art thumbnails instead of character portraits
 *  - Clicking an option auto-submits the guess
 *
 * @param {HTMLInputElement} input - The search/guess text input
 */
function initializeAutocomplete(input) {
  let currentFocus = -1;

  input.addEventListener("input", function () {
    closeList();
    const val = this.value.trim();
    if (!val) return;

    // Build dropdown container
    const list = document.createElement("DIV");
    list.id        = "autocomplete-list";
    list.className = "autocomplete-items";
    this.parentNode.appendChild(list);

    const lowerVal    = val.toLowerCase();
    const acceptedOpus = activeFilters.flatMap(o => validOpus[o]);

    // Filter songs by: partial title match, not already tried, active opus
    const matches = originalSongs
      .filter(song => {
        const songOpus = Array.isArray(song.opus) ? song.opus : [song.opus];
        return (
          song.titre.toLowerCase().includes(lowerVal) &&
          !triedTitles.includes(song.titre) &&
          songOpus.some(op => acceptedOpus.includes(op))
        );
      })
      .map(song => song.titre);

    // Render one dropdown row per match (album thumbnail + title)
    matches.forEach(nom => {
      const songData  = originalSongs.find(s => s.titre === nom);
      const imagePath = songData ? `./database/img/${songData.image}` : "";

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img src="${imagePath}" alt="${nom}" class="autocomplete-thumb">
        <span class="codename">${nom}</span>
        <input type="hidden" value="${nom.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}">
      `;

      // Clicking an option fills the input and immediately submits the guess
      option.addEventListener("click", function () {
        input.value = this.querySelector("input").value;
        handleGuess();
        closeList();
      });

      list.appendChild(option);
    });

    currentFocus = -1;
  });

  // Keyboard navigation: ↑ ↓ to move, Enter to confirm
  input.addEventListener("keydown", function (e) {
    const items = document.querySelectorAll("#autocomplete-list .list-options");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      currentFocus++;
      updateActive(items);
    } else if (e.key === "ArrowUp") {
      currentFocus--;
      updateActive(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentFocus > -1) items[currentFocus].click();
      else items[0]?.click();
    }
  });

  // Close the list when clicking outside of it
  document.addEventListener("click", function (e) {
    if (!e.target.closest("#autocomplete-list") && e.target !== input) {
      closeList();
    }
  });

  /** Highlights the item at `currentFocus` and clears others. */
  function updateActive(items) {
    items.forEach(i => i.classList.remove("autocomplete-active"));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0)            currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /** Removes all open autocomplete dropdowns from the DOM. */
  function closeList() {
    document.querySelectorAll(".autocomplete-items").forEach(el => el.remove());
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// FILTER BUTTONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires the opus filter buttons and syncs their visual state with `activeFilters`.
 *
 * NOTE: Music mode keeps its own filter setup (not the shared utility) because
 * it mutates `activeFilters` directly (push/filter pattern) rather than
 * rebuilding the array from DOM state. This matches Silhouette's approach.
 */
function setupFilterButtons() {
  const btns = document.querySelectorAll(".filter-btn");

  btns.forEach(btn => {
    const val = btn.dataset.opus;

    // Sync visual state with restored filters
    if (activeFilters.includes(val)) btn.classList.add("active");
    else btn.classList.remove("active");

    btn.addEventListener("click", () => {
      btn.classList.toggle("active");

      if (btn.classList.contains("active")) {
        if (!activeFilters.includes(val)) activeFilters.push(val);
      } else {
        activeFilters = activeFilters.filter(o => o !== val);
      }

      localStorage.setItem("musicActiveFilters", JSON.stringify(activeFilters));
      resetGame();
    });
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies extra dark-mode styling to the audio player box.
 * Called once on load; the global CSS handles everything else.
 */
function applyDarkModeStyles() {
  if (!document.body.classList.contains("darkmode")) return;
  if (audioBox) {
    audioBox.style.backgroundColor = "#222";
    audioBox.style.border = "3px solid #888";
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// DEBUG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Console utility: logs every title in musicTitles.js and flags any that
 * are missing from songs.js. Useful for catching data inconsistencies.
 *
 * Usage (browser console): import('/musicsMode/modeMusic.js').then(m => m.debugAllMusic())
 */
export function debugAllMusic() {
  console.log("=== DEBUG MUSIC MODE ===");
  const errors = [];
  for (const name of [...musicTitles].sort()) {
    const match = originalSongs.find(s => s.titre === name);
    if (!match) errors.push(`❌ ${name} — missing from songs.js`);
    else        console.log(`✅ OK: ${name}`);
  }
  if (errors.length) console.log(errors.join("\n"));
  else               console.log("🎉 No missing titles!");
}
debugAllMusic();
