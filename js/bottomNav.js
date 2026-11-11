/**
 * bottomNav.js — Barre de navigation fixe en bas de l'écran
 * ─────────────────────────────────────────────────────────
 * Affichée sur : index.html, profile/profile.html
 * Future : classiqueMode, emojiMode, etc. (activé page par page)
 *
 * 5 items :
 *   Home        → index.html
 *   Play        → feuille des 6 modes et de leur état du jour (js/daily_status.js)
 *   Ranking     → profile/leaderboard/leaderboard.html
 *   Friends     → profile/friends/friends.html
 *   Profile     → profile/profile.html
 *
 * Libellés traduits (clés `nav.*`) : ils étaient écrits en dur en anglais.
 *
 * Fonctionnalités :
 *   - Détection automatique de la page active (classe .active)
 *   - Avatar miniature dans l'icône Profile si profil existant
 *   - Toast animé "Coming soon" pour les sections non implémentées
 *   - Liens relatifs calculés selon la page hôte
 *
 * Usage :
 *   import { initBottomNav } from './js/bottomNav.js';
 *   initBottomNav();
 */

// ─────────────────────────────────────────────────────────
// 1. UTILITAIRES
// ─────────────────────────────────────────────────────────

/** Chemin absolu vers img/ — fonctionne quelle que soit la profondeur de la page. */
function _imgBase() {
  return window.location.pathname.startsWith("/personadle/") ? "/personadle/img/" : "/img/";
}

/** Normalise un chemin avatar (relatif ou absolu) en chemin absolu. */
function _normalizeAvatar(avatar) {
  if (!avatar || avatar.startsWith("data:")) return avatar;
  return avatar
    .replace(/^(\.\.\/)+img\//, _imgBase())
    .replace(/^\.\/img\//, _imgBase())
    .replace(/^img\//, _imgBase());
}

/**
 * Identifie la page courante d'après l'URL.
 * @returns {'home' | 'profile' | 'other'}
 */
import { siteRootPrefix } from "./gameCore.js";
import { dailyProgress, MODE_ICON, modeHref } from "./daily_status.js";

/** Traduction avec repli (CLAUDE.md §5 : t(key) rend la clé si elle manque). */
function _t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

export function getCurrentPage() {
  const path = window.location.pathname;
  if (path.includes("/profile/profile")) return "profile";
  if (path.includes("/profile/friends")) return "friends";
  if (path.includes("/profile/leaderboard")) return "leaderboard";
  if (path.endsWith("/index.html") || path.endsWith("/") || path.endsWith("personadle"))
    return "home";
  // Modes de jeu (pages dans un sous-dossier)
  if (
    path.includes("/classiqueMode/") ||
    path.includes("/emojiMode/") ||
    path.includes("/silhouetteMode/") ||
    path.includes("/allOutAttackMode/") ||
    path.includes("/personaeMode/") ||
    path.includes("/musicsMode/")
  )
    return "game";
  return "other";
}

/**
 * Retourne l'avatar stocké dans le profil localStorage, ou null.
 * Normalise les chemins relatifs selon la page hôte.
 * @param {string} currentPage - 'home' | 'profile' | 'other'
 * @returns {string|null}
 */
export function getProfileAvatar(currentPage) {
  try {
    const saved = localStorage.getItem("personaUserProfile");
    if (!saved) return null;
    const p = JSON.parse(saved);
    if (!p.avatar) return null;

    // Les data URLs (base64) sont toujours valides
    if (p.avatar.startsWith("data:")) return p.avatar;

    return _normalizeAvatar(p.avatar);
  } catch {
    return null;
  }
}

/**
 * Calcule les hrefs relatifs selon la page courante.
 * @param {string} currentPage
 * @returns {{ home: string, profile: string, friends: string, leaderboard: string }}
 */
export function buildHrefs(currentPage) {
  const isProfile = currentPage === "profile";
  const isFriends = currentPage === "friends";
  const isLeader = currentPage === "leaderboard";

  // Base calculée depuis l'URL réelle, pour que les liens résolvent correctement
  // depuis n'importe quel sous-dossier. siteRootPrefix() (gameCore.js) tient ce
  // calcul pour tout le site : c'est cette version-ci qui était juste, pendant
  // que les liens de défi partaient en absolu avec un « /personadle » codé en
  // dur — et tombaient en 404 sur toute autre racine.
  const base = siteRootPrefix();
  return {
    home: `${base}index.html`,
    profile: isProfile ? "./profile.html" : `${base}profile/profile.html`,
    friends: isFriends ? "./friends.html" : `${base}profile/friends/friends.html`,
    leaderboard: isLeader ? "./leaderboard.html" : `${base}profile/leaderboard/leaderboard.html`,
  };
}

// ─────────────────────────────────────────────────────────
// 2. TOAST "COMING SOON"
// ─────────────────────────────────────────────────────────

let toastTimeout = null;

/**
 * Affiche un toast temporaire en bas de l'écran.
 * @param {string} message - Texte à afficher
 */
function showToast(message) {
  let toast = document.getElementById("navToast");

  // Crée le toast s'il n'existe pas encore
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "navToast";
    toast.className = "nav-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  // Reset du timer précédent
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

// ─────────────────────────────────────────────────────────
// 3. GÉNÉRATION DU HTML DE LA NAV
// ─────────────────────────────────────────────────────────

/**
 * Génère le HTML complet de la barre de navigation.
 * @param {string} currentPage
 * @param {string|null} avatar
 * @param {{ home: string, profile: string }} hrefs
 * @returns {string}
 */
function buildNavHTML(currentPage, avatar, hrefs) {
  // Icône Profile : avatar miniature si disponible, sinon SVG user
  const profileIconHTML = avatar
    ? `<img class="nav-avatar" src="${avatar}" alt="Profile avatar" loading="lazy">`
    : `<svg viewBox="0 0 24 24" aria-hidden="true">
         <circle cx="12" cy="8" r="4"/>
         <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
       </svg>`;

  return `
    <nav class="bottom-nav" role="navigation" aria-label="Main navigation">

      <!-- ① HOME -->
      <a class="nav-item ${currentPage === "home" ? "active" : ""}"
         href="${hrefs.home}"
         aria-label="Home"
         aria-current="${currentPage === "home" ? "page" : "false"}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"/>
          <path d="M9 21V13h6v8"/>
        </svg>
        <span class="nav-label" data-i18n="nav.home">Home</span>
      </a>

      <!-- ② JOUER — ouvre la feuille des 6 modes -->
      <button type="button" class="nav-item nav-item--play ${currentPage === "game" ? "active" : ""}"
         id="navPlayBtn"
         aria-haspopup="dialog"
         aria-expanded="false"
         aria-controls="navPlaySheet">
        <div class="nav-icon-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span id="navPlayBadge" class="nav-badge nav-badge--play hidden"></span>
        </div>
        <span class="nav-label" data-i18n="nav.play">Play</span>
      </button>

      <!-- ③ RANKING -->
      <a class="nav-item ${currentPage === "leaderboard" ? "active" : ""}"
         href="${hrefs.leaderboard}"
         aria-label="Leaderboard"
         aria-current="${currentPage === "leaderboard" ? "page" : "false"}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3"  y="12" width="4" height="9" rx="1"/>
          <rect x="10" y="7"  width="4" height="14" rx="1"/>
          <rect x="17" y="3"  width="4" height="18" rx="1"/>
        </svg>
        <span class="nav-label" data-i18n="nav.ranking">Ranking</span>
      </a>

      <!-- ④ FRIENDS -->
      <a class="nav-item ${currentPage === "friends" ? "active" : ""}"
         href="${hrefs.friends}"
         aria-label="Friends"
         aria-current="${currentPage === "friends" ? "page" : "false"}">
        <div class="nav-icon-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9"  cy="8" r="3"/>
            <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
            <circle cx="17" cy="8" r="2.5"/>
            <path d="M22 20c0-2.8-2.2-5-5-5"/>
          </svg>
          <span id="navFriendsBadge" class="nav-badge hidden" aria-live="polite"></span>
        </div>
        <span class="nav-label" data-i18n="nav.friends">Friends</span>
      </a>

      <!-- ⑤ PROFILE -->
      <a class="nav-item ${currentPage === "profile" ? "active" : ""}"
         href="${hrefs.profile}"
         aria-label="My profile"
         aria-current="${currentPage === "profile" ? "page" : "false"}">
        ${profileIconHTML}
        <span class="nav-label" data-i18n="nav.profile">Profile</span>
      </a>

    </nav>
  `;
}

// ─────────────────────────────────────────────────────────
// 4. FEUILLE « JOUER »
// ─────────────────────────────────────────────────────────

/**
 * Traduit les libellés de la barre à son injection. Les changements de langue
 * suivants passent par les attributs data-i18n, que setLang() (js/i18n.js)
 * réapplique à tout le DOM ; si les traductions ne sont pas encore chargées,
 * le libellé anglais reste jusqu'à ce premier setLang().
 */
export function applyNavLabels(root = document) {
  root.querySelectorAll(".bottom-nav [data-i18n]").forEach((el) => {
    el.textContent = _t(el.getAttribute("data-i18n"), el.textContent);
  });
}

/** Met à jour la pastille « N à jouer » de l'item Jouer. */
export function updatePlayBadge(progress = dailyProgress()) {
  const badge = document.getElementById("navPlayBadge");
  if (!badge) return;
  const left = progress.total - progress.done;
  badge.textContent = left > 0 ? String(left) : "✓";
  badge.classList.toggle("nav-badge--done", left === 0);
  badge.classList.remove("hidden");
  badge.setAttribute(
    "aria-label",
    left > 0
      ? _t("nav.play_left", `${left} left today`, { count: left })
      : _t("nav.play_all_done", "All modes played today")
  );
}

/**
 * HTML de la feuille : les 6 modes, leur état du jour, le mode courant marqué.
 * Exportée pour les tests (tests/bottomNav.test.js).
 */
export function buildPlaySheetHTML(progress, currentPath = window.location.pathname) {
  const items = progress.modes
    .map(({ key, label, done }) => {
      const href = modeHref(key) ?? "#";
      const page = href.split("/").slice(-2).join("/").split("?")[0];
      const isHere = currentPath.endsWith(page);
      const state = done
        ? `<span class="play-sheet-state play-sheet-state--done">✓ ${_t("nav.play_done", "Played")}</span>`
        : `<span class="play-sheet-state">${_t("nav.play_todo", "To play")}</span>`;
      return `
        <a class="play-sheet-item${done ? " is-done" : ""}${isHere ? " is-here" : ""}"
           href="${href}" ${isHere ? 'aria-current="page"' : ""}>
          <span class="play-sheet-icon" aria-hidden="true">${MODE_ICON[key] ?? "🎮"}</span>
          <span class="play-sheet-name">${_t(`modes.${key}.name`, label)}</span>
          ${state}
        </a>`;
    })
    .join("");
  return `
    <div class="play-sheet-backdrop" data-play-close></div>
    <div class="play-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="navPlaySheetTitle">
      <div class="play-sheet-handle" aria-hidden="true"></div>
      <h2 id="navPlaySheetTitle" class="play-sheet-title">
        ${_t("nav.play_title", "Today's modes")}
        <span class="play-sheet-count">${progress.done} / ${progress.total}</span>
      </h2>
      <div class="play-sheet-list">${items}</div>
    </div>`;
}

function _openPlaySheet() {
  let sheet = document.getElementById("navPlaySheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "navPlaySheet";
    sheet.className = "play-sheet";
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-play-close]")) _closePlaySheet();
    });
  }
  const progress = dailyProgress();
  sheet.innerHTML = buildPlaySheetHTML(progress);
  updatePlayBadge(progress);
  sheet.classList.add("is-open");
  document.getElementById("navPlayBtn")?.setAttribute("aria-expanded", "true");
  (
    sheet.querySelector(".play-sheet-item:not(.is-done)") ?? sheet.querySelector(".play-sheet-item")
  )?.focus();
  document.addEventListener("keydown", _onSheetKey);
}

function _closePlaySheet() {
  const sheet = document.getElementById("navPlaySheet");
  if (!sheet?.classList.contains("is-open")) return;
  sheet.classList.remove("is-open");
  document.removeEventListener("keydown", _onSheetKey);
  const btn = document.getElementById("navPlayBtn");
  btn?.setAttribute("aria-expanded", "false");
  btn?.focus();
}

function _onSheetKey(e) {
  if (e.key === "Escape") _closePlaySheet();
}

// ─────────────────────────────────────────────────────────
// 5. POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────

/**
 * Initialise et insère la barre de navigation dans le DOM.
 * Doit être appelée après le chargement du DOM.
 */
export function initBottomNav() {
  const currentPage = getCurrentPage();
  const avatar = getProfileAvatar(currentPage);
  const hrefs = buildHrefs(currentPage);
  window.showToast = showToast;

  // Injecte la nav juste avant </body>
  document.body.insertAdjacentHTML("beforeend", buildNavHTML(currentPage, avatar, hrefs));

  // Libellés traduits + item Jouer
  applyNavLabels();
  updatePlayBadge();
  document.getElementById("navPlayBtn")?.addEventListener("click", () => {
    const open = document.getElementById("navPlaySheet")?.classList.contains("is-open");
    if (open) _closePlaySheet();
    else _openPlaySheet();
  });
  // Une partie vient d'être enregistrée sur cette page, ou l'onglet revient au
  // premier plan après une partie jouée ailleurs : la pastille suit.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updatePlayBadge();
  });
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith("dailyDone_")) updatePlayBadge();
  });

  // ── Item Admin dans la nav ─────────────────────────────────────────────────
  // Ajoute un 5e item "⚡ Admin" dans la bottomNav après résolution de l'auth.
  const _addAdminNavItem = () => {
    if (!window._currentUser?.is_admin) return;
    if (document.getElementById("nav-admin-item")) return;

    const p = window.location.pathname;
    const isDeepSubpath = p.includes("/profile/friends/") || p.includes("/profile/leaderboard/");
    const isSubpath =
      !isDeepSubpath &&
      (p.includes("/profile/") ||
        p.includes("/classiqueMode/") ||
        p.includes("/emojiMode/") ||
        p.includes("/silhouetteMode/") ||
        p.includes("/allOutAttackMode/") ||
        p.includes("/personaeMode/") ||
        p.includes("/musicsMode/"));
    const href = isDeepSubpath ? "../../admin/" : isSubpath ? "../admin/" : "./admin/";

    const item = document.createElement("a");
    item.id = "nav-admin-item";
    item.className = "nav-item nav-item--admin";
    item.href = href;
    item.setAttribute("aria-label", "Admin Panel");
    item.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"/>
        <path d="M9 12l2 2 4-4" stroke-width="2" fill="none"/>
      </svg>
      <span class="nav-label">Admin</span>
    `;

    document.querySelector(".bottom-nav")?.appendChild(item);
  };

  const _removeAdminNavItem = () => document.getElementById("nav-admin-item")?.remove();

  // Cas 1 : auth déjà résolue au moment de l'init (profile.html avec top-level await)
  if (window._currentUser?.is_admin) _addAdminNavItem();

  // Cas 2 : auth se résout plus tard (index.html) ou login manuel
  window.addEventListener("personadle:auth-ready", _addAdminNavItem);
  window.addEventListener("personadle:auth-login", _addAdminNavItem);
  window.addEventListener("personadle:auth-logout", _removeAdminNavItem);
}

/**
 * Met à jour l'avatar dans la bottomNav après un cloud sync.
 * À appeler après pullProfileFromCloud() sur les pages où initBottomNav() a déjà tourné.
 */
export function updateNavAvatar() {
  try {
    const p = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
    let avatar = p.avatar || null;
    const navLink = document.querySelector('a[aria-label="My profile"]');
    if (!avatar || !navLink) return;

    avatar = _normalizeAvatar(avatar) || avatar;

    let img = navLink.querySelector(".nav-avatar");
    if (!img) {
      // Pas encore d'img — remplacer le SVG générique
      img = document.createElement("img");
      img.className = "nav-avatar";
      img.alt = "Profile avatar";
      img.loading = "lazy";
      const svgEl = navLink.querySelector("svg");
      if (svgEl) svgEl.replaceWith(img);
      else navLink.insertBefore(img, navLink.firstChild);
    }
    // Toujours mettre à jour le src (couvre les changements d'avatar)
    if (img.src !== avatar) img.src = avatar;
  } catch {
    /* silencieux */
  }
}
