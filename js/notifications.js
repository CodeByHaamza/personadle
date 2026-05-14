/**
 * js/notifications.js — Polling notifications + badge nav + calling card
 * ─────────────────────────────────────────────────────────────────────
 * Importer et appeler initNotifications() sur toutes les pages après auth.
 * Ne montre PAS la calling card sur la page friends (l'UI est déjà visible).
 */

import { queueCallingCards }       from './calling-card.js';
import { queueTvAnimations }        from './tv-friend-anim.js';
import { queueEvokerAnimations }    from './p3-evoker-anim.js';
import { showSenderChallengeResult } from './challenge-result.js';
import { queueChallengeNotifs }      from './challenge-notif.js';
import { showSocialLinkRankUp }      from './social-link.js';

const SEEN_KEY              = 'ccShownFriendshipIds';
const SEEN_CHALLENGE_KEY    = 'seenChallengeResults';
const SEEN_CHALLENGE_NOTIF  = 'seenChallengeNotifIds';

/** How far back (ms) to look for challenge results to notify about (48 hours). */
const CHALLENGE_RESULT_CUTOFF_MS = 48 * 60 * 60 * 1000;

/** Notification polling interval (ms). */
const POLL_INTERVAL_MS = 60_000;

let _pollTimer = null;

/**
 * Lance le polling des notifications.
 * À appeler après que window._currentUser est défini.
 */
export async function initNotifications() {
  if (!window._currentUser || !window._personadleApi) return;

  _syncSettingsToLocal();

  // Premier check immédiat
  await _check();

  // Poll toutes les 60 secondes
  _pollTimer = setInterval(_check, POLL_INTERVAL_MS);

  // Sur la page friends : marquer comme vus (localStorage) pour ne pas re-déclencher
  if (_isOnFriendsPage()) {
    _clearSeenIds();
  }
}

/** Arrête le polling (ex: logout). */
export function stopNotifications() {
  clearInterval(_pollTimer);
  _pollTimer = null;
}

// ─────────────────────────────────────────────────────────
// Fonctions internes
// ─────────────────────────────────────────────────────────

async function _check() {
  const api = window._personadleApi;
  if (!api) return;

  try {
    const data  = await api.notifications.get();
    const count = data.friend_requests ?? 0;
    _updateBadge(count);

    // Calling card : seulement hors page friends/gameplay, si animation activée, si demandes non vues
    if (count > 0 && _isAnimFriendRequestEnabled() && !_isOnFriendsPage() && !_isOnGamePage()) {
      const friendsData = await api.friends.list();
      const pending = (friendsData.pending_requests ?? []).filter(r => r.direction === 'received');

      const unseen = pending.filter(r => !_isSeenLocally(r.friendship_id));
      if (unseen.length > 0) {
        unseen.forEach(r => _markSeenLocally(r.friendship_id));
        const mapped = unseen.map(r => ({
          pseudo:        r.pseudo,
          friendship_id: r.friendship_id,
          avatar_data:   r.avatar_data ?? null,
        }));
        const _style = _getAnimStyle();
        if (_style === 'persona4_tv') {
          queueTvAnimations(mapped);
        } else if (_style === 'persona3_evoker') {
          queueEvokerAnimations(mapped);
        } else {
          queueCallingCards(mapped);
        }
      }
    }

    // Un seul fetch pour les deux fonctions challenge
    if (!_isOnGamePage()) {
      const cutoff  = Date.now() - CHALLENGE_RESULT_CUTOFF_MS;
      const msgData = await api.messages.list({ type: 'challenge', limit: 30 });
      const allMsgs = msgData.messages ?? [];
      await _checkChallengeResults(allMsgs, cutoff);
      if (!_isOnFriendsPage()) {
        await _checkPendingChallenges(allMsgs);
      }
    }

    await _checkRankUpNotifs();
  } catch {
    // Offline ou non connecté — silencieux
  }
}

async function _checkChallengeResults(msgs, cutoff) {
  const me = window._currentUser;
  if (!me?.id) return;

  try {
    const filtered = msgs.filter(m =>
      m.sender_id === me.id &&
      (m.status === 'beaten' || m.status === 'expired') &&
      new Date(m.created_at).getTime() >= cutoff
    );

    // On first run, mark all existing resolved challenges as already seen
    // (prevents flooding animation for old history on first login)
    const seenIds = _getSeenChallengeIds();
    const _crKey = `_crInitDone_${me.id}`;
    if (!localStorage.getItem(_crKey)) {
      filtered.forEach(m => { if (!seenIds.includes(m.id)) seenIds.push(m.id); });
      localStorage.setItem(SEEN_CHALLENGE_KEY, JSON.stringify(seenIds.slice(-100)));
      localStorage.setItem(_crKey, '1');
      return;
    }

    const unseen = filtered.filter(m => !seenIds.includes(m.id));
    if (!unseen.length) return;

    // Mark all as seen before showing
    unseen.forEach(m => seenIds.push(m.id));
    localStorage.setItem(SEEN_CHALLENGE_KEY, JSON.stringify(seenIds.slice(-100)));

    // Show animation for the first unseen resolved challenge
    await showSenderChallengeResult(unseen[0]);
  } catch {
    // Silencieux
  }
}

function _getSeenChallengeIds() {
  try { return JSON.parse(localStorage.getItem(SEEN_CHALLENGE_KEY) || '[]'); }
  catch { return []; }
}

async function _checkPendingChallenges(msgs) {
  const me = window._currentUser;
  if (!me?.id) return;

  try {
    const pending = msgs.filter(m =>
      m.sender_id !== me.id &&   // je suis le receveur (l'expéditeur ne se challenge pas lui-même)
      m.status === 'unread'
    );

    if (!pending.length) return;

    const seenIds = _getSeenNotifIds();
    const unseen  = pending.filter(m => !seenIds.includes(m.id));
    if (!unseen.length) return;

    // Marquer comme vus avant d'afficher (évite un double affichage sur poll rapide)
    unseen.forEach(m => seenIds.push(m.id));
    localStorage.setItem(SEEN_CHALLENGE_NOTIF, JSON.stringify(seenIds.slice(-100)));

    queueChallengeNotifs(unseen.map(m => ({
      id:               m.id,
      senderPseudo:     m.sender?.pseudo   ?? '???',
      senderAvatar:     m.sender?.avatar   ?? null,
      mode:             m.challenge_mode   ?? '',
      score:            m.challenge_score  ?? 0,
      date:             m.challenge_date   ?? '',
      senderId:         m.sender_id,
      challengeFilters: m.challenge_filters ?? '[]',
    })));
  } catch {
    // Offline ou non connecté — silencieux
  }
}

function _getSeenNotifIds() {
  try { return JSON.parse(localStorage.getItem(SEEN_CHALLENGE_NOTIF) || '[]'); }
  catch { return []; }
}

function _updateBadge(count) {
  const badge = document.getElementById('navFriendsBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function _isOnFriendsPage() {
  return window.location.pathname.includes('/friends');
}

function _isOnGamePage() {
  const p = window.location.pathname;
  return (
    p.includes('/classiqueMode/')    ||
    p.includes('/emojiMode/')        ||
    p.includes('/silhouetteMode/')   ||
    p.includes('/allOutAttackMode/') ||
    p.includes('/personaeMode/')     ||
    p.includes('/musicsMode/')
  );
}

function _isAnimFriendRequestEnabled() {
  try {
    const s = JSON.parse(localStorage.getItem('personaSettings') || '{}');
    return s.anim_friend_request !== false; // défaut true
  } catch { return true; }
}

/** Retourne 'calling_card' (défaut), 'persona4_tv' ou 'persona3_evoker'. */
function _getAnimStyle() {
  try {
    const s = JSON.parse(localStorage.getItem('personaSettings') || '{}');
    const v = s.anim_friend_request_style;
    if (v === 'persona4_tv' || v === 'persona3_evoker') return v;
    return 'calling_card';
  } catch { return 'calling_card'; }
}

function _syncSettingsToLocal() {
  const settings = window._currentUser?.settings;
  if (settings && typeof settings === 'object') {
    localStorage.setItem('personaSettings', JSON.stringify(settings));
  }
}

// ── Tracking local des demandes déjà montrées ──────────────
// Évite que la calling card réapparaisse toutes les 60s pour la même demande.
// L'ID est retiré de la liste quand l'utilisateur visite la page friends
// (ce qui signifie qu'il a vu/traité la demande).

function _getSeenIds() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); }
  catch { return []; }
}

function _isSeenLocally(friendshipId) {
  return _getSeenIds().includes(friendshipId);
}

function _markSeenLocally(friendshipId) {
  const ids = _getSeenIds();
  if (!ids.includes(friendshipId)) {
    ids.push(friendshipId);
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-50)));
  }
}

/** Appelé quand l'utilisateur visite la page friends — reset les IDs vus. */
function _clearSeenIds() {
  localStorage.removeItem(SEEN_KEY);
}

// ── Social Link rank-up notifications (partenaire) ─────────────────────────

async function _checkRankUpNotifs() {
  const me = window._currentUser;
  if (!me?.id) return;
  try {
    const lang  = document.documentElement.lang || 'en';
    const data  = await window._personadleApi.socialLink.getRankUpNotifs(lang);
    const notifs = data.notifs ?? [];
    if (!notifs.length) return;

    const n = notifs[0];

    setTimeout(() => {
      showSocialLinkRankUp(n.new_rank, n.rank_names, {
        friendAvatar: n.partner_avatar,
        friendPseudo: n.partner_pseudo,
      });
    }, 800);

  } catch {
    // Silencieux
  }
}
