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
import { expertLyrics } from "./database/expert_lyrics.js";
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
  getActiveChallengeTarget,
  isChallengePlay,
  maskTerms,
  expertContext,
  setupExpertToggle,
  setGiveUpEnabled,
  startGame,
  isGameLogged,
  markGameLogged,
} from "../js/gameCore.js";

// Collapsible opus filter panel (shared across all modes)
import { initFilterMenu } from "../js/filterMenu.js";
import { checkChallengeCompletion } from "../js/challenge-result.js";
import { trackUniqueDay } from "../profile/badges/badgesManager.js";
import { checkUnlocksAfterGame } from "../js/unlock-notify.js";
import { closeAllAutocompleteLists } from "../js/autocomplete.js";

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
  // P3FES — rouge, comme la jaquette de FES, et non le bleu du P3 d'origine.
  // Volontairement plus chaud et plus sombre que le rouge P5 (#e63946) et distinct
  // du bordeaux P5X (#c0193a) : trois rouges cohabitent, ils doivent rester
  // reconnaissables l'un de l'autre.
  P3FES: { accent: "#d61f26", dark: "#8f0f18", light: "#ff6b60", glow: "rgba(214,31,38,{a})" },
  // P3P — Makoto (bleu) + Kotone (rose) : bordure et bouton indigo, barre dégradée
  // bleu→rose. `duality` active en plus la bordure tournante mi-bleu mi-rose autour
  // du player (voir .p3p-duality dans music.css).
  P3P: {
    accent: "#818cf8",
    dark: "#3b82f6",
    light: "#f9a8d4",
    glow: "rgba(129,140,248,{a})",
    gradientFill: "linear-gradient(90deg, #1d4ed8, #3b82f6 30%, #c084fc 65%, #ec4899)",
    duality: true,
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
  // VELVET (Velvet Room) — bleu profond dédié aux morceaux transversaux à toute
  // la série (ex: Aria of the Souls, présente dans tous les Persona majeurs) :
  // ne pas les rattacher visuellement à un seul opus.
  VELVET: { accent: "#151da6", dark: "#0d1370", light: "#5b63d6", glow: "rgba(21,29,166,{a})" },
};

/** Maximum number of guesses before the "Give Up" button is enabled. */
const MAX_ATTEMPTS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// MODE EXPERT
// ─────────────────────────────────────────────────────────────────────────────
//
// Même page, même logique : filtres, autocomplétion, défis, reset quotidien et
// victoire sont identiques. Seuls changent l'indice (les paroles au lieu de
// l'audio), le pool, le nombre d'essais et les clés localStorage.
// Dupliquer la page aurait voulu dire maintenir 1600 lignes en double.
//
// L'état vit dans l'URL (`?expert=1`) et non en localStorage : le mode reste
// partageable et bookmarkable, un rechargement ne perd rien, et il n'y a pas
// d'état caché qui ferait qu'une même URL affiche deux jeux différents.

// Même plomberie partagée que les 5 autres modes. Music la réimplémentait à la
// main (détection d'URL, clés, libellé du lien de bascule) : deux copies de la même
// logique, dont une seule aurait reçu le prochain correctif.
const EXPERT = expertContext({ prefix: "musicExpert", statsKey: "Music", hashMode: "Music" });

/** Vrai si la page tourne en Mode Expert. */
const IS_EXPERT = EXPERT.isExpert;

/** Essais ratés avant que « Abandonner » se débloque en Expert (décision 2026-08-15). */
const EXPERT_GIVE_UP_AFTER = 5;

/** Préfixe des clés localStorage — sépare intégralement les deux parties du jour. */
const KEY_PREFIX = IS_EXPERT ? "musicExpert" : "music";

/** Suffixe des clés de stats/date, aligné sur le vocabulaire des modes. */
const STATS_KEY = EXPERT.statsKey;

/** Chansons éligibles à l'Expert : celles qui ont des paroles (pas les instrumentales).
 *  L'ordre est celui de songs.js — il DOIT rester identique au pool `music_expert`
 *  de api/data/daily_pools.json, sinon le serveur attend une autre cible et logue
 *  chaque partie en anti_cheat. `npm run pools:build` régénère les deux depuis ici. */
const EXPERT_SONGS = originalSongs.filter((s) => expertLyrics[s.titre]);

/** Les vers de la cible courante, ou [] hors Expert. */
function targetLyrics() {
  return (target && expertLyrics[target.titre]) || [];
}

/**
 * Essais ratés nécessaires pour débloquer « Abandonner » — c'est AUSSI le
 * dénominateur affiché sous le bouton. Le compteur mesure la progression vers le
 * déblocage (3/3 en normal), pas le stock d'indices : en Expert il y a 5 à 30 vers
 * à révéler, mais l'abandon se débloque toujours à 5.
 */
function giveUpThreshold() {
  return IS_EXPERT ? EXPERT_GIVE_UP_AFTER : MAX_ATTEMPTS;
}

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

// Portée de l'enregistrement : une PARTIE, plus une journée (cf. startGame/
// isGameLogged, js/gameCore.js). 50 parties dans la soirée comptent 50 fois ;
// seule la streak reste journalière, et elle se calcule ailleurs.
const STATS_SCOPE = STATS_KEY;

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

  // ⚠️ NE PAS réintroduire de renvoi vers le mode normal depuis Music Expert.
  //
  // Un bloc le faisait ici jusqu'au 2026-09-02, écrit avant que les défis Expert
  // n'existent : un défi étant alors forcément « normal », le rejouer en Expert
  // n'avait pas de sens (barème incomparable) et cassait sur un instrumental,
  // sans parole à révéler. Son propre commentaire annonçait la suite — « les défis
  // Expert demandent une colonne dédiée sur `messages` » — livrée depuis par la
  // migration 037. Sa raison d'être avait donc disparu.
  //
  // Il éjectait alors les joueurs : `getPendingActiveChallenge()` sans argument
  // lit la dimension de la PAGE, donc `activeChallengeExpert` sur `?expert=1`. Il
  // détectait un défi Expert… et renvoyait vers le mode normal — l'inverse de ce
  // qu'il fallait. Le joueur était piégé : le défi vivant en localStorage, ni un
  // rechargement forcé ni un déblocage admin n'y changeaient rien, et la bannière
  // du mode normal ne lit pas la case Expert, donc pas de bouton Abandonner non plus.
  //
  // Plus rien à garder ici : les deux dimensions sont cloisonnées. Un défi NORMAL
  // vit dans `activeChallenge` et `getActiveChallengeTarget()` ne le voit pas en
  // Expert — il ne peut donc pas y imposer sa cible. Un défi EXPERT tire la sienne
  // dans le pool Expert, d'où les instrumentaux sont déjà exclus (faute de paroles).

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
  const savedTarget = localStorage.getItem(`${KEY_PREFIX}Target`);
  const savedAttempts = localStorage.getItem(`${KEY_PREFIX}Attempts`);
  const savedGameOver = localStorage.getItem(`${KEY_PREFIX}GameOver`);
  const savedTried = localStorage.getItem(`${KEY_PREFIX}TriedTitles`);
  const savedForceReveal = localStorage.getItem(`${KEY_PREFIX}ForceReveal`);

  if (savedTarget) {
    // Resume an in-progress or finished game
    target = JSON.parse(savedTarget);
    attempts = savedAttempts ? parseInt(savedAttempts, 10) : 0;
    triedTitles = savedTried ? JSON.parse(savedTried) : [];
    gameOver = savedGameOver === "true";

    audioPlayer.src = `./database/music/song/${target.fichier}`;
    audioPlayer.load();

    setPlayerTheme(target);

    giveUpCounter.textContent = `(${Math.min(attempts, giveUpThreshold())} / ${giveUpThreshold()})`;
    if (attempts >= giveUpThreshold()) {
      setGiveUpEnabled(true);
      giveUpCounter.classList.add("activated");
    }

    renderLyrics();

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
  applyExpertChrome();
  initCustomPlayer();
  setupRulesModal(); // ← shared utility

  guessBtn.addEventListener("click", handleGuess);
  resetBtn.addEventListener("click", () => resetGame(true));
  giveUpBtn.addEventListener("click", giveUp);

  initializeAutocomplete(textbar);

  // ── Daily reset checks ─────────────────────────────────────────────────────
  checkResetOnLoad(
    // ← shared utility
    `lastPlayedDate_${STATS_KEY}`,
    STATS_KEY,
    () => resetBtn.click()
  );

  setupDailyReset(() => {
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
  // En Expert, seules les chansons à paroles sont jouables.
  return (IS_EXPERT ? EXPERT_SONGS : originalSongs).filter((song) => {
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

  // Défi à cible dédiée (2026-07-17) : elle prime sur le tirage du jour ET sur
  // le random du Replay tant que le défi est actif.
  const _challengeTargetName = getActiveChallengeTarget("music");
  const _challengeSong = _challengeTargetName
    ? originalSongs.find((s) => s.titre === _challengeTargetName)
    : null;

  if (_challengeSong) {
    target = _challengeSong;
  } else if (random && filteredSongs.length) {
    const _prev = target;
    const _candidates =
      filteredSongs.length > 1 && _prev
        ? filteredSongs.filter((s) => s.titre !== _prev?.titre)
        : filteredSongs;
    target = _candidates[Math.floor(Math.random() * _candidates.length)] || filteredSongs[0];
  } else {
    // Pool ET clé de hash distincts en Expert : le tirage doit être indépendant
    // du mode normal, sinon jouer le normal d'abord (où l'audio est donné) offre
    // la réponse. La chaîne "MusicExpert" doit rester identique à celle de
    // api/lib/daily_target.php, sinon chaque partie est loguée en anti_cheat.
    target = getDailyTarget(IS_EXPERT ? EXPERT_SONGS : originalSongs, EXPERT.hashMode);
  }

  audioPlayer.src = `./database/music/song/${target.fichier}`;
  audioPlayer.load();

  localStorage.setItem(`${KEY_PREFIX}Target`, JSON.stringify(target));
  localStorage.setItem(`${KEY_PREFIX}Attempts`, attempts);
  localStorage.setItem(`${KEY_PREFIX}GameOver`, "false");
}



/**
 * Bascule la page entre habillage normal et habillage Expert.
 *
 * En Expert : le lecteur audio disparaît (il donnerait la réponse), le panneau de
 * paroles prend sa place, et le bouton bascule vers le retour au mode normal.
 * Tout le reste — filtres, autocomplétion, victoire, défis — est partagé.
 */
function applyExpertChrome() {
  const lyricsBox = document.getElementById("expertLyricsBox");

  // body.expert-mode, libellé/href du lien de bascule et blocs de règles : c'est
  // le patron commun aux 6 modes, il vit dans gameCore.
  setupExpertToggle(EXPERT, "musics.html");

  // Seul l'habillage propre à Music reste ici.
  if (audioBox) audioBox.style.display = IS_EXPERT ? "none" : "";
  if (lyricsBox) lyricsBox.style.display = IS_EXPERT ? "" : "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// PAROLES (Mode Expert)
// ─────────────────────────────────────────────────────────────────────────────

/** Index du dernier vers déjà tapé — évite de retaper à chaque re-rendu. */
let dernierVersTape = -1;
/** Timer de la machine à écrire en cours, annulé si un re-rendu survient. */
let timerFrappe = null;

/**
 * Écrit un vers caractère par caractère, façon karaoké. Le curseur est une
 * classe CSS, pas un caractère dans le texte : sinon il resterait collé au vers
 * si la frappe est interrompue en cours de route.
 */
function taperVers(li, texte, vitesse = 28) {
  clearInterval(timerFrappe);
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    li.textContent = texte;
    return;
  }
  li.textContent = "";
  li.classList.add("typing");
  let i = 0;
  timerFrappe = setInterval(() => {
    li.textContent = texte.slice(0, ++i);
    if (i >= texte.length) {
      clearInterval(timerFrappe);
      timerFrappe = null;
      li.classList.remove("typing");
    }
  }, vitesse);
}

/**
 * Affiche les paroles révélées jusqu'ici, façon lecteur de streaming : les vers
 * déjà obtenus restent visibles au-dessus, le dernier est mis en avant, et la
 * liste défile automatiquement dessus.
 *
 * Le titre est masqué tant que la partie court — 31 chansons sur 73 le citent
 * dans leurs propres paroles (« Burn my dread »), ce qui donnerait la réponse.
 * Le masquage se fait ICI, à l'affichage : les données restent brutes, donc la
 * révélation de fin de partie n'a qu'à réafficher sans masque.
 *
 * @param {boolean} [reveal=false] - true en fin de partie : tout, sans censure.
 */
function renderLyrics(reveal = false) {
  const list = document.getElementById("expertLyricsList");
  if (!list || !IS_EXPERT) return;

  const vers = targetLyrics();
  // 1 vers au départ, +1 par essai raté. En révélation, tout d'un coup.
  const shown = reveal ? vers.length : Math.min(attempts + 1, vers.length);

  list.innerHTML = "";
  let aTaper = null;
  for (let i = 0; i < shown; i++) {
    const li = document.createElement("li");
    li.className = "expert-lyric-line";
    if (!reveal && i === shown - 1) li.classList.add("current");
    if (reveal && i >= attempts + 1) li.classList.add("unheard");
    const texte = reveal ? vers[i] : maskTerms([target.titre], vers[i], "▮▮▮▮");
    // Machine à écrire sur le SEUL vers qui vient d'être gagné. Un re-rendu de
    // la même partie (changement de filtre, révélation) réaffiche d'un coup :
    // retaper un vers déjà lu donnerait l'impression d'un bug, pas d'un effet.
    if (!reveal && i === shown - 1 && i > dernierVersTape) aTaper = { li, texte };
    else li.textContent = texte;
    list.appendChild(li);
  }
  if (aTaper) {
    dernierVersTape = shown - 1;
    taperVers(aTaper.li, aTaper.texte);
  } else if (shown - 1 > dernierVersTape) {
    dernierVersTape = shown - 1;
  }

  const counter = document.getElementById("expertLyricsCount");
  if (counter) counter.textContent = `${shown} / ${vers.length}`;

  // Suivre le vers courant sans arracher la lecture des précédents : on scrolle
  // le conteneur, le joueur peut remonter librement.
  list.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    }
  }

  // 🔥 MEMENTO MORI — Find "Burn My Dread" (P3 title theme)
  if (!force && currentTitle === normalize("Burn My Dread")) {
    if (!profile.foundBurnMyDread) {
      profile.foundBurnMyDread = true;
      hasChanges = true;
    }
  }

  // 🌙 HIPPOCAMPUS RELOAD — Find the ZUTOMAYO collab track
  if (!force && currentTitle.includes("zutomayo")) {
    if (!profile.foundZutomayo) {
      profile.foundZutomayo = true;
      hasChanges = true;
    }
  }

  // 🌊 OUR LIGHT — Give up on the P3R ending theme
  const titleRaw = (target?.titre || "").toLowerCase();
  if (force && titleRaw.includes("our light") && !profile.gaveUpOnOurLight) {
    profile.gaveUpOnOurLight = true;
    hasChanges = true;
  }

  // 🏠 SECRET BASE — Find the P4 Dojima/Nanako theme
  if (!force && titleRaw.includes("secret base") && !profile.foundSecretBase) {
    profile.foundSecretBase = true;
    hasChanges = true;
  }

  // 🎬 WHEN MOTHER WAS THERE — Find the P4 track
  //
  // Les alias "kimi no kioku" / "memories of you" ont été retirés en 2.1 : c'étaient
  // des filets de sécurité posés quand aucune chanson de ce nom n'existait dans
  // songs.js. « Memories of You » y est entrée depuis (thème de fin P3R), et ces
  // alias auraient débloqué la moitié du badge Chronological Convergence sur la
  // MAUVAISE chanson. Le flag est persisté : personne ne perd un badge déjà obtenu.
  if (!force && titleRaw.includes("when mother was there") && !profile.foundWhenMotherWasThere) {
    profile.foundWhenMotherWasThere = true;
    hasChanges = true;
  }

  // 🌸 FALSE SPRING — Give up on "Memories of You" (thème de fin de P3R)
  // Pendant du badge Gentle Illusion sur « Our Light » : abandonner face au thème
  // de la fin, c'est choisir de rester assis à côté de Ryoji plutôt que d'aller
  // au bout.
  if (force && titleRaw.includes("memories of you") && !profile.gaveUpOnMemoriesOfYou) {
    profile.gaveUpOnMemoriesOfYou = true;
    hasChanges = true;
  }

  // 🎯 ONE SHOT — first-try win
  // `attempts` vaut 1 sur une victoire au premier essai : les modes incrementent
  // AVANT de tester la victoire. Le test portait sur 0, donc ce badge n'etait
  // jamais decerne (corrige en 2.1).
  if (!force && attempts === 1 && !profile.hasWonFirstTry) {
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

  // ── Enregistrement de la partie ────────────────────────────────────────────
  // Une partie de défi à cible dédiée ne se logge pas en session quotidienne.
  if (!isChallengePlay("music") && !isGameLogged(STATS_SCOPE)) {
    const result = force ? "giveup" : "win";
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    // Pas d'updateProfileStats() en Expert : ces stats client alimentent le mode
    // Music normal (victoires, streak, temps de jeu) et le serveur les exclut
    // déjà (user_stats intouché, cf. api/lib/game_session.php). Les compter ici
    // ferait diverger le profil local du backend au prochain pullProfileFromCloud.
    if (!IS_EXPERT) updateProfileStats({ result, mode: "Music", timeSpent });
    savePendingSession(
      buildGameSession({
        mode: "Music",
        targetName: target.titre,
        result,
        attempts,
        timeMs: timeSpent * 1000,
        isExpert: IS_EXPERT,
        clientSessionId: markGameLogged(STATS_SCOPE),
      })
    );
  }

  // Les conditions de déblocage portent sur les stats du mode normal, que
  // l'Expert ne touche pas — l'appel serait un no-op. Un badge « Expert » viendra
  // avec sa propre condition (ROADMAP v2.1 : badge une fois les 6 modes battus).
  if (!IS_EXPERT) checkUnlocksAfterGame("Music");

  // ── UI ─────────────────────────────────────────────────────────────────────
  // Fin de partie : la censure tombe, on affiche les paroles entières en clair.
  renderLyrics(true);
  textbar.disabled = true;
  guessBtn.disabled = true;
  setGiveUpEnabled(false);

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
    // Le bouton s'affiche AUSSI en Expert depuis la 2.1. La garde `!IS_EXPERT`
    // qui était ici datait d'avant les défis Expert : à l'époque le destinataire
    // aurait joué en mode normal (audio donné), donc avec un score incomparable.
    // La PR #85 a réglé ça — `showChallengeButton()` transmet désormais
    // `challenge_is_expert` (gameCore.js), et l'acceptation redirige vers
    // `?expert=1` (challenge-notif.js). La garde est restée par oubli.
    showChallengeButton(
      "music",
      attempts,
      filteredSongs.filter((s) => s.titre !== target.titre).map((s) => s.titre)
    );
  }
  checkChallengeCompletion("music", attempts, !force);
  if (!IS_EXPERT) showCommunityStats("music", target.titre);

  localStorage.setItem(`${KEY_PREFIX}GameOver`, "true");

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
  localStorage.setItem(`${KEY_PREFIX}Attempts`, attempts);
  localStorage.setItem(`${KEY_PREFIX}TriedTitles`, JSON.stringify(triedTitles));

  giveUpCounter.textContent = `(${Math.min(attempts, giveUpThreshold())} / ${giveUpThreshold()})`;

  if (attempts >= giveUpThreshold()) {
    setGiveUpEnabled(true);
    giveUpCounter.classList.add("activated");
  }

  if (normalize(guess) === normalize(target.titre)) {
    showVictory(false);
  } else {
    showWrong(guess);
    renderLyrics(); // un vers de plus
  }

  textbar.value = "";
}

/**
 * Triggered when the player clicks "Give Up".
 * Débloqué après giveUpThreshold() mauvaises réponses (3 en normal, 5 en Expert).
 */
function giveUp() {
  if (attempts < giveUpThreshold() || gameOver) return;

  gameOver = true;
  localStorage.setItem(`${KEY_PREFIX}ForceReveal`, "true");

  // Log stats if not already done — jamais pour une partie de défi à cible
  // dédiée (le give-up compte pour le défi via showVictory, pas en quotidien).
  if (!isChallengePlay("music") && !isGameLogged(STATS_SCOPE)) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    if (!IS_EXPERT) updateProfileStats({ result: "giveup", mode: "Music", timeSpent });
    savePendingSession(
      buildGameSession({
        mode: "Music",
        targetName: target.titre,
        result: "giveup",
        attempts,
        timeMs: timeSpent * 1000,
        isExpert: IS_EXPERT,
        clientSessionId: markGameLogged(STATS_SCOPE),
      })
    );
  }

  showVictory(true);
}

/**
 * Resets all state and starts a new round.
 * Called on page load (no saved target), by filter changes, and by daily reset.
 */
function resetGame(random = false) {
  // Clear all Music-mode localStorage keys
  localStorage.removeItem(`${KEY_PREFIX}Target`);
  localStorage.removeItem(`${KEY_PREFIX}Attempts`);
  localStorage.removeItem(`${KEY_PREFIX}GameOver`);
  localStorage.removeItem(`${KEY_PREFIX}TriedTitles`);
  localStorage.removeItem(`${KEY_PREFIX}ForceReveal`);
  startGame(STATS_SCOPE);
  dernierVersTape = -1;

  // Reset in-memory state
  gameOver = false;
  attempts = 0;
  triedTitles = [];
  sessionStartTime = Date.now();

  // Reset UI
  giveUpCounter.classList.remove("activated");
  setGiveUpEnabled(false);
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
  if (target) setPlayerTheme(target);

  // Après pickSong() : renderLyrics() dépend de la NOUVELLE cible — l'appeler
  // plus haut afficherait les paroles du tirage précédent.
  giveUpCounter.textContent = `(0 / ${giveUpThreshold()})`;
  renderLyrics();
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

    // Build dropdown container
    const list = document.createElement("DIV");
    list.id = "autocomplete-list";
    list.className = "autocomplete-items";
    list.setAttribute("role", "listbox");
    this.parentNode.appendChild(list);
    input.setAttribute("aria-expanded", "true");

    const lowerVal = val.toLowerCase();
    const acceptedOpus = activeFilters;

    // Filter songs by: partial title match, not already tried, active opus
    // Sorted the same way as the other modes' autocomplete (title starts with the
    // typed text ranks first, then alphabetical) so the dropdown order is uniform.
    const matches = originalSongs
      .filter((song) => {
        const songOpus = Array.isArray(song.opus) ? song.opus : [song.opus];
        return (
          song.titre.toLowerCase().includes(lowerVal) &&
          !triedTitles.includes(song.titre) &&
          songOpus.some((op) => acceptedOpus.includes(op))
        );
      })
      .map((song) => song.titre)
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(lowerVal) ? 0 : 1;
        const bStarts = b.toLowerCase().startsWith(lowerVal) ? 0 : 1;
        return aStarts !== bStarts ? aStarts - bStarts : a.localeCompare(b);
      });

    // Render one dropdown row per match (album thumbnail + title)
    matches.forEach((nom, idx) => {
      const songData = originalSongs.find((s) => s.titre === nom);
      const imagePath = songData ? `./database/img/${songData.image}` : "";

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.id = `autocomplete-option-${idx}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.innerHTML = `
        <img src="${imagePath}" alt="${nom}" class="autocomplete-thumb">
        <span class="codename">${nom}</span>
        <input type="hidden" value="${nom.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}">
      `;

      // Clicking an option fills the input and immediately submits the guess
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
      closeAllAutocompleteLists();
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
  });

  /** Highlights the item at `currentFocus` and clears others. */
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

  /** Removes all open autocomplete dropdowns from the DOM. */
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
function setPlayerTheme(songOrOpus) {
  if (!audioBox) return;
  // Accepte soit l'objet chanson (préféré : permet un thème explicite via .theme),
  // soit directement un tableau/chaîne d'opus (compat ascendante).
  const isSong = songOrOpus && typeof songOrOpus === "object" && !Array.isArray(songOrOpus);
  const opusArray = isSong ? songOrOpus.opus : songOrOpus;
  const explicitTheme = isSong ? songOrOpus.theme : null;
  const ops = Array.isArray(opusArray) ? opusArray : [opusArray];
  // Priorité : thème explicite de la chanson (ex: Aria → VELVET) > 1er opus connu > P5.
  const theme =
    (explicitTheme && OPUS_THEMES[explicitTheme]) ||
    ops.map((op) => OPUS_THEMES[op]).find(Boolean) ||
    OPUS_THEMES.P5;
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

  // Bordure tournante mi-bleu (Makoto) / mi-rose (Kotone) réservée à P3P.
  audioBox.classList.toggle("p3p-duality", theme.duality === true);
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

  initVolumeControl();
}

/**
 * Volume slider + mute toggle.
 *
 * Le niveau est persisté (`musicVolume`) : le joueur revient chaque jour, remettre
 * le son à fond à chaque visite serait une petite agression quotidienne.
 * Le mute ne remet pas le volume à 0 — il mémorise le niveau et le restaure, sinon
 * couper puis rétablir ferait perdre le réglage.
 *
 * @param {HTMLAudioElement} [audio] élément audio ; par défaut celui de la page
 */
export function initVolumeControl(audio = audioPlayer) {
  const track = document.getElementById("p5Volume");
  const fill = document.getElementById("p5VolumeFill");
  const muteBtn = document.getElementById("p5MuteBtn");
  const muteIcon = document.getElementById("p5MuteIcon");

  if (!track || !fill || !audio) return;

  const saved = parseFloat(localStorage.getItem("musicVolume"));
  let volume = isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
  let lastAudible = volume > 0 ? volume : 1;

  const render = () => {
    audio.volume = volume;
    fill.style.width = `${volume * 100}%`;
    track.setAttribute("aria-valuenow", Math.round(volume * 100));
    if (muteIcon) muteIcon.textContent = volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊";
  };

  const setVolume = (v) => {
    volume = Math.max(0, Math.min(1, v));
    if (volume > 0) lastAudible = volume;
    localStorage.setItem("musicVolume", String(volume));
    render();
  };

  // Glisser-déposer : pointer events couvrent souris ET tactile d'un seul jeu de
  // handlers, et setPointerCapture garde le suivi si le doigt sort de la piste.
  const setFromEvent = (e) => {
    const rect = track.getBoundingClientRect();
    setVolume((e.clientX - rect.left) / rect.width);
  };

  let dragging = false;
  track.addEventListener("pointerdown", (e) => {
    dragging = true;
    track.setPointerCapture?.(e.pointerId);
    setFromEvent(e);
  });
  track.addEventListener("pointermove", (e) => dragging && setFromEvent(e));
  track.addEventListener("pointerup", (e) => {
    dragging = false;
    track.releasePointerCapture?.(e.pointerId);
  });

  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") setVolume(volume + 0.05);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setVolume(volume - 0.05);
    else return;
    e.preventDefault();
  });

  muteBtn?.addEventListener("click", () => setVolume(volume === 0 ? lastAudible : 0));

  render();
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

