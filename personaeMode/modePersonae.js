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
  buildGameSession,
  savePendingSession,
  getDailyTarget,
  showChallengeButton,
  showCommunityStats,
  applyDarkModeOverrides,
  parisDateKey,
  getActiveChallengeTarget,
  isChallengePlay,
  setGiveUpEnabled,
} from "../js/gameCore.js";

// Collapsible opus filter panel (shared across all modes)
import { initFilterMenu } from "../js/filterMenu.js";
import { checkChallengeCompletion } from "../js/challenge-result.js";
import { checkUnlocksAfterGame } from "../js/unlock-notify.js";
import { trackUniqueDay } from "../profile/badges/badgesManager.js";
import { closeAllAutocompleteLists } from "../js/autocomplete.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & STATE
// ─────────────────────────────────────────────────────────────────────────────

/** All specific opus codes available in Personae mode. */
const ALL_OPUS = [
  "P2IS",
  "P2EP",
  "P3",
  "P3FES",
  "P3P",
  "P3R",
  "P4",
  "P4G",
  "P4AU",
  "P5",
  "P5R",
  "P5S",
  "P5T",
  "P5X",
  "PTS",
];

let activeFilters = [...ALL_OPUS];
let filteredCharacters = [];
let target = null;
let attempts = 0;
const maxAttempts = 3; // Give Up unlocks after this many wrong guesses
let gameOver = false;

let sessionStartTime = Date.now();
// Frontière de journée en heure de Paris (jamais toISOString/UTC, cf. CLAUDE.md) —
// sinon la garde "déjà joué" bascule à minuit UTC (1-2h du matin à Paris).
const statsKey = `statsLogged_Personae_${parisDateKey()}`;

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
 * Clé d'identification utilisée pour référencer une entrée personae dans le
 * système de défi (localStorage `activeChallenge.target`, jamais affiché en
 * clair au joueur défié — vérifié dans tout le pipeline challenge-notif.js /
 * friends.js / api/messages/index.php, qui ne font que transporter la chaîne).
 *
 * Certaines personas partagent le même nom entre deux personnages différents
 * (ex. "Thanatos" : Makoto/Kotone en P3 vs Elizabeth en P4AU ; "Hermes" :
 * Junpei en P3 vs Jun Kurosu en P2IS ; "Prometheus" : Futaba en P5R vs Baofu
 * en P2EP). Résoudre un défi par simple nom (ancien comportement) retombe
 * toujours sur la PREMIÈRE entrée du tableau portant ce nom, quelle que soit
 * l'entrée réellement tirée — mauvaise réponse acceptée côté ami si la cible
 * tirée était la 2e entrée. Ici, seuls les noms réellement dupliqués dans le
 * dataset reçoivent un suffixe `::OPUS` ; le reste garde le nom simple
 * (rétro-compatible avec un défi déjà en vol créé avant ce fix).
 */
function challengeKey(c) {
  const dup = originalCharacters.filter((x) => x.persona === c.persona).length > 1;
  if (!dup) return c.persona;
  const opus = Array.isArray(c.opus) ? c.opus[0] : c.opus;
  return `${c.persona}::${opus}`;
}

/** Résout une clé de défi (voir challengeKey) vers l'entrée personae exacte. */
function findByChallengeKey(key) {
  if (!key) return null;
  const sepIndex = key.lastIndexOf("::");
  if (sepIndex === -1) return originalCharacters.find((c) => c.persona === key) ?? null;
  const personaName = key.slice(0, sepIndex);
  const opusHint = key.slice(sepIndex + 2);
  return (
    originalCharacters.find(
      (c) => c.persona === personaName && (Array.isArray(c.opus) ? c.opus[0] : c.opus) === opusHint
    ) ?? originalCharacters.find((c) => c.persona === personaName) ?? null
  );
}

/**
 * Picks the daily target and loads their persona image.
 * Uses seeded RNG from the full unfiltered pool by default; falls back to a
 * seeded pick from the filtered pool if the daily character isn't in the
 * active filters (so P4-only players never see a P5 character).
 */
function pickCharacter(random = false) {
  filteredCharacters = getFilteredCharacters();

  // Défi à cible dédiée (2026-07-17) : elle prime sur le tirage du jour ET sur
  // le random du Replay tant que le défi est actif (identifiée par le persona,
  // désambiguïsé par opus pour les noms dupliqués — cf. challengeKey()).
  const _challengeTargetName = getActiveChallengeTarget("personae");
  const _challengeChar = _challengeTargetName ? findByChallengeKey(_challengeTargetName) : null;

  if (_challengeChar) {
    target = _challengeChar;
  } else if (random && filteredCharacters.length) {
    const _prev = target;
    const _candidates =
      filteredCharacters.length > 1 && _prev
        ? filteredCharacters.filter((c) => c.persona !== _prev.persona)
        : filteredCharacters;
    target = _candidates[Math.floor(Math.random() * _candidates.length)] || filteredCharacters[0];
  } else {
    const daily = getDailyTarget(originalCharacters, "Personae");
    if (filteredCharacters.length && !filteredCharacters.some((c) => c.persona === daily.persona)) {
      target = getDailyTarget(filteredCharacters, "Personae");
    } else {
      target = daily;
    }
  }

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

  // Pattern ARIA combobox : rend la liste de suggestions perceptible par un
  // lecteur d'écran (elle était jusqu'ici purement visuelle/souris+clavier).
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "autocomplete-list");

  input.addEventListener("input", function () {
    closeAllAutocompleteLists();
    const val = this.value.trim();
    if (!val) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      return;
    }

    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    list.setAttribute("role", "listbox");
    this.parentNode.appendChild(list);
    input.setAttribute("aria-expanded", "true");

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

      let priority = 3;
      if (firstName.startsWith(lowerVal)) priority = 1;
      else if (lastName.startsWith(lowerVal)) priority = 2;
      else if (!lowerName.includes(lowerVal)) continue;
      matches.push({ name: displayName, priority });
    }

    matches.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    matches.forEach(({ name: nom }, idx) => {
      const imageName = portraitsMap[nom] || nom.split(" ")[0];
      const option = document.createElement("DIV");
      option.className = "list-options";
      option.id = `autocomplete-option-${idx}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.innerHTML = `
        <img src="../database/portraits/${encodeURIComponent(imageName)}.webp" alt="${nom}">
        <span class="codename">${nom}</span>
        <input type='hidden' value='${nom}'>
      `;
      option.addEventListener("click", function () {
        input.value = this.querySelector("input").value;
        handleGuess();
        closeAllAutocompleteLists();
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      });
      list.appendChild(option);
    });

    currentFocus = -1;
  });

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

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#autocomplete-list") && e.target !== input) {
      closeAllAutocompleteLists();
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
  });

  function updateActive(items) {
    items.forEach((i) => {
      i.classList.remove("autocomplete-active");
      i.setAttribute("aria-selected", "false");
    });
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", items[currentFocus].id);
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
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
  setGiveUpEnabled(false);

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
      }
    }

    // ── Nouveaux flags badges v2.1 ────────────────────────────────────────
    // Strega personas
    if (["Hypnos"].includes(target.persona) && !profile.foundHypnos) {
      profile.foundHypnos = true;
      profileUpdated = true;
    }
    if (["Moros"].includes(target.persona) && !profile.foundMoros) {
      profile.foundMoros = true;
      profileUpdated = true;
    }
    if (["Medea"].includes(target.persona) && !profile.foundMedea) {
      profile.foundMedea = true;
      profileUpdated = true;
    }

    // Twin Fist (Makoto Nijima = Johanna/Anat, Akihiko = Polydeuces/Caesar)
    if (["Johanna", "Anat"].includes(target.persona) && !profile.foundMakotoNijima) {
      profile.foundMakotoNijima = true;
      profileUpdated = true;
    }
    if (["Polydeuces", "Caesar"].includes(target.persona) && !profile.foundAkihiko) {
      profile.foundAkihiko = true;
      profileUpdated = true;
    }

    // Twin Spear (Kotone = Orpheus Female variants, Ken = Kala-Nemi)
    if (
      [
        "Orpheus ( Female )",
        "Orpheus Picaro ( Female )",
        "Orpheus Telos",
        "Thanatos",
        "Thanatos Picaro",
      ].includes(target.persona) &&
      !profile.foundKotone
    ) {
      profile.foundKotone = true;
      profileUpdated = true;
    }
    if (["Kala-Nemi"].includes(target.persona) && !profile.foundKen) {
      profile.foundKen = true;
      profileUpdated = true;
    }

    // Tradition & Modernité
    if (["Sukuna-Hikona", "Yamato-Takeru"].includes(target.persona) && !profile.foundNaotoPersona) {
      profile.foundNaotoPersona = true;
      profileUpdated = true;
    }
    // "Prometheus" existe pour 2 personnages différents (Futaba P5/P5R et Baofu
    // P2EP, cf. personaeCharacters.js) — vérifier target.user en plus du nom de
    // persona, sinon gagner sur Baofu débloquait ce flag par erreur.
    const targetUsers = Array.isArray(target.user) ? target.user : [target.user];
    if (
      ["Necronomicon", "Prometheus"].includes(target.persona) &&
      targetUsers.includes("Futaba Sakura") &&
      !profile.foundFutabaPersona
    ) {
      profile.foundFutabaPersona = true;
      profileUpdated = true;
    }

    // For Real (Ryuji)
    if (["Captain Kidd", "Seiten Taisei"].includes(target.persona) && !profile.foundRyujiPersona) {
      profile.foundRyujiPersona = true;
      profileUpdated = true;
    }

    // characterModeMap
    if (!profile.characterModeMap) profile.characterModeMap = {};
    const _charName = Array.isArray(target.user) ? target.user[0] : target.user;
    if (!profile.characterModeMap[_charName]) profile.characterModeMap[_charName] = [];
    if (!profile.characterModeMap[_charName].includes("personae")) {
      profile.characterModeMap[_charName].push("personae");
      profileUpdated = true;
    }

    if (attempts === 0 && !profile.hasWonFirstTry) {
      profile.hasWonFirstTry = true;
      profileUpdated = true;
    }

    if (profileUpdated) {
      localStorage.setItem("personaUserProfile", JSON.stringify(profile));
    }
  }

  // ── Result display ────────────────────────────────────────────────────────
  if (force) {
    const i18n = window.i18n || { t: (k, v) => k };
    victoryText.innerHTML = `<span class="failure-text">${i18n.t("modes.personae.giveup_reveal", { name: Array.isArray(target.user) ? target.user[0] : target.user, persona: target.persona })}</span>`;
    victoryText.className = "victory-message failure-text";
  } else {
    const i18n = window.i18n || { t: (k, v) => k };
    victoryText.innerHTML = `<span class="success-text">${i18n.t("modes.personae.correct", { name, persona: target.persona })}</span>`;
    victoryText.className = "victory-message success-text";
    showConfettiExplosion({ count: 30, spreadFrom: "bottom" });
  }

  victoryBox.style.display = "block";
  setTimeout(() => victoryBox.scrollIntoView({ behavior: "smooth", block: "center" }), 500);

  revealNextLink({
    prevHref: "../silhouetteMode/silhouette.html",
    nextHref: "../musicsMode/musics.html",
  });
  // Capturé AVANT checkChallengeCompletion (qui consomme activeChallenge) :
  // une partie de défi à cible dédiée ne se logge pas en session quotidienne.
  const wasChallengePlay = isChallengePlay("personae");
  if (!force)
    showChallengeButton(
      "personae",
      attempts,
      // La cible d'un défi Personae est identifiée par challengeKey() (nom du
      // persona, désambiguïsé par opus quand plusieurs entrées partagent le
      // même nom — voir pickCharacter() plus haut).
      filteredCharacters.filter((c) => c.persona !== target.persona).map((c) => challengeKey(c))
    );
  checkChallengeCompletion("personae", attempts, !force);
  showCommunityStats("personae", Array.isArray(target.user) ? target.user[0] : target.user);

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (!wasChallengePlay && !localStorage.getItem(statsKey)) {
    const result = force ? "giveup" : "win";
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({ result, mode: "Personae", timeSpent });
    savePendingSession(
      buildGameSession({
        mode: "Personae",
        targetName: Array.isArray(target.user) ? target.user[0] : target.user,
        result,
        attempts,
        timeMs: timeSpent * 1000,
        filters: activeFilters,
      })
    );
    localStorage.removeItem("playerProfile");
    localStorage.setItem(statsKey, "true");
  }

  localStorage.setItem("personaeGameOver", "true");
  const _pPersonae = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
  trackUniqueDay(_pPersonae, () =>
    localStorage.setItem("personaUserProfile", JSON.stringify(_pPersonae))
  );
  checkUnlocksAfterGame("Personae");
}

/**
 * Appends a wrong-guess portrait to the wrong-guesses list.
 * @param {string} name
 */
function showWrong(name) {
  const imageName = portraitsMap[name] || name.split(" ")[0];
  showWrongMini(`../database/portraits/${encodeURIComponent(imageName)}.webp`, name, wrongList);
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

  // Défi à cible dédiée : le give-up compte pour le défi (perdu, via
  // showVictory → checkChallengeCompletion) mais pas en session quotidienne.
  if (!isChallengePlay("personae") && !localStorage.getItem(statsKey)) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({ result: "giveup", mode: "Personae", timeSpent });
    savePendingSession(
      buildGameSession({
        mode: "Personae",
        targetName: Array.isArray(target.user) ? target.user[0] : target.user,
        result: "giveup",
        attempts,
        timeMs: timeSpent * 1000,
        filters: activeFilters,
      })
    );
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
function resetGame(random = false) {
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
  setGiveUpEnabled(false);
  textbar.disabled = false;
  textbar.value = "";
  guessBtn.disabled = false;
  wrongList.innerHTML = "";

  victoryBox.style.display = "none";
  victoryText.innerHTML = "";
  victoryImage.src = "";

  originalCharacters.forEach((c) => {
    c._guessed = false;
  });

  pickCharacter(random);
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE (personae-specific element)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies inline dark-mode overrides to the persona image box.
 * Called once on load; the global CSS handles the rest of dark-mode styling.
 */
function applyDarkModeStyles() {
  applyDarkModeOverrides([
    { selector: ".persona-box", styles: { backgroundColor: "#222", border: "3px solid #888" } },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__i18nReady) await window.__i18nReady;
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
    if (newActive.length === 0) return;
    resetGame();
  });
  activeFilters = _filterApi.getActive();

  guessBtn.addEventListener("click", handleGuess);
  resetBtn.addEventListener("click", () => resetGame(true));
  giveUpBtn.addEventListener("click", giveUp);

  initializeAutocomplete(
    textbar,
    personas.sort((a, b) => a.localeCompare(b))
  );

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
        // Toujours passer le propriétaire du persona (même sur abandon) pour que
        // son portrait s'affiche à la restauration — sinon `showVictory(true, null)`
        // laissait la zone image vide au refresh (bug remonté par Hamza), alors que
        // l'abandon EN DIRECT (l.534) passe bien le nom.
        const owner = Array.isArray(target.user) ? target.user[0] : target.user;
        showVictory(force, owner);
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
