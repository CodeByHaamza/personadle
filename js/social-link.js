/**
 * js/social-link.js — Module Social Link côté client
 * ─────────────────────────────────────────────────────────
 * Exports :
 *   renderSocialLinkGauge(friendId, container)
 *     → Insère la jauge XP dans un container HTML
 *   gainSocialLinkXp(friendId, actionType)
 *     → Déclenche une interaction + retourne le résultat
 *   addFlameIfPlayedToday(friendEntry, el)
 *     → Ajoute la flamme 🔥 si on a joué ensemble aujourd'hui
 */

/** Cache linkId par friendId pour la session. */
const _linkCache = new Map();

/** Traduit une clé i18n ou renvoie le fallback. */
function t(key, fallback) { return window.i18n?.t?.(key) ?? fallback; }

/**
 * Récupère (et met en cache) le linkId pour un ami.
 * @param {number} friendId
 * @returns {Promise<number>}
 */
async function getLinkId(friendId) {
  if (_linkCache.has(friendId)) return _linkCache.get(friendId);
  const api = window._personadleApi;
  if (!api) throw new Error('API not available');
  const data = await api.socialLink.getByFriend(friendId);
  _linkCache.set(friendId, data.link_id);
  return data.link_id;
}

/**
 * Récupère les données complètes du Social Link avec un ami.
 * @param {number} friendId
 * @returns {Promise<object>}
 */
export async function getSocialLinkData(friendId) {
  const linkId = await getLinkId(friendId);
  return window._personadleApi.socialLink.get(linkId);
}

/**
 * Déclenche une interaction XP et retourne le résultat.
 * Utilise l'endpoint unifié by-friend/interact — 1 round-trip au lieu de 2.
 * @param {number} friendId
 * @param {string} actionType
 * @returns {Promise<{ link_id, xp_gained, is_mutual, new_xp, new_rank, ranked_up }>}
 * @throws {Error} on API unavailable or HTTP error (409 Already done today, 403 Not friends)
 */
export async function gainSocialLinkXp(friendId, actionType) {
  const api = window._personadleApi;
  if (!api) throw new Error('API not available');
  const result = await api.socialLink.interactByFriend(friendId, actionType);
  // Mettre à jour le cache linkId si retourné
  if (result?.link_id) _linkCache.set(friendId, result.link_id);
  return result;
}

/**
 * Rend la jauge Social Link dans un container HTML.
 * @param {number} friendId
 * @param {HTMLElement} container
 */
export async function renderSocialLinkGauge(friendId, container) {
  container.innerHTML = '<p class="sl-loading" style="font-size:0.8rem;color:#888">Loading…</p>';
  try {
    const data = await getSocialLinkData(friendId);
    _renderGauge(data, friendId, container);
  } catch {
    container.innerHTML = '';
  }
}

function _renderGauge(data, friendId, container) {
  const lang       = document.documentElement.lang || 'en';
  const rankName   = data.rank_names?.[lang] || data.rank_names?.en || '';
  const xp         = data.xp ?? 0;
  const xpCurrent  = data.xp_current_rank ?? 0;
  const xpNext     = data.xp_next_rank ?? null;
  const rank       = data.rank ?? 1;
  const isMax      = rank >= 10;

  const pct = isMax ? 100 :
    xpNext ? Math.min(100, Math.round(((xp - xpCurrent) / (xpNext - xpCurrent)) * 100)) : 0;

  const todayActions = (data.today_interactions ?? [])
    .filter(i => i.initiator_id === window._currentUser?.id)
    .map(i => i.action_type);

  const actions = [
    { type: 'visit_profile', label: t('social.action_visit',   '👁 Visit +5 XP')           },
    { type: 'share_score',   label: t('social.action_score',   '📊 Share score +10 XP')     },
    { type: 'compare_stats', label: t('social.action_compare', '⚖ Compare stats +10 XP')   },
  ];

  const doneLabel = t('social.done_today', 'Done today');

  container.innerHTML = `
    <div class="sl-gauge-wrap${isMax ? ' sl-rank-10' : ''}">
      <div class="sl-gauge-header">
        <span class="sl-rank-name">Social Link</span>
        <span class="sl-rank-badge">Rank ${rank} — ${rankName}</span>
      </div>
      <div class="sl-bar-bg">
        <div class="sl-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="sl-xp-label">
        ${isMax
          ? t('social.max_rank', '✨ MAX — True Confidant')
          : `${xp} XP / ${xpNext ?? '?'} XP (${pct}%)`}
      </span>
      <div class="sl-actions">
        ${actions.map(a => {
          const done = todayActions.includes(a.type);
          return `<button
            class="sl-action-btn"
            data-action="${a.type}"
            data-friendid="${friendId}"
            ${done ? 'disabled' : ''}
            ${done ? `title="${doneLabel}"` : ''}
          >${a.label}</button>`;
        }).join('')}
      </div>
    </div>
  `;

  // Délégation : click sur les boutons d'action
  container.querySelectorAll('.sl-action-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await gainSocialLinkXp(friendId, btn.dataset.action);
        // Invalider le cache pour forcer un rechargement frais
        _linkCache.delete(friendId);
        await renderSocialLinkGauge(friendId, container);

        if (res.ranked_up) {
          _showRankUpToast(res.new_rank, data.rank_names);
        }
      } catch (err) {
        if (err?.status === 409 || err?.message?.includes('409')) {
          btn.setAttribute('title', doneLabel);
        } else {
          btn.disabled = false;
        }
      }
    });
  });
}

function _showRankUpToast(newRank, rankNames) {
  const lang = document.documentElement.lang || 'en';
  const name = rankNames?.[lang] || rankNames?.en || `Rank ${newRank}`;
  const msg  = t('social.rank_up', '🎉 Social Link — Rank {{rank}}: {{name}}')
    .replace('{{rank}}', newRank)
    .replace('{{name}}', name);

  // Réutiliser showToast global si disponible
  if (typeof window.showToast === 'function') { window.showToast(msg); return; }

  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed', 'bottom:90px', 'left:50%', 'transform:translateX(-50%)',
    'background:#e63946', 'color:#fff', 'padding:10px 20px', 'border-radius:50px',
    "font-family:Oswald,Arial,sans-serif", 'font-weight:700', 'font-size:0.85rem',
    'z-index:9000', 'pointer-events:none', 'text-align:center',
  ].join(';');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Ajoute la flamme 🔥 à côté du pseudo d'un ami si on a interagi ensemble aujourd'hui.
 * @param {object} friendEntry  — objet retourné par api.friends.list()
 *                                doit avoir social_link_last_interaction (YYYY-MM-DD ou ISO)
 * @param {HTMLElement} el      — élément dans lequel injecter la flamme
 */
export function addFlameIfPlayedToday(friendEntry, el) {
  const lastInteraction = (friendEntry.social_link_last_interaction ?? '').slice(0, 10);
  if (!lastInteraction) return;
  const today = new Date().toISOString().slice(0, 10);
  if (lastInteraction === today) {
    el.insertAdjacentHTML('beforeend',
      '<span class="fr-flame" title="Played together today!">🔥</span>');
  }
}
