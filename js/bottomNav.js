/**
 * bottomNav.js — Barre de navigation fixe en bas de l'écran
 * ─────────────────────────────────────────────────────────
 * Affichée sur : index.html, profile/profile.html
 * Future : classiqueMode, emojiMode, etc. (activé page par page)
 *
 * 4 items :
 *   Home        → index.html
 *   Ranking     → coming soon (toast)
 *   Friends     → coming soon (toast)
 *   Profile     → profile/profile.html
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

/**
 * Identifie la page courante d'après l'URL.
 * @returns {'home' | 'profile' | 'other'}
 */
function getCurrentPage() {
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
function getProfileAvatar(currentPage) {
  try {
    const saved = localStorage.getItem("personaUserProfile");
    if (!saved) return null;
    const p = JSON.parse(saved);
    if (!p.avatar) return null;

    // Les data URLs (base64) sont toujours valides
    if (p.avatar.startsWith("data:")) return p.avatar;

    // Normalise le chemin selon la profondeur de la page :
    // - sous-dossier (/profile/, /classiqueMode/, …) → préfixe = ../
    // - racine (index.html, /)                       → préfixe = ./
    const isSubdir = ["profile", "friends", "leaderboard", "game"].includes(currentPage);
    if (isSubdir) {
      // ../img/ reste ../img/ ; ./img/ → ../img/
      return p.avatar.replace(/^\.\/img\//, "../img/");
    } else {
      // ./img/ reste ./img/ ; ../img/ → ./img/ (depuis la racine ../img/ est hors projet)
      return p.avatar.replace(/^\.\.\/img\//, "./img/");
    }
  } catch {
    return null;
  }
}

/**
 * Calcule les hrefs relatifs selon la page courante.
 * @param {string} currentPage
 * @returns {{ home: string, profile: string, friends: string, leaderboard: string }}
 */
function buildHrefs(currentPage) {
  const isProfile = currentPage === "profile";
  const isFriends = currentPage === "friends";
  const isLeader = currentPage === "leaderboard";

  // Compute base from the actual URL path so pages inside any subdirectory
  // always resolve links correctly, regardless of currentPage value.
  // profile/friends/ and profile/leaderboard/ are 2 levels deep → need ../../
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
  const base = isDeepSubpath ? "../../" : isSubpath ? "../" : "./";
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
        <span class="nav-label">Home</span>
      </a>

      <!-- ② RANKING -->
      <a class="nav-item ${currentPage === "leaderboard" ? "active" : ""}"
         href="${hrefs.leaderboard}"
         aria-label="Leaderboard"
         aria-current="${currentPage === "leaderboard" ? "page" : "false"}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3"  y="12" width="4" height="9" rx="1"/>
          <rect x="10" y="7"  width="4" height="14" rx="1"/>
          <rect x="17" y="3"  width="4" height="18" rx="1"/>
        </svg>
        <span class="nav-label">Ranking</span>
      </a>

      <!-- ③ FRIENDS -->
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
        <span class="nav-label">Friends</span>
      </a>

      <!-- ④ PROFILE -->
      <a class="nav-item ${currentPage === "profile" ? "active" : ""}"
         href="${hrefs.profile}"
         aria-label="My profile"
         aria-current="${currentPage === "profile" ? "page" : "false"}">
        ${profileIconHTML}
        <span class="nav-label">Profile</span>
      </a>

    </nav>
  `;
}

// ─────────────────────────────────────────────────────────
// 4. POINT D'ENTRÉE
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

  // ── Item Admin dans la nav ─────────────────────────────────────────────────
  // Ajoute un 5e item "⚡ Admin" dans la bottomNav après résolution de l'auth.
  const _addAdminNavItem = () => {
    if (!window._currentUser?.is_admin) return;
    if (document.getElementById("nav-admin-item")) return;

    const isSubpath =
      window.location.pathname.includes("/profile/") ||
      window.location.pathname.includes("/classiqueMode/") ||
      window.location.pathname.includes("/emojiMode/") ||
      window.location.pathname.includes("/silhouetteMode/") ||
      window.location.pathname.includes("/allOutAttackMode/") ||
      window.location.pathname.includes("/personaeMode/") ||
      window.location.pathname.includes("/musicsMode/");
    const href = isSubpath ? "../admin/" : "./admin/";

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

    // Normalise les chemins relatifs selon la profondeur de la page courante
    if (!avatar.startsWith("data:")) {
      const path = window.location.pathname;
      const isSubpath =
        path.includes("/profile/") ||
        path.includes("/classiqueMode/") ||
        path.includes("/emojiMode/") ||
        path.includes("/silhouetteMode/") ||
        path.includes("/allOutAttackMode/") ||
        path.includes("/personaeMode/") ||
        path.includes("/musicsMode/");
      avatar = isSubpath
        ? avatar.replace(/^\.\/img\//, "../img/")
        : avatar.replace(/^\.\.\/img\//, "./img/");
    }

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
