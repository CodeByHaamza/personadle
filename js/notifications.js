/**
 * js/notifications.js — Polling notifications + badge nav + calling card
 * ─────────────────────────────────────────────────────────────────────
 * Importer et appeler initNotifications() sur toutes les pages après auth.
 * Ne montre PAS la calling card sur la page friends (l'UI est déjà visible).
 */

import { queueCallingCards } from './calling-card.js';

let _pollTimer = null;

/**
 * Lance le polling des notifications.
 * À appeler après que window._currentUser est défini.
 */
export async function initNotifications() {
  if (!window._currentUser || !window._personadleApi) return;

  // Sync settings depuis le cloud vers localStorage
  _syncSettingsToLocal();

  // Premier check immédiat
  await _check();

  // Poll toutes les 60 secondes
  _pollTimer = setInterval(_check, 60_000);

  // Sur la page friends : marquer comme vus immédiatement
  if (_isOnFriendsPage()) {
    window._personadleApi.notifications.markSeen().catch(() => {});
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

    // Calling card : seulement hors page friends, si animation activée, si demandes non vues
    if (count > 0 && _isAnimFriendRequestEnabled() && !_isOnFriendsPage()) {
      const friendsData = await api.friends.list();
      const unseen = (friendsData.pending_requests ?? []).filter(r => r.direction === 'received');

      if (unseen.length > 0) {
        // Marquer comme vus AVANT d'afficher (évite re-déclenchement au poll suivant)
        await api.notifications.markSeen().catch(() => {});

        queueCallingCards(unseen.map(r => ({
          pseudo:        r.pseudo,
          friendship_id: r.friendship_id,
          avatar_data:   r.avatar_data ?? null,
        })));
      }
    }
  } catch {
    // Offline ou non connecté — silencieux
  }
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

function _isAnimFriendRequestEnabled() {
  try {
    const s = JSON.parse(localStorage.getItem('personaSettings') || '{}');
    return s.anim_friend_request !== false; // défaut true
  } catch { return true; }
}

function _syncSettingsToLocal() {
  // window._currentUser.settings est retourné par auth/me.php (Task 2)
  const settings = window._currentUser?.settings;
  if (settings && typeof settings === 'object') {
    localStorage.setItem('personaSettings', JSON.stringify(settings));
  }
}
