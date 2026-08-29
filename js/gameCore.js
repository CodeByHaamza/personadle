/**
 * gameCore.js — Shared utilities for all Personadle game modes.
 *
 * Every game mode (Classique, Emoji, Silhouette, AllOutAttack, Personae, Music)
 * imports from this file to avoid code duplication.
 *
 * Exported API (kept in sync with `export` statements below — update both
 * when adding/removing an export):
 *   parisDateKey(d?)             → "YYYY-MM-DD" in Europe/Paris (DST-safe)
 *   msUntilNextParisMidnight()   → ms until next Paris midnight
 *   normalize(str)               → lowercase, accent-stripped, trimmed
 *   MODES                        → canonical mode list (id, key, label…)
 *   normalizeModeKey(input)      → maps any mode graphy to its canonical key
 *   modeLabel(input)             → display label for a mode key
 *   showConfettiExplosion(opts)  → victory confetti burst + victory sound
 *   revealNextLink(opts)         → shows the mode-navigation bar
 *   setupRulesModal()            → wires the "?" button and modal close
 *   setupDailyReset(onReset)     → schedules an auto-reset at Paris midnight
 *   checkResetOnLoad(...)        → resets the game if a new day has started
 *   setupFilterButtons(...)      → wires opus filter-button click events
 *   showWrongMini(...)           → appends a shaking wrong-guess portrait
 *   buildGameSession(opts)       → builds a standardised session object for the backend
 *   savePendingSession(session)  → stores a session in localStorage for later sync
 *   getPlayerSeedId()            → stable per-player seed ID (user_id or anon UUID)
 *   getDailyTarget(pool, mode)   → deterministic per-player daily pick via FNV-1a seeded RNG
 *   showCommunityStats(mode, t)  → injects "X% of players found this today" in victory box
 *   FILTER_STORAGE_KEYS          → localStorage key map for per-mode opus filters
 *   showChallengeButton(mode, s) → shows the "Challenge a friend" share button
 *   applyDarkModeOverrides(list) → applies inline style overrides when darkmode is active
 *   enableGiveUpButton(id?)      → re-enables the #giveUpButton after the attempts threshold
 *   characterMatchesActiveOpus(character, activeOpus) → opus-intersection test used by filterCharacterPool()
 *   updateCounterElement(id, attempts, threshold) → updates a single hint/give-up counter's text + .activated class
 *   getPendingActiveChallenge()  → today's still-unfinished accepted challenge (any mode), or null
 */

// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES (Paris / Europe timezone, DST-safe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns today's date as "YYYY-MM-DD" using the Europe/Paris timezone.
 * Handles Daylight Saving Time automatically via Intl.DateTimeFormat.
 *
 * @param {Date} [d=new Date()] - Optional date to format (default: now)
 * @returns {string} e.g. "2025-03-26"
 */
export function parisDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns the number of milliseconds remaining until the next Paris midnight.
 * Used to schedule the automatic daily reset.
 *
 * @returns {number} Milliseconds until 00:00:00 Paris time
 */
export function msUntilNextParisMidnight() {
  const nowInParis = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const midnight = new Date(nowInParis);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - nowInParis.getTime();
}

// ─────────────────────────────────────────────────────────────────────────────
// STRING UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a string for case-insensitive, accent-insensitive comparison.
 * Used in Music mode to compare song titles, but available to all modes.
 *
 * @param {string} str
 * @returns {string} Lowercase, accent-stripped, trimmed string
 *
 * @example
 * normalize("Brûle, ma Peine !") // "brule, ma peine !"
 */
export function normalize(str) {
  return str
    .normalize("NFD") // decompose accented chars
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/[\u2018\u2019]/g, "'") // unify curly apostrophes → straight
    .replace(/"/g, "") // remove double quotes
    .trim()
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE EXPERT — plomberie partagée par les modes
// ─────────────────────────────────────────────────────────────────────────────
//
// Chaque mode Expert vit dans la MÊME page que son mode normal, distingué par
// `?expert=1`. Dupliquer la page coûterait des centaines de lignes maintenues en
// double, avec la garantie qu'un correctif ne parte un jour que d'un seul côté.
//
// L'état vit dans l'URL et non en localStorage : le mode reste partageable et
// bookmarkable, un rechargement ne perd rien, et une même URL ne peut pas afficher
// deux jeux différents selon un état caché.

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITÉ DE PARTIE — « une partie = un enregistrement »
// ─────────────────────────────────────────────────────────────────────────────
//
// Remplace l'ancienne garde `statsLogged_<Mode>_<date>` (une partie enregistrée
// par jour et par mode). Le design a changé le 2026-08-15 : 50 parties dans la
// soirée doivent compter 50 fois, seule la *streak* reste journalière — et elle
// est calculée ailleurs, sur les jours distincts (updateProfileStats côté client,
// GROUP BY played_date côté serveur).
//
// Retirer la garde sans rien mettre à la place rejouerait l'enregistrement à
// chaque F5 : la restauration de session appelle showVictory(), qui contient le
// bloc de log. La garde devient donc « CETTE partie a-t-elle déjà été
// enregistrée », scopée sur un identifiant régénéré à chaque tirage.
//
// Ce même identifiant part au serveur comme `client_session_id` (migration 032) :
// si le flag local est perdu (nettoyage du navigateur, autre onglet), le doublon
// est refusé côté base au lieu de dépendre du seul client.

const _gameIdKey = (scope) => `gameId_${scope}`;
const _gameLoggedKey = (scope) => `gameLogged_${scope}`;

/**
 * Identifiant unique de partie.
 *
 * `crypto.randomUUID()` n'existe QUE en contexte sécurisé (https ou localhost) et
 * seulement depuis Safari 15.4 : sur http://<ip-du-LAN> — le cas de test mobile le
 * plus courant — ou sur un vieil iPhone, l'appel lève et `startGame()` casse au tout
 * début du chargement du mode, donc le mode entier.
 * Rien ici n'exige d'unicité cryptographique : la clé sert d'identité de partie et
 * de clé d'idempotence, un repli horodaté + aléatoire suffit largement.
 */
function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

/**
 * Démarre une nouvelle partie : nouvel identifiant, enregistrement réarmé.
 * À appeler au tirage de la cible (nouveau jour, Replay, changement de filtres).
 *
 * @param {string} scope Clé de stats du mode, Expert compris ("Classic", "ClassicExpert"…)
 */
export function startGame(scope) {
  localStorage.setItem(_gameIdKey(scope), newId());
  localStorage.removeItem(_gameLoggedKey(scope));
}

/**
 * Identifiant de la partie en cours, créé à la volée s'il manque.
 *
 * Sert aussi de graine à ce qui doit être stable PENDANT une partie mais varier
 * d'une partie à l'autre — le leurre d'Émoji Expert, par exemple : seedé sur la
 * date il restait figé toute la journée, seedé sur la cible il ne bougeait plus
 * d'un Replay à l'autre pour un même personnage.
 */
export function currentGameId(scope) {
  let id = localStorage.getItem(_gameIdKey(scope));
  if (!id) {
    id = newId();
    localStorage.setItem(_gameIdKey(scope), id);
  }
  return id;
}

/** Vrai si la partie EN COURS a déjà été enregistrée (survit à un rechargement). */
export function isGameLogged(scope) {
  const id = localStorage.getItem(_gameIdKey(scope));
  return !!id && localStorage.getItem(_gameLoggedKey(scope)) === id;
}

/**
 * Marque la partie en cours comme enregistrée et rend son identifiant, à passer
 * en `clientSessionId` à buildGameSession().
 *
 * @returns {string} l'identifiant de la partie
 */
export function markGameLogged(scope) {
  const id = currentGameId(scope);
  localStorage.setItem(_gameLoggedKey(scope), id);
  return id;
}

/** Vrai si la page courante tourne en Mode Expert. */
export function isExpertPage() {
  return new URLSearchParams(window.location.search).get("expert") === "1";
}

/**
 * Contexte Expert d'un mode : clés localStorage cloisonnées, clé de stats et clé
 * de hash du tirage quotidien.
 *
 * **Le tirage doit être indépendant du mode normal.** Avec la même clé de hash,
 * jouer le mode normal d'abord — où l'indice est bien plus généreux — donnerait la
 * réponse de l'Expert du jour. D'où `hashMode` suffixé, qui doit rester identique
 * à la chaîne attendue par `api/lib/daily_target.php`, sinon chaque partie Expert
 * est loguée en `anti_cheat`.
 *
 * @param {object} o
 * @param {string} o.prefix   préfixe des clés Expert, ex. "classicExpert"
 * @param {string} o.statsKey clé de stats du mode normal, ex. "Classic"
 * @param {string} o.hashMode clé de hash du mode normal, ex. "Classic"
 * @returns {{isExpert: boolean, statsKey: string, hashMode: string, key: (name: string) => string}}
 */
export function expertContext({ prefix, statsKey, hashMode }) {
  const isExpert = isExpertPage();
  return {
    isExpert,
    statsKey: isExpert ? `${statsKey}Expert` : statsKey,
    hashMode: isExpert ? `${hashMode}Expert` : hashMode,
    /**
     * Clé de mode canonique du backend ("classic", "music"…), toujours celle du mode
     * NORMAL. `statsKey`/`hashMode` sont des libellés capitalisés et suffixés en
     * Expert ("ClassicExpert") : les passer à l'API ne matcherait aucun mode.
     */
    modeKey: normalizeModeKey(hashMode),
    /**
     * Traduit une clé localStorage du mode normal vers sa variante Expert.
     * En mode normal la clé historique est rendue telle quelle — aucune partie en
     * cours ne doit être perdue par ce câblage.
     */
    key: (name) => (isExpert ? `${prefix}_${name}` : name),
  };
}

/**
 * Câble le lien de bascule Normal ⇄ Expert (`#expertToggle`) et affiche le bon
 * bloc de règles (`#rulesNormal` / `#rulesExpert`).
 *
 * C'est un `<a>` et non un `<button>` : le mode vit dans l'URL, donc le lien doit
 * être copiable, ouvrable dans un onglet, et suivre l'historique du navigateur.
 *
 * @param {{isExpert: boolean}} ctx  contexte rendu par expertContext()
 * @param {string} page             nom de fichier de la page, ex. "silhouette.html"
 */
export function setupExpertToggle(ctx, page) {
  document.body.classList.toggle("expert-mode", ctx.isExpert);

  const rules = (id, shown) =>
    document.getElementById(id)?.style.setProperty("display", shown ? "" : "none");
  rules("rulesNormal", !ctx.isExpert);
  rules("rulesExpert", ctx.isExpert);

  const toggle = document.getElementById("expertToggle");
  if (!toggle) return;

  const k = ctx.isExpert ? "ui.expert_leave" : "ui.expert_enter";
  const t = window.i18n?.t?.(k);
  toggle.setAttribute("data-i18n", k);
  toggle.textContent = t != null && t !== k ? t : ctx.isExpert ? "← Normal mode" : "⚡ Expert mode";
  toggle.classList.toggle("active", ctx.isExpert);
  toggle.href = ctx.isExpert ? page : `${page}?expert=1`;

  // Le verrou se pose ensuite, quand le backend a répondu (la fonction doit
  // rester synchrone pour ses appelants). Le bouton est donc rendu déverrouillé
  // puis dégradé — sur une page Expert, c'est une redirection à la place.
  applyExpertGate(ctx, page, toggle);
}

// Le déblocage de l'Expert est une propriété du COMPTE : il se gagne en jouant
// connecté, et suit alors le joueur sur n'importe quel appareil. Conséquence
// directe : sans compte, il n'y a rien à débloquer — le bouton reste verrouillé.
// Le défaut est donc fail-closed (verrouillé sauf réponse serveur contraire), et
// non l'inverse.
const EXPERT_STATUS_STORAGE_KEY = "expertUnlockStatus";

let _expertStatus = null; // { state: "ok"|"anonymous"|"unavailable", modes?: object }
let _expertStatusPromise = null; // dédoublonne les appels concurrents des 6 modes
let _newlyUnlocked = []; // modes passés de verrouillé à débloqué depuis la dernière visite

/**
 * Modes qui viennent de s'ouvrir, en comparant l'état connu au dernier reçu.
 *
 * Couvre les deux façons dont un mode s'ouvre — le joueur a franchi le seuil en
 * jouant, ou un admin lui a accordé l'accès (`expert_unlocks_granted`) : dans les
 * deux cas le serveur renvoie `unlocked: true` là où le cache disait `false`.
 *
 * Le garde-fou important est `prev == null` → aucune annonce. Sans compte connu
 * précédemment (première visite, cache vidé, navigation privée), TOUS les modes
 * débloqués paraîtraient neufs et le joueur se prendrait 6 animations d'affilée
 * pour des accès qu'il avait depuis longtemps. Dans le doute, on n'annonce rien :
 * rater une animation est bénin, en inventer une ne l'est pas.
 *
 * @param {Record<string, {unlocked: boolean}>|null} prev  dernier état connu
 * @param {Record<string, {unlocked: boolean}>} next       état reçu du serveur
 * @returns {string[]} clés de mode nouvellement débloquées
 */
export function diffNewlyUnlocked(prev, next) {
  if (!prev || !next) return [];
  return Object.keys(next).filter((mode) => prev[mode]?.unlocked === false && next[mode]?.unlocked === true);
}

/**
 * Rend les modes fraîchement débloqués et vide la liste — l'animation ne doit
 * jouer qu'une fois par chargement, même si plusieurs modes appellent
 * `fetchExpertStatus()` (l'appel est dédoublonné, pas ses lecteurs).
 *
 * @returns {string[]}
 */
export function consumeNewlyUnlockedExpertModes() {
  const out = _newlyUnlocked;
  _newlyUnlocked = [];
  return out;
}

/**
 * État de déblocage des 6 Modes Expert.
 *
 * - `ok`          → réponse du serveur, fait autorité
 * - `anonymous`   → 401 : pas de compte, donc rien de débloquable
 * - `unavailable` → hors ligne / erreur : on retombe sur le dernier état connu
 *                   du joueur (localStorage), sinon rien
 *
 * @returns {Promise<{state: string, modes?: Record<string, object>|null}>}
 */
export async function fetchExpertStatus() {
  if (_expertStatus) return _expertStatus;
  if (_expertStatusPromise) return _expertStatusPromise;

  _expertStatusPromise = (async () => {
    const api = window._personadleApi;
    if (!api?.user?.expertStatus) {
      // Bridge absent : on ne peut rien affirmer → verrouillé par défaut.
      _expertStatus = { state: "unavailable", modes: readCachedExpertStatus() };
      return _expertStatus;
    }

    try {
      const modes = (await api.user.expertStatus())?.expert_status ?? null;
      if (modes) {
        // Comparer AVANT d'écraser le cache : c'est la seule trace de l'état
        // précédent, et c'est elle qui dit quels modes viennent de s'ouvrir.
        _newlyUnlocked = diffNewlyUnlocked(readCachedExpertStatus(), modes);
        cacheExpertStatus(modes);
        _expertStatus = { state: "ok", modes };
      } else {
        _expertStatus = { state: "unavailable", modes: readCachedExpertStatus() };
      }
    } catch (err) {
      _expertStatus =
        err?.status === 401
          ? { state: "anonymous" }
          : { state: "unavailable", modes: readCachedExpertStatus() };
    }
    return _expertStatus;
  })();

  return _expertStatusPromise;
}

/**
 * Mémorise le dernier état connu, pour que le joueur déjà débloqué qui passe
 * hors ligne ne retrouve pas ses 6 modes fermés. Rattaché à l'id du compte : sur
 * un appareil partagé, le cache d'un joueur ne doit pas déverrouiller l'autre.
 */
function cacheExpertStatus(modes) {
  const userId = window._currentUser?.id;
  if (userId == null) return;
  try {
    localStorage.setItem(EXPERT_STATUS_STORAGE_KEY, JSON.stringify({ userId, modes }));
  } catch {
    // Quota plein ou navigation privée : le cache est un confort, pas un prérequis.
  }
}

/** Dernier état connu pour le compte courant, ou null. */
function readCachedExpertStatus() {
  const userId = window._currentUser?.id;
  if (userId == null) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(EXPERT_STATUS_STORAGE_KEY) || "null");
    return raw && raw.userId === userId ? raw.modes : null;
  } catch {
    return null;
  }
}

/** Réinitialise le cache mémoire — utilisé par les tests. */
export function resetExpertStatusCache() {
  _expertStatus = null;
  _expertStatusPromise = null;
  _newlyUnlocked = [];
}

/**
 * Redirection isolée derrière un objet : jsdom n'implémente pas la navigation,
 * les tests remplacent `go` pour vérifier qu'elle a bien lieu.
 */
export const expertNavigate = {
  go: (url) => window.location.replace(url),
};

/** Traduction avec repli, cf. CLAUDE.md §5 (t() renvoie la clé si absente). */
function _t(key, vars, fallback) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

/**
 * Libellé de la condition, progression comprise (« 7/10 victoires… »).
 * Construit côté client : le serveur n'envoie que le type et les deux nombres,
 * sinon le texte serait en anglais dans les 6 langues.
 */
export function expertConditionLabel(progress) {
  const { condition_type: type, current, required } = progress;
  const vars = { current, required };

  // Phrase d'objectif seule : l'avancement chiffré est rendu à part, par la barre
  // de progression de l'infobulle. Le répéter ici donnerait « 7/10 … 7 / 10 ».
  const fallbacks = {
    mode_wins_under_attempts: `Win ${required} games in 4 attempts or fewer`,
    mode_wins_single_day: `Win ${required} games in a single day`,
    mode_consecutive_perfects: `Win ${required} games in a row on the first try`,
  };

  const suffix = String(type).replace(/^mode_/, "");
  return _t(`ui.expert_cond_${suffix}`, vars, fallbacks[type] ?? `${current} / ${required}`);
}

/** Identifiant unique de l'infobulle, référencé par aria-describedby. */
const EXPERT_TOOLTIP_ID = "expertLockTooltip";

/**
 * Carte d'infobulle : titre, objectif en clair, et barre de progression.
 * Construite en DOM plutôt qu'en innerHTML — `reason` vient de l'i18n, mais rien
 * ne justifie d'ouvrir une porte à l'injection pour trois nœuds.
 */
function buildExpertTooltip(reason, progress) {
  const tip = document.createElement("div");
  tip.className = "expert-tooltip";
  tip.id = EXPERT_TOOLTIP_ID;
  tip.setAttribute("role", "tooltip");

  const title = document.createElement("span");
  title.className = "expert-tooltip-title";
  title.textContent = _t("ui.expert_locked_title", undefined, "Expert mode locked");
  tip.append(title);

  const cond = document.createElement("span");
  cond.className = "expert-tooltip-cond";
  cond.textContent = reason;
  tip.append(cond);

  // Pas de barre quand il n'y a rien à mesurer (visiteur non connecté, hors ligne) :
  // une jauge à 0 laisserait croire à une progression réelle qui n'existe pas.
  const required = Number(progress?.required) || 0;
  if (required > 0) {
    const current = Math.max(0, Number(progress.current) || 0);
    const pct = Math.min(100, Math.round((current / required) * 100));

    const bar = document.createElement("span");
    bar.className = "expert-tooltip-bar";
    const fill = document.createElement("i");
    fill.style.width = `${pct}%`;
    bar.append(fill);

    const count = document.createElement("span");
    count.className = "expert-tooltip-count";
    count.textContent = `${current} / ${required}`;

    tip.append(bar, count);
  }

  return tip;
}

/** Grise le bouton et lui accroche l'infobulle expliquant le verrouillage. */
function lockExpertToggle(toggle, reason, progress) {
  toggle.classList.add("expert-locked");
  toggle.setAttribute("aria-disabled", "true");
  // Un <a> sans href n'est plus activable ni copiable ; tabindex le garde
  // atteignable au clavier — c'est aussi ce qui permet d'ouvrir l'infobulle au
  // doigt sur mobile, où le survol n'existe pas.
  toggle.removeAttribute("href");
  toggle.setAttribute("tabindex", "0");
  // L'infobulle maison remplace le title natif : les garder tous les deux
  // afficherait deux bulles superposées au survol.
  toggle.removeAttribute("title");

  const label = _t("ui.expert_locked", undefined, "🔒 Expert mode");
  toggle.setAttribute("data-i18n", "ui.expert_locked");
  toggle.textContent = label;
  toggle.setAttribute("aria-label", `${label} — ${reason}`);

  // Rejouable : un second appel ne doit pas empiler deux infobulles.
  document.getElementById(EXPERT_TOOLTIP_ID)?.remove();
  toggle.insertAdjacentElement("afterend", buildExpertTooltip(reason, progress));
  toggle.setAttribute("aria-describedby", EXPERT_TOOLTIP_ID);
}

/**
 * Applique la porte d'entrée : bouton grisé sur une page normale, redirection
 * vers le mode normal sur une page Expert non débloquée (le mode vit dans l'URL,
 * `?expert=1` se tape à la main).
 */
async function applyExpertGate(ctx, page, toggle) {
  if (!ctx.modeKey) return;

  const status = await fetchExpertStatus();

  // Un mode qui vient de s'ouvrir s'annonce, qu'il ait été gagné en jouant ou
  // accordé par un admin. Import dynamique : expert-unlock-anim.js lit modeLabel()
  // d'ici, un import statique fermerait le cycle (CLAUDE.md §4). Le module n'est
  // donc même pas téléchargé tant qu'il n'y a rien à annoncer.
  const justUnlocked = consumeNewlyUnlockedExpertModes();
  if (justUnlocked.length) {
    import("./expert-unlock-anim.js")
      .then((m) => m.showExpertUnlock(justUnlocked))
      // L'annonce est un bonus : si le module ne charge pas, la partie continue.
      .catch(() => {});
  }

  const progress = status.modes?.[ctx.modeKey] ?? null;

  let locked, reason;
  if (status.state === "anonymous") {
    locked = true;
    reason = _t("ui.expert_cond_signin", undefined, "Sign in to unlock Expert mode");
  } else if (progress) {
    locked = !progress.unlocked;
    reason = expertConditionLabel(progress);
  } else {
    // Aucune réponse et aucun état connu : verrouillé, jamais ouvert par défaut.
    locked = true;
    reason = _t("ui.expert_cond_unknown", undefined, "Reconnect to check your progress");
  }

  if (!locked) return;

  if (ctx.isExpert) {
    // Ne ressortir le joueur que sur une réponse FERME (serveur ou 401). Un
    // simple échec réseau ne doit pas éjecter de sa partie un joueur
    // légitimement débloqué — de toute façon `api/sessions.php` refuserait
    // d'enregistrer la session de quelqu'un qui ne l'est pas.
    if (status.state === "ok" || status.state === "anonymous") expertNavigate.go(page);
    return;
  }

  lockExpertToggle(toggle, reason, progress);
}

/**
 * Masque dans `text` toute occurrence des termes donnés — utilisé par les modes
 * Expert, où l'indice textuel cite souvent la réponse : les paroles d'une chanson
 * répètent son titre (« Burn my dread »), la fiche d'une persona commence par son
 * nom (« Hades, also known as… »).
 *
 * Le masquage est fait à l'affichage, jamais dans les données : révéler en fin de
 * partie (victoire ou abandon) consiste simplement à afficher le texte brut, sans
 * seconde copie du texte à maintenir en parallèle.
 *
 * Tolère la casse, les espaces multiples et la ponctuation interne du terme
 * (« Dance! » masque aussi « dance »), et ne coupe jamais au milieu d'un mot
 * (« Mask » ne masque pas « Masked »). Seuls les termes d'une seule lettre sont
 * ignorés : les termes sont des noms propres fournis explicitement, et la frontière
 * de mot suffit à éviter les faux positifs — « Io » (persona de Yukari) doit pouvoir
 * être masqué, sinon sa fiche donne la réponse dès la première ligne.
 *
 * @param {string[]} terms  termes à masquer (nom, alias, titre…)
 * @param {string} text     texte brut
 * @param {string} [token]  remplacement affiché
 * @returns {string} texte masqué
 */
export function maskTerms(terms, text, token = "[?]") {
  let out = text;
  for (const term of terms) {
    const t = (term ?? "").trim();
    if (t.length < 2) continue;
    const pattern = t
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // échappe les métacaractères regex
      .replace(/\\?[!?.,]/g, "[!?.,]?") // ponctuation interne optionnelle
      .replace(/\s+/g, "\\s+"); // espaces variables
    // Frontière = tout ce qui n'est pas une lettre/chiffre. L'apostrophe en faisait
    // partie : « Io » n'était donc PAS masqué dans « Io's blessing », et la fiche
    // donnait la réponse dès la première ligne — le cas exact que le masquage vise.
    out = out.replace(new RegExp(`(^|[^\\w])(${pattern})(?=$|[^\\w])`, "gi"), `$1${token}`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODES — source unique de vérité pour le vocabulaire des modes de jeu
// ─────────────────────────────────────────────────────────────────────────────
//
// Historiquement chaque couche avait sa propre table de modes : le backend parle
// `classic`, le profil affiche `Classic`, certaines pages passaient `classique`
// ou `All Out Attack` (non normalisé → entrée parasite dans modeCount). Tout doit
// désormais transiter par ces helpers.
//
//   - key   : identifiant canonique = clé backend/API (game_sessions.mode)
//   - label : libellé canonique côté profil / stats / UI

export const MODES = [
  { key: "classic", label: "Classic" },
  { key: "emoji", label: "Emoji" },
  { key: "silhouette", label: "Silhouette" },
  { key: "alloutattack", label: "AllOutAttack" },
  { key: "personae", label: "Personae" },
  { key: "music", label: "Music" },
];

// Table interne « graphie aplatie » → clé canonique.
// On aplatit l'entrée (minuscule, sans espace/_/-) pour absorber toutes les
// variantes ("All Out Attack", "all_out_attack", "AllOutAttack"…).
const _MODE_LOOKUP = (() => {
  const flat = (s) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  const map = new Map();
  for (const { key, label } of MODES) {
    map.set(flat(key), key);
    map.set(flat(label), key);
  }
  // Alias historiques présents dans le code / les données.
  const aliases = {
    classique: "classic",
    classiquemode: "classic",
    allout: "alloutattack",
    aoa: "alloutattack",
    persona: "personae",
    musics: "music",
    musique: "music",
  };
  for (const [alias, key] of Object.entries(aliases)) map.set(flat(alias), key);
  return { map, flat };
})();

/**
 * Convertit n'importe quelle graphie de mode en sa clé canonique backend.
 * @param {string} input
 * @returns {string|null} ex. "classic", ou null si inconnu
 */
export function normalizeModeKey(input) {
  return _MODE_LOOKUP.map.get(_MODE_LOOKUP.flat(input)) ?? null;
}

/**
 * Convertit n'importe quelle graphie de mode en son libellé canonique d'affichage.
 * Retourne l'entrée brute si le mode est inconnu (non destructif).
 * @param {string} input
 * @returns {string} ex. "Classic"
 */
export function modeLabel(input) {
  const key = normalizeModeKey(input);
  const found = MODES.find((m) => m.key === key);
  return found ? found.label : input;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI / VICTORY CELEBRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plays the victory sound and launches an animated confetti burst.
 *
 * Two spawn styles are supported:
 *   - "sides"  (default): emojis launch from the left and right edges —
 *              used by Classique, Emoji, Silhouette, AllOutAttack.
 *   - "bottom": emojis launch from random positions along the bottom edge —
 *              used by Personae and Music.
 *
 * NOTE: `new Audio(path)` resolves relative to the *document* URL, not this
 * module's URL. All mode pages sit one level deep (e.g. classiqueMode/),
 * so "../assets/…" always resolves to the project root.
 *
 * @param {Object}   [opts]
 * @param {string[]} [opts.emojiList=["🎉","🎊","✨","💥","🌟"]] - Emojis to use
 * @param {number}   [opts.count=40]   - Total number of emoji particles
 * @param {string}   [opts.spreadFrom="sides"] - "sides" | "bottom"
 */
export function showConfettiExplosion({
  emojiList = ["🎉", "🎊", "✨", "💥", "🌟"],
  count = 40,
  spreadFrom = "sides",
} = {}) {
  // Play victory sound (path resolved relative to the HTML page)
  new Audio("../assets/sound_effect/Victory_sound.mp3").play().catch(() => {});

  for (let i = 0; i < count; i++) {
    const emoji = document.createElement("span");
    emoji.textContent = emojiList[Math.floor(Math.random() * emojiList.length)];
    emoji.classList.add("confetti-emoji");
    emoji.style.bottom = "0vh";

    if (spreadFrom === "sides") {
      // Bilateral: first half from left, second half from right
      const isLeft = i < count / 2;
      emoji.style.left = isLeft ? "0vw" : "100vw";
      const xTarget = isLeft ? Math.random() * 50 + 25 : -(Math.random() * 50 + 25);
      emoji.style.setProperty("--x-move", xTarget + "vw");
    } else {
      // Bottom: random horizontal origin
      emoji.style.left = Math.random() * 100 + "vw";
      emoji.style.setProperty("--x-move", Math.random() * 100 - 50 + "vw");
    }

    emoji.style.setProperty("--y-move", -(Math.random() * 50 + 30) + "vh");
    emoji.style.setProperty("--rotate", Math.random() * 360 + "deg");

    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 1000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reveals the between-modes navigation bar and wires prev/next links.
 * Called after a win or give-up in every game mode.
 *
 * The container (#modeNavigationContainer) must already exist in the HTML
 * with display:none. It is made visible here and scrolled into view.
 *
 * @param {Object} [opts]
 * @param {string} [opts.nextHref=""]   - URL for the "next mode" button
 * @param {string} [opts.prevHref=null] - URL for the "prev mode" button
 *                                        (null/empty = button stays hidden)
 */
export function revealNextLink({ nextHref = "", prevHref = null } = {}) {
  const nav = document.getElementById("modeNavigationContainer");
  const nextButton = document.getElementById("nextModeButton");
  const prevButton = document.getElementById("prevModeButton");

  if (nextButton && nextHref) {
    nextButton.onclick = () => (location.href = nextHref);
  }

  if (prevButton) {
    if (prevHref) {
      prevButton.style.visibility = "visible";
      prevButton.onclick = () => (location.href = prevHref);
    } else {
      prevButton.style.visibility = "hidden";
      prevButton.onclick = null;
    }
  }

  if (nav) {
    nav.style.display = "flex";
    // Delay the scroll so the layout has time to update
    setTimeout(() => {
      nav.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires the "How to Play" rules modal:
 *  - Clicking #rulesButton opens the modal and adds "modal-open" to <body>
 *  - Clicking the × button or the backdrop closes it
 *
 * Safe to call even if the elements are missing (no-op).
 */
export function setupRulesModal() {
  const modal = document.getElementById("rulesModal");
  const btn = document.getElementById("rulesButton");
  if (!modal || !btn) return;

  const closeBtn = modal.querySelector(".close");

  const open = () => {
    modal.style.display = "block";
    document.body.classList.add("modal-open");
  };

  const close = () => {
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
  };

  btn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);

  // Close when clicking the semi-transparent backdrop
  window.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY RESET SCHEDULING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schedules a one-time callback at the next Paris midnight + 500 ms buffer.
 * Called once at page load; the callback is responsible for triggering
 * the mode-specific reset (e.g. clicking #resetButton or calling resetGame()).
 *
 * @param {Function} onReset - Called when midnight Paris is reached
 * @returns {number} The setTimeout timer ID (can be cleared if needed)
 */
export function setupDailyReset(onReset) {
  const ms = msUntilNextParisMidnight();
  console.log(`🕛 Next auto-reset in ~${Math.round(ms / 60000)} minutes (Paris)`);
  return setTimeout(onReset, ms + 500);
}

/**
 * Checks at page load whether a new Paris day has started since last visit.
 * If yes, arms a fresh game, saves today's date, and triggers the mode-specific
 * reset callback.
 *
 * ⚠️ `lastPlayedKey` DOIT être scopé par mode Expert (`EXPERT.key(...)`) : tout le
 * reste de l'état de partie l'est. Avec une clé partagée, ouvrir la variante Expert
 * un nouveau jour écrit la date du jour et ne reset que SES clés — la variante
 * normale se croit alors à jour et restitue la partie terminée de la veille, sans
 * jamais retirer la cible du jour.
 *
 * Le réarmement (`startGame`) vit ICI et non dans les callbacks : c'est le seul
 * point commun aux 6 modes. Laissé à chaque `onReset`, il avait déjà été oublié en
 * Émoji — dont la partie quotidienne n'était donc plus jamais enregistrée à partir
 * du 2e jour (`isGameLogged()` restait vrai avec l'identifiant de la veille).
 *
 * @param {string}   lastPlayedKey  - localStorage key storing the last-played date,
 *                                    scopée Expert (e.g. "lastPlayedDate_Classic")
 * @param {string}   statsScope     - Portée d'enregistrement du mode, Expert comprise
 *                                    (`EXPERT.statsKey` — "Classic", "ClassicExpert"…)
 * @param {Function} onReset        - Callback to run when a new day is detected
 */
export function checkResetOnLoad(lastPlayedKey, statsScope, onReset) {
  const storedDate = localStorage.getItem(lastPlayedKey);
  const today = parisDateKey();

  if (storedDate !== today) {
    console.log(`📅 New day detected → auto-reset (${statsScope})`);

    // Nouvelle journée = nouvelle partie : identifiant neuf, enregistrement réarmé.
    startGame(statsScope);

    localStorage.setItem(lastPlayedKey, today);
    onReset();
  } else {
    console.log(`📅 Same day, no reset needed (${statsScope})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPUS FILTER BUTTONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires click events for the opus filter buttons (.filter-btn).
 *
 * On each click:
 *  1. Toggles the "active" CSS class on the clicked button
 *  2. Collects the full list of currently active filter values
 *  3. Persists them to localStorage
 *  4. Calls `onFilterChange` with the new filter array so the mode can
 *     re-filter its character pool and pick a new target
 *
 * The initial visual state (which buttons are active) must be set BEFORE
 * calling this function (see each mode's DOMContentLoaded handler).
 *
 * @param {string}   storageKey     - localStorage key for this mode's filters
 *                                    (e.g. "filters_Classic")
 * @param {Function} onFilterChange - Called with (string[]) newActiveFilters
 */
export function setupFilterButtons(storageKey, onFilterChange) {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");

      const activeFilters = Array.from(document.querySelectorAll(".filter-btn.active")).map(
        (b) => b.dataset.opus
      );

      localStorage.setItem(storageKey, JSON.stringify(activeFilters));
      onFilterChange(activeFilters);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WRONG GUESS MINI PORTRAIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends a small "wrong guess" portrait to the wrong-guesses list and
 * triggers the shake animation after a brief delay.
 *
 * Used by Classique, Emoji, Silhouette, AllOutAttack, and Personae.
 * (Music mode has its own variant that also shows the song title.)
 *
 * @param {string}      imageSrc      - Full src URL for the portrait image
 * @param {string}      altText       - Alt text / character name
 * @param {HTMLElement} wrongListEl   - The container element (#wrongGuessList)
 * @param {string}      [fallbackSrc] - Fallback image src on load error
 */
export function showWrongMini(
  imageSrc,
  altText,
  wrongListEl,
  fallbackSrc = "../database/portraits/unknown.webp"
) {
  if (!wrongListEl) return;

  const div = document.createElement("div");
  div.className = "wrong-mini";

  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = altText;
  img.onerror = () => {
    img.src = fallbackSrc;
  };

  div.appendChild(img);
  wrongListEl.appendChild(div);

  // Small delay so the element is in the DOM before the class triggers CSS
  setTimeout(() => div.classList.add("shake"), 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME SESSION — Backend sync preparation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a standardised game session object ready to be POST-ed to /api/sessions.
 * Call this at the end of each game (win or giveup).
 *
 * @param {object}   opts
 * @param {string}   opts.mode       - Mode name: 'Classic'|'Emoji'|'Silhouette'|'AllOutAttack'|'Personae'|'Music'
 * @param {string}   opts.targetName - The character/track that was to be guessed
 * @param {string}   opts.result     - 'win' | 'giveup'
 * @param {number}   opts.attempts   - Number of attempts made
 * @param {number}   opts.timeMs     - Time spent in milliseconds
 * @param {string[]} [opts.filters]  - Active opus filters at the time of the game
 * @param {boolean}  [opts.isExpert] - Partie jouée en Mode Expert (mécanique et cible
 *   propres). Le backend garde le même `mode` et distingue via game_sessions.is_expert
 *   (migration 031) : les stats et le classement du mode normal l'excluent.
 * @returns {{ mode, played_date, target_name, result, attempts, time_ms, active_filters, is_expert }}
 */
export function buildGameSession({
  mode,
  targetName,
  result,
  attempts,
  timeMs = 0,
  filters = [],
  isExpert = false,
  clientSessionId = "",
}) {
  return {
    // Clé backend canonique, quelle que soit la graphie passée par le mode
    // ("AllOutAttack", "All Out Attack", "Classic"…). Voir normalizeModeKey().
    mode: normalizeModeKey(mode) ?? mode,
    played_date: parisDateKey(),
    target_name: targetName,
    result,
    attempts,
    time_ms: Math.round(timeMs),
    active_filters: filters,
    is_expert: isExpert,
    // Clé d'idempotence (migration 032). savePendingSession() met les sessions en
    // file dans localStorage quand le réseau tombe puis les rejoue : sans elle, un
    // timeout sur une requête que le serveur avait pourtant traitée insérerait la
    // partie deux fois — l'ancienne contrainte d'unicité par jour l'empêchait
    // accidentellement, elle n'existe plus.
    //
    // Passer markGameLogged() ici plutôt que de laisser le défaut : l'identifiant
    // est alors stable pour toute la partie, donc un ré-enregistrement après perte
    // du flag local (autre onglet, nettoyage navigateur) est refusé côté base.
    client_session_id: clientSessionId || newId(),
  };
}

/**
 * Saves a completed game session.
 *
 * If the user is connected (window._personadleApi available + session active),
 * the session is posted directly to the backend.
 * On failure (offline, server error), it falls back to localStorage so it
 * can be synced later via api.stats.syncPending().
 *
 * If the user is not connected, the session is queued in localStorage only.
 *
 * After saving, shows community stats in the victory box (if the backend is reachable).
 *
 * @param {ReturnType<typeof buildGameSession>} session
 */
export async function savePendingSession(session) {
  const api = window._personadleApi;

  if (api) {
    try {
      await api.stats.postSession(session);
      // Success — also sync any previously queued offline sessions
      await api.stats.syncPending();
    } catch (err) {
      if (err?.status === 409) return; // Session already recorded (e.g. challenge replay)
      // Offline or other server error — queue to localStorage for later sync
      const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
      pending.push(session);
      localStorage.setItem("pendingSessions", JSON.stringify(pending));
    }
  } else {
    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    pending.push(session);
    localStorage.setItem("pendingSessions", JSON.stringify(pending));
  }

  // Always try to show community stats (silent fail if offline).
  // Pas en Expert : la cible du jour y est différente de celle du mode normal, et
  // community-stats.php ne compte que les parties non-Expert — le « X % des joueurs
  // ont trouvé » afficherait donc 0 % en permanence.
  if (!session.is_expert) showCommunityStats(session.mode, session.target_name);
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY TARGET — Deterministic seeded RNG (FNV-1a 32-bit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a stable player-specific seed ID used to personalise the daily target.
 *
 * Priority order:
 *   1. Logged-in user → their numeric user_id (set in localStorage by auth.js)
 *   2. Anonymous → a random UUID generated once and stored as 'anonPlayerId'
 *
 * This ensures:
 *   - Every player gets their own unique daily character (not the same as everyone else)
 *   - The pick is stable: reloading the page gives the same character
 *   - On login the player seamlessly switches to their account-based seed
 *
 * @returns {string}
 */
export function getPlayerSeedId() {
  const uid = localStorage.getItem("playerUserId");
  if (uid) return uid;

  let anonId = localStorage.getItem("anonPlayerId");
  if (!anonId) {
    // Generate a random UUID v4-like identifier (crypto.randomUUID when available)
    anonId =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    localStorage.setItem("anonPlayerId", anonId);
  }
  return anonId;
}

/**
 * Returns a deterministic daily target from a pool using a player+date+mode seed.
 * Each player gets their own unique character for a given day and mode.
 *
 * Algorithm: FNV-1a 32-bit hash of "${seedId}|${date}|${mode}" modulo pool.length.
 * Stable across reloads for the same player — changes only if seedId, date or mode changes.
 *
 * @param {Array}  pool            - Array of items to pick from (objects or strings)
 * @param {string} mode            - Mode identifier (e.g. 'Classic', 'Music')
 * @param {string} [date]          - YYYY-MM-DD date key (default: today Paris time)
 * @param {string} [seedId]        - Player seed ID (default: getPlayerSeedId())
 * @returns {*} The selected item, or null if pool is empty
 */
export function getDailyTarget(pool, mode, date = parisDateKey(), seedId = getPlayerSeedId()) {
  if (!pool || pool.length === 0) return null;
  // Debug override: debugTarget_<mode> in localStorage (set via debug panel)
  try {
    const override = localStorage.getItem(`debugTarget_${mode}`);
    if (override && pool.includes(override)) return override;
  } catch (_) {
    /* ignore */
  }
  const str = `${seedId}|${date}|${mode}`;
  let h = 2166136261 >>> 0; // FNV-1a offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return pool[h % pool.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY STATS — "X% of players found this today"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * No-op depuis le 2026-07-17 (retour Hamza) : la stat « X% of N players found
 * this today! » encombrait/enlaidissait l'écran de victoire et a été retirée.
 *
 * L'export est conservé (les 6 modes l'importent + `savePendingSession` l'appelle)
 * pour ne rien casser, mais la fonction n'injecte plus rien et ne tape plus l'API.
 * L'endpoint backend `community_stats` reste inutilisé — à retirer complètement
 * dans un second temps si on confirme qu'on n'y revient pas.
 */
export async function showCommunityStats(_mode, _targetName) {
  // Feature retirée — plus d'affichage communautaire dans la victoryBox.
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Filter storage keys per mode — single source of truth (also exported for friends.js)
export const FILTER_STORAGE_KEYS = {
  classic: "filters_Classic",
  emoji: "filters_Emoji",
  silhouette: "silhouetteActiveFilters",
  alloutattack: "filters_AllOutAttack",
  personae: "personaeActiveFilters",
  music: "musicActiveFilters",
};
const _FILTER_STORAGE_KEY = FILTER_STORAGE_KEYS;

/** Returns the currently active opus filters for a given mode (array of strings). */
function _getActiveFilters(mode) {
  const key = _FILTER_STORAGE_KEY[mode?.toLowerCase()];
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

// CHALLENGE BUTTON — "Challenge a friend" post-victoire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cible dédiée du défi actif pour un mode (décision produit 2026-07-17 :
 * « le défi doit défier » — cible aléatoire, pas celle du jour).
 * Retourne le nom de la cible, ou null si pas de défi actif pour ce mode ou
 * défi ancien format (sans cible propre → comportement historique, cible du jour).
 */
/**
 * Clé localStorage du défi en cours, CLOISONNÉE par dimension.
 *
 * Normal et Expert ont chacun leur case. C'est ce qui a rendu possible les défis
 * en Expert (migration 037) : avec une case unique, accepter un défi Expert
 * écrasait silencieusement le défi normal en cours — et une victoire en Expert
 * validait le défi normal, dont le barème n'a rien à voir (l'Expert ne donne
 * qu'un indice, ses essais ne se comparent pas). D'où les gardes qui
 * neutralisaient purement et simplement les défis en Expert jusqu'ici.
 *
 * Même convention de préfixe que `expertContext().key()`, qui cloisonne déjà
 * l'état de partie des 6 modes.
 *
 * @param {boolean} [isExpert] défaut : la dimension de la page courante
 */
export function activeChallengeKey(isExpert = isExpertPage()) {
  return isExpert ? "activeChallengeExpert" : "activeChallenge";
}

export function getActiveChallengeTarget(mode) {
  try {
    const c = JSON.parse(localStorage.getItem(activeChallengeKey()) || "null");
    if (!c) return null;
    const key = normalizeModeKey(mode) ?? String(mode).toLowerCase();
    if ((c.mode || "").toLowerCase() !== key) return null;
    return c.target ?? null;
  } catch {
    return null;
  }
}

/** True si la partie en cours est un défi à cible dédiée (stats quotidiennes à NE PAS logger). */
export function isChallengePlay(mode) {
  return getActiveChallengeTarget(mode) !== null;
}

/**
 * Défi en attente (accepté mais pas encore joué jusqu'au bout), tous modes
 * confondus, s'il est encore valide pour AUJOURD'HUI (heure Paris) — sinon
 * null (absent, JSON invalide, ou défi d'un jour précédent qu'on considère
 * périmé, même logique que initChallengeBanner()).
 *
 * localStorage 'activeChallenge' est une case UNIQUE (pas une file) : accepter
 * un nouveau défi l'écrase silencieusement, ce qui abandonne le défi en cours
 * sans que le message associé ne se résolve jamais (reste bloqué en statut
 * 'accepted' côté serveur — cf. DEV_CHANGELOG.md). Les points d'acceptation
 * (js/challenge-notif.js, profile/friends/friends.js) appellent cette fonction
 * avant d'écraser 'activeChallenge' pour empêcher ça.
 *
 * Ne modifie PAS localStorage (contrairement à initChallengeBanner() qui
 * nettoie les entrées périmées au passage) — l'appelant décide de la suite.
 */
export function getPendingActiveChallenge(isExpert = isExpertPage()) {
  try {
    const c = JSON.parse(localStorage.getItem(activeChallengeKey(isExpert)) || "null");
    if (!c) return null;
    if (c.date && c.date !== parisDateKey()) return null;
    return c;
  } catch {
    return null;
  }
}

/**
 * Injecte le bouton "Challenge a Friend" dans le modeNavigationContainer
 * après une victoire. Ne fait rien si l'utilisateur n'est pas connecté.
 *
 * @param {string}   mode       - Mode lowercase ('classic', 'emoji', etc.)
 * @param {number}   score      - Score à battre (tentatives ou secondes selon le mode)
 * @param {string[]} targetPool - Noms candidats pour la cible du défi (pool filtré,
 *                                cible du jour exclue par l'appelant). Null/vide =
 *                                défi ancien format (cible du jour).
 */
export function showChallengeButton(mode, score, targetPool = null) {
  if (!window._currentUser) return;

  // L'Expert émet désormais ses propres défis (migration 037). La dimension est
  // portée jusqu'au serveur : elle décide de la page d'arrivée du destinataire
  // et du barème appliqué. `targetPool` est déjà le pool de la page courante,
  // donc celui de l'Expert quand on y est — la cible est tirée au bon endroit
  // sans traitement supplémentaire.
  const isExpert = isExpertPage();

  const nav = document.getElementById("modeNavigationContainer");
  if (!nav || document.getElementById("challengeFriendBtn")) return;

  const t = (key, fb) => window.i18n?.t?.(key) ?? fb;
  const date = parisDateKey();

  const btn = document.createElement("button");
  btn.id = "challengeFriendBtn";
  btn.className = "btn-challenge";
  btn.innerHTML = `<span>⚔</span><span>${t("challenge.challenge_friend", "Challenge a Friend")}</span>`;

  // Insérer entre prevMode et nextMode
  const nextBtn = document.getElementById("nextModeButton");
  if (nextBtn) nav.insertBefore(btn, nextBtn);
  else nav.appendChild(btn);

  btn.addEventListener("click", () =>
    _showChallengeModal(mode, score, date, _getActiveFilters(mode), targetPool, isExpert)
  );
}

function _showChallengeModal(mode, score, date, activeFilters = [], targetPool = null, isExpert = false) {
  const api = window._personadleApi;
  if (!api || !window._currentUser) return;

  document.getElementById("challengeModal")?.remove();

  const t = (key, fb) => window.i18n?.t?.(key) ?? fb;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

  const modal = document.createElement("div");
  modal.id = "challengeModal";
  modal.className = "challenge-overlay";
  modal.innerHTML = `
    <div class="challenge-card">
      <div id="challengeFriendList" class="challenge-card__list">
        <p class="challenge-card__empty">${t("ui.loading", "Loading…")}</p>
      </div>
      <div class="challenge-card__footer">
        <span class="challenge-card__footer-label">⚔ ${t("challenge.select_friend", "Challenge a friend")}</span>
        <button id="challengeModalClose" class="challenge-card__footer-close" aria-label="Close">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  modal.querySelector("#challengeModalClose").addEventListener("click", () => modal.remove());

  // Charger la liste d'amis
  api.friends
    .list()
    .then((data) => {
      const friends = data.friends ?? [];
      const listEl = document.getElementById("challengeFriendList");
      if (!listEl) return;

      if (!friends.length) {
        listEl.innerHTML = `<p class="challenge-card__empty">${t("friends.no_friends", "No friends yet.")}</p>`;
        return;
      }

      listEl.innerHTML = friends
        .map(
          (f) => `
      <div class="challenge-friend-row">
        <img class="challenge-friend-row__avatar"
             src="${esc(f.avatar_data) || "../img/default_avatar.png"}"
             onerror="this.src='../img/default_avatar.png'"
             alt="${esc(f.pseudo)}">
        <div class="challenge-friend-row__info">
          <div class="challenge-friend-row__pseudo">${esc(f.pseudo)}</div>
          <div class="challenge-friend-row__code">${esc(f.friend_code)}</div>
        </div>
        <button data-fid="${f.friend_id}" class="challenge-friend-row__send js-send-challenge">
          ${t("challenge.send", "Send")}
        </button>
      </div>
    `
        )
        .join("");

      listEl.querySelectorAll(".js-send-challenge").forEach((sendBtn) => {
        sendBtn.addEventListener("click", async () => {
          sendBtn.disabled = true;
          const friendId = parseInt(sendBtn.dataset.fid);
          try {
            // Cible aléatoire dédiée au défi (« un autre guest à deviner ») —
            // tirée dans le pool filtré du mode, cible du jour déjà exclue par
            // l'appelant. Null si pool indisponible → défi ancien format.
            const challengeTarget =
              Array.isArray(targetPool) && targetPool.length
                ? targetPool[Math.floor(Math.random() * targetPool.length)]
                : null;
            await api.messages.send({
              receiver_id: friendId,
              type: "challenge",
              challenge_mode: normalizeModeKey(mode) ?? mode,
              challenge_score: score,
              challenge_date: date,
              challenge_filters: JSON.stringify(activeFilters),
              ...(challengeTarget ? { challenge_target: challengeTarget } : {}),
              // Porté jusqu'au serveur : décide de la page d'arrivée du
              // destinataire (`?expert=1`) et du barème à l'arrivée.
              challenge_is_expert: isExpert,
            });
            sendBtn.textContent = "✓ Sent!";
            sendBtn.classList.add("sent");

            // XP Social Link : action 'challenge'
            if (api.socialLink) {
              api.socialLink.interactByFriend(friendId, "challenge").catch(() => {});
            }
          } catch (err) {
            sendBtn.disabled = false;
            sendBtn.textContent =
              err?.status === 409 ? t("challenge.already_sent", "Already sent today") : "✕ Error";
          }
        });
      });
    })
    .catch(() => {
      const listEl = document.getElementById("challengeFriendList");
      if (listEl) listEl.innerHTML = `<p class="challenge-card__empty">Could not load friends.</p>`;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MODE / UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applique une liste de surcharges de style inline quand le dark mode est actif.
 * Chaque mode de jeu cible des éléments et couleurs différents (pas de logique
 * commune à extraire au-delà de ce squelette guard + querySelector + null-check),
 * donc les données d'override restent locales à chaque mode — seul ce squelette
 * répété 6 fois est factorisé ici.
 *
 * @param {Array<{selector?: string, id?: string, styles: Record<string,string>}>} overrides
 */
export function applyDarkModeOverrides(overrides) {
  if (!document.body.classList.contains("darkmode")) return;
  for (const { selector, id, styles } of overrides) {
    const el = id ? document.getElementById(id) : document.querySelector(selector);
    if (el) Object.assign(el.style, styles);
  }
}

/**
 * True si l'utilisateur a activé la réduction de mouvement au niveau OS/navigateur.
 * À vérifier avant de démarrer une boucle `requestAnimationFrame` décorative
 * (confettis, bruit TV…) : contrairement aux animations CSS, une media query
 * `prefers-reduced-motion` (css/global.css) ne peut jamais arrêter une boucle JS.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Réactive le bouton "Give up" après le délai/seuil de tentatives requis.
 * Identique dans tous les modes qui ont un bouton #giveUpButton.
 *
 * @param {string} [buttonId="giveUpButton"]
 */
export function setGiveUpEnabled(enabled, buttonId = "giveUpButton") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  // `disabled` n'existe que sur les contrôles de formulaire. Dans les 6 modes le
  // bouton Abandonner est un `<div class="link-wrapper">` : y écrire `.disabled`
  // ne bloque rien et ne se voit pas. Le verrou réel est dans le handler de chaque
  // mode (`if (attempts < GIVE_UP_THRESHOLD) return`) ; ce qui manquait, c'est le
  // signal — visuel et pour les lecteurs d'écran.
  btn.disabled = !enabled; // sans effet sur un div, utile si c'en devient un vrai
  btn.setAttribute("aria-disabled", String(!enabled));
  btn.style.cursor = enabled ? "pointer" : "not-allowed";
}

/**
 * Débloque le bouton Abandonner. Conservée parce qu'elle est appelée depuis
 * plusieurs modes ; délègue à setGiveUpEnabled().
 */
export function enableGiveUpButton(buttonId = "giveUpButton") {
  setGiveUpEnabled(true, buttonId);
}

/**
 * Vrai si un personnage appartient à au moins un des opus actifs.
 *
 * Extrait de la logique dupliquée de filterCharacterPool() (classiqueMode,
 * emojiMode) — chaque mode garde sa propre fonction wrapper car les deux
 * diffèrent réellement au-delà de ce test (mutation en place vs retour d'un
 * nouveau tableau, exclusion ou non des noms déjà devinés) ; seul ce test
 * d'intersection opus, identique partout, est factorisé ici.
 *
 * @param {{ opus?: string|string[] }} character
 * @param {string[]} activeOpus
 * @returns {boolean}
 */
export function characterMatchesActiveOpus(character, activeOpus) {
  if (!character || !character.opus) return false;
  const charOpus = Array.isArray(character.opus) ? character.opus : [character.opus];
  return charOpus.some((op) => activeOpus.includes(op));
}

/**
 * Met à jour le texte "(x / seuil)" et la classe .activated d'un compteur de
 * tentatives (hint/give-up). No-op si l'élément n'existe pas.
 *
 * Extrait de updateCounters() (classiqueMode, emojiMode) — chaque mode garde
 * sa propre fonction wrapper car ils n'affichent pas le même nombre de
 * compteurs (classique en a 2, emoji 1) ; seul ce fragment de mise à jour par
 * élément, identique partout, est factorisé ici.
 *
 * @param {string} elementId
 * @param {number} attempts
 * @param {number} threshold
 */
export function updateCounterElement(elementId, attempts, threshold) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = `(${attempts} / ${threshold})`;
  el.classList.toggle("activated", attempts >= threshold);
}
