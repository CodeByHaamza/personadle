// === IMPORTS ===
import { personas as originalPersonas } from "../database/personas.js";
import { portraitsMap } from "../database/portraitsMap.js";
import { characters } from "../database/characters_clean.js";
import { updateProfileStats } from "../profile/profileStats.js";

// Shared game utilities
import {
  parisDateKey,
  msUntilNextParisMidnight,
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
  applyDarkModeOverrides,
  enableGiveUpButton,
  characterMatchesActiveOpus,
  updateCounterElement,
  getActiveChallengeTarget,
  isChallengePlay,
} from "../js/gameCore.js";

// Collapsible opus filter panel (shared across all modes)
import { initFilterMenu } from "../js/filterMenu.js";
import { closeAutocompleteList, removeFromAutocomplete } from "../js/autocomplete.js";
import { checkChallengeCompletion } from "../js/challenge-result.js";
import { trackUniqueDay } from "../profile/badges/badgesManager.js";
import { checkUnlocksAfterGame } from "../js/unlock-notify.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & STATE
// ─────────────────────────────────────────────────────────────────────────────

const modeName = "Emoji";

/** Minimum attempts before the Give-Up button activates. */
const GIVE_UP_THRESHOLD = 8;

/** All specific opus codes available in Emoji mode. */
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

let activeOpus = [...ALL_OPUS];

// Mutable list of names fed to the autocomplete (splice to remove guessed)
let personas = [...originalPersonas];

let gameOver = false;
let sessionStartTime = Date.now();
let attempts = 0;
let target = null;

// Guard against double-binding autocomplete listeners after filter changes
let autocompleteBound = false;

/** Returns today's stats key for this mode (recalculated fresh each time). */
function getTodayStatsKey() {
  return `statsLogged_${modeName}_${parisDateKey()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER / CHARACTER POOL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the array of character objects that match the current opus filters.
 * @returns {Object[]}
 */
function filterCharacterPool() {
  return characters.filter((c) => characterMatchesActiveOpus(c, activeOpus));
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches an autocomplete dropdown to `element`.
 * Re-attaching after a filter change replaces the element's listeners by
 * cloning the node (avoids listener accumulation).
 *
 * @param {HTMLInputElement} element     - The text input to enhance
 * @param {string[]}         sourceArray - Current list of guessable names
 */
function initializeAutocomplete(element, sourceArray) {
  // Reset listeners by replacing the element with a clean clone
  if (autocompleteBound) {
    const clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    element = clone;
  }

  let currentFocus = -1;

  // Pattern ARIA combobox : rend la liste de suggestions perceptible par un
  // lecteur d'écran (elle était jusqu'ici purement visuelle/souris+clavier).
  element.setAttribute("role", "combobox");
  element.setAttribute("aria-autocomplete", "list");
  element.setAttribute("aria-expanded", "false");
  element.setAttribute("aria-controls", "autocomplete-list");

  element.addEventListener("input", function () {
    const val = this.value.trim();
    closeAutocompleteList(null, element);
    if (!val) return;

    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    list.setAttribute("role", "listbox");
    this.parentNode.appendChild(list);
    element.setAttribute("aria-expanded", "true");

    // Build sorted matches (first-name start > last-name start > contains)
    const matches = [];
    for (let i = 0; i < sourceArray.length; i++) {
      const displayName = sourceArray[i];
      const lowerName = displayName.toLowerCase();
      const lowerVal = val.toLowerCase();
      if (!lowerName.includes(lowerVal)) continue;

      const [firstName, lastName] = displayName.split(" ");
      let priority = 3;
      if (firstName?.toLowerCase().startsWith(lowerVal)) priority = 1;
      else if (lastName?.toLowerCase().startsWith(lowerVal)) priority = 2;
      matches.push({ name: displayName, priority });
    }

    matches.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    matches.forEach(({ name: displayName }, idx) => {
      const imageName = portraitsMap[displayName] || displayName.split(" ")[0];
      const portraitName = encodeURIComponent(imageName);

      const matchIndex = displayName.toLowerCase().indexOf(val.toLowerCase());
      const before = displayName.substring(0, matchIndex);
      const match = displayName.substring(matchIndex, matchIndex + val.length);
      const after = displayName.substring(matchIndex + val.length);

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.id = `autocomplete-option-${idx}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.innerHTML = `
        <img src="../database/portraits/${portraitName}.webp" alt="${displayName} portrait"
             onerror="this.src='../database/portraits/unknown.webp'" />
        <span title="${displayName}">
          ${before}<strong style="color:#6bbf59">${match}</strong>${after}
        </span>
        <input type='hidden' value='${displayName}'>
      `;

      option.addEventListener("click", function () {
        element.value = this.getElementsByTagName("input")[0].value;
        closeAutocompleteList(null, element);
        document.getElementById("guessButton")?.click();
      });

      list.appendChild(option);
    });

    currentFocus = -1;
  });

  // Keyboard navigation: ↑ ↓ to browse, Enter to confirm
  element.addEventListener("keydown", function (e) {
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

  function updateActive(items) {
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].setAttribute("aria-selected", "true");
    element.setAttribute("aria-activedescendant", items[currentFocus].id);
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function removeActive(items) {
    for (let item of items) {
      item.classList.remove("autocomplete-active");
      item.setAttribute("aria-selected", "false");
    }
  }

  document.addEventListener("click", (e) => closeAutocompleteList(e.target, element));
  autocompleteBound = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reveals emoji hints one by one based on the number of attempts so far.
 * Each incorrect guess unveils the next emoji in the sequence.
 */
function updateEmojiHint() {
  const displayZone = document.getElementById("emojiDisplay");
  displayZone.innerHTML = "";
  target.emoji.slice(0, attempts).forEach((e) => {
    const span = document.createElement("span");
    span.textContent = e;
    span.classList.add("emoji-unit");
    displayZone.appendChild(span);
  });
}

/** Updates the give-up counter display and activates it at the threshold. */
function updateCounters() {
  updateCounterElement("giveUpCounter", attempts, GIVE_UP_THRESHOLD);
}

// enableGiveUpButton() est maintenant importée de gameCore.js (identique dans tous les modes).

// ─────────────────────────────────────────────────────────────────────────────
// GAME LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a guess against the current target.
 * On correct guess (or forceReveal): reveals all emojis, shows victory UI.
 * On wrong guess: reveals one more emoji, increments attempt counter.
 *
 * @param {string}  name         - Guessed character name
 * @param {boolean} [forceReveal=false] - True when Give Up is triggered
 */
function checkEmojiGuess(name, forceReveal = false) {
  const displayZone = document.getElementById("emojiDisplay");
  const winMessage = document.getElementById("winMessage");
  const victoryBox = document.getElementById("victoryBox");
  const victoryPortrait = document.getElementById("victoryPortrait");
  const textbar = document.getElementById("textbar");
  const wrongList = document.getElementById("wrongGuessList");

  const guess = characters.find((c) => c.nom.toLowerCase() === name.toLowerCase());
  if (!guess) {
    winMessage.textContent = (window.i18n || { t: (k, v) => k }).t("modes.emoji.not_in_database", {
      name,
    });
    return;
  }

  if (guess.nom.toLowerCase() === target.nom.toLowerCase() || forceReveal) {
    // Reveal all emojis
    displayZone.innerHTML = "";
    target.emoji.forEach((e) => {
      const span = document.createElement("span");
      span.textContent = e;
      span.classList.add("emoji-unit");
      displayZone.appendChild(span);
    });

    localStorage.setItem("emojiGameOver", "true");
    localStorage.setItem("emojiForceReveal", String(forceReveal));

    // Show character portrait in victory box
    const imageName = portraitsMap[target.nom] || target.nom.split(" ")[0];
    victoryPortrait.src = `../database/portraits/${encodeURIComponent(imageName)}.webp`;
    victoryPortrait.alt = target.nom;

    winMessage.textContent = forceReveal
      ? (window.i18n || { t: (k, v) => k }).t("modes.emoji.giveup_reveal", { name: target.nom })
      : (window.i18n || { t: (k, v) => k }).t("modes.emoji.correct", { name: target.nom });

    victoryBox.style.display = "flex";
    showConfettiExplosion();
    revealNextLink({
      prevHref: "../classiqueMode/classiqueMode.html",
      nextHref: "../allOutAttackMode/allOutAttack.html",
    });
    // Capturé AVANT checkChallengeCompletion (qui consomme activeChallenge) :
    // une partie de défi à cible dédiée ne se logge pas en session quotidienne.
    const wasChallengePlay = isChallengePlay("emoji");
    if (!forceReveal)
      showChallengeButton(
        "emoji",
        attempts,
        // Seuls les persos AVEC données emoji sont jouables comme cible de défi.
        characters.filter((c) => c.emoji && c.nom !== target.nom).map((c) => c.nom)
      );
    checkChallengeCompletion("emoji", attempts, !forceReveal);
    showCommunityStats(modeName, target.nom);

    // 🎭 SHAPESHIFTER — track character per mode (write into personaUserProfile.characterModeMap)
    if (!forceReveal && target.nom) {
      const _pShape = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
      if (!_pShape.characterModeMap) _pShape.characterModeMap = {};
      if (!_pShape.characterModeMap[target.nom]) _pShape.characterModeMap[target.nom] = [];
      if (!_pShape.characterModeMap[target.nom].includes("emoji")) {
        _pShape.characterModeMap[target.nom].push("emoji");
      }
      localStorage.setItem("personaUserProfile", JSON.stringify(_pShape));
    }

    if (!forceReveal) {
      const _pEmo = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
      if (attempts === 1 && !_pEmo.hasWonFirstTry) {
        _pEmo.hasWonFirstTry = true;
        localStorage.setItem("personaUserProfile", JSON.stringify(_pEmo));
      }
      trackUniqueDay(_pEmo, () =>
        localStorage.setItem("personaUserProfile", JSON.stringify(_pEmo))
      );
    }

    const todayKey = getTodayStatsKey();
    if (!wasChallengePlay && !localStorage.getItem(todayKey)) {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
      const result = forceReveal ? "giveup" : "win";
      updateProfileStats({ result, mode: modeName, timeSpent });
      savePendingSession(
        buildGameSession({
          mode: modeName,
          targetName: target.nom,
          result,
          attempts,
          timeMs: timeSpent * 1000,
        })
      );
      localStorage.setItem(todayKey, "true");
    }

    textbar.disabled = true;
    document.getElementById("guessButton").disabled = true;
    document.getElementById("giveUpButton").disabled = true;
    gameOver = true;
    localStorage.setItem("emojiWin", "true");
    checkUnlocksAfterGame();
  } else {
    // Wrong guess: show mini portrait + increment
    const imageName = portraitsMap[guess.nom] || guess.nom.split(" ")[0];
    showWrongMini(
      `../database/portraits/${encodeURIComponent(imageName)}.webp`,
      guess.nom,
      wrongList
    );
    attempts++;
    localStorage.setItem("attemptsEmoji", attempts);
    updateEmojiHint();
    updateCounters();
    if (attempts >= GIVE_UP_THRESHOLD) enableGiveUpButton();
  }

  removeFromAutocomplete(personas, name);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clears all game state and picks a fresh target from the current filter pool.
 * Called by the Replay button, daily reset, and filter changes.
 */
function resetGame() {
  const nav = document.getElementById("modeNavigationContainer");
  if (nav) nav.style.display = "none";

  sessionStartTime = Date.now();
  localStorage.setItem("lastPlayedDate_Emoji", parisDateKey());

  document.getElementById("emojiDisplay").innerHTML = "";
  document.getElementById("winMessage").textContent = "";
  document.getElementById("victoryBox").style.display = "none";
  const wrongList = document.getElementById("wrongGuessList");
  if (wrongList) wrongList.innerHTML = "";

  const textbar = document.getElementById("textbar");
  textbar.disabled = false;
  textbar.value = "";
  document.getElementById("guessButton").disabled = false;
  document.getElementById("giveUpButton").disabled = true;
  document.getElementById("giveUpButton").style.cursor = "not-allowed";

  const pool = filterCharacterPool();
  // Mutate the shared personas array so the autocomplete stays in sync
  personas.length = 0;
  personas.push(...pool.map((c) => c.nom));

  gameOver = false;
  attempts = 1;
  const _prevEmoji = target;
  const _emojiCandidates =
    pool.length > 1 && _prevEmoji ? pool.filter((c) => c.nom !== _prevEmoji.nom) : pool;
  target = _emojiCandidates[Math.floor(Math.random() * _emojiCandidates.length)] || pool[0];
  if (target) localStorage.setItem("targetEmoji", JSON.stringify(target));
  localStorage.setItem("attemptsEmoji", attempts);

  updateEmojiHint();
  updateCounters();
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE (emoji-specific elements)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies inline dark-mode styles to elements specific to Emoji mode.
 */
function applyDarkModeStyles() {
  applyDarkModeOverrides([
    {
      selector: ".emoji-hint-zone",
      styles: { background: "rgba(20, 20, 20, 0.7)", boxShadow: "0 0 12px rgba(255, 255, 255, 0.2)" },
    },
    {
      id: "victoryBox",
      styles: { backgroundColor: "#1a1a1a", color: "#90ee90", border: "3px solid #4caf50" },
    },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__i18nReady) await window.__i18nReady;
  applyDarkModeStyles();
  setupRulesModal();

  const textbar = document.getElementById("textbar");
  const guessButton = document.getElementById("guessButton");
  const giveUpButton = document.getElementById("giveUpButton");
  const resetButton = document.getElementById("resetButton");

  // ── Filtre opus — panneau déroulant ──
  const _filterApi = initFilterMenu("filters_Emoji", ALL_OPUS, (newActive) => {
    activeOpus = newActive;
    if (newActive.length === 0) return;
    resetGame();
  });
  activeOpus = _filterApi.getActive();

  // ── Build initial character pool ──
  const poolInit = filterCharacterPool();
  personas = poolInit.map((c) => c.nom);

  // ── Restore or create target / attempts ──
  // Daily target uses seeded RNG so all players get the same character today.
  // Pool is all characters with emoji data (regardless of active opus filters).
  const ALL_EMOJI_CHARS = characters.filter((c) => c.emoji);
  const _rawEmoji = localStorage.getItem("targetEmoji");
  let _savedEmoji = null;
  try {
    if (_rawEmoji && _rawEmoji !== "undefined") _savedEmoji = JSON.parse(_rawEmoji);
  } catch {}
  target = _savedEmoji || getDailyTarget(ALL_EMOJI_CHARS, "Emoji");

  // Défi à cible dédiée (2026-07-17) : jouer la cible du défi, pas celle du
  // jour. Persistée dans targetEmoji (état wipé à l'acceptation) → un refresh
  // mi-défi reprend la même cible. Idempotent si déjà persistée.
  const _challengeTargetName = getActiveChallengeTarget("emoji");
  if (_challengeTargetName) {
    const _ct = ALL_EMOJI_CHARS.find((c) => c.nom === _challengeTargetName);
    if (_ct) target = _ct;
  }

  attempts = parseInt(localStorage.getItem("attemptsEmoji")) || 1;
  localStorage.setItem("targetEmoji", JSON.stringify(target));
  localStorage.setItem("attemptsEmoji", attempts);

  // Bind autocomplete (single bind; personas mutated on wrong guess)
  initializeAutocomplete(textbar, personas);

  updateEmojiHint();
  updateCounters();
  if (attempts >= GIVE_UP_THRESHOLD) enableGiveUpButton();

  // Restore finished game state
  if (localStorage.getItem("emojiGameOver") === "true" && target?.nom) {
    checkEmojiGuess(target.nom, localStorage.getItem("emojiForceReveal") === "true");
  }

  // ── Guess button ──
  guessButton.addEventListener("click", () => {
    if (gameOver) return;
    const guess = textbar.value.trim();
    if (!guess) return;
    checkEmojiGuess(guess);
    textbar.value = "";
  });

  // ── Give Up button ──
  giveUpButton.addEventListener("click", () => {
    if (attempts < GIVE_UP_THRESHOLD || gameOver) return;
    checkEmojiGuess(target.nom, true);
  });

  // ── Replay button ──
  resetButton.addEventListener("click", () => {
    localStorage.removeItem("targetEmoji");
    localStorage.removeItem("attemptsEmoji");
    localStorage.removeItem("emojiGameOver");
    localStorage.removeItem("emojiForceReveal");
    localStorage.removeItem("emojiWin");
    // Aligne Emoji sur les 5 autres modes : le replay efface aussi la garde
    // stats du jour, pour qu'une victoire en replay soit envoyée au backend
    // (qui upgrade un éventuel giveup→win — décision produit 2026-07-17).
    localStorage.removeItem(getTodayStatsKey());
    resetGame();
  });

  // ── Daily reset ──
  checkResetOnLoad("lastPlayedDate_Emoji", "Emoji", () => {
    localStorage.removeItem("targetEmoji");
    localStorage.removeItem("attemptsEmoji");
    localStorage.removeItem("emojiGameOver");
    localStorage.removeItem("emojiForceReveal");
    localStorage.removeItem("emojiWin");
    resetGame();
  });

  // Emoji mode uses msUntilNextParisMidnight directly for a reschedulable reset
  const scheduleDailyReset = () => {
    clearTimeout(window.__emojiResetTimer);
    window.__emojiResetTimer = setTimeout(() => {
      localStorage.setItem("lastPlayedDate_Emoji", parisDateKey());
      resetGame();
      location.reload();
    }, msUntilNextParisMidnight() + 500);
  };

  scheduleDailyReset();

  // Si l'onglet était en arrière-plan et qu'on revient sur un nouveau jour,
  // reset immédiat. Sinon, reprogramme simplement l'alarme.
  // NOTE : window "focus" supprimé — il se déclenche à chaque clic sur la page
  // et provoquait des rechargements intempestifs.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    const stored = localStorage.getItem("lastPlayedDate_Emoji");
    if (stored && stored !== parisDateKey()) {
      // Nouveau jour détecté pendant que l'onglet était en arrière-plan
      localStorage.setItem("lastPlayedDate_Emoji", parisDateKey());
      resetGame();
      location.reload();
    } else {
      scheduleDailyReset();
    }
  });
});
