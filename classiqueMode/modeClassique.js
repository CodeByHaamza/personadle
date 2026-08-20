// === IMPORTS ===
import { personas as originalPersonas } from "../database/personas.js";
import { portraitsMap } from "../database/portraitsMap.js";
import { characters } from "../database/characters_clean.js";
import { updateProfileStats } from "../profile/profileStats.js";

// Shared game utilities (confetti, navigation, modal, daily reset, filters)
import {
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
  applyDarkModeOverrides,
  enableGiveUpButton,
  showWrongMini,
  setGiveUpEnabled,
  startGame,
  isGameLogged,
  markGameLogged,
  characterMatchesActiveOpus,
  updateCounterElement,
  getActiveChallengeTarget,
  isChallengePlay,
  expertContext,
  setupExpertToggle,
  maskTerms,
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

const modeName = "Classic";

// ─────────────────────────────────────────────────────────────────────────────
// MODE EXPERT — la citation, et rien d'autre
// ─────────────────────────────────────────────────────────────────────────────
//
// Même page que le mode normal, distinguée par `?expert=1`. Le mode normal
// compare sept attributs (genre, âge, manieur, persona, arcane, opus…) ; l'Expert
// n'en montre aucun. Seule la citation du personnage est donnée, dès le premier
// essai, et une réponse est juste ou fausse — rien entre les deux.
const EXPERT = expertContext({
  prefix: "classicExpert",
  statsKey: modeName,
  hashMode: modeName,
});

/** Personnages tirables en Expert : ceux qui ont une citation à donner.
 *  Ordre = celui de characters_clean.js. Doit rester identique au pool
 *  `classic_expert` de api/data/daily_pools.json, sinon le serveur attend une
 *  autre cible et logue chaque partie en anti_cheat. */
const EXPERT_CHARACTERS = characters.filter((c) => String(c.quote ?? "").trim());

/** Minimum attempts before the Hint button activates. */
const HINT_THRESHOLD = 3;

/** Minimum attempts before the Give-Up button activates.
 *  5 en Expert (aligné sur Music Expert) : sans indice progressif, laisser 8 essais
 *  avant de pouvoir renoncer n'apporte que de la frustration. */
const GIVE_UP_THRESHOLD = EXPERT.isExpert ? 5 : 8;

/** All specific opus codes available in Classic mode. */
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
  "PTS",
];

let activeOpus = [...ALL_OPUS];

// Mutable list of names fed to the autocomplete (names are removed as guessed)
let personas = [...originalPersonas];

let gameOver = false;
let daltonianMode = localStorage.getItem("daltonianMode") === "enabled";
let attempts = parseInt(localStorage.getItem(EXPERT.key("attempts"))) || 0;

// Stats / session tracking
// Portée de l'enregistrement : une PARTIE, plus une journée (cf. startGame/
// isGameLogged, js/gameCore.js). 50 parties dans la soirée comptent 50 fois ;
// seule la streak reste journalière, et elle se calcule ailleurs.
const STATS_SCOPE = EXPERT.statsKey;
let statsAlreadyLogged = isGameLogged(STATS_SCOPE);
let sessionStartTime = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches an autocomplete dropdown to `element`.
 * Displays portrait thumbnails + highlighted match text for each suggestion.
 * Clicking a suggestion auto-submits the guess.
 *
 * @param {HTMLInputElement} element     - The text input to enhance
 * @param {string[]}         array       - Current list of guessable names
 */
function initializeAutocomplete(element, array) {
  let currentFocus = -1;
  let _debounceTimer = null;

  // Pattern ARIA combobox : rend la liste de suggestions perceptible par un
  // lecteur d'écran (elle était jusqu'ici purement visuelle/souris+clavier).
  element.setAttribute("role", "combobox");
  element.setAttribute("aria-autocomplete", "list");
  element.setAttribute("aria-expanded", "false");
  element.setAttribute("aria-controls", "autocomplete-list");

  element.addEventListener("input", function () {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      const val = this.value.trim();
      closeAutocompleteList(null, element);
      if (!val) return;

      const list = document.createElement("DIV");
      list.setAttribute("id", "autocomplete-list");
      list.setAttribute("class", "autocomplete-items");
      list.setAttribute("role", "listbox");
      this.parentNode.appendChild(list);
      element.setAttribute("aria-expanded", "true");

      // Build sorted match list (first-name start > last-name start > contains)
      const matches = [];
      for (let i = 0; i < array.length; i++) {
        const displayName = array[i];
        const lowerName = displayName.toLowerCase();
        const lowerVal = val.toLowerCase();
        if (!lowerName.includes(lowerVal)) continue;

        const [firstName, lastName] = displayName.split(" ");
        let priority = 3;
        if (firstName?.toLowerCase().startsWith(lowerVal)) priority = 1;
        else if (lastName?.toLowerCase().startsWith(lowerVal)) priority = 2;
        matches.push({ name: displayName, priority });
      }

      matches.sort((a, b) =>
        a.priority !== b.priority ? a.priority - b.priority : a.name.localeCompare(b.name)
      );

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
    }, 120); // fin debounce
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
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER / CHARACTER POOL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rebuilds the autocomplete list based on the currently active opus filters.
 * Also re-initialises the autocomplete listener on the text input.
 */
function filterCharacterPool() {
  // Exclure les noms déjà devinés pour que l'autocomplétion reste cohérente
  const history = JSON.parse(localStorage.getItem(EXPERT.key("guessHistory"))) || [];
  const guessedSet = new Set(history.map((n) => n.toLowerCase()));

  const filtered = originalPersonas.filter((name) => {
    if (guessedSet.has(name.toLowerCase())) return false;
    const character = characters.find((c) => c.nom === name);
    return characterMatchesActiveOpus(character, activeOpus);
  });

  // Mutation en place — le listener autocomplete garde la même référence tableau
  // (évite d'empiler de nouveaux listeners à chaque changement de filtre)
  personas.length = 0;
  personas.push(...filtered);
}

// ─────────────────────────────────────────────────────────────────────────────
// GUESS LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a string age range to a numeric midpoint for arrow comparison.
 * @param {string} age - e.g. "15-20", "40+"
 * @returns {number} Numeric value or -1 if unknown
 */
export function convertAgeToValue(age) {
  const map = { "< 15": 10, "15-20": 17.5, "21-40": 30, "40+": 50, "80+": 85 };
  return map[age] ?? -1;
}

/**
 * Pure comparison of a single guessed attribute against the target's value.
 * No DOM, no i18n — just the Wordle-style correct/misplaced/wrong decision
 * (plus an age arrow direction), so it can be unit-tested in isolation.
 *
 * @param {string} key       - Attribute key ("age", "genre", "arcane", "opus", …)
 * @param {*}      value     - The guessed character's value for this key
 * @param {*}      targetVal - The target character's value for this key
 * @returns {{status: "correct"|"misplaced"|"wrong", arrow: "up"|"down"|null}}
 */
export function compareAttribute(key, value, targetVal) {
  if (key === "age") {
    if (value === targetVal) return { status: "correct", arrow: null };
    const guessVal = convertAgeToValue(value);
    const targetValue = convertAgeToValue(targetVal);
    if (guessVal !== -1 && targetValue !== -1) {
      return { status: "misplaced", arrow: guessVal < targetValue ? "up" : "down" };
    }
    return { status: "wrong", arrow: null };
  }

  if (typeof value === "boolean" || typeof targetVal === "boolean") {
    return { status: value === targetVal ? "correct" : "wrong", arrow: null };
  }

  if (Array.isArray(targetVal)) {
    const guessArr = Array.isArray(value) ? value : [value];
    const intersection = guessArr.filter((v) => targetVal.includes(v));
    if (intersection.length === targetVal.length && guessArr.length === targetVal.length) {
      return { status: "correct", arrow: null };
    }
    if (intersection.length > 0) return { status: "misplaced", arrow: null };
    return { status: "wrong", arrow: null };
  }

  const isMatch =
    typeof value === "string" &&
    typeof targetVal === "string" &&
    value.toLowerCase() === targetVal.toLowerCase();
  return { status: isMatch ? "correct" : "wrong", arrow: null };
}

function fillVictoryBox(nom, isGiveup) {
  // Fin de partie : le mode Expert réaffiche sa citation sans masque. Un événement
  // plutôt qu'un appel direct — fillVictoryBox() est déclarée hors du scope où vit
  // la cible, et un événement évite de faire remonter cet état d'un cran.
  window.dispatchEvent(new CustomEvent("personadle:classic-reveal"));
  const i18 = window.i18n || { t: (k, v) => v?.name ?? k };
  const img = document.getElementById("victoryPortrait");
  const msg = document.getElementById("winMessage");
  if (img) {
    const imageName = portraitsMap[nom] || nom.split(" ")[0];
    img.src = `../database/portraits/${encodeURIComponent(imageName)}.webp`;
    img.alt = nom;
  }
  if (msg) {
    const key = isGiveup ? "modes.classic.giveup_reveal" : "modes.classic.correct";
    msg.textContent = i18.t(key, { name: nom });
  }
}

/**
 * Rend une tentative ratée en Mode Expert.
 *
 * Même présentation que l'historique d'erreurs du mode Émoji : une vignette du
 * portrait qui tremble, via `showWrongMini()` (js/gameCore.js). Pas de composant
 * propre — la grille de comparaison n'a aucun sens ici, mais réinventer une liste
 * d'erreurs alors que le jeu en a déjà une n'en avait pas davantage.
 *
 * Une bonne réponse n'y figure pas : elle termine la partie et la boîte de victoire
 * prend le relais, exactement comme en Émoji.
 *
 * @param {Object}  guess        personnage proposé
 * @param {Object}  target       cible secrète
 * @param {boolean} forceReveal  true en abandon
 */
function renderExpertGuess(guess, target, forceReveal) {
  if (guess.nom.toLowerCase() === target.nom.toLowerCase() || forceReveal) return;

  const imageName = portraitsMap[guess.nom] || guess.nom.split(" ")[0];
  showWrongMini(
    `../database/portraits/${encodeURIComponent(imageName)}.webp`,
    guess.nom,
    document.getElementById("wrongGuessList")
  );
}

/**
 * Validates a single guess against the current target and renders a
 * comparison row in the output grid.
 *
 * @param {string}  name         - The guessed character name
 * @param {Object}  target       - The secret character object
 * @param {boolean} [forceReveal=false] - If true, marks all cells as correct
 *                                        (used by Give Up)
 */
function checkGuess(name, target, forceReveal = false) {
  const output = document.getElementById("output");
  const guess = characters.find((c) => c.nom.toLowerCase() === name.toLowerCase());
  if (!guess) {
    output.innerHTML += `<p class="wrong">${(window.i18n || { t: (k, v) => k }).t("modes.classic.not_in_database", { name })}</p>`;
    return;
  }

  const isWin = guess.nom.toLowerCase() === target.nom.toLowerCase() || forceReveal;

  // ── Mode Expert : historique d'erreurs, pas de tableau ────────────────────
  // Rien à comparer, donc rien à aligner en colonnes. Les attributs ne sont ni
  // affichés ni construits dans le DOM — les masquer en CSS les laisserait
  // lisibles dans l'inspecteur.
  //
  // ⚠️ On saute la GRILLE, pas la fin de partie : la victoire, ses confettis et
  // l'enregistrement de session vivent dans le `if (isWin)` commun plus bas.
  if (EXPERT.isExpert) {
    renderExpertGuess(guess, target, forceReveal);
    removeFromAutocomplete(personas, guess.nom);
  } else {
    // Insert column headers on first guess
    if (!document.querySelector(".category-row")) {
      const i = window.i18n || { t: (k) => k };
      const categoryRow = document.createElement("div");
      categoryRow.classList.add("category-row");
      categoryRow.innerHTML = `
        <div></div>
        <div class="tooltip">${i.t("modes.classic.label_name")}<span class="tooltip-text">${i.t("modes.classic.tooltip_name")}</span></div>
        <div class="tooltip">${i.t("modes.classic.label_gender")}<span class="tooltip-text">${i.t("modes.classic.tooltip_gender")}</span></div>
        <div class="tooltip">${i.t("modes.classic.label_age")}<span class="tooltip-text">${i.t("modes.classic.tooltip_age")}</span></div>
        <div class="tooltip">${i.t("modes.classic.label_persona_user")}<span class="tooltip-text">${i.t("modes.classic.tooltip_persona_user")}</span></div>
        <div class="tooltip">${i.t("modes.classic.label_persona")}<span class="tooltip-text">${i.t("modes.classic.tooltip_persona")}</span></div>
        <div class="tooltip">${i.t("modes.classic.label_arcana")}<span class="tooltip-text">${i.t("modes.classic.tooltip_arcana")}</span></div>
        <div class="tooltip">${i.t("modes.classic.label_game")}<span class="tooltip-text">${i.t("modes.classic.tooltip_game")}</span></div>`;
      output.insertBefore(categoryRow, output.firstChild);
    }

    const row = document.createElement("div");
    row.classList.add("guess-row");

    // Portrait image
    const imageName = portraitsMap[guess.nom] || guess.nom.split(" ")[0];
    const img = document.createElement("img");
    img.src = `../database/portraits/${encodeURIComponent(imageName)}.webp`;
    img.alt = guess.nom;
    img.className = "guess-image";
    row.appendChild(img);

    const keysToCompare = ["nom", "genre", "age", "personaUser", "persona", "arcane", "opus"];
    const i18 = window.i18n || { t: (k) => k };
    // Labels affichés sur mobile via CSS ::before (data-label)
    const keyLabels = {
      nom: i18.t("modes.classic.label_name"),
      genre: i18.t("modes.classic.label_gender"),
      age: i18.t("modes.classic.label_age"),
      personaUser: i18.t("modes.classic.label_persona_user"),
      persona: i18.t("modes.classic.label_persona"),
      arcane: i18.t("modes.classic.label_arcana"),
      opus: i18.t("modes.classic.label_game"),
    };

    keysToCompare.forEach((key, index) => {
      const cell = document.createElement("div");
      cell.classList.add("guess-cell");
      cell.dataset.label = keyLabels[key] || key; // Pour l'affichage mobile ::before

      const value = guess[key];
      const targetVal = target[key];
      let displayValue;

      // Traduit une valeur atomique (genre ou arcane) via i18n
      const translateAtom = (ns, v) => {
        const translated = i18.t(`data.${ns}.${v}`);
        // Si la clé n'existe pas, t() retourne la clé brute → garder la valeur d'origine
        return translated === `data.${ns}.${v}` ? v : translated;
      };

      if (typeof value === "boolean") {
        displayValue = value ? i18.t("ui.yes") : i18.t("ui.no");
      } else if (key === "genre") {
        const vals = Array.isArray(value) ? value : [value];
        displayValue = vals.map((v) => translateAtom("genre", v)).join(", ");
      } else if (key === "arcane") {
        const vals = Array.isArray(value) ? value : [value];
        displayValue = vals.map((v) => translateAtom("arcane", v)).join(", ");
      } else {
        displayValue = Array.isArray(value) ? value.join(", ") : value;
      }

      // Determine cell colour: correct (green), misplaced (yellow), wrong (red)
      // — decision delegated to the pure compareAttribute() (unit-tested separately).
      if (isWin) {
        cell.classList.add("correct");
      } else {
        const { status, arrow } = compareAttribute(key, value, targetVal);
        cell.classList.add(status);
        if (key === "age" && arrow) {
          displayValue += arrow === "up" ? " ↑" : " ↓";
        } else if (typeof value === "boolean" || typeof targetVal === "boolean") {
          displayValue = value ? i18.t("ui.yes") : i18.t("ui.no");
        }
      }

      // Daltonian mode: replace colours with symbols + accessible palette
      if (daltonianMode) {
        let symbol = "";
        let bgColor = "";
        if (cell.classList.contains("correct")) {
          symbol = " ✔";
          bgColor = "#4F81BD";
        } else if (cell.classList.contains("misplaced")) {
          symbol = " ▲";
          bgColor = "#F79646";
        } else if (cell.classList.contains("wrong")) {
          symbol = " ✖";
          bgColor = "#A6A6A6";
        }
        cell.textContent = `${displayValue}${symbol}`;
        cell.style.backgroundColor = bgColor;
        cell.style.color = "white";
      } else {
        cell.textContent = displayValue;
      }

      // Flip-in animation staggered by column index
      setTimeout(() => cell.classList.add("flip"), 100 * (index + 1));
      row.appendChild(cell);
    });

    output.insertBefore(row, output.querySelector(".category-row")?.nextSibling);
    removeFromAutocomplete(personas, guess.nom);
  }

  if (isWin) {
    const textbar = document.getElementById("textbar");
    const guessButton = document.getElementById("guessButton");
    const giveUpButton = document.getElementById("giveUpButton");

    const wasFresh = !gameOver;
    // Capturé AVANT checkChallengeCompletion (qui consomme activeChallenge) :
    // une partie de défi à cible dédiée ne se logge pas en session quotidienne.
    const wasChallengePlay = isChallengePlay("classic");
    textbar.disabled = true;
    guessButton.style.pointerEvents = "none";
    giveUpButton.style.pointerEvents = "none";
    giveUpButton.style.opacity = "0.5";
    gameOver = true;
    document.querySelector(".input-row")?.classList.add("hidden");
    document.getElementById("autocompleteList")?.classList.add("hidden");

    // !forceReveal : un Give Up ne doit jamais se logger comme une victoire —
    // le handler du bouton Give Up (plus bas) logge lui-même le "giveup" une
    // fois checkGuess() revenu ; sans cette garde, statsAlreadyLogged passait
    // déjà à true ici et le "giveup" attendu était silencieusement ignoré.
    if (wasFresh && !statsAlreadyLogged && !forceReveal && !wasChallengePlay) {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
      if (!EXPERT.isExpert) updateProfileStats({ result: "win", mode: modeName, timeSpent });
      savePendingSession(
        buildGameSession({
          mode: modeName,
          targetName: target.nom,
          isExpert: EXPERT.isExpert,
          result: "win",
          attempts,
          timeMs: timeSpent * 1000,
          filters: activeOpus,
          clientSessionId: markGameLogged(STATS_SCOPE),
        })
      );
      statsAlreadyLogged = true;

      // ── Badge flags ──────────────────────────────────────────────────────
      const _pr = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");

      // one_shot : victoire en 1 essai
      if (attempts === 1 && !_pr.hasWonFirstTry) _pr.hasWonFirstTry = true;

      // night_owl / nyx_hour : heure Paris
      const _now = new Date();
      const _hour = parseInt(
        new Intl.DateTimeFormat("fr-FR", {
          timeZone: "Europe/Paris",
          hour: "numeric",
          hour12: false,
        }).format(_now),
        10
      );
      if (_hour >= 0 && _hour < 5) _pr.playedAtNight = true;
      if (_hour === 0 && _now.getMinutes() < 30) _pr.playedAtNyxHour = true;

      // shapeshifter : characterModeMap
      if (!_pr.characterModeMap) _pr.characterModeMap = {};
      const _tName = target.nom;
      if (!_pr.characterModeMap[_tName]) _pr.characterModeMap[_tName] = [];
      if (!_pr.characterModeMap[_tName].includes("classic"))
        _pr.characterModeMap[_tName].push("classic");

      localStorage.setItem("personaUserProfile", JSON.stringify(_pr));
      trackUniqueDay(_pr, () => localStorage.setItem("personaUserProfile", JSON.stringify(_pr)));
      if (!EXPERT.isExpert) checkUnlocksAfterGame(modeName);
    }

    // !forceReveal ici aussi : le handler Give Up gère déjà lui-même revealNextLink/
    // showCommunityStats/checkChallengeCompletion(…, false)/victoryBox après cet appel —
    // sans cette garde ils s'exécutaient deux fois (avec des arguments contradictoires
    // pour checkChallengeCompletion), et confettis + bouton "Challenge a friend"
    // apparaissaient à tort sur un Give Up (incohérent avec emojiMode, qui les gate déjà).
    if (wasFresh && !forceReveal) {
      showConfettiExplosion();
      revealNextLink({ nextHref: "../emojiMode/emojiMode.html" });
      showChallengeButton(
        "classic",
        attempts,
        characters.filter((c) => personas.includes(c.nom) && c.nom !== target.nom).map((c) => c.nom)
      );
      checkChallengeCompletion("classic", attempts, true);
      if (!EXPERT.isExpert) showCommunityStats(modeName, target.nom);
      fillVictoryBox(target.nom, false);
      document.getElementById("victoryBox").style.display = "block";
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE (classique-specific elements)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies inline dark-mode styles to elements specific to this mode.
 * Called once at startup; CSS handles the rest via the .darkmode class.
 */
function applyDarkModeStyles() {
  applyDarkModeOverrides([
    {
      selector: ".emoji-hint-zone",
      styles: {
        background: "rgba(20, 20, 20, 0.7)",
        boxShadow: "0 0 12px rgba(255, 255, 255, 0.2)",
      },
    },
    {
      selector: ".personadle-box",
      styles: {
        background: "rgba(10, 10, 10, 0.7)",
        color: "white",
        boxShadow: "0 0 10px rgba(255, 255, 255, 0.2)",
      },
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
  setupExpertToggle(EXPERT, "classiqueMode.html");

  const textbar = document.getElementById("textbar");
  textbar.value = "";
  const guessButton = document.getElementById("guessButton");
  const hintButton = document.getElementById("hintButton");
  const quoteHint = document.getElementById("quoteHint");
  const output = document.getElementById("output");
  const resetButton = document.getElementById("resetButton");
  const giveUpButton = document.getElementById("giveUpButton");
  const giveUpCounter = document.getElementById("giveUpCounter");
  const hintCounter = document.getElementById("hintCounter");

  // Daltonian toggle label
  const daltonianToggle = document.getElementById("daltonianToggle");
  if (daltonianToggle) {
    daltonianToggle.textContent = (window.i18n || { t: (k) => k }).t(
      daltonianMode ? "ui.daltonian_on" : "ui.daltonian_off"
    );
  }

  // ── Filtre opus — panneau déroulant ──
  const _filterApi = initFilterMenu("filters_Classic", ALL_OPUS, (newActive) => {
    activeOpus = newActive;
    if (newActive.length === 0) return;
    resetButton.click();
  });
  // Synchronise activeOpus avec ce qu'initFilterMenu a chargé depuis localStorage
  activeOpus = _filterApi.getActive();

  filterCharacterPool();
  // Lié une seule fois — filterCharacterPool() mute `personas` en place,
  // le listener voit toujours la liste à jour sans re-bind.
  initializeAutocomplete(textbar, personas);

  // ── Restore session state ──
  attempts = parseInt(localStorage.getItem(EXPERT.key("attempts"))) || 0;
  let target = JSON.parse(localStorage.getItem(EXPERT.key("target")));
  let history = JSON.parse(localStorage.getItem(EXPERT.key("guessHistory"))) || [];

  // If already won today, disable inputs and show navigation
  if (history.includes(target?.nom)) {
    gameOver = true;
    textbar.disabled = true;
    guessButton.disabled = true;
    setGiveUpEnabled(false);
    document.querySelector(".input-row")?.classList.add("hidden");
    document.getElementById("autocompleteList")?.classList.add("hidden");
    revealNextLink({ nextHref: "../emojiMode/emojiMode.html" });
    fillVictoryBox(target.nom, false);
    document.getElementById("victoryBox").style.display = "block";
  }

  // Défi à cible dédiée (2026-07-17) : jouer la cible du défi, pas celle du jour.
  // Persistée dans "target" (état wipé à l'acceptation) → un refresh mi-défi
  // reprend la même cible. Idempotent si déjà persistée.
  const challengeTargetName = getActiveChallengeTarget("classic");
  if (challengeTargetName) {
    const ct = characters.find((c) => c.nom === challengeTargetName);
    if (ct) {
      target = ct;
      localStorage.setItem(EXPERT.key("target"), JSON.stringify(target));
    }
  }

  // Pick daily target if none stored (seeded RNG — same character for all players today)
  if (!target) {
    // Pool ET clé de hash distincts en Expert : sans ça, jouer le mode normal
    // d'abord — où sept attributs sont comparés — donnerait la réponse du jour.
    target = EXPERT.isExpert
      ? getDailyTarget(EXPERT_CHARACTERS, EXPERT.hashMode)
      : getDailyTarget(characters, EXPERT.hashMode);
    localStorage.setItem(EXPERT.key("target"), JSON.stringify(target));
  }

  // Replay previous guesses to restore grid
  history.forEach((name) => checkGuess(name, target));

  updateCounters();
  if (attempts >= HINT_THRESHOLD) enableHintButton();
  if (attempts >= GIVE_UP_THRESHOLD) enableGiveUpButton();

  // ── Guess button ──
  guessButton.addEventListener("click", () => {
    if (gameOver) return;
    const guessName = textbar.value.trim();
    if (!guessName) return;
    attempts++;
    localStorage.setItem(EXPERT.key("attempts"), attempts);
    history.push(guessName);
    localStorage.setItem(EXPERT.key("guessHistory"), JSON.stringify(history));
    updateCounters();
    if (attempts >= HINT_THRESHOLD) enableHintButton();
    if (attempts >= GIVE_UP_THRESHOLD) enableGiveUpButton();
    checkGuess(guessName, target);
    textbar.value = "";
  });

  // ── Give Up button (available after GIVE_UP_THRESHOLD attempts) ──
  giveUpButton.addEventListener("click", () => {
    if (gameOver || attempts < GIVE_UP_THRESHOLD) return;

    if (target?.nom) checkGuess(target.nom, target, true);

    textbar.disabled = true;
    guessButton.disabled = true;
    giveUpButton.style.pointerEvents = "none";
    giveUpButton.style.opacity = "0.5";
    gameOver = true;
    document.querySelector(".input-row")?.classList.add("hidden");
    document.getElementById("autocompleteList")?.classList.add("hidden");

    if (!history.includes(target.nom)) {
      history.push(target.nom);
      localStorage.setItem(EXPERT.key("guessHistory"), JSON.stringify(history));
    }

    // Défi à cible dédiée : le give-up compte pour le défi (perdu) mais ne se
    // logge pas en session quotidienne. Capturé avant checkChallengeCompletion.
    const wasChallengePlay = isChallengePlay("classic");
    if (!statsAlreadyLogged && !wasChallengePlay) {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
      if (!EXPERT.isExpert) updateProfileStats({ result: "giveup", mode: modeName, timeSpent });
      savePendingSession(
        buildGameSession({
          mode: modeName,
          targetName: target.nom,
          isExpert: EXPERT.isExpert,
          result: "giveup",
          attempts,
          timeMs: timeSpent * 1000,
          filters: activeOpus,
          clientSessionId: markGameLogged(STATS_SCOPE),
        })
      );
      statsAlreadyLogged = true;
      // Give Up ne passait jamais par checkBadgesAfterGame() (seul le chemin victoire l'appelait,
      // cf. checkGuess()) — un badge comme ace_defective (10 give-ups) ne se débloquait donc
      // jamais tant qu'on n'allait pas sur le profil, jamais "en live" après l'action elle-même.
      if (!EXPERT.isExpert) checkUnlocksAfterGame(modeName);
    }

    checkChallengeCompletion("classic", attempts, false);
    if (!EXPERT.isExpert) showCommunityStats(modeName, target.nom);
    revealNextLink({ nextHref: "../emojiMode/emojiMode.html" });
    fillVictoryBox(target.nom, true);
    document.getElementById("victoryBox").style.display = "block";
  });

  // ── Indice Expert : la citation, tout de suite ──
  // Elle remplace le bouton Indice, qui n'aurait plus rien à révéler. Le nom de la
  // cible y est masqué à l'AFFICHAGE — certaines citations se nomment elles-mêmes.
  // La révélation de fin de partie réaffiche simplement le texte brut.
  //
  // Déclarée dans le scope d'init (et non dans le bloc Expert) pour que le bouton
  // Rejouer puisse la rappeler : sans ça, un replay masquait la citation et ne la
  // réaffichait jamais — le mode se retrouvait sans le moindre indice.
  let showExpertQuote = () => {};

  if (EXPERT.isExpert) {
    hintButton.style.display = "none";
    // Le compteur « (0 / 3) » compte les indices : sans bouton Indice il n'a plus
    // rien à compter, et il restait affiché à zéro pour toujours.
    document.getElementById("hintCounter")?.style.setProperty("display", "none");
    showExpertQuote = (reveal = false) => {
      if (!target?.quote) return;
      quoteHint.textContent = reveal ? target.quote : maskTerms([target.nom], target.quote, "▮▮▮");
      quoteHint.style.display = "block";
    };
    showExpertQuote();
    // Rejouée à la fin de partie par fillVictoryBox() via cet écouteur.
    window.addEventListener("personadle:classic-reveal", () => showExpertQuote(true));
  }

  // ── Hint button (available after HINT_THRESHOLD attempts) ──
  hintButton.addEventListener("click", () => {
    if (attempts < HINT_THRESHOLD) return;
    if (target?.quote) {
      quoteHint.textContent = target.quote;
      quoteHint.style.display = "block";
      hintButton.disabled = true;
      hintButton.style.cursor = "not-allowed";
      // Badge Navigator : compteur d'indices
      const _ph = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
      _ph.classicHintsUsed = (_ph.classicHintsUsed || 0) + 1;
      localStorage.setItem("personaUserProfile", JSON.stringify(_ph));
    }
  });

  // ── Reset / Replay button ──
  resetButton.addEventListener("click", () => {
    startGame(STATS_SCOPE);
    statsAlreadyLogged = false;
    sessionStartTime = Date.now();

    localStorage.removeItem(EXPERT.key("target"));
    localStorage.removeItem(EXPERT.key("attempts"));
    localStorage.removeItem(EXPERT.key("guessHistory"));
    attempts = 0;
    history = [];
    updateCounters();
    output.innerHTML = "";
    // L'historique d'erreurs Expert vit dans sa propre liste (showWrongMini), que
    // vider #output ne touche pas.
    const _wrongList = document.getElementById("wrongGuessList");
    if (_wrongList) _wrongList.innerHTML = "";
    document.getElementById("victoryBox").style.display = "none";
    quoteHint.style.display = "none";
    textbar.disabled = false;
    textbar.value = "";
    guessButton.disabled = false;
    guessButton.style.pointerEvents = "auto";
    hintButton.disabled = true;
    hintButton.style.cursor = "not-allowed";
    setGiveUpEnabled(false);
    giveUpButton.style.pointerEvents = "auto";
    giveUpButton.style.opacity = "1";
    giveUpCounter.textContent = `(0 / ${GIVE_UP_THRESHOLD})`;
    hintCounter.textContent = `(0 / ${HINT_THRESHOLD})`;
    gameOver = false;

    filterCharacterPool();

    // Pick from the filtered pool, never the same character twice in a row
    // En Expert, seuls les personnages ayant une citation sont jouables : sans
    // cette restriction, un replay pouvait tomber sur l'un des 4 sans réplique et
    // laisser le joueur sans aucun indice.
    const _pool = EXPERT.isExpert ? EXPERT_CHARACTERS : characters;
    const _filteredPool = _pool.filter((c) => personas.includes(c.nom));
    const _prevTarget = target;
    const _candidates =
      _filteredPool.length > 1 && _prevTarget
        ? _filteredPool.filter((c) => c.nom !== _prevTarget.nom)
        : _filteredPool;
    target = _candidates[Math.floor(Math.random() * _candidates.length)] || _filteredPool[0];
    localStorage.setItem(EXPERT.key("target"), JSON.stringify(target));

    // Après le nouveau tirage : la citation à deviner change aussi.
    showExpertQuote();

    const nav = document.getElementById("modeNavigationContainer");
    if (nav) {
      nav.style.display = "none";
      nav.classList.remove("reveal-style");
    }
  });

  // ── Daltonian mode toggle ──
  daltonianToggle?.addEventListener("click", () => {
    daltonianMode = !daltonianMode;
    localStorage.setItem("daltonianMode", daltonianMode ? "enabled" : "disabled");
    daltonianToggle.textContent = (window.i18n || { t: (k) => k }).t(
      daltonianMode ? "ui.daltonian_on" : "ui.daltonian_off"
    );
    location.reload();
  });

  // ── Daily reset (auto-resets at Paris midnight) ──
  checkResetOnLoad("lastPlayedDate_Classic", "Classic", () => {
    if (localStorage.getItem("activeChallenge")) return;
    resetButton.click();
  });
  setupDailyReset(() => {
    resetButton?.click() ?? location.reload();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COUNTER HELPERS (scoped to DOMContentLoaded but defined here for clarity)
// ─────────────────────────────────────────────────────────────────────────────

function updateCounters() {
  const attempts = parseInt(localStorage.getItem(EXPERT.key("attempts"))) || 0;
  updateCounterElement("hintCounter", attempts, HINT_THRESHOLD);
  updateCounterElement("giveUpCounter", attempts, GIVE_UP_THRESHOLD);
}

function enableHintButton() {
  const hintButton = document.getElementById("hintButton");
  if (hintButton) {
    hintButton.disabled = false;
    hintButton.style.cursor = "pointer";
  }
}

// enableGiveUpButton() est maintenant importée de gameCore.js (identique dans tous les modes).
