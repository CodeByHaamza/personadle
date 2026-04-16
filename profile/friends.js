/**
 * profile/friends.js — Page amis PersonaDLE (v2)
 * ─────────────────────────────────────────────────────────────
 *
 * Sections :
 *   1. Utilitaires
 *   2. État interne
 *   3. Rendus — Browse Players (liste paginée avec friendship context)
 *   4. Rendus — My Friends
 *   5. Rendus — Pending Requests
 *   6. Chargement des données
 *   7. Actions (add, accept, decline, remove)
 *   8. Recherche + pagination
 *   9. Délégation d'événements
 *  10. Point d'entrée
 *
 * Dépendances :
 *   - window._personadleApi  (injecté par api.js)
 *   - window._currentUser    (injecté par auth.js après initAuth())
 *   - window.__i18nReady     (injecté par i18n.js)
 */

import { addFlameIfPlayedToday, gainSocialLinkXp } from '../js/social-link.js';

// ─────────────────────────────────────────────────────────
// 1. UTILITAIRES
// ─────────────────────────────────────────────────────────

/** Échappe les caractères spéciaux HTML. */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/** URL de l'avatar (fallback si absent). */
function avatarSrc(avatarData) {
  return avatarData || '../img/default_avatar.png';
}

/** Renders avatar wrapped in .fr-avatar-wrap with an online/offline/unknown dot. */
function avatarHTML(pseudo, avatarData, borderColor = '#ffffff', lastSeen = null) {
  const online = isOnline(lastSeen);
  // Always show dot: green = online (<30min), orange = offline, grey = never seen (null)
  const dotClass = lastSeen === null ? 'fr-dot--unknown' : (online ? 'fr-dot--online' : 'fr-dot--offline');
  const dot = `<span class="fr-dot ${dotClass}"></span>`;
  return `<div class="fr-avatar-wrap">
    <img class="fr-avatar"
         src="${esc(avatarSrc(avatarData))}"
         alt="${esc(pseudo)}"
         loading="lazy"
         style="border-color:${esc(borderColor)}"
         onerror="this.src='../img/default_avatar.png'">
    ${dot}
  </div>`;
}

/** Traduit une clé i18n ou retourne la clé brute. */
function t(key, vars = {}) {
  return window.i18n?.t?.(key, vars) ?? key;
}

/** Returns true if lastSeen ISO string is within the last 30 minutes. */
function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 30 * 60 * 1000;
}

/** Returns a human-readable "X ago" string, or null if no date. */
function formatLastSeen(isoDate) {
  if (!isoDate) return null;
  const diff = Date.now() - new Date(isoDate).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)  return t('friends.last_seen_just_now') || 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60)  return (t('friends.last_seen_minutes') || '{{n}}m ago').replace('{{n}}', min);
  const hr   = Math.floor(min / 60);
  if (hr  < 24)  return (t('friends.last_seen_hours')   || '{{n}}h ago').replace('{{n}}', hr);
  const days = Math.floor(hr / 24);
  if (days < 7)  return (t('friends.last_seen_days')    || '{{n}}d ago').replace('{{n}}', days);
  return t('friends.last_seen_long_ago') || 'a while ago';
}

// ─────────────────────────────────────────────────────────
// 2. ÉTAT INTERNE
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

let state = {
  // Données de l'API friends.list()
  friends: [],       // { friendship_id, friend_id, pseudo, friend_code, avatar_data, avatar_border_color }
  pending: [],       // idem, direction:'received'
  sentCodes: new Set(), // friend_codes auxquels on a envoyé une demande (pour désactiver les boutons)

  // Browse Players
  browseUsers:  [],  // résultats bruts de api.user.list()
  browseTotal:  0,
  browsePage:   0,
  browseQuery:  '',
};

let searchTimer = null;

// ─────────────────────────────────────────────────────────
// 3. RENDU — BROWSE PLAYERS
// ─────────────────────────────────────────────────────────

/**
 * Génère le HTML d'une ligne joueur dans le Browse.
 * @param {object} player  - objet retourné par api.user.list()
 */
function renderBrowseEntry(player) {
  const { id, pseudo, friend_code, avatar_data, avatar_border_color,
          last_seen_at,
          friendship_status, friendship_direction, friendship_id } = player;

  const myId = window._currentUser?.id;
  const isSelf = myId && myId === id;

  let badge = '';
  let actions = '';

  if (isSelf) {
    badge   = `<span class="fr-tag fr-tag--self">${t('friends.thats_you') || 'You'}</span>`;
    actions = '';
  } else if (friendship_status === 'accepted') {
    badge   = `<span class="fr-tag fr-tag--friend">💙 ${t('friends.friend') || 'Friend'}</span>`;
    actions = `
      <a href="profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view" title="${t('friends.view_profile') || 'View profile'}">👁</a>
      <button class="fr-btn fr-btn--danger js-remove"
              data-fid="${esc(String(friendship_id))}"
              title="${t('friends.remove_friend') || 'Remove'}">✕</button>
    `;
  } else if (friendship_status === 'pending' && friendship_direction === 'sent') {
    badge   = `<span class="fr-tag fr-tag--pending">⏳ ${t('friends.request_sent') || 'Sent'}</span>`;
    actions = `<a href="profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view">👁</a>`;
  } else if (friendship_status === 'pending' && friendship_direction === 'received') {
    badge   = `<span class="fr-tag fr-tag--pending">⏳ ${t('friends.pending') || 'Pending'}</span>`;
    actions = `
      <button class="fr-btn fr-btn--accept js-accept"
              data-fid="${esc(String(friendship_id))}"
              title="${t('friends.accept') || 'Accept'}">✓</button>
      <button class="fr-btn fr-btn--danger js-decline"
              data-fid="${esc(String(friendship_id))}"
              title="${t('friends.decline') || 'Decline'}">✕</button>
    `;
  } else if (state.sentCodes.has(friend_code)) {
    badge   = `<span class="fr-tag fr-tag--pending">⏳ ${t('friends.request_sent') || 'Sent'}</span>`;
    actions = `<a href="profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view">👁</a>`;
  } else {
    // Pas de relation — bouton Add Friend
    actions = `
      <button class="fr-btn fr-btn--add js-add"
              data-code="${esc(friend_code)}"
              data-id="${esc(String(id))}"
              title="${t('friends.add_friend') || 'Add friend'}">+ ${t('friends.add_friend') || 'Add'}</button>
      <a href="profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view">👁</a>
    `;
  }

  return `
    <div class="fr-entry" data-uid="${esc(String(id))}" data-code="${esc(friend_code)}">
      ${avatarHTML(pseudo, avatar_data, avatar_border_color, last_seen_at)}
      <div class="fr-entry-info">
        <div class="fr-entry-pseudo">${esc(pseudo)} ${badge}</div>
        <div class="fr-entry-code">🔑 ${esc(friend_code)}</div>
      </div>
      <div class="fr-entry-actions">${actions}</div>
    </div>
  `;
}

/** Affiche la liste browse + met à jour le compteur et la pagination. */
function renderBrowse() {
  const list    = document.getElementById('browseList');
  const countEl = document.getElementById('browseCount');
  if (!list) return;

  if (!state.browseUsers.length) {
    const msg = state.browseQuery.length >= 2
      ? t('friends.no_results')  || 'No players found.'
      : t('friends.no_users')    || 'No players yet.';
    list.innerHTML = `<p class="fr-empty">${esc(msg)}</p>`;
  } else {
    list.innerHTML = state.browseUsers.map(renderBrowseEntry).join('');
  }

  if (countEl) countEl.textContent = state.browseTotal;
  renderBrowsePagination();
}

/** Met à jour les boutons de pagination. */
function renderBrowsePagination() {
  const pag      = document.getElementById('browsePagination');
  const prevBtn  = document.getElementById('browsePrevBtn');
  const nextBtn  = document.getElementById('browseNextBtn');
  const pageInfo = document.getElementById('browsePageInfo');
  if (!pag) return;

  const totalPages = Math.ceil(state.browseTotal / PAGE_SIZE);
  const currentPage = state.browsePage + 1;

  if (totalPages <= 1) {
    pag.classList.add('hidden');
    return;
  }

  pag.classList.remove('hidden');
  if (prevBtn) prevBtn.disabled = state.browsePage === 0;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;
}

// ─────────────────────────────────────────────────────────
// 4. RENDU — MY FRIENDS
// ─────────────────────────────────────────────────────────

function renderFriendEntry(entry) {
  const { friendship_id, pseudo, friend_code, avatar_data, avatar_border_color, last_seen_at } = entry;
  const lastSeenText = formatLastSeen(last_seen_at);
  return `
    <div class="fr-entry" data-fid="${esc(String(friendship_id))}">
      ${avatarHTML(pseudo, avatar_data, avatar_border_color, last_seen_at)}
      <div class="fr-entry-info">
        <div class="fr-entry-pseudo" id="pseudo-${friendship_id}">${esc(pseudo)}<span id="flame-${friendship_id}"></span></div>
        <div class="fr-entry-code">
          🔑 ${esc(friend_code)}
          ${lastSeenText ? `<span class="fr-last-seen">· ${esc(lastSeenText)}</span>` : ''}
        </div>
      </div>
      <div class="fr-entry-actions">
        <a href="profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view" title="${t('friends.view_profile') || 'View'}">👁</a>
        <button class="fr-btn fr-btn--danger js-remove"
                data-fid="${esc(String(friendship_id))}"
                title="${t('friends.remove_friend') || 'Remove'}">✕</button>
      </div>
    </div>
  `;
}

function renderFriendsList() {
  const list    = document.getElementById('friendsList');
  const countEl = document.getElementById('friendsCount');
  if (!list) return;

  if (!state.friends.length) {
    list.innerHTML = `<p class="fr-empty">${t('friends.no_friends') || 'No friends yet.'}</p>`;
  } else {
    list.innerHTML = state.friends.map(renderFriendEntry).join('');
  }
  if (countEl) countEl.textContent = state.friends.length;
}

// ─────────────────────────────────────────────────────────
// 5. RENDU — PENDING REQUESTS
// ─────────────────────────────────────────────────────────

function renderPendingEntry(entry) {
  const { friendship_id, pseudo, friend_code, avatar_data, avatar_border_color, last_seen_at } = entry;
  return `
    <div class="fr-entry" data-fid="${esc(String(friendship_id))}">
      ${avatarHTML(pseudo, avatar_data, avatar_border_color, last_seen_at)}
      <div class="fr-entry-info">
        <div class="fr-entry-pseudo">${esc(pseudo)}</div>
        <div class="fr-entry-code">🔑 ${esc(friend_code)}</div>
      </div>
      <div class="fr-entry-actions">
        <button class="fr-btn fr-btn--accept js-accept"
                data-fid="${esc(String(friendship_id))}"
                title="${t('friends.accept') || 'Accept'}">✓ ${t('friends.accept') || 'Accept'}</button>
        <button class="fr-btn fr-btn--danger js-decline"
                data-fid="${esc(String(friendship_id))}"
                title="${t('friends.decline') || 'Decline'}">✕</button>
      </div>
    </div>
  `;
}

function renderPendingSection() {
  const section  = document.getElementById('pendingSection');
  const list     = document.getElementById('pendingList');
  const countEl  = document.getElementById('pendingCount');
  if (!list || !section) return;

  // Filtrer seulement les reçues (direction === 'received')
  const received = state.pending.filter(p => p.direction === 'received');

  if (!received.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = received.map(renderPendingEntry).join('');
  if (countEl) countEl.textContent = received.length;
}

// ─────────────────────────────────────────────────────────
// 6. CHARGEMENT DES DONNÉES
// ─────────────────────────────────────────────────────────

/** Charge friends + pending depuis /api/friends. */
async function loadFriends() {
  const api = window._personadleApi;
  if (!api) return;

  try {
    const data = await api.friends.list();
    // L'API retourne { friends, pending_requests }
    state.friends = data.friends         ?? [];
    state.pending = data.pending_requests ?? [];

    // Codes des demandes envoyées (direction=sent) → pour désactiver les boutons browse
    state.sentCodes = new Set(
      state.pending.filter(p => p.direction === 'sent').map(p => p.friend_code)
    );

    // Marquer les demandes reçues comme vues (l'utilisateur les voit maintenant)
    if (state.pending.some(p => p.direction === 'received')) {
      api.notifications.markSeen().catch(() => {});
    }
  } catch {
    state.friends = [];
    state.pending = [];
  }

  renderFriendsList();
  renderPendingSection();

  // Ajouter la flamme 🔥 si on a interagi ensemble aujourd'hui
  state.friends.forEach(f => {
    const el = document.getElementById(`flame-${f.friendship_id}`);
    if (el) addFlameIfPlayedToday(f, el.parentElement);
  });
}

/**
 * Charge les joueurs pour la section Browse.
 * @param {string}  q       - Texte de recherche ('' = tous)
 * @param {number}  page    - Page (0-indexed)
 */
async function loadBrowse(q = '', page = 0) {
  const api  = window._personadleApi;
  const list = document.getElementById('browseList');
  if (!api || !list) return;

  list.innerHTML = `<p class="fr-empty fr-loading">${t('ui.loading') || 'Loading…'}</p>`;

  try {
    const data = await api.publicProfile.list({
      q,
      limit:  PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });

    state.browseUsers = data.users  ?? [];
    state.browseTotal = data.total  ?? 0;
    state.browsePage  = page;
    state.browseQuery = q;
  } catch {
    state.browseUsers = [];
    state.browseTotal = 0;
    list.innerHTML = `<p class="fr-empty">${t('friends.load_error') || 'Could not load players.'}</p>`;
    return;
  }

  renderBrowse();
}

// ─────────────────────────────────────────────────────────
// 7. ACTIONS
// ─────────────────────────────────────────────────────────

/** Envoie une demande d'ami par friend_code. */
async function sendFriendRequest(friendCode, targetId) {
  const api = window._personadleApi;
  if (!api) return;

  try {
    await api.friends.request(friendCode);
    state.sentCodes.add(friendCode);

    // Mise à jour inline dans Browse
    const entry = document.querySelector(`.fr-entry[data-code="${CSS.escape(friendCode)}"]`);
    if (entry) {
      const actions = entry.querySelector('.fr-entry-actions');
      const infoDiv = entry.querySelector('.fr-entry-pseudo');
      if (actions) actions.innerHTML = `<a href="profile.html?view=${esc(friendCode)}" class="fr-btn fr-btn--view">👁</a>`;
      if (infoDiv && !infoDiv.querySelector('.fr-tag')) {
        infoDiv.insertAdjacentHTML('beforeend', `<span class="fr-tag fr-tag--pending">⏳ ${t('friends.request_sent') || 'Sent'}</span>`);
      }
    }
  } catch (err) {
    alert(err.message || t('friends.error_send') || 'Could not send friend request.');
  }
}

/** Accepte ou refuse une demande. */
async function respondToRequest(friendshipId, action) {
  const api = window._personadleApi;
  if (!api) return;

  try {
    await api.friends.respond(friendshipId, action);
    await loadFriends();
    // Rafraîchir le browse pour mettre à jour les statuts
    await loadBrowse(state.browseQuery, state.browsePage);
  } catch (err) {
    alert(err.message || t('friends.error_respond') || 'Could not process this request.');
  }
}

/** Supprime un ami. */
async function removeFriend(friendshipId) {
  const api = window._personadleApi;
  if (!api) return;

  const confirmed = confirm(t('friends.confirm_remove') || 'Remove this friend?');
  if (!confirmed) return;

  try {
    await api.friends.remove(friendshipId);
    state.friends = state.friends.filter(f => f.friendship_id !== friendshipId);
    renderFriendsList();
    // Rafraîchir browse pour changer le bouton
    await loadBrowse(state.browseQuery, state.browsePage);
  } catch (err) {
    alert(err.message || t('friends.error_remove') || 'Could not remove friend.');
  }
}

// ─────────────────────────────────────────────────────────
// 8. RECHERCHE + ADD BY CODE (barre unifiée)
// ─────────────────────────────────────────────────────────

/** Pattern d'un friend code valide : exactement 8 chars alphanumériques. */
const CODE_RE = /^[A-Z0-9]{8}$/;

/**
 * Gère la saisie dans la barre de recherche unifiée.
 * Si la valeur est un friend code (8 chars alnum), on affiche le bouton "+ Add".
 * Sinon on lance la recherche de joueurs.
 */
function handleSearchInput(value) {
  clearTimeout(searchTimer);

  const clearBtn = document.getElementById('browseSearchClear');
  const addBtn   = document.getElementById('browseSearchAddBtn');
  const msg      = document.getElementById('addByCodeMsg');

  const trimmed = value.trim();
  const isCode  = CODE_RE.test(trimmed.toUpperCase());

  if (clearBtn) clearBtn.classList.toggle('hidden', !trimmed.length);
  if (addBtn)   addBtn.classList.toggle('hidden', !isCode);
  // Effacer le message de résultat précédent dès que l'utilisateur retape
  if (msg && trimmed.length > 0) { msg.className = 'fr-add-code-msg hidden'; }

  searchTimer = setTimeout(() => {
    loadBrowse(trimmed, 0);
  }, 350);
}

/**
 * Envoie une demande d'ami depuis la barre unifiée (quand c'est un code détecté).
 */
async function handleAddByCode() {
  const input  = document.getElementById('browseSearch');
  const msg    = document.getElementById('addByCodeMsg');
  const addBtn = document.getElementById('browseSearchAddBtn');
  if (!input || !msg || !addBtn) return;

  const code = input.value.trim().toUpperCase();
  if (!CODE_RE.test(code)) return;

  addBtn.disabled = true;
  msg.className = 'fr-add-code-msg hidden';

  try {
    await window._personadleApi.friends.request(code);
    state.sentCodes.add(code);
    msg.textContent = t('friends.add_success') || 'Friend request sent!';
    msg.className = 'fr-add-code-msg fr-add-code-msg--success';
    input.value = '';
    addBtn.classList.add('hidden');
    document.getElementById('browseSearchClear')?.classList.add('hidden');
    await loadBrowse(state.browseQuery, state.browsePage);
  } catch (err) {
    msg.textContent = err.message || t('friends.error_send') || 'Could not send friend request.';
    msg.className = 'fr-add-code-msg fr-add-code-msg--error';
  } finally {
    addBtn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────
// 8b. MESSAGERIE
// ─────────────────────────────────────────────────────────

async function loadMessages() {
  const api     = window._personadleApi;
  const list    = document.getElementById('messagesList');
  const section = document.getElementById('messagesSection');
  if (!api || !list || !section) return;

  try {
    const data = await api.messages.list({ limit: 30 });
    const msgs = data.messages ?? [];

    const unreadCnt = msgs.filter(
      m => m.status === 'unread' && m.receiver_id === window._currentUser?.id
    ).length;
    const unreadEl = document.getElementById('unreadCount');
    if (unreadEl) {
      unreadEl.textContent = unreadCnt;
      unreadEl.classList.toggle('hidden', unreadCnt === 0);
    }

    if (!msgs.length) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');
    list.innerHTML = msgs.map(renderMessage).join('');
  } catch {
    section.classList.add('hidden');
  }
}

function renderMessage(msg) {
  const isReceived  = msg.receiver_id === window._currentUser?.id;
  const fromPseudo  = msg.sender.pseudo;
  const time        = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isChallenge = msg.type === 'challenge';
  const isUnread    = msg.status === 'unread' && isReceived;

  let content = '';
  let actions  = '';

  if (isChallenge) {
    content = `
      <span class="fr-msg-challenge-info">
        🎮 ${esc(msg.challenge_mode?.toUpperCase() ?? '')} · ${t('friends.challenge_beat') || 'Beat'} ${msg.challenge_score} pts · ${msg.challenge_date ?? ''}
      </span>`;
    if (isReceived && msg.status === 'unread') {
      actions = `
        <button class="fr-btn fr-btn--accept js-accept-challenge"
                data-mid="${msg.id}"
                data-mode="${esc(msg.challenge_mode ?? '')}"
                data-date="${esc(msg.challenge_date ?? '')}"
                data-score="${msg.challenge_score}"
                data-senderid="${msg.sender_id}">
          ${t('friends.challenge_accept') || '⚔ Accept'}
        </button>
        <button class="fr-btn fr-btn--danger js-decline-msg" data-mid="${msg.id}">
          ${t('friends.challenge_decline') || '✕'}
        </button>`;
    }
  } else {
    content = `<span class="fr-msg-content">${esc(msg.content ?? '')}</span>`;
    if (isUnread) {
      actions = `<button class="fr-btn fr-btn--view js-mark-read" data-mid="${msg.id}" style="font-size:0.68rem;">
        ${t('friends.mark_read') || '✓ Mark read'}
      </button>`;
    }
  }

  return `
    <div class="fr-msg ${isChallenge ? 'fr-msg--challenge' : ''} ${isUnread ? 'fr-msg--unread' : ''}"
         data-mid="${msg.id}">
      <div class="fr-msg-body">
        <div class="fr-msg-meta">
          ${isReceived
            ? `<b>${esc(fromPseudo)}</b> · ${time}`
            : `${t('friends.sent_to') || 'To'} <b>${esc(msg.receiver.pseudo)}</b> · ${time}`}
          <span style="margin-left:6px;font-size:0.65rem;background:var(--fr-surface-alt);padding:1px 5px;border-radius:4px;">
            ${esc(msg.status)}
          </span>
        </div>
        ${content}
        ${actions ? `<div class="fr-msg-actions">${actions}</div>` : ''}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────
// 9. DÉLÉGATION D'ÉVÉNEMENTS
// ─────────────────────────────────────────────────────────

function attachListeners() {
  // ── Barre de recherche unifiée (search + add by code) ──
  const searchInput = document.getElementById('browseSearch');
  const clearBtn    = document.getElementById('browseSearchClear');
  const addBtn      = document.getElementById('browseSearchAddBtn');

  searchInput?.addEventListener('input', e => handleSearchInput(e.target.value));

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.classList.add('hidden');
    addBtn?.classList.add('hidden');
    const msg = document.getElementById('addByCodeMsg');
    if (msg) msg.className = 'fr-add-code-msg hidden';
    loadBrowse('', 0);
  });

  addBtn?.addEventListener('click', handleAddByCode);

  // Touche Entrée quand le bouton Add est visible → déclencher l'ajout
  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && addBtn && !addBtn.classList.contains('hidden')) {
      handleAddByCode();
    }
  });

  // ── Pagination browse ─────────────────────────────────
  document.getElementById('browsePrevBtn')?.addEventListener('click', () => {
    if (state.browsePage > 0) loadBrowse(state.browseQuery, state.browsePage - 1);
  });

  document.getElementById('browseNextBtn')?.addEventListener('click', () => {
    const totalPages = Math.ceil(state.browseTotal / PAGE_SIZE);
    if (state.browsePage + 1 < totalPages) loadBrowse(state.browseQuery, state.browsePage + 1);
  });

  // ── Délégation globale (boutons dynamiques) ───────────
  document.addEventListener('click', async e => {
    // + Add
    const addEntryBtn = e.target.closest('.js-add');
    if (addEntryBtn) {
      addEntryBtn.disabled = true;
      await sendFriendRequest(addEntryBtn.dataset.code, addEntryBtn.dataset.id);
      return;
    }

    // ✓ Accept
    const acceptBtn = e.target.closest('.js-accept');
    if (acceptBtn) {
      acceptBtn.disabled = true;
      await respondToRequest(parseInt(acceptBtn.dataset.fid, 10), 'accept');
      return;
    }

    // ✕ Decline
    const declineBtn = e.target.closest('.js-decline');
    if (declineBtn) {
      declineBtn.disabled = true;
      await respondToRequest(parseInt(declineBtn.dataset.fid, 10), 'decline');
      return;
    }

    // ✕ Remove friend
    const removeBtn = e.target.closest('.js-remove');
    if (removeBtn) {
      await removeFriend(parseInt(removeBtn.dataset.fid, 10));
      return;
    }

    // ── Messages : Accept challenge ───────────────────────
    const acceptChallenge = e.target.closest('.js-accept-challenge');
    if (acceptChallenge) {
      const mid      = parseInt(acceptChallenge.dataset.mid);
      const mode     = acceptChallenge.dataset.mode;
      const date     = acceptChallenge.dataset.date;
      const score    = parseInt(acceptChallenge.dataset.score);
      const senderId = parseInt(acceptChallenge.dataset.senderid);
      acceptChallenge.disabled = true;
      await window._personadleApi?.messages.updateStatus(mid, 'accepted').catch(() => {});
      localStorage.setItem('activeChallenge', JSON.stringify({ msgId: mid, mode, date, score, senderId }));
      // XP Social Link : challenge accepté
      if (senderId) gainSocialLinkXp(senderId, 'challenge').catch(() => {});
      await loadMessages();
      return;
    }

    // ── Messages : Mark read / Decline ────────────────────
    const markReadBtn = e.target.closest('.js-mark-read, .js-decline-msg');
    if (markReadBtn) {
      const mid = parseInt(markReadBtn.dataset.mid);
      await window._personadleApi?.messages.updateStatus(mid, 'read').catch(() => {});
      await loadMessages();
      return;
    }
  });
}

// ─────────────────────────────────────────────────────────
// 10. POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Attendre i18n
  if (window.__i18nReady) await window.__i18nReady;

  // Attendre auth (max 2 s)
  let waited = 0;
  while (!window._currentUser && !window._authResolved && waited < 2000) {
    await new Promise(r => setTimeout(r, 100));
    waited += 100;
  }

  const connected = document.getElementById('friendsConnected');
  const guest     = document.getElementById('friendsGuest');

  if (window._currentUser) {
    connected?.classList.remove('hidden');
    guest?.classList.add('hidden');

    attachListeners();

    // Charger les trois sections en parallèle
    await Promise.all([
      loadFriends(),
      loadBrowse('', 0),
      loadMessages(),
    ]);
  } else {
    connected?.classList.add('hidden');
    guest?.classList.remove('hidden');
  }
});
