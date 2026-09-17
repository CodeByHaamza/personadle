/**
 * js/notifications.js — Push temps réel (Pusher) + fallback polling + badge nav
 * ────────────────────────────────────────────────────────────────────────────
 * Importer et appeler initNotifications() sur toutes les pages après auth.
 * Ne montre PAS la calling card sur la page friends (l'UI est déjà visible).
 *
 * _check() reste l'unique source de vérité (dédup localStorage, animations,
 * affichage) : un event Pusher ne porte aucune donnée, il ne fait que rappeler
 * _check() immédiatement au lieu d'attendre le prochain tick.
 *
 * Trois régimes, choisis dans _initPusher() :
 *   - Pusher non configuré (pas de clé dans /api/auth/me) → polling 60 s,
 *     exactement le comportement d'avant ce chantier, aucun script CDN chargé ;
 *   - Pusher configuré et connecté → push, aucun polling ;
 *   - Pusher configuré mais indisponible (CDN, socket) → fallback polling 5 min,
 *     dégradé de latence, jamais de perte de notification.
 */

import { queueCallingCards } from "./calling-card.js";
import { queueTvAnimations } from "./tv-friend-anim.js";
import { queueEvokerAnimations } from "./p3-evoker-anim.js";
import { showSenderChallengeResult } from "./challenge-result.js";
import { queueChallengeNotifs, setChallengeNotifDismissHandler } from "./challenge-notif.js";
import { showSocialLinkRankUp } from "./social-link.js";
import { getCsrfToken, BASE_URL } from "./api.js";
import { flushPendingChallengeStatus } from "./gameCore.js";

const SEEN_KEY = "ccShownFriendshipIds";
const SEEN_CHALLENGE_KEY = "seenChallengeResults";
const SEEN_CHALLENGE_NOTIF = "seenChallengeNotifIds";

/** How far back (ms) to look for challenge results to notify about (48 hours). */
const CHALLENGE_RESULT_CUTOFF_MS = 48 * 60 * 60 * 1000;

/**
 * Polling « historique » (ms) quand Pusher n’est PAS configuré (clé absente
 * dans /api/auth/me) — c’est le comportement d’avant ce chantier, conservé tel
 * quel pour ne créer aucune régression de latence tant que le compte Pusher
 * n’est pas renseigné en prod.
 */
const POLL_INTERVAL_MS = 60_000;

/**
 * Fallback polling (ms) quand Pusher EST configuré mais que la connexion
 * WebSocket est indisponible (CDN injoignable, socket coupé…) : plus lent que
 * le polling historique, puisque Pusher reprendra la main dès qu’il revient.
 */
const FALLBACK_POLL_INTERVAL_MS = 5 * 60_000;

/** Délai de grâce avant de considérer une déconnexion Pusher comme "prolongée". */
const RECONNECT_GRACE_MS = 10_000;

const PUSHER_JS_URL = "https://cdn.jsdelivr.net/npm/pusher-js@8.4.0/dist/web/pusher.min.js";

let _fallbackPollTimer = null;
let _pusher = null;
let _disconnectGraceTimer = null;

/**
 * Défis déjà poussés dans la file d'animation PENDANT CETTE PAGE.
 *
 * Le suivi « déjà vu » était entièrement persistant (localStorage) et posé AVANT
 * l'affichage : une notification que le joueur n'a jamais vue — parce qu'il a
 * changé de page dans la seconde, ou parce qu'un autre plein écran est passé
 * par-dessus — était perdue DÉFINITIVEMENT, alors que le message restait
 * `unread` côté serveur. C'est la cause n°1 des « parfois pas d'animation ».
 *
 * Désormais deux niveaux :
 *   - ce Set, en mémoire : évite seulement de rejouer la même notification à
 *     chaque sondage (60 s) tant qu'on est sur la page ;
 *   - localStorage (SEEN_CHALLENGE_NOTIF) : posé UNIQUEMENT quand le joueur a
 *     explicitement clos la notification (accepter / refuser / croix).
 */
const _queuedThisPage = new Set();

setChallengeNotifDismissHandler((id) => {
  const seen = _getSeenNotifIds();
  if (!seen.includes(id)) {
    seen.push(id);
    localStorage.setItem(SEEN_CHALLENGE_NOTIF, JSON.stringify(seen.slice(-100)));
  }
});

/**
 * Lance le polling des notifications.
 * À appeler après que window._currentUser est défini.
 */
export async function initNotifications() {
  if (!window._currentUser || !window._personadleApi) return;

  _syncSettingsToLocal();

  await _check();

  await _initPusher();

  // Sur la page friends : marquer comme vus (localStorage) pour ne pas re-déclencher
  if (_isOnFriendsPage()) {
    _clearSeenIds();
  }
}

/** Arrête le push et le fallback polling (ex: logout). */
export function stopNotifications() {
  if (_pusher) {
    _pusher.disconnect();
    _pusher = null;
  }
  _stopFallbackPolling();
  if (_disconnectGraceTimer) {
    clearTimeout(_disconnectGraceTimer);
    _disconnectGraceTimer = null;
  }
}

// ─────────────────────────────────────────────────────────
// Pusher — push temps réel + fallback polling
// ─────────────────────────────────────────────────────────

/** Délai max (ms) pour charger pusher-js avant d'abandonner et de tomber en fallback polling. */
const PUSHER_SCRIPT_LOAD_TIMEOUT_MS = 8_000;

async function _loadPusherScript() {
  if (window.Pusher) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("pusher-js load timed out")), PUSHER_SCRIPT_LOAD_TIMEOUT_MS);
    const script = document.createElement("script");
    script.src = PUSHER_JS_URL;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("pusher-js failed to load"));
    };
    document.head.appendChild(script);
  });
}

/** Pusher est « configuré » quand /api/auth/me a renvoyé une clé ET un cluster non vides. */
function _isPusherConfigured() {
  return Boolean(window._pusherKey) && Boolean(window._pusherCluster);
}

async function _initPusher() {
  // Pas de compte Pusher renseigné côté serveur (prod tant que les clés ne sont
  // pas posées, dev local sans .env) : on ne charge PAS le script CDN et on
  // garde le polling historique à 60 s — strictement le comportement d’avant.
  // Sans ce garde, pusher-js lance une exception sur une clé null et plus
  // aucun rafraîchissement n’a lieu après le premier _check().
  if (!_isPusherConfigured()) {
    _startPolling(POLL_INTERVAL_MS);
    return;
  }

  try {
    await _loadPusherScript();
  } catch {
    _startFallbackPolling();
    return;
  }

  const me = window._currentUser;
  let channel;
  try {
    _pusher = new window.Pusher(window._pusherKey, {
      cluster: window._pusherCluster,
      authEndpoint: `${BASE_URL}/pusher/auth`,
      auth: { headers: { "X-CSRF-Token": getCsrfToken() } },
    });
    channel = _pusher.subscribe(`private-user-${me.id}`);
  } catch (err) {
    // Clé refusée par pusher-js, constructeur cassé par un bloqueur… : on ne
    // laisse jamais l’utilisateur sans rafraîchissement.
    console.warn("[notifications] Pusher init failed, falling back to polling:", err);
    _pusher = null;
    _startFallbackPolling();
    return;
  }

  ["friend_request", "friend_declined", "challenge", "challenge_beaten", "rankup"].forEach((evt) => {
    channel.bind(evt, () => _check());
  });

  _pusher.connection.bind("state_change", (states) => {
    if (states.current === "connected") {
      if (_disconnectGraceTimer) {
        clearTimeout(_disconnectGraceTimer);
        _disconnectGraceTimer = null;
      }
      _stopFallbackPolling();
      return;
    }

    if (_disconnectGraceTimer) return;
    _disconnectGraceTimer = setTimeout(() => {
      _disconnectGraceTimer = null;
      if (_pusher?.connection.state !== "connected") _startFallbackPolling();
    }, RECONNECT_GRACE_MS);
  });
}

function _startPolling(intervalMs) {
  if (_fallbackPollTimer) return;
  _fallbackPollTimer = setInterval(_check, intervalMs);
}

function _startFallbackPolling() {
  _startPolling(FALLBACK_POLL_INTERVAL_MS);
}

function _stopFallbackPolling() {
  if (_fallbackPollTimer) {
    clearInterval(_fallbackPollTimer);
    _fallbackPollTimer = null;
  }
}

// ─────────────────────────────────────────────────────────
// Fonctions internes
// ─────────────────────────────────────────────────────────

async function _check() {
  const api = window._personadleApi;
  if (!api) return;

  // Résultats de défi que la fin de partie n'a pas pu transmettre (réseau, 5xx) :
  // rejoués ici avant de lire quoi que ce soit, pour que la liste des messages
  // ci-dessous reflète déjà le vrai statut. Cf. gameCore.js, file de relance.
  try {
    await flushPendingChallengeStatus(api);
  } catch {
    /* jamais bloquant */
  }

  try {
    const data = await api.notifications.get();
    const count = data.friend_requests ?? 0;
    _updateBadge(count);

    // Calling card : seulement hors page friends/gameplay, si animation activée, si demandes non vues
    if (count > 0 && _isAnimFriendRequestEnabled() && !_isOnFriendsPage() && !_isOnGamePage()) {
      const friendsData = await api.friends.list();
      const pending = (friendsData.pending_requests ?? []).filter(
        (r) => r.direction === "received"
      );

      const unseen = pending.filter((r) => !_isSeenLocally(r.friendship_id));
      if (unseen.length > 0) {
        unseen.forEach((r) => _markSeenLocally(r.friendship_id));
        const mapped = unseen.map((r) => ({
          pseudo: r.pseudo,
          friendship_id: r.friendship_id,
          avatar_data: r.avatar_data ?? null,
        }));
        const _style = _getAnimStyle();
        if (_style === "persona4_tv") {
          queueTvAnimations(mapped);
        } else if (_style === "persona3_evoker") {
          queueEvokerAnimations(mapped);
        } else {
          queueCallingCards(mapped);
        }
      }
    }

    // Un seul fetch pour les deux fonctions challenge
    if (!_isOnGamePage()) {
      const cutoff = Date.now() - CHALLENGE_RESULT_CUTOFF_MS;
      const msgData = await api.messages.list({ type: "challenge", limit: 30 });
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
    const filtered = msgs.filter(
      (m) =>
        m.sender_id === me.id &&
        (m.status === "beaten" || m.status === "expired") &&
        new Date(m.created_at).getTime() >= cutoff
    );

    // On first run, mark all existing resolved challenges as already seen
    // (prevents flooding animation for old history on first login)
    const seenIds = _getSeenChallengeIds();
    const _crKey = `_crInitDone_${me.id}`;
    if (!localStorage.getItem(_crKey)) {
      filtered.forEach((m) => {
        if (!seenIds.includes(m.id)) seenIds.push(m.id);
      });
      localStorage.setItem(SEEN_CHALLENGE_KEY, JSON.stringify(seenIds.slice(-100)));
      localStorage.setItem(_crKey, "1");
      return;
    }

    const unseen = filtered.filter((m) => !seenIds.includes(m.id));
    if (!unseen.length) return;

    // Mark all as seen before showing
    unseen.forEach((m) => seenIds.push(m.id));
    localStorage.setItem(SEEN_CHALLENGE_KEY, JSON.stringify(seenIds.slice(-100)));

    // Show animation for the first unseen resolved challenge
    await showSenderChallengeResult(unseen[0]);
  } catch {
    // Silencieux
  }
}

function _getSeenChallengeIds() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_CHALLENGE_KEY) || "[]");
  } catch {
    return [];
  }
}

async function _checkPendingChallenges(msgs) {
  const me = window._currentUser;
  if (!me?.id) return;

  try {
    const pending = msgs.filter(
      (m) =>
        m.sender_id !== me.id && // je suis le receveur (l'expéditeur ne se challenge pas lui-même)
        m.status === "unread"
    );

    if (!pending.length) return;

    const seenIds = _getSeenNotifIds();
    const unseen = pending.filter((m) => !seenIds.includes(m.id) && !_queuedThisPage.has(m.id));
    if (!unseen.length) return;

    // Un plein écran de résultat de défi est peut-être déjà affiché (l'expéditeur
    // vient d'apprendre que son défi a été relevé). Empiler la notification
    // par-dessus la rendait invisible puis la détruisait — et, à l'époque où le
    // « vu » était persisté ici, la perdait pour de bon. On repasse dans 60 s.
    if (document.getElementById("cr-overlay")) return;

    // Anti-doublon de sondage seulement : le « vu » persistant est posé par
    // challenge-notif.js quand le joueur ferme réellement la notification.
    unseen.forEach((m) => _queuedThisPage.add(m.id));

    queueChallengeNotifs(
      unseen.map((m) => ({
        id: m.id,
        senderPseudo: m.sender?.pseudo ?? "???",
        senderAvatar: m.sender?.avatar ?? null,
        mode: m.challenge_mode ?? "",
        score: m.challenge_score ?? 0,
        date: m.challenge_date ?? "",
        senderId: m.sender_id,
        challengeFilters: m.challenge_filters ?? "[]",
        // Cible dédiée du défi (migration 023) — null sur les anciens défis.
        challengeTarget: m.challenge_target ?? null,
        // Dimension du défi (migration 037). Sans ce report, un défi Expert
        // enverrait le joueur en mode normal, où sa partie ne le résoudrait
        // jamais — les deux dimensions ont des cases de stockage distinctes.
        challengeIsExpert: !!m.challenge_is_expert,
      }))
    );
  } catch {
    // Offline ou non connecté — silencieux
  }
}

function _getSeenNotifIds() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_CHALLENGE_NOTIF) || "[]");
  } catch {
    return [];
  }
}

function _updateBadge(count) {
  const badge = document.getElementById("navFriendsBadge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function _isOnFriendsPage() {
  return window.location.pathname.includes("/friends");
}

function _isOnGamePage() {
  const p = window.location.pathname;
  return (
    p.includes("/classiqueMode/") ||
    p.includes("/emojiMode/") ||
    p.includes("/silhouetteMode/") ||
    p.includes("/allOutAttackMode/") ||
    p.includes("/personaeMode/") ||
    p.includes("/musicsMode/")
  );
}

function _isAnimFriendRequestEnabled() {
  try {
    const s = JSON.parse(localStorage.getItem("personaSettings") || "{}");
    return s.anim_friend_request !== false; // défaut true
  } catch {
    return true;
  }
}

/** Retourne 'calling_card' (défaut), 'persona4_tv' ou 'persona3_evoker'. */
function _getAnimStyle() {
  try {
    const s = JSON.parse(localStorage.getItem("personaSettings") || "{}");
    const v = s.anim_friend_request_style;
    if (v === "persona4_tv" || v === "persona3_evoker") return v;
    return "calling_card";
  } catch {
    return "calling_card";
  }
}

function _syncSettingsToLocal() {
  const settings = window._currentUser?.settings;
  if (settings && typeof settings === "object") {
    localStorage.setItem("personaSettings", JSON.stringify(settings));
  }
}

// ── Tracking local des demandes déjà montrées ──────────────
// Évite que la calling card réapparaisse toutes les 60s pour la même demande.
// L'ID est retiré de la liste quand l'utilisateur visite la page friends
// (ce qui signifie qu'il a vu/traité la demande).

function _getSeenIds() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
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
    const lang = document.documentElement.lang || "en";
    const data = await window._personadleApi.socialLink.getRankUpNotifs(lang);
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
