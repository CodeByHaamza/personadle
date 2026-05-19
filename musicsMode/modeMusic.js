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
import { musicTitles } from "./database/musicTitles.js";
import { updateProfileStats } from "../profile/profileStats.js";

import {
  normalize,
  showConfettiExplosion,
  revealNextLink,
  setupRulesModal,
  setupDailyReset,
  checkResetOnLoad,
  buildGameSession,
  savePendingSession,
  getDailyTarget,
  showChallengeButton,
  showCommunityStats,
} from "../js/gameCore.js";

// Collapsible opus filter panel (shared across all modes)
import { initFilterMenu } from "../js/filterMenu.js";
import { checkChallengeCompletion } from "../js/challenge-result.js";
import { trackUniqueDay, checkBadgesAfterGame } from "../profile/badges/badgesManager.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** All specific opus codes available in Music mode. */
const ALL_OPUS = [
  "P1",
  "P2IS",
  "P2EP",
  "P3",
  "P3FES",
  "P3P",
  "P3R",
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

/**
 * Color themes per Persona series.
 * Each entry defines accent colors and glow rgba template ('{a}' = alpha).
 * Applied to the audio player via CSS custom properties.
 */
const OPUS_THEMES = {
  P1: { accent: "#7c3aed", dark: "#5b21b6", light: "#a78bfa", glow: "rgba(124,58,237,{a})" },
  P2IS: { accent: "#ea580c", dark: "#c2410c", light: "#fb923c", glow: "rgba(234,88,12,{a})" },
  P2EP: { accent: "#8b5cf6", dark: "#7c3aed", light: "#c4b5fd", glow: "rgba(139,92,246,{a})" },
  P3: { accent: "#3b82f6", dark: "#1d4ed8", light: "#93c5fd", glow: "rgba(59,130,246,{a})" },
  P3FES: { accent: "#3b82f6", dark: "#1d4ed8", light: "#93c5fd", glow: "rgba(59,130,246,{a})" },
  // P3P — Makoto (bleu) + Kotone (rose) : bordure et bouton indigo, barre dégradée bleu→rose
  P3P: {
    accent: "#818cf8",
    dark: "#3b82f6",
    light: "#f9a8d4",
    glow: "rgba(129,140,248,{a})",
    gradientFill: "linear-gradient(90deg, #1d4ed8, #3b82f6 30%, #c084fc 65%, #ec4899)",
  },
  P3R: { accent: "#3b82f6", dark: "#1d4ed8", light: "#93c5fd", glow: "rgba(59,130,246,{a})" },
  P4: { accent: "#eab308", dark: "#a16207", light: "#fde047", glow: "rgba(234,179,8,{a})" },
  P4G: { accent: "#eab308", dark: "#a16207", light: "#fde047", glow: "rgba(234,179,8,{a})" },
  P4AU: { accent: "#eab308", dark: "#a16207", light: "#fde047", glow: "rgba(234,179,8,{a})" },
  P4D: { accent: "#eab308", dark: "#a16207", light: "#fde047", glow: "rgba(234,179,8,{a})" },
  P5: { accent: "#e63946", dark: "#c1121f", light: "#ff8fa3", glow: "rgba(230,57,70,{a})" },
  P5R: { accent: "#e63946", dark: "#c1121f", light: "#ff8fa3", glow: "rgba(230,57,70,{a})" },
  P5S: { accent: "#e63946", dark: "#c1121f", light: "#ff8fa3", glow: "rgba(230,57,70,{a})" },
  P5T: { accent: "#e63946", dark: "#c1121f", light: "#ff8fa3", glow: "rgba(230,57,70,{a})" },
  // P5X (The Phantom X) — bordeaux/cramoisi, rouge sombre distinct du rouge vif P5
  P5X: { accent: "#c0193a", dark: "#5c0f1f", light: "#e63946", glow: "rgba(192,25,58,{a})" },
  PQ: { accent: "#f97316", dark: "#ea580c", light: "#fdba74", glow: "rgba(249,115,22,{a})" },
  PQ2: { accent: "#f97316", dark: "#ea580c", light: "#fdba74", glow: "rgba(249,115,22,{a})" },
};

/** Maximum number of guesses before the "Give Up" button is enabled. */
const MAX_ATTEMPTS = 3;

/** Confetti emojis used in Music mode victory celebration. */
const MUSIC_EMOJIS = ["🎵", "🎶", "🎉", "✨"];

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

/** Currently active opus filters (persisted to localStorage). */
let activeFilters = [...ALL_OPUS];

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

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__i18nReady) await window.__i18nReady;

  // ── DOM element references ─────────────────────────────────────────────────
  textbar = document.getElementById("textbar");
  audioBox = document.getElementById("audioBox");
  audioPlayer = document.getElementById("audioPlayer");
  guessBtn = document.getElementById("guessButton");
  resetBtn = document.getElementById("resetButton");
  giveUpBtn = document.getElementById("giveUpButton");
  giveUpCounter = document.getElementById("giveUpCounter");
  wrongList = document.getElementById("wrongGuessList");
  victoryBox = document.getElementById("victoryBox");
  victoryImage = document.getElementById("victoryImage");
  victoryText = document.getElementById("victoryText");

  // ── Restore session state ──────────────────────────────────────────────────
  const savedTarget = localStorage.getItem("musicTarget");
  const savedAttempts = localStorage.getItem("musicAttempts");
  const savedGameOver = localStorage.getItem("musicGameOver");
  const savedTried = localStorage.getItem("musicTriedTitles");
  const savedForceReveal = localStorage.getItem("musicForceReveal");

  if (savedTarget) {
    // Resume an in-progress or finished game
    target = JSON.parse(savedTarget);
    attempts = savedAttempts ? parseInt(savedAttempts, 10) : 0;
    triedTitles = savedTried ? JSON.parse(savedTried) : [];
    gameOver = savedGameOver === "true";

    audioPlayer.src = `./database/music/song/${target.fichier}`;
    audioPlayer.load();

    setPlayerTheme(target.opus);

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

  // ── Filtre opus — panneau déroulant ──
  const _filterApi = initFilterMenu("musicActiveFilters", ALL_OPUS, (newActive) => {
    activeFilters = newActive;
    if (newActive.length === 0) return;
    resetGame(true);
  });
  activeFilters = _filterApi.getActive();

  // ── UI wiring ──────────────────────────────────────────────────────────────
  applyDarkModeStyles();
  initCustomPlayer();
  setupRulesModal(); // ← shared utility

  guessBtn.addEventListener("click", handleGuess);
  resetBtn.addEventListener("click", () => resetGame(true));
  giveUpBtn.addEventListener("click", giveUp);

  initializeAutocomplete(textbar);

  // ── Daily reset checks ─────────────────────────────────────────────────────
  checkResetOnLoad(
    // ← shared utility
    "lastPlayedDate_Music",
    "Music",
    () => resetBtn.click()
  );

  setupDailyReset(() => {
    // ← shared utility
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
  return originalSongs.filter((song) => {
    const ops = Array.isArray(song.opus) ? song.opus : [song.opus];
    return ops.some((op) => activeFilters.includes(op));
  });
}

/**
 * Picks the daily song target and resets the audio player.
 * Uses seeded RNG from the full song pool so all players get the same song
 * today regardless of their opus filter settings.
 */
function pickSong(random = false) {
  filteredSongs = getFilteredSongs();

  if (random && filteredSongs.length) {
    const _prev = target;
    const _candidates =
      filteredSongs.length > 1 && _prev
        ? filteredSongs.filter((s) => s.titre !== _prev?.titre)
        : filteredSongs;
    target = _candidates[Math.floor(Math.random() * _candidates.length)] || filteredSongs[0];
  } else {
    target = getDailyTarget(originalSongs, "Music");
  }

  audioPlayer.src = `./database/music/song/${target.fichier}`;
  audioPlayer.load();

  localStorage.setItem("musicTarget", JSON.stringify(target));
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
  let profile = JSON.parse(localStorage.getItem("personaUserProfile")) || {};
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

  // 🌊 OUR LIGHT — Give up on the P3R ending theme
  const titleRaw = (target?.titre || "").toLowerCase();
  if (force && titleRaw.includes("our light") && !profile.gaveUpOnOurLight) {
    profile.gaveUpOnOurLight = true;
    hasChanges = true;
    console.log("🌊 Badge Trigger: Our Light — gave up");
  }

  // 🏠 SECRET BASE — Find the P4 Dojima/Nanako theme
  if (!force && titleRaw.includes("secret base") && !profile.foundSecretBase) {
    profile.foundSecretBase = true;
    hasChanges = true;
    console.log("🏠 Badge Trigger: Secret Base found!");
  }

  // 🎬 WHEN MOTHER WAS THERE — Find "Kimi no Kioku" / "Memories of You"
  if (
    !force &&
    (titleRaw.includes("when mother was there") ||
      titleRaw.includes("kimi no kioku") ||
      titleRaw.includes("memories of you")) &&
    !profile.foundWhenMotherWasThere
  ) {
    profile.foundWhenMotherWasThere = true;
    hasChanges = true;
    console.log("🎬 Badge Trigger: When Mother Was There found!");
  }

  // 🎯 ONE SHOT — first-try win
  if (!force && attempts === 0 && !profile.hasWonFirstTry) {
    profile.hasWonFirstTry = true;
    hasChanges = true;
  }

  // 🌙 NIGHT OWL / NYX HOUR flags (shared with other modes)
  const nowHour = new Date().getHours();
  if (nowHour >= 23 || nowHour < 1) {
    if (!profile.playedAtNight) {
      profile.playedAtNight = true;
      hasChanges = true;
    }
  }
  if (nowHour === 0) {
    if (!profile.playedAtNyxHour) {
      profile.playedAtNyxHour = true;
      hasChanges = true;
    }
  }

  // 🎭 SHAPESHIFTER — track character-per-mode (music targets may have a character field)
  if (target?.character) {
    const cmap = JSON.parse(localStorage.getItem("characterModeMap") || "{}");
    const char = target.character;
    if (!cmap[char]) cmap[char] = [];
    if (!cmap[char].includes("music")) cmap[char].push("music");
    localStorage.setItem("characterModeMap", JSON.stringify(cmap));
  }

  trackUniqueDay(profile, () =>
    localStorage.setItem("personaUserProfile", JSON.stringify(profile))
  );

  if (hasChanges) {
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));
  }

  // ── Stats logging (once per day) ───────────────────────────────────────────
  if (!localStorage.getItem(todayKey)) {
    const result = force ? "giveup" : "win";
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({ result, mode: "Music", timeSpent });
    savePendingSession(
      buildGameSession({
        mode: "Music",
        targetName: target.titre,
        result,
        attempts,
        timeMs: timeSpent * 1000,
      })
    );
    localStorage.setItem(todayKey, "1");
  }

  checkBadgesAfterGame();

  // ── UI ─────────────────────────────────────────────────────────────────────
  textbar.disabled = true;
  guessBtn.disabled = true;
  giveUpBtn.disabled = true;

  victoryImage.src = `./database/img/${target.image}`;
  victoryImage.alt = target.titre;

  const i18n = window.i18n || { t: (k) => k };
  const vocal = target.vocalist?.trim();
  const vocalLine = vocal ? `<br>${i18n.t("modes.music.vocal_label", { name: vocal })}` : "";
  const linkLine = target.lien
    ? `<br><a href="${target.lien}" target="_blank" class="victory-link">${i18n.t("modes.music.listen_link")}</a>`
    : "";

  victoryText.innerHTML = force
    ? `${i18n.t("modes.music.giveup_reveal", { title: target.titre })}${vocalLine}${linkLine}`
    : `${i18n.t("modes.music.correct", { title: target.titre })}${vocalLine}${linkLine}`;

  victoryBox.style.display = "block";

  setTimeout(() => {
    victoryBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 500);

  // Confetti only on a win (not give-up)
  if (!force) {
    showConfettiExplosion({
      // ← shared utility
      emojiList: MUSIC_EMOJIS,
      count: 30,
      spreadFrom: "bottom",
    });
    showChallengeButton("music", attempts);
  }
  checkChallengeCompletion("music", attempts, !force);
  showCommunityStats("music", target.titre);

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
  const match = originalSongs.find((song) => song.titre.toLowerCase() === name.toLowerCase());

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
  localStorage.setItem("musicAttempts", attempts);
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
    savePendingSession(
      buildGameSession({
        mode: "Music",
        targetName: target.titre,
        result: "giveup",
        attempts,
        timeMs: timeSpent * 1000,
      })
    );
    localStorage.setItem(todayKey, "1");
  }

  showVictory(true);
}

/**
 * Resets all state and starts a new round.
 * Called on page load (no saved target), by filter changes, and by daily reset.
 */
function resetGame(random = false) {
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
  gameOver = false;
  attempts = 0;
  triedTitles = [];
  sessionStartTime = Date.now();

  // Reset UI
  giveUpCounter.textContent = `(0 / ${MAX_ATTEMPTS})`;
  giveUpCounter.classList.remove("activated");
  giveUpBtn.disabled = true;
  textbar.disabled = false;
  guessBtn.disabled = false;
  wrongList.innerHTML = "";
  textbar.value = "";
  victoryBox.style.display = "none";
  victoryText.innerHTML = "";
  victoryImage.src = "";

  // Hide the between-modes navigation bar
  const navContainer = document.getElementById("modeNavigationContainer");
  if (navContainer) navContainer.style.display = "none";

  resetPlayerVisuals();
  pickSong(random);
  if (target) setPlayerTheme(target.opus);
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
    list.id = "autocomplete-list";
    list.className = "autocomplete-items";
    this.parentNode.appendChild(list);

    const lowerVal = val.toLowerCase();
    const acceptedOpus = activeFilters;

    // Filter songs by: partial title match, not already tried, active opus
    const matches = originalSongs
      .filter((song) => {
        const songOpus = Array.isArray(song.opus) ? song.opus : [song.opus];
        return (
          song.titre.toLowerCase().includes(lowerVal) &&
          !triedTitles.includes(song.titre) &&
          songOpus.some((op) => acceptedOpus.includes(op))
        );
      })
      .map((song) => song.titre);

    // Render one dropdown row per match (album thumbnail + title)
    matches.forEach((nom) => {
      const songData = originalSongs.find((s) => s.titre === nom);
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
    items.forEach((i) => i.classList.remove("autocomplete-active"));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /** Removes all open autocomplete dropdowns from the DOM. */
  function closeList() {
    document.querySelectorAll(".autocomplete-items").forEach((el) => el.remove());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM AUDIO PLAYER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies the color theme matching the song's opus to the audio player
 * via CSS custom properties on the #audioBox element.
 *
 * In dark mode the CSS overrides these properties with cyan — no action needed.
 *
 * @param {string|string[]} opusArray - opus code(s) from the song object
 */
function setPlayerTheme(opusArray) {
  if (!audioBox) return;
  const ops = Array.isArray(opusArray) ? opusArray : [opusArray];
  const theme = ops.map((op) => OPUS_THEMES[op]).find(Boolean) || OPUS_THEMES.P5;
  const g = (a) => theme.glow.replace("{a}", a);

  audioBox.style.setProperty("--player-accent", theme.accent);
  audioBox.style.setProperty("--player-accent-dark", theme.dark);
  audioBox.style.setProperty("--player-accent-light", theme.light);
  audioBox.style.setProperty("--player-glow", g("0.35"));
  audioBox.style.setProperty("--player-glow-strong", g("0.55"));
  audioBox.style.setProperty("--player-glow-subtle", g("0.04"));
  audioBox.style.setProperty("--player-btn-glow", g("0.70"));
  audioBox.style.setProperty("--player-btn-glow-strong", g("0.90"));
  audioBox.style.setProperty("--player-btn-glow-max", g("1.00"));

  // Dégradé custom pour la barre (ex: P3P bleu→rose) — sinon dégradé mono-couleur standard
  const fillGradient =
    theme.gradientFill ??
    `linear-gradient(90deg, var(--player-accent-dark), var(--player-accent) 70%, var(--player-accent-light))`;
  audioBox.style.setProperty("--player-fill-gradient", fillGradient);
}

/**
 * Resets the audio player visual state to its initial position.
 * Called by resetGame() so the bar starts at 0 on a new round.
 */
function resetPlayerVisuals() {
  const progressFill = document.getElementById("p5ProgressFill");
  const curTimeEl = document.getElementById("p5CurrentTime");
  const durEl = document.getElementById("p5Duration");
  const soundBars = document.getElementById("p5SoundBars");
  const playIcon = document.getElementById("p5PlayIcon");
  const playBtn = document.getElementById("p5PlayBtn");

  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }
  if (progressFill) progressFill.style.width = "0%";
  if (curTimeEl) curTimeEl.textContent = "0:00";
  if (durEl) durEl.textContent = "--:--";
  if (soundBars) soundBars.classList.remove("playing");
  if (playIcon) playIcon.textContent = "▶";
  if (playBtn) {
    playBtn.classList.remove("playing");
    playBtn.classList.add("idle");
  }
}

/**
 * Wires up the custom Persona-5-themed audio player controls.
 * Works on top of the native <audio id="audioPlayer"> element.
 */
function initCustomPlayer() {
  const playBtn = document.getElementById("p5PlayBtn");
  const playIcon = document.getElementById("p5PlayIcon");
  const progressEl = document.getElementById("p5Progress");
  const progressFill = document.getElementById("p5ProgressFill");
  const soundBars = document.getElementById("p5SoundBars");
  const curTimeEl = document.getElementById("p5CurrentTime");
  const durEl = document.getElementById("p5Duration");

  if (!playBtn || !audioPlayer) return;

  // Format seconds → "m:ss"
  function fmt(s) {
    if (!isFinite(s) || isNaN(s)) return "--:--";
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${sec}`;
  }

  // Pulse animation on idle button, remove when playing
  playBtn.classList.add("idle");

  // ── Play / Pause ──────────────────────────────────────────────────────────
  playBtn.addEventListener("click", () => {
    if (audioPlayer.paused) {
      audioPlayer.play().catch(() => {});
    } else {
      audioPlayer.pause();
    }
  });

  audioPlayer.addEventListener("play", () => {
    playIcon.textContent = "⏸";
    playBtn.classList.remove("idle");
    soundBars?.classList.add("playing");
  });

  audioPlayer.addEventListener("pause", () => {
    playIcon.textContent = "▶";
    playBtn.classList.add("idle");
    soundBars?.classList.remove("playing");
  });

  audioPlayer.addEventListener("ended", () => {
    playIcon.textContent = "▶";
    playBtn.classList.add("idle");
    soundBars?.classList.remove("playing");
    if (progressFill) progressFill.style.width = "0%";
    if (curTimeEl) curTimeEl.textContent = "0:00";
  });

  // ── Progress bar update ───────────────────────────────────────────────────
  audioPlayer.addEventListener("timeupdate", () => {
    if (!audioPlayer.duration) return;
    const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressEl) progressEl.setAttribute("aria-valuenow", Math.round(pct));
    if (curTimeEl) curTimeEl.textContent = fmt(audioPlayer.currentTime);
  });

  audioPlayer.addEventListener("loadedmetadata", () => {
    if (durEl) durEl.textContent = fmt(audioPlayer.duration);
  });

  // ── Seek on click ─────────────────────────────────────────────────────────
  progressEl?.addEventListener("click", (e) => {
    if (!audioPlayer.duration) return;
    const rect = progressEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioPlayer.currentTime = pct * audioPlayer.duration;
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
  // CSS handles all dark mode player styles via body.darkmode selectors.
  // No inline overrides needed.
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
    const match = originalSongs.find((s) => s.titre === name);
    if (!match) errors.push(`❌ ${name} — missing from songs.js`);
    else console.log(`✅ OK: ${name}`);
  }
  if (errors.length) console.log(errors.join("\n"));
  else console.log("🎉 No missing titles!");
}
