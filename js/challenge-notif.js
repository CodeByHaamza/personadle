/**
 * js/challenge-notif.js — Animation notification défi entrant (Persona 5 style)
 * ──────────────────────────────────────────────────────────────────────────────
 * Usage :
 *   import { queueChallengeNotifs } from './challenge-notif.js';
 *   queueChallengeNotifs([{ id, senderPseudo, senderAvatar, mode, score,
 *                           date, senderId, challengeFilters }]);
 *
 * La croix (haut gauche) ferme l'animation — le message reste en attente
 * dans les notifications et est visible depuis la page Amis.
 */

import { FILTER_STORAGE_KEYS, getPendingActiveChallenge, normalizeModeKey } from "./gameCore.js";
import { gainSocialLinkXp } from "./social-link.js";

const _queue = [];
let _busy = false;

// Exporté : challenge-result.js efface ces clés en fin de défi à cible dédiée
// pour restaurer la partie quotidienne (cible du jour recalculable, seedée).
export const MODE_STATE_KEYS = {
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

const MODE_PAGE = {
  classic: "/classiqueMode/classiqueMode.html",
  emoji: "/emojiMode/emojiMode.html",
  silhouette: "/silhouetteMode/silhouette.html",
  alloutattack: "/allOutAttackMode/allOutAttack.html",
  personae: "/personaeMode/personae.html",
  music: "/musicsMode/musics.html",
};

const MODE_ICONS = {
  classic: "🃏",
  emoji: "😊",
  silhouette: "👤",
  alloutattack: "💥",
  personae: "👺",
  music: "🎵",
};

/** Racine du site (vide en prod, '/personadle' en dev sous-dossier). */
function _siteBase() {
  return window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
}

function _imgBase() {
  return `${_siteBase()}/img/`;
}

function _esc(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function _avatarSrc(data) {
  if (!data) return `${_imgBase()}default_avatar.png`;
  if (data.startsWith("data:")) return data;
  const base = _imgBase().replace(/img\/$/, "");
  return data.replace(/^\.\//, base);
}

/** t(key) retourne la clé brute (truthy) si absente — ?? ne se déclenche jamais, cf. CLAUDE.md §5. */
function _t(key, fallback) {
  const r = window.i18n?.t?.(key);
  return r != null && r !== key ? r : fallback;
}

/**
 * Ajoute des défis à la file d'attente et démarre l'affichage.
 * @param {Array<{id, senderPseudo, senderAvatar, mode, score, date, senderId, challengeFilters}>} challenges
 */
export function queueChallengeNotifs(challenges) {
  if (!challenges.length) return;
  for (const c of challenges) _queue.push(c);
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

function _render({
  id,
  senderPseudo,
  senderAvatar,
  mode,
  score,
  date,
  senderId,
  challengeFilters,
  challengeTarget = null,
}) {
  document.getElementById("cn-overlay")?.remove();

  // normalizeModeKey() et non .toLowerCase() : il gère « All Out Attack »,
  // « classique », « AllOutAttack »… (CLAUDE.md §8). Un .toLowerCase() nu laissait
  // passer des clés introuvables dans MODE_PAGE / MODE_STATE_KEYS /
  // FILTER_STORAGE_KEYS, qui échouaient alors toutes en silence.
  const modeKey = normalizeModeKey(mode) ?? (mode ?? "").toLowerCase();
  const modeIcon = MODE_ICONS[modeKey] ?? "⚔";
  const modeName = modeKey === "alloutattack" ? "ALL-OUT ATTACK" : (mode ?? "").toUpperCase();

  const overlay = document.createElement("div");
  overlay.id = "cn-overlay";
  overlay.innerHTML = `
    <div class="cn-backdrop"></div>
    <button class="cn-close" aria-label="Close">✕</button>
    <div class="cn-flash"></div>
    <div class="cn-rings">
      <div class="cn-ring"></div>
      <div class="cn-ring"></div>
      <div class="cn-ring"></div>
      <div class="cn-ring"></div>
    </div>
    <div class="cn-scene">
      <div class="cn-card">
        <img class="cn-avatar"
             src="${_avatarSrc(senderAvatar)}"
             alt="${_esc(senderPseudo)}"
             onerror="this.src='${_imgBase()}default_avatar.png'">
        <p class="cn-pseudo">${_esc(senderPseudo)}</p>
        <p class="cn-message">${_t("challenge.notif_challenges_you", "vous lance un défi !")}</p>
        <hr class="cn-divider">
        <div class="cn-mode-badge">${modeIcon} ${_esc(modeName)}</div>
        <p class="cn-score">
          ${_t("challenge.notif_beat", "Battre")} :
          <strong>${score}</strong>
          ${_t("challenge.notif_attempts", "tentative(s)")}
        </p>
        <div class="cn-buttons">
          <button class="cn-btn cn-btn--accept">
            ⚔ ${_t("friends.challenge_accept", "Accepter")}
          </button>
          <button class="cn-btn cn-btn--refuse">
            ${_t("friends.challenge_decline", "Refuser")}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("cn--visible"));

  // ── Accepter : pose localStorage + XP + redirect ────────
  overlay.querySelector(".cn-btn--accept").addEventListener("click", async () => {
    // activeChallenge est une case localStorage unique (pas une file) — accepter
    // ici l'écraserait silencieusement si un autre défi est déjà en cours,
    // laissant ce dernier bloqué en statut 'accepted' pour toujours côté serveur.
    const pending = getPendingActiveChallenge();
    if (pending && pending.msgId !== id) {
      if (typeof window.showToast === "function") {
        window.showToast(_t("challenge.already_active", "Finish your current challenge first."));
      }
      return;
    }

    // ── Rien n'est modifié tant qu'on ne sait pas qu'on peut aboutir ──────────
    // Ordre historique : on marquait le défi « accepted », on écrasait l'état du
    // mode, on écrivait activeChallenge… puis on découvrait qu'il n'y avait pas
    // de page où aller. Résultat : un défi bloqué « en cours » côté serveur, sans
    // redirection ni bannière, que le joueur ne pouvait plus ni jouer ni annuler.
    const dest = MODE_PAGE[modeKey] ? `${_siteBase()}${MODE_PAGE[modeKey]}` : null;
    if (!dest) {
      console.error(`[challenge] mode inconnu « ${mode} » → aucune page cible`);
      if (typeof window.showToast === "function") {
        window.showToast(_t("challenge.unknown_mode", "This challenge's mode is unavailable."));
      }
      return;
    }

    const api = window._personadleApi;
    if (!api) {
      // Sans API, le serveur ne saura jamais que le défi a été accepté : le
      // joueur jouerait pour rien et le défi resterait « en attente » chez lui.
      if (typeof window.showToast === "function") {
        window.showToast(_t("challenge.offline", "You need to be online to accept a challenge."));
      }
      return;
    }

    try {
      await api.messages.updateStatus(id, "accepted");
    } catch (err) {
      // Ne PAS avaler : si le serveur n'a pas enregistré l'acceptation, écrire
      // activeChallenge en local ferait diverger les deux états — c'est ce qui
      // produisait les défis fantômes « en cours ».
      console.error("[challenge] acceptation refusée par le serveur", err);
      if (typeof window.showToast === "function") {
        window.showToast(_t("challenge.accept_failed", "Could not accept the challenge. Try again."));
      }
      return;
    }

    (MODE_STATE_KEYS[modeKey] ?? []).forEach((k) => localStorage.removeItem(k));

    // Pas de fallback "[]" ici : filterMenu.js traite un tableau vide comme
    // "tout désélectionné" (état volontaire), différent de l'absence de clé
    // ("tout actif" par défaut, cf. initFilterMenu()). Si le joueur n'a jamais
    // touché ses filtres pour ce mode, localStorage.getItem() renvoie null —
    // on garde null tel quel pour que la restauration plus bas
    // (checkChallengeCompletion(), js/challenge-result.js) le laisse absent au
    // lieu d'écraser avec un "tout désélectionné" qui n'a jamais existé.
    const filterKey = FILTER_STORAGE_KEYS[modeKey] ?? null;
    const originalFilters = filterKey ? localStorage.getItem(filterKey) : null;
    const filters = challengeFilters && challengeFilters !== "[]" ? challengeFilters : null;
    if (filterKey && filters) localStorage.setItem(filterKey, filters);

    localStorage.setItem(
      "activeChallenge",
      JSON.stringify({
        msgId: id,
        mode: modeKey,
        date,
        score,
        senderId,
        filterKey,
        originalFilters,
        // Cible dédiée (2026-07-17) : le mode la jouera à la place de la cible
        // du jour et n'enregistrera PAS la partie en session quotidienne.
        // Null (ancien défi) = comportement historique, cible du jour.
        target: challengeTarget ?? null,
      })
    );

    if (senderId) gainSocialLinkXp(senderId, "challenge").catch(() => {});

    // `dest` a été résolu et validé plus haut, avant toute écriture.
    window.location.href = dest;
  });

  // ── Refuser : marque comme lu côté API + ferme ───────────
  overlay.querySelector(".cn-btn--refuse").addEventListener("click", async () => {
    await window._personadleApi?.messages.updateStatus(id, "read").catch(() => {});
    _closeOverlay(overlay);
  });

  // ── Croix : ferme seulement l'animation ─────────────────
  // Le message reste "unread" dans l'API → visible depuis la page Amis.
  overlay.querySelector(".cn-close").addEventListener("click", () => {
    _queue.length = 0;
    _busy = false;
    _fadeOut(overlay, null);
  });
}

function _fadeOut(overlay, onDone) {
  const scene = overlay.querySelector(".cn-scene");
  if (scene) {
    scene.style.transition = "opacity 0.22s ease";
    scene.style.opacity = "0";
  }
  overlay.querySelector(".cn-backdrop").style.background = "rgba(0,0,0,0)";
  setTimeout(() => {
    overlay.remove();
    if (onDone) onDone();
  }, 240);
}

function _closeOverlay(overlay) {
  _fadeOut(overlay, _showNext);
}
