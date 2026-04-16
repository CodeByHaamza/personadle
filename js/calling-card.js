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
let   _busy  = false;

/**
 * Détermine le chemin de base des images selon la profondeur de la page.
 * @returns {string} ex: '/personadle/img/' ou '/img/'
 */
function _imgBase() {
  const p = window.location.pathname;
  const prefix = p.startsWith('/personadle/') ? '/personadle' : '';
  return `${prefix}/img/`;
}

/** Échappe les caractères HTML dangereux. */
function _esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
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
  if (!_queue.length) { _busy = false; return; }
  _busy = true;
  _render(_queue.shift());
}

function _render({ pseudo, friendship_id, avatar_data }) {
  // Supprimer un overlay existant
  document.getElementById('cc-overlay')?.remove();

  const t = (key, fallback) => window.i18n?.t?.(key) || fallback;
  const imgSrc = `${_imgBase()}calling_card.webp`;

  const overlay = document.createElement('div');
  overlay.id = 'cc-overlay';
  overlay.innerHTML = `
    <div class="cc-backdrop"></div>
    <button class="cc-close" aria-label="Close">✕</button>
    <div class="cc-scene">
      <div class="cc-card cc-card--flip" id="cc-card-inner">
        <div class="cc-card-front">
          <img src="${imgSrc}" alt="Calling Card" draggable="false">
        </div>
        <div class="cc-card-back">
          <div class="cc-rings">
            <span class="cc-ring"></span>
            <span class="cc-ring"></span>
            <span class="cc-ring"></span>
            <span class="cc-ring"></span>
            <span class="cc-ring"></span>
          </div>
          <p class="cc-pseudo">${_esc(pseudo)}</p>
          <p class="cc-message">${t('friends.cc_wants_confidant', 'wants to be your Confidant.')}</p>
          <p class="cc-sub">${t('friends.cc_accept_social_link', 'Accept this Social Link?')}</p>
          <div class="cc-buttons">
            <button class="cc-btn cc-btn--yes" data-fid="${friendship_id}">
              ${t('friends.cc_yes', 'YES')}
            </button>
            <button class="cc-btn cc-btn--no" data-fid="${friendship_id}">
              ${t('friends.cc_no', 'NO')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Déclencher l'apparition (transition opacity)
  requestAnimationFrame(() => overlay.classList.add('cc--visible'));

  // Events
  overlay.querySelector('.cc-btn--yes').addEventListener('click', async e => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, 'accept').catch(() => {});
    _closeOverlay(overlay);
  });

  overlay.querySelector('.cc-btn--no').addEventListener('click', async e => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, 'decline').catch(() => {});
    _closeOverlay(overlay);
  });

  overlay.querySelector('.cc-close').addEventListener('click', () => {
    // L'utilisateur ferme → vider la file + marquer tout comme vu
    _queue.length = 0;
    _busy = false;
    window._personadleApi?.notifications.markSeen().catch(() => {});
    overlay.classList.remove('cc--visible');
    setTimeout(() => overlay.remove(), 300);
  });
}

function _closeOverlay(overlay) {
  overlay.classList.remove('cc--visible');
  setTimeout(() => {
    overlay.remove();
    _showNext(); // carte suivante dans la file
  }, 300);
}
