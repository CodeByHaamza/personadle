// === IMPORTS ===
import { personas as originalPersonas } from "./database/personas_allOut.js";
import { portraitsMap } from "./database/portraitsMap.js";
import { aoaCharacters } from "./database/aoaCharacters.js";
import { updateProfileStats } from "../profile/profileStats.js";

// Shared game utilities
import {
  parisDateKey,
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
  getActiveChallengeTarget,
  isChallengePlay,
  expertContext,
  setupExpertToggle,
  setGiveUpEnabled,
} from "../js/gameCore.js";

// Collapsible opus filter panel (shared across all modes)
import { initFilterMenu } from "../js/filterMenu.js";
import { checkChallengeCompletion } from "../js/challenge-result.js";
import { closeAutocompleteList, removeFromAutocomplete } from "../js/autocomplete.js";
import { checkUnlocksAfterGame } from "../js/unlock-notify.js";
import { trackUniqueDay } from "../profile/badges/badgesManager.js";

// ─────────────────────────────────────────────────────────────────────────────
// CDN / IMAGE LOADING CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/** CloudFlare R2 CDN base URL for All-Out Attack GIFs. */
const CDN_BASE_URL = "https://pub-39a737fc7a9c44c08b7701bdd4b2de4a.r2.dev/";
const CACHE_CONTROL = "public, max-age=86400";

/**
 * True when running in a local environment (file://, localhost, 127.0.0.1,
 * 0.0.0.0, or any private network IP 192.168.x.x / 10.x.x.x).
 * → Assets served from ./database/allOutAttack/ instead of the CDN.
 */
const IS_LOCAL = (() => {
  const h = location.hostname;
  return (
    h === "" || // file:// protocol
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    /^192\.168\./.test(h) || // LAN (Live Server on local IP)
    /^10\./.test(h) // LAN (corporate / VPN)
  );
})();

/**
 * Builds the URL for an All-Out Attack asset.
 * Local: `./database/allOutAttack/<filename>.<ext>`
 * Production: CDN Cloudflare R2
 *
 * @param {string} subfolder - CDN subfolder (e.g. "allOutAttack")
 * @param {string} filename  - Asset filename without extension
 * @param {string} [ext="webp"]
 * @returns {string}
 */
function cdn(subfolder, filename, ext = "webp") {
  if (IS_LOCAL) return `./database/allOutAttack/${encodeURIComponent(filename)}.${ext}`;
  return `${CDN_BASE_URL}${subfolder}/${encodeURIComponent(filename)}.${ext}?cache=${CACHE_CONTROL}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE CACHE & PRELOADING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plafond d'attente d'une image en préchargement prioritaire.
 * Aligné sur le timeout déjà en place dans loadGif() : au-delà, on passe à la
 * suivante plutôt que de bloquer toute la file.
 */
const PRELOAD_TIMEOUT_MS = 5000;

/** Promesse résolue après `ms` — utilitaire de temporisation et de garde-fou. */
const _timeout = (ms) => new Promise((r) => setTimeout(r, ms));

/** LRU-like cache to avoid re-downloading GIFs. Max 20 entries. */
const imageCache = new Map();
const MAX_CACHE_SIZE = 20;

let isPreloading = false;

/**
 * Adds an image to the cache, evicting the oldest entry when full.
 * @param {string}     src
 * @param {HTMLImageElement} imgElement
 */
function addToImageCache(src, imgElement) {
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    const old = imageCache.get(firstKey);
    if (old) old.src = ""; // free memory
    imageCache.delete(firstKey);
  }
  imageCache.set(src, imgElement);
}

function getFromCache(src) {
  return imageCache.get(src);
}

/**
 * Preloads up to 15 character images in the background.
 * High-priority loads await each image; low-priority loads are fire-and-forget.
 *
 * @param {string[]} namesList
 * @param {"high"|"low"} [priority="low"]
 */
async function smartPreload(namesList, priority = "low") {
  if (isPreloading) return;
  isPreloading = true;

  // try/finally : sans lui, une exception laissait isPreloading bloqué à true et
  // TOUS les préchargements suivants sortaient immédiatement — le mode restait sur
  // le placeholder de chargement jusqu'à un rechargement complet de la page
  // (bug « chargement infini en AOA » signalé le 2026-08-15).
  try {
    const limited = namesList.slice(0, 15);
    for (const name of limited) {
      const base = portraitsMap[name] || name.split(" ")[0];
      const src = cdn("allOutAttack", base);
      if (getFromCache(src)) continue;

      const img = new Image();
      img.loading = priority === "high" ? "eager" : "lazy";
      img.src = src;

      const p = new Promise((resolve) => {
        img.onload = () => {
          addToImageCache(src, img);
          resolve();
        };
        img.onerror = () => resolve();
      });

      // Un GIF dont la requête reste en suspens ne déclenche NI onload NI onerror :
      // sans borne, `await p` bloquait la boucle indéfiniment. Même garde-fou que
      // loadGif() plus bas, qui avait déjà son timeout de 5 s — le préchargement
      // l'avait oublié.
      if (priority === "high") await Promise.race([p, _timeout(PRELOAD_TIMEOUT_MS)]);
      await _timeout(priority === "high" ? 30 : 100);
    }
  } finally {
    isPreloading = false;
  }
}

/**
 * Loads an image into `gifElement`, using the cache when available.
 * Shows loading.gif only when the image isn't already cached.
 * Falls back to loading.gif after a 5-second timeout.
 *
 * @param {HTMLImageElement} gifElement
 * @param {string}           src
 * @param {Function}         [onLoadCallback]
 */
function loadImageSafely(gifElement, src, onLoadCallback) {
  const cached = getFromCache(src);
  if (cached?.complete) {
    gifElement.src = src;
    onLoadCallback?.();
    return;
  }

  // Only show loading placeholder when we actually have to wait for a network load
  showLoading(gifElement);

  const tempImg = new Image();
  let timeoutId;

  const cleanup = () => {
    clearTimeout(timeoutId);
    tempImg.onload = null;
    tempImg.onerror = null;
  };

  tempImg.onload = () => {
    cleanup();
    addToImageCache(src, tempImg);
    gifElement.src = src;
    gifElement.style.opacity = "1";
    onLoadCallback?.();
  };

  tempImg.onerror = () => {
    cleanup();
    console.error(`Failed to load: ${src}`);
    gifElement.src = "../img/loading.gif";
  };

  timeoutId = setTimeout(() => {
    cleanup();
    console.warn(`Timeout loading: ${src}`);
    gifElement.src = "../img/loading.gif";
  }, IMAGE_LOAD_TIMEOUT_MS);

  tempImg.src = src;
}

/** Displays the loading placeholder. Always sets src synchronously to avoid race conditions. */
function showLoading(gifElement) {
  gifElement.style.filter = "none";
  gifElement.style.opacity = "1";
  gifElement.src = "../img/loading.gif";
  // Warm the JS cache without touching gifElement asynchronously
  if (!getFromCache("../img/loading.gif")) {
    const img = new Image();
    img.onload = () => addToImageCache("../img/loading.gif", img);
    img.src = "../img/loading.gif";
  }
}

// Fast lookup map: character name → aoaCharacter object
const AOA_BY_NAME = new Map(aoaCharacters.map((c) => [c.nom, c]));

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & STATE
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MODE EXPERT — flou figé au maximum, et en noir et blanc
// ─────────────────────────────────────────────────────────────────────────────
//
// Le mode normal fait baisser le flou de 3px par erreur : l'image finit par se
// lire. L'Expert le fige au maximum et retire la couleur — or la couleur porte
// une grande part de l'identification (cheveux, tenue, palette d'opus).
const EXPERT = expertContext({
  prefix: "aoaExpert",
  statsKey: "AllOut",
  hashMode: "AllOutAttack",
});

const todayKey = `statsLogged_${EXPERT.statsKey}_${parisDateKey()}`;
let sessionStartTime = Date.now();

/** Minimum attempts before the Give-Up button activates. */
const GIVE_UP_THRESHOLD = 5;

/** Initial CSS blur level (px) applied to the All-Out Attack GIF. */
const INITIAL_BLUR = 20;

/** Blur decreases by this amount per wrong guess (px). */
const BLUR_STEP = 3;

/** Timeout (ms) before giving up on a slow image load. */
const IMAGE_LOAD_TIMEOUT_MS = 5000;

/** All specific opus codes available in AllOutAttack mode. */
const ALL_OPUS = ["P3", "P3FES", "P3P", "P5", "P5R", "P5X"];

let activeOpusFilters = [...ALL_OPUS];
let personas = []; // mutable filtered list of character names
let attempts = 0;
let gameOver = false;
let target = null;

// ─────────────────────────────────────────────────────────────────────────────
// FILTER / CHARACTER POOL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the list of character names that belong to the active opus filters.
 * Uses the fast AOA_BY_NAME lookup for O(1) access.
 * @returns {string[]}
 */
function getFilteredPersonas() {
  const result = [];
  for (const name of originalPersonas) {
    const entry = AOA_BY_NAME.get(name);
    if (!entry) continue;
    if (entry.opus.some((op) => activeOpusFilters.includes(op))) result.push(name);
  }
  if (!result.length) console.warn("⚠️ No characters match current filters:", activeOpusFilters);
  return result;
}

/**
 * Returns the deterministic daily character for All-Out Attack.
 * Uses seeded RNG from the full unfiltered pool so all players get the same
 * character today regardless of their opus filter settings.
 * @returns {string|null} Character name or null if pool is empty
 */
function getBetterRandomCharacter(random = false) {
  if (!originalPersonas.length) {
    alert((window.i18n || { t: (k) => k }).t("modes.alloutattack.no_characters"));
    return null;
  }
  if (random && personas.length) {
    const _candidates =
      personas.length > 1 && target ? personas.filter((n) => n !== target) : personas;
    return _candidates[Math.floor(Math.random() * _candidates.length)] || personas[0];
  }
  // Daily target depuis le pool complet — mais si le filtre actif l'exclut,
  // utiliser un daily depuis la liste filtrée pour rester jouable.
  const daily = getDailyTarget(originalPersonas, EXPERT.hashMode);
  if (personas.length && !personas.includes(daily)) {
    return getDailyTarget(personas, EXPERT.hashMode);
  }
  return daily;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────

// Shared array reference read by the input handler — updated on every call so
// filter changes and resets are reflected without re-attaching listeners.
let _acCurrentArray = [];

/**
 * Updates the autocomplete candidate list and attaches listeners to the element
 * once. Subsequent calls only refresh the candidate array, preventing duplicate
 * listener stacking on replay/filter-change.
 *
 * @param {HTMLInputElement} element - The text input to enhance
 * @param {string[]}         array  - Current list of guessable names
 */
function initializeAutocomplete(element, array) {
  _acCurrentArray = array;

  if (element._acInitDone) return;
  element._acInitDone = true;

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

    const lowerVal = val.toLowerCase();
    const matches = [];
    for (const displayName of _acCurrentArray) {
      if (!displayName.toLowerCase().includes(lowerVal)) continue;
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
      const realName = displayName.includes("(") ? displayName.split("(")[1].replace(")", "") : "";

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.id = `autocomplete-option-${idx}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.innerHTML = `
        <img src="./database/img/${portraitName}.webp" alt="${displayName}">
        <span style="display: flex; flex-direction: column;">
          <span class="codename">${displayName.split(" (")[0]}</span>
          ${realName ? `<span class="realname">(${realName})</span>` : ""}
        </span>
        <input type='hidden' value='${displayName}'>
      `;

      option.addEventListener("click", function () {
        element.value = this.getElementsByTagName("input")[0].value;
        removeFromAutocomplete(personas, element.value);
        handleGuess();
        closeAutocompleteList(null, element);
      });

      list.appendChild(option);
    });

    currentFocus = -1;
  });

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
    for (let item of items) {
      item.classList.remove("autocomplete-active");
      item.setAttribute("aria-selected", "false");
    }
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].setAttribute("aria-selected", "true");
    element.setAttribute("aria-activedescendant", items[currentFocus].id);
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  document.addEventListener("click", (e) => closeAutocompleteList(e.target, element));
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Filtre CSS appliqué au GIF selon le mode et l'avancement.
 *
 * Centralisé parce que cinq endroits le construisaient à la main — en ajouter un
 * sixième pour l'Expert aurait garanti qu'un des cinq soit oublié.
 *
 * - normal  : le flou baisse de BLUR_STEP par erreur, jusqu'à 0
 * - Expert  : flou figé au maximum **et** noir et blanc. La couleur porte une
 *   grande part de l'identification (couleur de cheveux, palette de l'opus) ;
 *   la retirer est ce qui rend le flou maximal réellement difficile.
 * - révélé  : aucun filtre, quel que soit le mode
 *
 * @param {boolean} [revealed=false] fin de partie (victoire ou abandon)
 */
function gifFilter(revealed = false) {
  if (revealed) return "none";
  if (EXPERT.isExpert) return `blur(${INITIAL_BLUR}px) grayscale(1)`;
  return `blur(${Math.max(INITIAL_BLUR - attempts * BLUR_STEP, 0)}px)`;
}

/**
 * Processes one guess:
 *  - Correct: removes blur, shows victory box, triggers badges/stats
 *  - Wrong: increases blur slightly, shows wrong-guess portrait
 */
function handleGuess() {
  if (gameOver) return;
  const input = document.getElementById("textbar");
  const guess = input.value.trim();
  if (!guess) return;

  attempts++;
  localStorage.setItem(EXPERT.key("aoaAttempts"), attempts);
  updateGiveUpCounter();

  if (guess.toLowerCase() === target.toLowerCase()) {
    // ── Win ──────────────────────────────────────────────────────────────────
    // Capturé AVANT checkChallengeCompletion (qui consomme activeChallenge) :
    // une partie de défi à cible dédiée ne se logge pas en session quotidienne.
    const wasChallengePlay = isChallengePlay("alloutattack");
    checkSpecialBadges(target);
    document.getElementById("aoaGif").style.filter = gifFilter(true);
    showVictoryBox(target);
    showConfettiExplosion();
    revealNextLink({
      prevHref: "../emojiMode/emojiMode.html",
      nextHref: "../silhouetteMode/silhouette.html",
    });
    if (!EXPERT.isExpert) {
      showChallengeButton(
        "alloutattack",
        attempts,
        personas.filter((n) => n !== target)
      );
    }
    checkChallengeCompletion("alloutattack", attempts, true);
    if (!EXPERT.isExpert) showCommunityStats("alloutattack", target);
    gameOver = true;
    localStorage.setItem(EXPERT.key("aoaGameOver"), "true");

    if (!wasChallengePlay && !localStorage.getItem(todayKey)) {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
      if (!EXPERT.isExpert) updateProfileStats({ result: "win", mode: "All Out Attack", timeSpent });
      savePendingSession(
        buildGameSession({
          mode: "AllOutAttack",
          targetName: target,
          isExpert: EXPERT.isExpert,
          result: "win",
          attempts,
          timeMs: timeSpent * 1000,
          filters: activeOpusFilters,
        })
      );
      localStorage.setItem(todayKey, "1");

      // aoa_vision : victoire au 1er essai
      if (attempts === 1) {
        const _pa = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
        if (!_pa.hasWonAOAFirstTry) {
          _pa.hasWonAOAFirstTry = true;
          localStorage.setItem("personaUserProfile", JSON.stringify(_pa));
        }
      }
    }

    localStorage.setItem(EXPERT.key("aoaTarget"), target);
    localStorage.setItem(EXPERT.key("aoaAttempts"), attempts);
    const _pAoaWin = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
    trackUniqueDay(_pAoaWin, () =>
      localStorage.setItem("personaUserProfile", JSON.stringify(_pAoaWin))
    );
    if (!EXPERT.isExpert) checkUnlocksAfterGame("All Out Attack");
    disableInputs();
  } else {
    // ── Wrong guess ──────────────────────────────────────────────────────────
    const imageName = portraitsMap[guess] || guess.split(" ")[0];
    showWrongMini(
      `./database/img/${imageName}.webp`,
      guess,
      document.getElementById("wrongGuessList")
    );
    removeFromAutocomplete(personas, guess);

    document.getElementById("aoaGif").style.filter = gifFilter();
    input.value = "";
  }
}

/** Give Up: reveals the GIF and shows the victory box as a defeat screen. */
function giveUp() {
  if (attempts < GIVE_UP_THRESHOLD || gameOver) return;
  document.getElementById("aoaGif").style.filter = gifFilter(true);
  localStorage.setItem(EXPERT.key("aoaForceReveal"), "true");
  showVictoryBox(target, true);
  showConfettiExplosion();
  disableInputs();
  gameOver = true;

  // Défi à cible dédiée : le give-up compte pour le défi (perdu) mais ne se
  // logge pas en session quotidienne. Capturé avant checkChallengeCompletion.
  const wasChallengePlay = isChallengePlay("alloutattack");
  if (!wasChallengePlay && !localStorage.getItem(todayKey)) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    if (!EXPERT.isExpert) updateProfileStats({ result: "giveup", mode: "All Out Attack", timeSpent });
    savePendingSession(
      buildGameSession({
        mode: "AllOutAttack",
        targetName: target,
        isExpert: EXPERT.isExpert,
        result: "giveup",
        attempts,
        timeMs: timeSpent * 1000,
        filters: activeOpusFilters,
      })
    );
    localStorage.setItem(todayKey, "1");
    revealNextLink({
      prevHref: "../emojiMode/emojiMode.html",
      nextHref: "../silhouetteMode/silhouette.html",
    });
  }

  checkChallengeCompletion("alloutattack", attempts, false);
  if (!EXPERT.isExpert) showCommunityStats("alloutattack", target);
  localStorage.setItem(EXPERT.key("aoaGameOver"), "true");
  localStorage.setItem(EXPERT.key("aoaTarget"), target);
  localStorage.setItem(EXPERT.key("aoaAttempts"), attempts);
  const _pAoaGiveUp = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
  trackUniqueDay(_pAoaGiveUp, () =>
    localStorage.setItem("personaUserProfile", JSON.stringify(_pAoaGiveUp))
  );
  if (!EXPERT.isExpert) checkUnlocksAfterGame("All Out Attack");
}

/**
 * Resets the game state and loads a new character GIF.
 * Called by the Replay button, daily reset, and filter changes.
 */
function resetGame(random = false) {
  sessionStartTime = Date.now();
  localStorage.removeItem(todayKey);

  const input = document.getElementById("textbar");
  const gifElement = document.getElementById("aoaGif");
  const wrongListEl = document.getElementById("wrongGuessList");

  gameOver = false;
  attempts = 0;
  document.getElementById("victoryBox").style.display = "none";

  personas = getFilteredPersonas();
  const newTarget = getBetterRandomCharacter(random);
  if (!newTarget) return;
  target = newTarget;

  gifElement.style.filter = "none";

  const imageName = portraitsMap[target] || target.split(" ")[0];
  const newSrc = cdn("allOutAttack", imageName);
  loadImageSafely(gifElement, newSrc, () => {
    gifElement.style.filter = gifFilter();
  });

  // Background preload of next characters
  setTimeout(() => smartPreload(personas, "low"), 800);

  input.disabled = false;
  input.value = "";
  document.getElementById("guessButton").disabled = false;
  setGiveUpEnabled(false);
  if (wrongListEl) wrongListEl.innerHTML = "";

  initializeAutocomplete(input, personas);
  updateGiveUpCounter();

  localStorage.setItem(EXPERT.key("aoaTarget"), target);
  localStorage.setItem(EXPERT.key("aoaAttempts"), attempts);
  localStorage.removeItem(EXPERT.key("aoaGameOver"));

  const nav = document.getElementById("modeNavigationContainer");
  if (nav) {
    nav.style.display = "none";
    nav.classList.remove("reveal-style");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Updates the give-up counter display and enables/disables the button. */
function updateGiveUpCounter() {
  const counter = document.getElementById("giveUpCounter");
  const btn = document.getElementById("giveUpButton");
  if (counter) {
    counter.textContent = `(${attempts} / ${GIVE_UP_THRESHOLD})`;
    counter.classList.toggle("activated", attempts >= GIVE_UP_THRESHOLD);
  }
  if (btn) {
    // setGiveUpEnabled() plutôt que `btn.disabled` en direct : le bouton est un
    // <div class="link-wrapper">, où l'attribut n'a aucun effet. Le helper pose
    // aussi aria-disabled, qui est ce que voient le CSS et les lecteurs d'écran.
    setGiveUpEnabled(attempts >= GIVE_UP_THRESHOLD);
  }
}

function disableInputs() {
  document.getElementById("textbar").disabled = true;
  document.getElementById("guessButton").disabled = true;
  setGiveUpEnabled(false);
}

/**
 * Fills and shows the victory box with the character's battle image.
 * @param {string} name - Character name
 */
function showVictoryBox(name, force = false) {
  const baseName = (portraitsMap[name] || name.split(" ")[0]).trim();
  const box = document.getElementById("victoryBox");
  const img = document.getElementById("victoryImage");
  const text = document.getElementById("victoryText");
  const i18n = window.i18n || { t: (k) => k };

  img.src = `./database/img/${baseName}_Battle.webp`;
  img.alt = name;
  // Le nom (souvent long en FR, ex: "Cherish ( Masaki Ashiya )") ne doit pas se
  // couper en plein milieu : on l'isole dans un span insécable qui, s'il ne tient
  // pas, retombe proprement sur sa propre ligne au lieu de casser après "Cherish (".
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  const key = force ? "giveup_reveal" : "correct";
  const SENTINEL = ""; // zone privée Unicode, jamais dans une traduction
  const raw = i18n.t(`modes.alloutattack.${key}`, { name: SENTINEL });
  const [before, after = ""] = raw.split(SENTINEL);
  text.innerHTML = `${esc(before)}<span class="aoa-answer-name" style="white-space:nowrap;">${esc(name)}</span>${esc(after)}`;
  box.style.display = "flex";
  setTimeout(() => box.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether `characterName` triggers any special AOA badges and updates
 * the player profile in localStorage accordingly.
 *
 * Badges tracked here:
 *  - Truth & Duality: Crow (Akechi) and Black Mask (Akechi)
 *  - Chinese New Year: Wonder (CNY) and Rin (CNY)
 *  - Velvet Headache: Wonder (Velvet) and Twins (Caroline & Justine)
 *
 * @param {string} characterName
 */
function checkSpecialBadges(characterName) {
  const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
  if (!profile) return;

  let shouldSave = false;
  const n = characterName.toLowerCase();

  const check = (flag, condition) => {
    if (condition && !profile[flag]) {
      profile[flag] = true;
      shouldSave = true;
    }
  };

  check("foundCrow", n.includes("crow") && n.includes("akechi"));
  check("foundBlackMask", n.includes("black mask") && n.includes("akechi"));
  check("foundWonderCNY", n.includes("wonder") && n.includes("chinese"));
  check("foundRinCNY", n.includes("rin") && n.includes("chinese"));
  check("foundWonderVelvet", n.includes("wonder") && n.includes("velvet"));
  check("foundTwins", n.includes("caroline") || n.includes("justine"));

  // ── Nouveaux flags v2.1 ───────────────────────────────────────────────
  // Twin Fist AOA
  check("foundMakotoNijimaAOA", n.includes("makoto nijima") || n.includes("queen"));
  check("foundAkihikoAOA", n.includes("akihiko sanada"));

  // Twin Spear AOA
  check("foundKotoneAOA", n.includes("kotone") || n.includes("female protagonist"));
  check("foundKenAOA", n.includes("ken amada"));

  // For Real AOA (Ryuji)
  check(
    "foundRyujiAOA",
    n.includes("ryuji sakamoto") || (n.includes("skull") && !n.includes("caroline"))
  );

  // aoa_vision : victoire au 1er essai
  // (attempts est une variable locale du contexte d'appel, pas disponible ici — géré via profile.hasWonAOAFirstTry dans checkGuess)

  // characterModeMap
  if (!profile.characterModeMap) profile.characterModeMap = {};
  if (!profile.characterModeMap[characterName]) profile.characterModeMap[characterName] = [];
  if (!profile.characterModeMap[characterName].includes("alloutattack")) {
    profile.characterModeMap[characterName].push("alloutattack");
    shouldSave = true;
  }

  if (shouldSave) {
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));
    // `window.forceCheckBadges` n'était jamais défini nulle part dans le repo — ce bloc
    // ne s'exécutait jamais (code mort). checkUnlocksAfterGame() relit déjà le profil
    // frais depuis localStorage, pas besoin du setTimeout ni de repasser `profile`.
    if (!EXPERT.isExpert) checkUnlocksAfterGame();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE (AOA-specific element)
// ─────────────────────────────────────────────────────────────────────────────

function applyDarkModeStyles() {
  applyDarkModeOverrides([
    {
      selector: ".emoji-hint-zone",
      styles: { background: "rgba(20, 20, 20, 0.7)", boxShadow: "0 0 12px rgba(255, 255, 255, 0.2)" },
    },
    { id: "textbar", styles: { backgroundColor: "#111", color: "#fff", border: "2px solid #666" } },
    {
      selector: ".aoa-gif-zone",
      styles: { background: "rgba(20, 20, 20, 0.8)", borderColor: "#ffaaaa" },
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
  setupExpertToggle(EXPERT, "allOutAttack.html");

  const textbar = document.getElementById("textbar");
  const gifElement = document.getElementById("aoaGif");
  const guessButton = document.getElementById("guessButton");

  // Anti-triche : le drag natif du navigateur ignore le filtre CSS de flou et
  // peut être déposé hors de la zone du GIF, révélant le personnage à deviner.
  // draggable="false" (HTML) + user-drag: none (CSS) suffisent dans la plupart
  // des navigateurs ; ce preventDefault() couvre les cas restants.
  gifElement?.addEventListener("dragstart", (e) => e.preventDefault());

  // ── Filtre opus — panneau déroulant ──
  const _filterApi = initFilterMenu("filters_AllOutAttack", ALL_OPUS, (newActive) => {
    activeOpusFilters = newActive;
    if (newActive.length === 0) return;
    personas = getFilteredPersonas();

    if (!personas.length) return;

    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
    gifElement.style.filter = "none";
    loadImageSafely(gifElement, cdn("allOutAttack", imageName), () => {
      gifElement.style.filter = gifFilter();
    });

    attempts = 0;
    document.getElementById("wrongGuessList").innerHTML = "";
    document.getElementById("victoryBox").style.display = "none";
    localStorage.setItem(EXPERT.key("aoaTarget"), target);
    localStorage.setItem(EXPERT.key("aoaAttempts"), 0);
    localStorage.removeItem(EXPERT.key("aoaGameOver"));
    updateGiveUpCounter();

    textbar.value = "";
    textbar.disabled = false;
    setGiveUpEnabled(false);
    initializeAutocomplete(textbar, personas);
  });
  activeOpusFilters = _filterApi.getActive();

  personas = getFilteredPersonas();
  setTimeout(() => smartPreload(personas, "low"), 1500);
  initializeAutocomplete(textbar, personas);

  // ── Défi à cible dédiée (2026-07-17) : jouer la cible du défi, pas celle
  //    du jour. On la persiste dans aoaTarget (état wipé à l'acceptation) pour
  //    que le refresh mi-défi reprenne la même cible. ──
  const challengeTargetName = getActiveChallengeTarget("alloutattack");
  if (challengeTargetName && originalPersonas.includes(challengeTargetName)) {
    localStorage.setItem(EXPERT.key("aoaTarget"), challengeTargetName);
    localStorage.setItem(EXPERT.key("aoaAttempts"), localStorage.getItem(EXPERT.key("aoaAttempts")) || 0);
  }

  // ── Restore session ──
  const savedTarget = localStorage.getItem(EXPERT.key("aoaTarget"));
  const savedAttempts = parseInt(localStorage.getItem(EXPERT.key("aoaAttempts"))) || 0;
  const savedGameOver = localStorage.getItem(EXPERT.key("aoaGameOver")) === "true";

  if (savedTarget) {
    target = savedTarget;
    attempts = savedAttempts;
    gameOver = savedGameOver;

    const imageName = portraitsMap[target] || target.split(" ")[0];
    loadImageSafely(gifElement, cdn("allOutAttack", imageName), () => {
      gifElement.style.filter = gameOver
        ? "none"
        : gifFilter();
    });

    updateGiveUpCounter();

    if (gameOver) {
      const wasGiveup = localStorage.getItem(EXPERT.key("aoaForceReveal")) === "true";
      showVictoryBox(target, wasGiveup);
      disableInputs();
      revealNextLink({
        prevHref: "../emojiMode/emojiMode.html",
        nextHref: "../silhouetteMode/silhouette.html",
      });
    }

    if (attempts >= GIVE_UP_THRESHOLD) {
      setGiveUpEnabled(true);
    }
  } else {
    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
    gifElement.style.filter = "none";
    loadImageSafely(gifElement, cdn("allOutAttack", imageName), () => {
      gifElement.style.filter = gifFilter();
    });
    localStorage.setItem(EXPERT.key("aoaTarget"), target);
    localStorage.setItem(EXPERT.key("aoaAttempts"), 0);
  }

  // ── Buttons ──
  guessButton.addEventListener("click", handleGuess);
  document.getElementById("giveUpButton").addEventListener("click", giveUp);
  document.getElementById("resetButton").addEventListener("click", () => {
    localStorage.removeItem(EXPERT.key("aoaTarget"));
    localStorage.removeItem(EXPERT.key("aoaAttempts"));
    localStorage.removeItem(EXPERT.key("aoaGameOver"));
    localStorage.removeItem(EXPERT.key("aoaForceReveal"));
    resetGame(true); // true = random character, pas le daily
  });

  // ── Daily reset ──
  checkResetOnLoad("lastPlayedDate_AllOut", "AllOut", () => {
    localStorage.removeItem(EXPERT.key("aoaTarget"));
    localStorage.removeItem(EXPERT.key("aoaAttempts"));
    localStorage.removeItem(EXPERT.key("aoaGameOver"));
    location.reload();
  });
  setupDailyReset(() => {
    document.getElementById("resetButton")?.click() ?? location.reload();
  });
});
