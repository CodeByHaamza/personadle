// === IMPORTS ===
import { personas as originalPersonas } from "./database/personas_allOut.js";
import { portraitsMap } from "./database/portraitsMap.js";
import { aoaCharacters } from "./database/aoaCharacters.js";
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
    h === "" ||                        // file:// protocol
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    /^192\.168\./.test(h) ||           // LAN (Live Server on local IP)
    /^10\./.test(h)                    // LAN (corporate / VPN)
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

  const limited = namesList.slice(0, 15);
  for (const name of limited) {
    const base = portraitsMap[name] || name.split(" ")[0];
    const src = cdn("allOutAttack", base);
    if (getFromCache(src)) continue;

    const img = new Image();
    img.loading = priority === "high" ? "eager" : "lazy";
    img.src = src;

    const p = new Promise((resolve) => {
      img.onload = () => { addToImageCache(src, img); resolve(); };
      img.onerror = () => resolve();
    });

    if (priority === "high") await p;
    await new Promise((r) => setTimeout(r, priority === "high" ? 30 : 100));
  }

  isPreloading = false;
}

/**
 * Loads an image into `gifElement`, using the cache when available.
 * Falls back to loading.gif after a 10-second timeout.
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
  }, 10000);

  tempImg.src = src;
}

/** Displays the loading placeholder, preferring the cached version. */
function showLoading(gifElement) {
  gifElement.style.filter = "none";
  gifElement.style.opacity = "1";
  const cached = getFromCache("../img/loading.gif");
  if (cached) {
    gifElement.src = "../img/loading.gif";
  } else {
    const img = new Image();
    img.src = "../img/loading.gif";
    img.onload = () => { addToImageCache("../img/loading.gif", img); gifElement.src = "../img/loading.gif"; };
  }
}

// Fast lookup map: character name → aoaCharacter object
const AOA_BY_NAME = new Map(aoaCharacters.map((c) => [c.nom, c]));


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & STATE
// ─────────────────────────────────────────────────────────────────────────────

const todayKey = `statsLogged_AllOut_${new Date().toISOString().split("T")[0]}`;
let sessionStartTime = Date.now();

/** All specific opus codes available in AllOutAttack mode. */
const ALL_OPUS = ["P3", "P3FES", "P3P", "P5", "P5R", "P5X"];

let activeOpusFilters = [...ALL_OPUS];
let personas = [];      // mutable filtered list of character names
let attempts = 0;
let gameOver = false;
let target = null;
let lastFiveTargets = [];


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
    alert((window.i18n || { t: (k) => k }).t('modes.alloutattack.no_characters'));
    return null;
  }
  if (random && personas.length) {
    return personas[Math.floor(Math.random() * personas.length)];
  }
  return getDailyTarget(originalPersonas, 'AllOutAttack');
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches an autocomplete dropdown showing character portraits and names.
 * Supports codename + real-name display (e.g. "Crow (Akechi Goro)").
 *
 * @param {HTMLInputElement} element - The text input to enhance
 * @param {string[]}         array  - Current list of guessable names
 */
function initializeAutocomplete(element, array) {
  let currentFocus = -1;

  element.addEventListener("input", function () {
    const val = this.value.trim();
    closeList(null, element);
    if (!val) return;

    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);

    const lowerVal = val.toLowerCase();
    const matches = [];
    for (const displayName of array) {
      if (!displayName.toLowerCase().includes(lowerVal)) continue;
      const [firstName, lastName] = displayName.split(" ");
      let priority = 3;
      if (firstName?.toLowerCase().startsWith(lowerVal)) priority = 1;
      else if (lastName?.toLowerCase().startsWith(lowerVal)) priority = 2;
      matches.push({ name: displayName, priority });
    }

    matches.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    matches.forEach(({ name: displayName }) => {
      const imageName = portraitsMap[displayName] || displayName.split(" ")[0];
      const portraitName = encodeURIComponent(imageName);
      const realName = displayName.includes("(") ? displayName.split("(")[1].replace(")", "") : "";

      const option = document.createElement("DIV");
      option.className = "list-options";
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
        removeFromAutocomplete(element.value);
        handleGuess();
        closeList(null, element);
      });

      list.appendChild(option);
    });

    currentFocus = -1;
  });

  element.addEventListener("keydown", function (e) {
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

  function updateActive(items) {
    for (let item of items) item.classList.remove("autocomplete-active");
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  document.addEventListener("click", (e) => closeList(e.target, element));
}

function closeList(e, inputElement) {
  const items = document.getElementsByClassName("autocomplete-items");
  for (let item of items) {
    if (e !== item && e !== inputElement) item.remove();
  }
}

function removeFromAutocomplete(name) {
  const idx = personas.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  if (idx !== -1) personas.splice(idx, 1);
}


// ─────────────────────────────────────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────────────────────────────────────

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
  localStorage.setItem("aoaAttempts", attempts);
  updateGiveUpCounter();

  if (guess.toLowerCase() === target.toLowerCase()) {
    // ── Win ──────────────────────────────────────────────────────────────────
    checkSpecialBadges(target);
    document.getElementById("aoaGif").style.filter = "none";
    showVictoryBox(target);
    showConfettiExplosion();
    revealNextLink({
      prevHref: "../emojiMode/emojiMode.html",
      nextHref: "../silhouetteMode/silhouette.html",
    });
    showChallengeButton('alloutattack', attempts);
    checkChallengeCompletion('alloutattack', attempts, true);
    showCommunityStats('alloutattack', target);
    gameOver = true;
    localStorage.setItem("aoaGameOver", "true");

    if (!localStorage.getItem(todayKey)) {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
      updateProfileStats({ result: "win", mode: "All Out Attack", timeSpent });
      savePendingSession(buildGameSession({
        mode: "AllOutAttack", targetName: target, result: "win",
        attempts, timeMs: timeSpent * 1000,
      }));
      localStorage.setItem(todayKey, "1");

      // aoa_vision : victoire au 1er essai
      if (attempts === 1) {
        const _pa = JSON.parse(localStorage.getItem('personaUserProfile') || '{}');
        if (!_pa.hasWonAOAFirstTry) {
          _pa.hasWonAOAFirstTry = true;
          localStorage.setItem('personaUserProfile', JSON.stringify(_pa));
        }
      }
    }

    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", attempts);
    disableInputs();
  } else {
    // ── Wrong guess ──────────────────────────────────────────────────────────
    const imageName = portraitsMap[guess] || guess.split(" ")[0];
    showWrongMini(`./database/img/${imageName}.webp`, guess, document.getElementById("wrongGuessList"));
    removeFromAutocomplete(guess);

    const blurLevel = Math.max(20 - attempts * 3, 0);
    document.getElementById("aoaGif").style.filter = `blur(${blurLevel}px)`;
    input.value = "";
  }
}

/** Give Up: reveals the GIF and shows the victory box as a defeat screen. */
function giveUp() {
  if (attempts < 5 || gameOver) return;
  document.getElementById("aoaGif").style.filter = "none";
  localStorage.setItem("aoaForceReveal", "true");
  showVictoryBox(target, true);
  showConfettiExplosion();
  disableInputs();
  gameOver = true;

  if (!localStorage.getItem(todayKey)) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({ result: "giveup", mode: "All Out Attack", timeSpent });
    savePendingSession(buildGameSession({
      mode: "AllOutAttack", targetName: target, result: "giveup",
      attempts, timeMs: timeSpent * 1000,
    }));
    localStorage.setItem(todayKey, "1");
    revealNextLink({
      prevHref: "../emojiMode/emojiMode.html",
      nextHref: "../silhouetteMode/silhouette.html",
    });
  }

  checkChallengeCompletion('alloutattack', attempts, false);
  showCommunityStats('alloutattack', target);
  localStorage.setItem("aoaGameOver", "true");
  localStorage.setItem("aoaTarget", target);
  localStorage.setItem("aoaAttempts", attempts);
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
  showLoading(gifElement);

  const imageName = portraitsMap[target] || target.split(" ")[0];
  const newSrc = cdn("allOutAttack", imageName);
  loadImageSafely(gifElement, newSrc, () => { gifElement.style.filter = "blur(20px)"; });

  // Background preload of next characters
  setTimeout(() => smartPreload(personas, "low"), 800);

  input.disabled = false;
  input.value = "";
  document.getElementById("guessButton").disabled = false;
  document.getElementById("giveUpButton").disabled = true;
  document.getElementById("giveUpButton").style.cursor = "not-allowed";
  if (wrongListEl) wrongListEl.innerHTML = "";

  initializeAutocomplete(input, personas);
  updateGiveUpCounter();

  localStorage.setItem("aoaTarget", target);
  localStorage.setItem("aoaAttempts", attempts);
  localStorage.removeItem("aoaGameOver");

  const nav = document.getElementById("modeNavigationContainer");
  if (nav) { nav.style.display = "none"; nav.classList.remove("reveal-style"); }
}


// ─────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Updates the give-up counter display and enables/disables the button. */
function updateGiveUpCounter() {
  const counter = document.getElementById("giveUpCounter");
  const btn = document.getElementById("giveUpButton");
  if (counter) {
    counter.textContent = `(${attempts} / 5)`;
    counter.classList.toggle("activated", attempts >= 5);
  }
  if (btn) {
    btn.disabled = attempts < 5;
    btn.style.cursor = attempts >= 5 ? "pointer" : "not-allowed";
  }
}

function disableInputs() {
  document.getElementById("textbar").disabled = true;
  document.getElementById("guessButton").disabled = true;
  document.getElementById("giveUpButton").disabled = true;
  document.getElementById("giveUpButton").style.cursor = "not-allowed";
}

/**
 * Fills and shows the victory box with the character's battle image.
 * @param {string} name - Character name
 */
function showVictoryBox(name, force = false) {
  const baseName = (portraitsMap[name] || name.split(" ")[0]).trim();
  const box  = document.getElementById("victoryBox");
  const img  = document.getElementById("victoryImage");
  const text = document.getElementById("victoryText");
  const i18n = window.i18n || { t: (k) => k };

  img.src = `./database/img/${baseName}_Battle.webp`;
  img.alt = name;
  text.textContent = force
    ? i18n.t('modes.alloutattack.giveup_reveal', { name })
    : i18n.t('modes.alloutattack.correct',       { name });
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
    if (condition && !profile[flag]) { profile[flag] = true; shouldSave = true; }
  };

  check("foundCrow",        n.includes("crow")    && n.includes("akechi"));
  check("foundBlackMask",   n.includes("black mask") && n.includes("akechi"));
  check("foundWonderCNY",   n.includes("wonder")  && n.includes("chinese"));
  check("foundRinCNY",      n.includes("rin")     && n.includes("chinese"));
  check("foundWonderVelvet",n.includes("wonder")  && n.includes("velvet"));
  check("foundTwins",       n.includes("caroline") || n.includes("justine"));

  // ── Nouveaux flags v2.1 ───────────────────────────────────────────────
  // Twin Fist AOA
  check("foundMakotoNijimaAOA", n.includes("makoto nijima") || n.includes("queen"));
  check("foundAkihikoAOA",      n.includes("akihiko sanada"));

  // Twin Spear AOA
  check("foundKotoneAOA", n.includes("kotone") || n.includes("female protagonist"));
  check("foundKenAOA",    n.includes("ken amada"));

  // For Real AOA (Ryuji)
  check("foundRyujiAOA",  n.includes("ryuji sakamoto") || (n.includes("skull") && !n.includes("caroline")));

  // aoa_vision : victoire au 1er essai
  // (attempts est une variable locale du contexte d'appel, pas disponible ici — géré via profile.hasWonAOAFirstTry dans checkGuess)

  // characterModeMap
  if (!profile.characterModeMap) profile.characterModeMap = {};
  if (!profile.characterModeMap[characterName]) profile.characterModeMap[characterName] = [];
  if (!profile.characterModeMap[characterName].includes('alloutattack')) {
    profile.characterModeMap[characterName].push('alloutattack');
    shouldSave = true;
  }

  if (shouldSave) {
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));
    setTimeout(() => {
      if (window.forceCheckBadges) {
        window.forceCheckBadges(profile, (updated) => {
          localStorage.setItem("personaUserProfile", JSON.stringify(updated));
        });
      }
    }, 100);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE (AOA-specific element)
// ─────────────────────────────────────────────────────────────────────────────

function applyDarkModeStyles() {
  if (!document.body.classList.contains("darkmode")) return;

  const emojiZone = document.querySelector(".emoji-hint-zone");
  if (emojiZone) {
    emojiZone.style.background = "rgba(20, 20, 20, 0.7)";
    emojiZone.style.boxShadow = "0 0 12px rgba(255, 255, 255, 0.2)";
  }

  const textbar = document.getElementById("textbar");
  if (textbar) {
    textbar.style.backgroundColor = "#111";
    textbar.style.color = "#fff";
    textbar.style.border = "2px solid #666";
  }

  const gifZone = document.querySelector(".aoa-gif-zone");
  if (gifZone) {
    gifZone.style.background = "rgba(20, 20, 20, 0.8)";
    gifZone.style.borderColor = "#ffaaaa";
  }

  const victoryBox = document.getElementById("victoryBox");
  if (victoryBox) {
    victoryBox.style.backgroundColor = "#1a1a1a";
    victoryBox.style.color = "#90ee90";
    victoryBox.style.border = "3px solid #4caf50";
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__i18nReady) await window.__i18nReady;
  applyDarkModeStyles();
  setupRulesModal();

  const textbar = document.getElementById("textbar");
  const gifElement = document.getElementById("aoaGif");
  const guessButton = document.getElementById("guessButton");

  // ── Filtre opus — panneau déroulant ──
  const _filterApi = initFilterMenu("filters_AllOutAttack", ALL_OPUS, (newActive) => {
    activeOpusFilters = newActive;
    personas = getFilteredPersonas();

    if (!personas.length) { alert((window.i18n || { t: (k) => k }).t('game.no_characters_filters')); return; }

    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
    showLoading(gifElement);
    loadImageSafely(gifElement, cdn("allOutAttack", imageName), () => {
      gifElement.style.filter = "blur(20px)";
    });

    attempts = 0;
    document.getElementById("wrongGuessList").innerHTML = "";
    document.getElementById("victoryBox").style.display = "none";
    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", 0);
    localStorage.removeItem("aoaGameOver");
    updateGiveUpCounter();

    textbar.value = "";
    textbar.disabled = false;
    document.getElementById("giveUpButton").disabled = true;
    document.getElementById("giveUpButton").style.cursor = "not-allowed";
    initializeAutocomplete(textbar, personas);
  });
  activeOpusFilters = _filterApi.getActive();

  personas = getFilteredPersonas();
  setTimeout(() => smartPreload(personas, "low"), 1500);
  initializeAutocomplete(textbar, personas);

  // ── Restore session ──
  const savedTarget = localStorage.getItem("aoaTarget");
  const savedAttempts = parseInt(localStorage.getItem("aoaAttempts")) || 0;
  const savedGameOver = localStorage.getItem("aoaGameOver") === "true";

  if (savedTarget) {
    target = savedTarget;
    attempts = savedAttempts;
    gameOver = savedGameOver;

    const imageName = portraitsMap[target] || target.split(" ")[0];
    loadImageSafely(gifElement, cdn("allOutAttack", imageName), () => {
      gifElement.style.filter = gameOver ? "none" : `blur(${Math.max(20 - attempts * 3, 0)}px)`;
    });

    updateGiveUpCounter();

    if (gameOver) {
      const wasGiveup = localStorage.getItem("aoaForceReveal") === "true";
      showVictoryBox(target, wasGiveup);
      disableInputs();
      revealNextLink({
        prevHref: "../emojiMode/emojiMode.html",
        nextHref: "../silhouetteMode/silhouette.html",
      });
    }

    if (attempts >= 5) {
      document.getElementById("giveUpButton").disabled = false;
      document.getElementById("giveUpButton").style.cursor = "pointer";
    }
  } else {
    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
    gifElement.style.filter = "none";
    showLoading(gifElement);
    loadImageSafely(gifElement, cdn("allOutAttack", imageName), () => {
      gifElement.style.filter = "blur(20px)";
    });
    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", 0);
  }

  // ── Buttons ──
  guessButton.addEventListener("click", handleGuess);
  document.getElementById("giveUpButton").addEventListener("click", giveUp);
  document.getElementById("resetButton").addEventListener("click", () => {
    localStorage.removeItem("aoaTarget");
    localStorage.removeItem("aoaAttempts");
    localStorage.removeItem("aoaGameOver");
    resetGame(true);
  });

  // ── Daily reset ──
  checkResetOnLoad("lastPlayedDate_AllOut", "AllOut", () => {
    localStorage.removeItem("aoaTarget");
    localStorage.removeItem("aoaAttempts");
    localStorage.removeItem("aoaGameOver");
    location.reload();
  });
  setupDailyReset(() => {
    document.getElementById("resetButton")?.click() ?? location.reload();
  });
});
