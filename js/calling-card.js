/**
 * js/calling-card.js — Animation "Calling Card" Persona 5
 * ─────────────────────────────────────────────────────────
 * Usage :
 *   import { queueCallingCards } from './calling-card.js';
 *   queueCallingCards([{ pseudo, friendship_id, avatar_data }]);
 *
 * L'animation peut être désactivée via settings.anim_friend_request = false.
 */

/** File d'attente des calling cards. */
const _queue = [];
let _busy = false;

/**
 * Détermine le chemin de base des images selon la profondeur de la page.
 * @returns {string} ex: '/personadle/img/' ou '/img/'
 */
function _imgBase() {
  const p = window.location.pathname;
  const prefix = p.startsWith("/personadle/") ? "/personadle" : "";
  return `${prefix}/img/`;
}

/** Échappe les caractères HTML dangereux. */
function _esc(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/** Résout le chemin de l'avatar (base64 ou chemin relatif). */
function _avatarSrc(data) {
  if (!data) return `${_imgBase()}default_avatar.png`;
  if (data.startsWith("data:")) return data;
  const base = _imgBase().replace(/img\/$/, "");
  return data.replace(/^\.\.\//, base).replace(/^\.\//, base);
}

/**
 * Enfile une ou plusieurs demandes pour affichage.
 * @param {Array<{pseudo: string, friendship_id: number, avatar_data: string|null}>} requests
 */
export function queueCallingCards(requests) {
  if (!requests.length) return;
  for (const r of requests) _queue.push(r);
  if (!_busy) _showNext();
}

function _showNext() {
  if (!_queue.length) {
    _busy = false;
    return;
  }
  _busy = true;
  _render(_queue.shift());
}

function _render({ pseudo, friendship_id, avatar_data }) {
  // Supprimer un overlay existant
  document.getElementById("cc-overlay")?.remove();

  const t = (key, fallback) => window.i18n?.t?.(key) || fallback;
  const imgSrc = `${_imgBase()}calling_card.webp`;

  const overlay = document.createElement("div");
  overlay.id = "cc-overlay";
  overlay.innerHTML = `
    <div class="cc-backdrop"></div>
    <button class="cc-close" aria-label="Close">✕</button>
    <!-- Flash rouge à l'impact — hors de tout contexte 3D -->
    <div class="cc-flash"></div>
    <!-- Anneaux d'impact — fixed, centrés sur viewport, hors contexte 3D -->
    <div class="cc-rings">
      <div class="cc-ring"></div>
      <div class="cc-ring"></div>
      <div class="cc-ring"></div>
      <div class="cc-ring"></div>
      <div class="cc-ring"></div>
      <div class="cc-ring"></div>
    </div>
    <!-- Scène 3D — contient uniquement la carte -->
    <div class="cc-scene">
      <div class="cc-card cc-card--flip" id="cc-card-inner">
        <div class="cc-card-front">
          <img src="${imgSrc}" alt="Calling Card" draggable="false">
        </div>
        <div class="cc-card-back">
          <img class="cc-friend-avatar"
               src="${_avatarSrc(avatar_data)}"
               alt="${_esc(pseudo)}"
               onerror="this.src='${_imgBase()}default_avatar.png'">
          <p class="cc-pseudo">${_esc(pseudo)}</p>
          <p class="cc-message">${t("friends.cc_wants_confidant", "vous a demandé en ami.")}</p>
          <p class="cc-sub">${t("friends.cc_accept_social_link", "Accepter ce Social Link ?")}</p>
          <div class="cc-buttons">
            <button class="cc-btn cc-btn--yes" data-fid="${friendship_id}">
              ${t("friends.cc_yes", "OUI")}
            </button>
            <button class="cc-btn cc-btn--no" data-fid="${friendship_id}">
              ${t("friends.cc_no", "NON")}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Déclencher immédiatement (backdrop s'ouvre en CSS via transition après .cc--visible)
  requestAnimationFrame(() => overlay.classList.add("cc--visible"));

  // Events
  overlay.querySelector(".cc-btn--yes").addEventListener("click", async (e) => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, "accept").catch(() => {});
    _closeOverlay(overlay);
  });

  overlay.querySelector(".cc-btn--no").addEventListener("click", async (e) => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, "decline").catch(() => {});
    _closeOverlay(overlay);
  });

  overlay.querySelector(".cc-close").addEventListener("click", () => {
    _queue.length = 0;
    _busy = false;
    window._personadleApi?.notifications.markSeen().catch(() => {});
    _fadeOut(overlay, null);
  });
}

function _fadeOut(overlay, onDone) {
  overlay.querySelector(".cc-backdrop").style.background = "rgba(0,0,0,0)";
  overlay.querySelector(".cc-scene").style.transition = "opacity 0.22s ease";
  overlay.querySelector(".cc-scene").style.opacity = "0";
  setTimeout(() => {
    overlay.remove();
    if (onDone) onDone();
  }, 240);
}

function _closeOverlay(overlay) {
  _fadeOut(overlay, _showNext);
}
