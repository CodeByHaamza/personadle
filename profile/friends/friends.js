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

import {
  addFlameIfPlayedToday,
  gainSocialLinkXp,
  applyRank10Effect,
} from "../../js/social-link.js";
import { FILTER_STORAGE_KEYS } from "../../js/gameCore.js";

// ─────────────────────────────────────────────────────────
// 1. UTILITAIRES
// ─────────────────────────────────────────────────────────

/** Échappe les caractères spéciaux HTML. */
export function esc(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]
  );
}

/** URL de l'avatar — normalise les chemins relatifs, fallback si absent.
 *  Ce fichier est servi depuis profile/friends/ (2 niveaux) — img/ est à ../../img/. */
export function avatarSrc(avatarData) {
  if (!avatarData) return "../../img/default_avatar.png";
  if (avatarData.startsWith("data:")) return avatarData;
  // Paths stored in DB are relative to profile/ (../img/...) → adjust for friends/ depth
  if (avatarData.startsWith("../img/")) return "../" + avatarData;  // ../../img/
  if (avatarData.startsWith("./img/"))  return "../../img/" + avatarData.slice(6);
  return avatarData;
}

/** Renders avatar wrapped in .fr-avatar-wrap with an online/offline/unknown dot. */
function avatarHTML(pseudo, avatarData, borderColor = "#ffffff", lastSeen = null) {
  const online = isOnline(lastSeen);
  // Always show dot: green = online (<30min), orange = offline, grey = never seen (null)
  const dotClass =
    lastSeen === null ? "fr-dot--unknown" : online ? "fr-dot--online" : "fr-dot--offline";
  const dot = `<span class="fr-dot ${dotClass}"></span>`;
  return `<div class="fr-avatar-wrap">
    <img class="fr-avatar"
         src="${esc(avatarSrc(avatarData))}"
         alt="${esc(pseudo)}"
         loading="lazy"
         style="border-color:${esc(borderColor)}"
         onerror="this.src='../../img/default_avatar.png'">
    ${dot}
  </div>`;
}

/** Traduit une clé i18n avec un vrai fallback string (détecte quand i18n retourne la clé brute). */
function tf(key, fallback, vars) {
  if (!window.i18n?.t) return fallback;
  const r = window.i18n.t(key, vars);
  return r && r !== key ? r : fallback;
}

/** Returns true if lastSeen ISO string is within the last 30 minutes. */
export function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

/** Returns a human-readable "X ago" string, or null if no date. */
export function formatLastSeen(isoDate) {
  if (!isoDate) return null;
  const diff = Date.now() - new Date(isoDate).getTime();
  const sec = Math.floor(diff / 1000);
  // tf() (pas t() + `||`) : t(key) renvoie la clé brute — truthy — quand i18n
  // n'est pas encore prêt, donc `||` ne retombe jamais sur le fallback anglais.
  if (sec < 60) return tf("friends.last_seen_just_now", "just now");
  const min = Math.floor(sec / 60);
  if (min < 60) return tf("friends.last_seen_minutes", "{{n}}m ago").replace("{{n}}", min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return tf("friends.last_seen_hours", "{{n}}h ago").replace("{{n}}", hr);
  const days = Math.floor(hr / 24);
  if (days < 7) return tf("friends.last_seen_days", "{{n}}d ago").replace("{{n}}", days);
  return tf("friends.last_seen_long_ago", "a while ago");
}

// ─────────────────────────────────────────────────────────
// 2. ÉTAT INTERNE
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

/** Time window (ms) within which a user is considered "online". */
const ONLINE_THRESHOLD_MS = 30 * 60 * 1000;

// localStorage keys to clear when accepting a challenge (forces fresh game)
const MODE_STATE_KEYS = {
  classic: ["target", "attempts", "guessHistory"],
  emoji: ["targetEmoji", "attemptsEmoji", "emojiGameOver", "emojiForceReveal", "emojiWin"],
  silhouette: [
    "silhouetteTarget",
    "silhouetteAttempts",
    "silhouetteGameOver",
    "silhouetteForceReveal",
  ],
  alloutattack: ["aoaTarget", "aoaAttempts", "aoaGameOver", "aoaForceReveal"],
  personae: ["personaeTarget", "personaeAttempts", "personaeGameOver", "personaeForceReveal"],
  music: ["musicTarget", "musicAttempts", "musicGameOver", "musicTriedTitles", "musicForceReveal"],
};

// localStorage keys where each mode stores its active opus filters
const MODE_FILTER_KEY = FILTER_STORAGE_KEYS;

let state = {
  // Données de l'API friends.list()
  friends: [], // { friendship_id, friend_id, pseudo, friend_code, avatar_data, avatar_border_color }
  pending: [], // idem, direction:'received'
  sentCodes: new Set(), // friend_codes auxquels on a envoyé une demande (pour désactiver les boutons)

  // Browse Players
  browseUsers: [], // résultats bruts de api.user.list()
  browseTotal: 0,
  browsePage: 0,
  browseQuery: "",
};

let searchTimer = null;
let _pollInterval = null;

// ─────────────────────────────────────────────────────────
// 3. RENDU — BROWSE PLAYERS
// ─────────────────────────────────────────────────────────

/**
 * Génère le HTML d'une ligne joueur dans le Browse.
 * @param {object} player  - objet retourné par api.user.list()
 */
function renderBrowseEntry(player) {
  const {
    id,
    pseudo,
    friend_code,
    avatar_data,
    avatar_border_color,
    last_seen_at,
    friendship_status,
    friendship_direction,
    friendship_id,
  } = player;

  const myId = window._currentUser?.id;
  const isSelf = myId && myId === id;

  let badge = "";
  let actions = "";

  if (isSelf) {
    badge = `<span class="fr-tag fr-tag--self">${tf("friends.thats_you", "You")}</span>`;
    actions = "";
  } else if (friendship_status === "accepted") {
    badge = `<span class="fr-tag fr-tag--friend">💙 ${tf("friends.friend", "Friend")}</span>`;
    actions = `
      <a href="../profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view" title="${tf("friends.view_profile", "View profile")}">👁</a>
      <button class="fr-btn fr-btn--danger js-remove"
              data-fid="${esc(String(friendship_id))}"
              title="${tf("friends.remove_friend", "Remove")}">✕</button>
    `;
  } else if (friendship_status === "pending" && friendship_direction === "sent") {
    badge = `<span class="fr-tag fr-tag--pending">⏳ ${tf("friends.request_sent", "Sent")}</span>`;
    actions = `<a href="../profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view">👁</a>`;
  } else if (friendship_status === "pending" && friendship_direction === "received") {
    badge = `<span class="fr-tag fr-tag--pending">⏳ ${tf("friends.pending", "Pending")}</span>`;
    actions = `
      <button class="fr-btn fr-btn--accept js-accept"
              data-fid="${esc(String(friendship_id))}"
              title="${tf("friends.accept", "Accept")}">✓</button>
      <button class="fr-btn fr-btn--danger js-decline"
              data-fid="${esc(String(friendship_id))}"
              title="${tf("friends.decline", "Decline")}">✕</button>
    `;
  } else if (state.sentCodes.has(friend_code)) {
    badge = `<span class="fr-tag fr-tag--pending">⏳ ${tf("friends.request_sent", "Sent")}</span>`;
    actions = `<a href="../profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view">👁</a>`;
  } else {
    // Pas de relation — bouton Add Friend
    actions = `
      <button class="fr-btn fr-btn--add js-add"
              data-code="${esc(friend_code)}"
              data-id="${esc(String(id))}"
              title="${tf("friends.add_friend", "Add friend")}">+ ${tf("friends.add_friend", "Add")}</button>
      <a href="../profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view">👁</a>
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
  const list = document.getElementById("browseList");
  const countEl = document.getElementById("browseCount");
  if (!list) return;

  if (!state.browseUsers.length) {
    const msg =
      state.browseQuery.length >= 2
        ? tf("friends.no_results", "No players found.")
        : tf("friends.no_users", "No players yet.");
    list.innerHTML = `<p class="fr-empty">${esc(msg)}</p>`;
  } else {
    list.innerHTML = state.browseUsers.map(renderBrowseEntry).join("");
  }

  if (countEl) countEl.textContent = state.browseTotal;
  renderBrowsePagination();
}

/** Met à jour les boutons de pagination. */
function renderBrowsePagination() {
  const pag = document.getElementById("browsePagination");
  const prevBtn = document.getElementById("browsePrevBtn");
  const nextBtn = document.getElementById("browseNextBtn");
  const pageInfo = document.getElementById("browsePageInfo");
  if (!pag) return;

  const totalPages = Math.ceil(state.browseTotal / PAGE_SIZE);
  const currentPage = state.browsePage + 1;

  if (totalPages <= 1) {
    pag.classList.add("hidden");
    return;
  }

  pag.classList.remove("hidden");
  if (prevBtn) prevBtn.disabled = state.browsePage === 0;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;
}

// ─────────────────────────────────────────────────────────
// 4. RENDU — MY FRIENDS
// ─────────────────────────────────────────────────────────

function renderFriendEntry(entry) {
  const {
    friendship_id,
    pseudo,
    friend_code,
    avatar_data,
    avatar_border_color,
    last_seen_at,
    social_link_rank = 1,
  } = entry;
  const lastSeenText = formatLastSeen(last_seen_at);
  return `
    <div class="fr-entry" data-fid="${esc(String(friendship_id))}" data-rank="${social_link_rank}">
      ${avatarHTML(pseudo, avatar_data, avatar_border_color, last_seen_at)}
      <div class="fr-entry-info">
        <div class="fr-entry-pseudo" id="pseudo-${friendship_id}">${esc(pseudo)}<span id="flame-${friendship_id}"></span></div>
        <div class="fr-entry-code">
          🔑 ${esc(friend_code)}
          ${lastSeenText ? `<span class="fr-last-seen">· ${esc(lastSeenText)}</span>` : ""}
        </div>
      </div>
      <div class="fr-entry-actions">
        <a href="../profile.html?view=${esc(friend_code)}" class="fr-btn fr-btn--view" title="${tf("friends.view_profile", "View")}">👁</a>
        <button class="fr-btn fr-btn--danger js-remove"
                data-fid="${esc(String(friendship_id))}"
                title="${tf("friends.remove_friend", "Remove")}">✕</button>
      </div>
    </div>
  `;
}

function renderFriendsList() {
  const list = document.getElementById("friendsList");
  const countEl = document.getElementById("friendsCount");
  if (!list) return;

  if (!state.friends.length) {
    list.innerHTML = `<p class="fr-empty">${tf("friends.no_friends", "No friends yet.")}</p>`;
  } else {
    list.innerHTML = state.friends.map(renderFriendEntry).join("");
  }
  if (countEl) countEl.textContent = state.friends.length;

  // Effet True Confidant pour les amis rang 10
  list.querySelectorAll('.fr-entry[data-rank="10"]').forEach((entry, idx) => {
    applyRank10Effect(
      entry.querySelector(".fr-avatar"),
      entry.querySelector(".fr-entry-pseudo"),
      idx * 150
    );
  });
}

// ─────────────────────────────────────────────────────────
// 5. RENDU — PENDING REQUESTS
// ─────────────────────────────────────────────────────────

function renderPendingEntry(entry) {
  const { friendship_id, pseudo, friend_code, avatar_data, avatar_border_color, last_seen_at } =
    entry;
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
                title="${tf("friends.accept", "Accept")}">✓ ${tf("friends.accept", "Accept")}</button>
        <button class="fr-btn fr-btn--danger js-decline"
                data-fid="${esc(String(friendship_id))}"
                title="${tf("friends.decline", "Decline")}">✕</button>
      </div>
    </div>
  `;
}

function renderPendingSection() {
  const section = document.getElementById("pendingSection");
  const list = document.getElementById("pendingList");
  const countEl = document.getElementById("pendingCount");
  if (!list || !section) return;

  // Filtrer seulement les reçues (direction === 'received')
  const received = state.pending.filter((p) => p.direction === "received");

  if (!received.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.innerHTML = received.map(renderPendingEntry).join("");
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
    state.friends = data.friends ?? [];
    state.pending = data.pending_requests ?? [];

    // Codes des demandes envoyées (direction=sent) → pour désactiver les boutons browse
    state.sentCodes = new Set(
      state.pending.filter((p) => p.direction === "sent").map((p) => p.friend_code)
    );

    // Marquer les demandes reçues comme vues (l'utilisateur les voit maintenant)
    if (state.pending.some((p) => p.direction === "received")) {
      api.notifications.markSeen().catch(() => {});
    }
  } catch (err) {
    console.error("[Friends] loadFriends failed:", err?.status, err?.message, err);
    state.friends = [];
    state.pending = [];
  }

  renderFriendsList();
  renderPendingSection();

  // Ajouter la flamme 🔥 si on a interagi ensemble aujourd'hui
  state.friends.forEach((f) => {
    const el = document.getElementById(`flame-${f.friendship_id}`);
    if (el) addFlameIfPlayedToday(f, el.parentElement);
  });
}

/**
 * Charge les joueurs pour la section Browse.
 * @param {string}  q       - Texte de recherche ('' = tous)
 * @param {number}  page    - Page (0-indexed)
 */
async function loadBrowse(q = "", page = 0) {
  const api = window._personadleApi;
  const list = document.getElementById("browseList");
  if (!api || !list) return;

  list.innerHTML = `<p class="fr-empty fr-loading">${tf("ui.loading", "Loading…")}</p>`;

  try {
    const data = await api.publicProfile.list({
      q,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });

    state.browseUsers = data.users ?? [];
    state.browseTotal = data.total ?? 0;
    state.browsePage = page;
    state.browseQuery = q;
  } catch {
    state.browseUsers = [];
    state.browseTotal = 0;
    list.innerHTML = `<p class="fr-empty">${tf("friends.load_error", "Could not load players.")}</p>`;
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
      const actions = entry.querySelector(".fr-entry-actions");
      const infoDiv = entry.querySelector(".fr-entry-pseudo");
      if (actions)
        actions.innerHTML = `<a href="../profile.html?view=${esc(friendCode)}" class="fr-btn fr-btn--view">👁</a>`;
      if (infoDiv && !infoDiv.querySelector(".fr-tag")) {
        infoDiv.insertAdjacentHTML(
          "beforeend",
          `<span class="fr-tag fr-tag--pending">⏳ ${tf("friends.request_sent", "Sent")}</span>`
        );
      }
    }
  } catch (err) {
    console.error("[Friends] sendFriendRequest failed:", err?.status, err?.message, err?.data);
    alert(err.message || tf("friends.error_send", "Could not send friend request."));
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
    alert(err.message || tf("friends.error_respond", "Could not process this request."));
  }
}

/** Supprime un ami. */
async function removeFriend(friendshipId) {
  const api = window._personadleApi;
  if (!api) return;

  const confirmed = confirm(tf("friends.confirm_remove", "Remove this friend?"));
  if (!confirmed) return;

  try {
    await api.friends.remove(friendshipId);
    state.friends = state.friends.filter((f) => f.friendship_id !== friendshipId);
    renderFriendsList();
    // Rafraîchir browse pour changer le bouton
    await loadBrowse(state.browseQuery, state.browsePage);
  } catch (err) {
    alert(err.message || tf("friends.error_remove", "Could not remove friend."));
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

  const clearBtn = document.getElementById("browseSearchClear");
  const addBtn = document.getElementById("browseSearchAddBtn");
  const msg = document.getElementById("addByCodeMsg");

  const trimmed = value.trim();
  const isCode = CODE_RE.test(trimmed.toUpperCase());

  if (clearBtn) clearBtn.classList.toggle("hidden", !trimmed.length);
  if (addBtn) addBtn.classList.toggle("hidden", !isCode);
  // Effacer le message de résultat précédent dès que l'utilisateur retape
  if (msg && trimmed.length > 0) {
    msg.className = "fr-add-code-msg hidden";
  }

  searchTimer = setTimeout(() => {
    loadBrowse(trimmed, 0);
  }, 350);
}

/**
 * Envoie une demande d'ami depuis la barre unifiée (quand c'est un code détecté).
 */
async function handleAddByCode() {
  const input = document.getElementById("browseSearch");
  const msg = document.getElementById("addByCodeMsg");
  const addBtn = document.getElementById("browseSearchAddBtn");
  if (!input || !msg || !addBtn) return;

  const code = input.value.trim().toUpperCase();
  if (!CODE_RE.test(code)) return;

  addBtn.disabled = true;
  msg.className = "fr-add-code-msg hidden";

  try {
    await window._personadleApi.friends.request(code);
    state.sentCodes.add(code);
    msg.textContent = tf("friends.add_success", "Friend request sent!");
    msg.className = "fr-add-code-msg fr-add-code-msg--success";
    input.value = "";
    addBtn.classList.add("hidden");
    document.getElementById("browseSearchClear")?.classList.add("hidden");
    await loadBrowse(state.browseQuery, state.browsePage);
  } catch (err) {
    msg.textContent = err.message || tf("friends.error_send", "Could not send friend request.");
    msg.className = "fr-add-code-msg fr-add-code-msg--error";
  } finally {
    addBtn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────
// 8b. MESSAGERIE
// ─────────────────────────────────────────────────────────

async function loadMessages() {
  const api = window._personadleApi;
  const list = document.getElementById("messagesList");
  const section = document.getElementById("messagesSection");
  if (!api || !list || !section) return;

  try {
    const data = await api.messages.list({ limit: 30 });
    const msgs = data.messages ?? [];

    const unreadCnt = msgs.filter(
      (m) => m.status === "unread" && m.receiver_id === window._currentUser?.id
    ).length;
    const unreadEl = document.getElementById("unreadCount");
    if (unreadEl) {
      unreadEl.textContent = unreadCnt;
      unreadEl.classList.toggle("hidden", unreadCnt === 0);
    }

    if (!msgs.length) {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");
    list.innerHTML = msgs.map(renderMessage).join("");
  } catch {
    section.classList.add("hidden");
  }
}

// ─────────────────────────────────────────────────────────
// 8c. POLLING TEMPS RÉEL
// ─────────────────────────────────────────────────────────

function startPolling() {
  if (_pollInterval) return;
  _pollInterval = setInterval(async () => {
    if (window._currentUser) await loadFriends();
  }, 30_000);
}

function stopPolling() {
  clearInterval(_pollInterval);
  _pollInterval = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPolling();
  else if (window._currentUser) startPolling();
});

const MODE_ICON = {
  classic: "🧩",
  emoji: "🎭",
  silhouette: "👤",
  alloutattack: "⚔️",
  personae: "🌟",
  music: "🎵",
};

function formatMsgDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

function renderStatusBadge(status) {
  const map = {
    unread: { label: tf("friends.status_unread", "New"), cls: "fr-status--new" },
    read: { label: tf("friends.status_read", "Read"), cls: "fr-status--read" },
    accepted: { label: tf("friends.status_accepted", "In progress"), cls: "fr-status--active" },
    beaten: { label: tf("friends.status_beaten", "Beaten"), cls: "fr-status--beaten" },
    expired: { label: tf("friends.status_expired", "Expired"), cls: "fr-status--expired" },
  };
  const s = map[status] ?? { label: esc(status), cls: "" };
  return `<span class="fr-status ${s.cls}">${esc(s.label)}</span>`;
}

function renderMessage(msg) {
  const isReceived = msg.receiver_id === window._currentUser?.id;
  const fromPseudo = isReceived ? msg.sender.pseudo : msg.receiver.pseudo;
  const fromAvatar = isReceived ? msg.sender.avatar : msg.receiver.avatar;
  const time = formatMsgDate(msg.created_at);
  const isChallenge = msg.type === "challenge";
  const isUnread = msg.status === "unread" && isReceived;

  const direction = isReceived
    ? `<b>${esc(fromPseudo)}</b>`
    : `${tf("friends.sent_to", "To")} <b>${esc(msg.receiver.pseudo)}</b>`;

  let content = "";
  let actions = "";

  if (msg.type === "friend_declined") {
    content = `<span class="fr-msg-declined">✗ <b>${esc(msg.sender.pseudo)}</b> ${tf("friends.declined_request", "declined your friend request.")}</span>`;
    if (isUnread) {
      actions = `<button class="fr-btn fr-btn--view js-mark-read" data-mid="${msg.id}">${tf("friends.mark_read", "✓ Mark read")}</button>`;
    }
  } else if (isChallenge) {
    const modeKey = (msg.challenge_mode ?? "").toLowerCase();
    const modeIcon = MODE_ICON[modeKey] ?? "🎮";
    const modeName = esc((msg.challenge_mode ?? "").toUpperCase());
    const dateLabel = msg.challenge_date ?? "";
    const score = msg.challenge_score ?? "?";

    if (msg.status === "beaten") {
      content = `
        <div class="fr-challenge-card fr-challenge-card--won">
          <span class="fr-challenge-mode-badge">${modeIcon} ${modeName}</span>
          <span class="fr-challenge-outcome">🏆 ${tf("friends.challenge_beaten", "Challenge beaten!")}</span>
          <span class="fr-challenge-date">${esc(dateLabel)}</span>
        </div>`;
    } else if (msg.status === "expired") {
      content = `
        <div class="fr-challenge-card fr-challenge-card--lost">
          <span class="fr-challenge-mode-badge">${modeIcon} ${modeName}</span>
          <span class="fr-challenge-outcome">✗ ${tf("friends.challenge_failed", "Challenge failed")}</span>
          <span class="fr-challenge-date">${esc(dateLabel)}</span>
        </div>`;
    } else {
      content = `
        <div class="fr-challenge-card">
          <div class="fr-challenge-header">
            <span class="fr-challenge-mode-badge">${modeIcon} ${modeName}</span>
            <span class="fr-challenge-date">${esc(dateLabel)}</span>
          </div>
          <span class="fr-challenge-score">${tf("friends.challenge_beat", "Beat")} <b>${score}</b> attempts</span>
        </div>`;
      if (isReceived && msg.status === "unread") {
        actions = `
          <button class="fr-btn fr-btn--accept js-accept-challenge"
                  data-mid="${msg.id}"
                  data-mode="${esc(msg.challenge_mode ?? "")}"
                  data-date="${esc(msg.challenge_date ?? "")}"
                  data-score="${msg.challenge_score}"
                  data-senderid="${msg.sender_id}"
                  data-filters="${esc(msg.challenge_filters ?? "[]")}"
                  data-target="${esc(msg.challenge_target ?? "")}">
            ${tf("friends.challenge_accept", "⚔ Accept")}
          </button>
          <button class="fr-btn fr-btn--danger js-decline-msg" data-mid="${msg.id}">
            ${tf("friends.challenge_decline", "✕")}
          </button>`;
      }
    }
  } else {
    content = `<span class="fr-msg-content">${esc(msg.content ?? "")}</span>`;
    if (isUnread) {
      actions = `<button class="fr-btn fr-btn--view js-mark-read" data-mid="${msg.id}">${tf("friends.mark_read", "✓ Mark read")}</button>`;
    }
  }

  return `
    <div class="fr-msg ${isChallenge ? "fr-msg--challenge" : ""} ${isUnread ? "fr-msg--unread" : ""}"
         data-mid="${msg.id}" data-status="${esc(msg.status)}">
      <img class="fr-msg-avatar"
           src="${esc(avatarSrc(fromAvatar))}"
           alt="${esc(fromPseudo)}"
           onerror="this.src='../../img/default_avatar.png'">
      <div class="fr-msg-body">
        <div class="fr-msg-meta">
          ${direction}
          <span class="fr-msg-time">· ${esc(time)}</span>
          ${renderStatusBadge(msg.status)}
          <button class="fr-msg-delete js-delete-msg"
                  data-mid="${msg.id}"
                  title="${tf("friends.delete_msg", "Delete")}">🗑</button>
        </div>
        ${content}
        ${actions ? `<div class="fr-msg-actions">${actions}</div>` : ""}
      </div>
    </div>
  `;
}

async function clearReadMessages() {
  const api = window._personadleApi;
  const resolved = ["read", "beaten", "expired"];
  const allMsgEls = [...document.querySelectorAll(".fr-msg[data-mid][data-status]")];
  const els = allMsgEls.filter((el) => resolved.includes(el.dataset.status));
  // Défis en cours (acceptés, pas encore joués jusqu'au bout) : jamais supprimés
  // automatiquement — ce n'est ni "lu" ni "résolu", et supprimer le message
  // effacerait aussi la trace du défi côté ami (DELETE partagé, pas un masquage
  // par utilisateur, cf. api/messages/index.php). On prévient juste pourquoi
  // la poubelle ne les a pas touchés.
  const keptActiveCount = allMsgEls.filter((el) => el.dataset.status === "accepted").length;

  if (els.length) {
    // Optimistic: remove from DOM immediately, then fire API deletes in background
    const ids = els.map((el) => +el.dataset.mid);
    els.forEach((el) => el.remove());

    if (api) {
      await Promise.all(ids.map((id) => api.messages.delete(id).catch(() => {})));
    }

    const list = document.getElementById("messagesList");
    if (list && !list.querySelector(".fr-msg")) {
      list.innerHTML = `<p class="fr-empty">${tf("friends.msg_empty", "No messages yet.")}</p>`;
      document.getElementById("messagesSection")?.classList.add("hidden");
    }
  }

  if (keptActiveCount > 0 && typeof window.showToast === "function") {
    window.showToast(
      tf(
        "friends.msg_clear_kept_active",
        `${keptActiveCount} challenge(s) in progress were kept — finish them first.`,
        { count: keptActiveCount }
      )
    );
  }
}

// ─────────────────────────────────────────────────────────
// 9. DÉLÉGATION D'ÉVÉNEMENTS
// ─────────────────────────────────────────────────────────

function attachListeners() {
  // ── Barre de recherche unifiée (search + add by code) ──
  const searchInput = document.getElementById("browseSearch");
  const clearBtn = document.getElementById("browseSearchClear");
  const addBtn = document.getElementById("browseSearchAddBtn");

  searchInput?.addEventListener("input", (e) => handleSearchInput(e.target.value));

  clearBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    clearBtn.classList.add("hidden");
    addBtn?.classList.add("hidden");
    const msg = document.getElementById("addByCodeMsg");
    if (msg) msg.className = "fr-add-code-msg hidden";
    loadBrowse("", 0);
  });

  addBtn?.addEventListener("click", handleAddByCode);

  // Touche Entrée quand le bouton Add est visible → déclencher l'ajout
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && addBtn && !addBtn.classList.contains("hidden")) {
      handleAddByCode();
    }
  });

  // ── Pagination browse ─────────────────────────────────
  document.getElementById("browsePrevBtn")?.addEventListener("click", () => {
    if (state.browsePage > 0) loadBrowse(state.browseQuery, state.browsePage - 1);
  });

  document.getElementById("browseNextBtn")?.addEventListener("click", () => {
    const totalPages = Math.ceil(state.browseTotal / PAGE_SIZE);
    if (state.browsePage + 1 < totalPages) loadBrowse(state.browseQuery, state.browsePage + 1);
  });

  // ── Délégation globale (boutons dynamiques) ───────────
  document.addEventListener("click", async (e) => {
    // + Add
    const addEntryBtn = e.target.closest(".js-add");
    if (addEntryBtn) {
      addEntryBtn.disabled = true;
      await sendFriendRequest(addEntryBtn.dataset.code, addEntryBtn.dataset.id);
      return;
    }

    // ✓ Accept
    const acceptBtn = e.target.closest(".js-accept");
    if (acceptBtn) {
      acceptBtn.disabled = true;
      await respondToRequest(parseInt(acceptBtn.dataset.fid, 10), "accept");
      return;
    }

    // ✕ Decline
    const declineBtn = e.target.closest(".js-decline");
    if (declineBtn) {
      declineBtn.disabled = true;
      await respondToRequest(parseInt(declineBtn.dataset.fid, 10), "decline");
      return;
    }

    // ✕ Remove friend
    const removeBtn = e.target.closest(".js-remove");
    if (removeBtn) {
      await removeFriend(parseInt(removeBtn.dataset.fid, 10));
      return;
    }

    // ── Messages : Accept challenge ───────────────────────
    const acceptChallenge = e.target.closest(".js-accept-challenge");
    if (acceptChallenge) {
      const mid = parseInt(acceptChallenge.dataset.mid);
      const mode = acceptChallenge.dataset.mode?.toLowerCase();
      const date = acceptChallenge.dataset.date;
      const score = parseInt(acceptChallenge.dataset.score);
      const senderId = parseInt(acceptChallenge.dataset.senderid);
      const challengeFilters = acceptChallenge.dataset.filters ?? "[]";
      const challengeTarget = acceptChallenge.dataset.target || null;
      acceptChallenge.disabled = true;
      await window._personadleApi?.messages.updateStatus(mid, "accepted").catch(() => {});

      // Clear this mode's game state so the player starts fresh
      (MODE_STATE_KEYS[mode] ?? []).forEach((k) => localStorage.removeItem(k));

      // Backup current filters, then apply sender's challenge filters
      const filterKey = MODE_FILTER_KEY[mode] ?? null;
      const originalFilters = filterKey ? (localStorage.getItem(filterKey) ?? "[]") : null;
      if (filterKey && challengeFilters && challengeFilters !== "[]") {
        localStorage.setItem(filterKey, challengeFilters);
      }

      localStorage.setItem(
        "activeChallenge",
        JSON.stringify({
          msgId: mid,
          mode,
          date,
          score,
          senderId,
          filterKey,
          originalFilters,
          // Cible dédiée (2026-07-17) : le mode la jouera à la place de la cible
          // du jour et n'enregistrera PAS la partie en session quotidienne.
          // Null (ancien défi) = comportement historique, cible du jour.
          // Sans ce champ, isChallengePlay()/getActiveChallengeTarget() (gameCore.js)
          // ne reconnaissent jamais le défi accepté ici — cf. challenge-notif.js
          // qui pose déjà ce même champ pour le chemin popup d'animation.
          target: challengeTarget,
        })
      );

      // XP Social Link : challenge accepté
      if (senderId) gainSocialLinkXp(senderId, "challenge").catch(() => {});
      // Chemins relatifs à profile/friends/ (2 niveaux sous la racine du site,
      // cf. commentaire sur avatarSrc() plus haut) — pas 1 seul niveau, sinon
      // 404 (ex: "../classiqueMode/..." résoudrait vers profile/classiqueMode/).
      const modePageMap = {
        classic: "../../classiqueMode/classiqueMode.html",
        emoji: "../../emojiMode/emojiMode.html",
        silhouette: "../../silhouetteMode/silhouette.html",
        alloutattack: "../../allOutAttackMode/allOutAttack.html",
        personae: "../../personaeMode/personae.html",
        music: "../../musicsMode/musics.html",
      };
      const dest = modePageMap[mode?.toLowerCase()];
      if (dest) {
        window.location.href = dest;
        return;
      }
      await loadMessages();
      return;
    }

    // ── Messages : Mark read / Decline ────────────────────
    const markReadBtn = e.target.closest(".js-mark-read, .js-decline-msg");
    if (markReadBtn) {
      const mid = parseInt(markReadBtn.dataset.mid);
      await window._personadleApi?.messages.updateStatus(mid, "read").catch(() => {});
      await loadMessages();
      return;
    }

    // ── Messages : Delete individual ──────────────────────
    const deleteBtn = e.target.closest(".js-delete-msg");
    if (deleteBtn) {
      const mid = parseInt(deleteBtn.dataset.mid);
      await window._personadleApi?.messages.delete(mid).catch(() => {});
      deleteBtn.closest(".fr-msg")?.remove();
      const list = document.getElementById("messagesList");
      if (list && !list.querySelector(".fr-msg")) {
        list.innerHTML = `<p class="fr-empty">${tf("friends.msg_empty", "No messages yet.")}</p>`;
        document.getElementById("messagesSection")?.classList.add("hidden");
      }
      return;
    }
  });

  // ── Vider les messages résolus ────────────────────────
  document.getElementById("clearMsgsBtn")?.addEventListener("click", clearReadMessages);
}

// ─────────────────────────────────────────────────────────
// 10. POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Attendre i18n
  if (window.__i18nReady) await window.__i18nReady;

  if (window._authReady) await window._authReady;

  const connected = document.getElementById("friendsConnected");
  const guest = document.getElementById("friendsGuest");

  if (window._currentUser) {
    connected?.classList.remove("hidden");
    guest?.classList.add("hidden");

    attachListeners();

    // Charger les trois sections en parallèle
    await Promise.all([loadFriends(), loadBrowse("", 0), loadMessages()]);

    startPolling();
  } else {
    connected?.classList.add("hidden");
    guest?.classList.remove("hidden");
  }
});
