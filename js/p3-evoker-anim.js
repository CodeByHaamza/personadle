/**
 * js/p3-evoker-anim.js — Animation "Evoker" Persona 3
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage :
 *   import { queueEvokerAnimations } from './p3-evoker-anim.js';
 *   queueEvokerAnimations([{ pseudo, friendship_id, avatar_data }]);
 *
 * L'animation peut être désactivée via settings.anim_friend_request = false.
 */

const _queue = [];
let   _busy  = false;

function _imgBase() {
  const p = window.location.pathname;
  const prefix = p.startsWith('/personadle/') ? '/personadle' : '';
  return `${prefix}/img/`;
}

function _esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function _avatarSrc(data) {
  if (!data) return `${_imgBase()}default_avatar.png`;
  if (data.startsWith('data:')) return data;
  const base = _imgBase().replace(/img\/$/, '');
  return data.replace(/^\.\.\//, base).replace(/^\.\//, base);
}

/**
 * Enfile une ou plusieurs demandes d'ami pour affichage.
 * @param {Array<{pseudo: string, friendship_id: number, avatar_data: string|null}>} requests
 */
export function queueEvokerAnimations(requests) {
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
  document.getElementById('p3e-overlay')?.remove();

  const t = (key, fallback) => {
    const val = window.i18n?.t?.(key);
    return (val && val !== key) ? val : fallback;
  };

  const overlay = document.createElement('div');
  overlay.id = 'p3e-overlay';

  overlay.innerHTML = `
    <div class="p3e-backdrop"></div>
    <button class="p3e-close" aria-label="Close">✕</button>
    <div class="p3e-flash"></div>

    <!-- Éclats bleus — partent vers la gauche (côté opposé à l'Evoker) -->
    <div class="p3e-shards-wrap">
      <div class="p3e-shard p3e-shard--1"></div>
      <div class="p3e-shard p3e-shard--2"></div>
      <div class="p3e-shard p3e-shard--3"></div>
      <div class="p3e-shard p3e-shard--4"></div>
      <div class="p3e-shard p3e-shard--5"></div>
      <div class="p3e-shard p3e-shard--6"></div>
    </div>

    <div class="p3e-scene">
      <!-- Avatar (sombre au départ, révèle après le tir) -->
      <div class="p3e-avatar-wrap">
        <img class="p3e-avatar"
             src="${_avatarSrc(avatar_data)}"
             alt="${_esc(pseudo)}"
             onerror="this.src='${_imgBase()}default_avatar.png'">
        <div class="p3e-evoker-wrap">
          <span class="p3e-evoker">🔫</span>
        </div>
      </div>

      <!-- Panneau bleu foncé central — apparaît après le tir -->
      <div class="p3e-panel">
        <p class="p3e-pseudo">${_esc(pseudo)}</p>
        <p class="p3e-msg">${t('friends.cc_wants_confidant', 'vous demande en ami.')}</p>
      </div>

      <!-- Boutons sous la pdp -->
      <div class="p3e-actions">
        <button class="p3e-btn p3e-btn--yes" data-fid="${friendship_id}">
          ${t('friends.cc_yes', 'OUI')}
        </button>
        <button class="p3e-btn p3e-btn--no" data-fid="${friendship_id}">
          ${t('friends.cc_no', 'NON')}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Phase 1 : backdrop + avatar sombre
  requestAnimationFrame(() => overlay.classList.add('p3e--visible'));

  // Phase 2 : tir (evoker a fini de viser)
  setTimeout(() => overlay.classList.add('p3e--fired'), 1800);

  // Phase 3 : panneau + boutons
  setTimeout(() => {
    overlay.querySelector('.p3e-panel').classList.add('p3e-panel--visible');
    overlay.querySelector('.p3e-actions').classList.add('p3e-actions--visible');
  }, 2300);

  overlay.querySelector('.p3e-btn--yes').addEventListener('click', async e => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, 'accept').catch(() => {});
    _closeOverlay(overlay);
  });

  overlay.querySelector('.p3e-btn--no').addEventListener('click', async e => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, 'decline').catch(() => {});
    _closeOverlay(overlay);
  });

  overlay.querySelector('.p3e-close').addEventListener('click', () => {
    _queue.length = 0;
    _busy = false;
    window._personadleApi?.notifications.markSeen().catch(() => {});
    _fadeOut(overlay, null);
  });
}

function _fadeOut(overlay, onDone) {
  overlay.style.transition = 'opacity 0.3s ease';
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.remove();
    if (onDone) onDone();
  }, 320);
}

function _closeOverlay(overlay) {
  _fadeOut(overlay, _showNext);
}
