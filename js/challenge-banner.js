/**
 * js/challenge-banner.js — Bandeau rappel du défi actif
 * ─────────────────────────────────────────────────────────
 * Usage dans les pages de jeu :
 *   import { initChallengeBanner } from '../js/challenge-banner.js';
 *   initChallengeBanner('classic'); // passer le mode courant (lowercase)
 *
 * Le défi actif est stocké dans localStorage 'activeChallenge' :
 *   { msgId, mode, date, score, senderId }
 * Il est effacé automatiquement si la date ne correspond plus au jour courant.
 */

export function initChallengeBanner(currentMode) {
  const raw = localStorage.getItem('activeChallenge');
  if (!raw) return;

  let challenge;
  try { challenge = JSON.parse(raw); }
  catch { localStorage.removeItem('activeChallenge'); return; }

  // Vérifier que c'est pour aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  if (challenge.date && challenge.date !== today) {
    localStorage.removeItem('activeChallenge');
    return;
  }

  // Vérifier que c'est pour le bon mode
  if (challenge.mode && challenge.mode.toLowerCase() !== currentMode.toLowerCase()) return;

  _injectBanner(challenge);
}

function _injectBanner({ msgId, mode, score }) {
  if (document.getElementById('challengeBanner')) return;

  const t = (key, fb) => window.i18n?.t?.(key) || fb;

  const banner = document.createElement('div');
  banner.id = 'challengeBanner';
  banner.innerHTML = `
    <img class="cb-avatar" src="${_defaultAvatar()}" alt="challenger" id="cbAvatar">
    <div class="cb-text">
      <div class="cb-pseudo" id="cbPseudo">${t('challenge.banner_title', '⚔ Active Challenge')}</div>
      <div class="cb-score">
        ${t('challenge.banner_beat', 'Beat')} <strong>${score} pts</strong>
        — ${(mode || '').toUpperCase()}
      </div>
    </div>
    <button class="cb-dismiss" id="cbDismiss" title="Dismiss">✕</button>
  `;

  document.body.insertBefore(banner, document.body.firstChild);

  // Charger les infos de l'adversaire en arrière-plan
  if (msgId) _loadChallengerInfo(msgId);

  document.getElementById('cbDismiss')?.addEventListener('click', () => {
    banner.remove();
    // Ne pas effacer le challenge — l'utilisateur peut encore le relever
  });
}

async function _loadChallengerInfo(msgId) {
  if (!window._personadleApi) return;
  try {
    const data = await window._personadleApi.messages.list({ limit: 50 });
    const msg  = (data.messages ?? []).find(m => m.id === msgId);
    if (!msg) return;

    const pseudoEl = document.getElementById('cbPseudo');
    const avatarEl = document.getElementById('cbAvatar');
    if (pseudoEl) pseudoEl.textContent = `⚔ ${msg.sender.pseudo}`;
    if (avatarEl && msg.sender.avatar) avatarEl.src = msg.sender.avatar;
  } catch { /* silencieux */ }
}

function _defaultAvatar() {
  const p = window.location.pathname;
  const prefix = p.startsWith('/personadle/') ? '/personadle' : '';
  return `${prefix}/img/default_avatar.png`;
}
