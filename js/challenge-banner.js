/**
 * js/challenge-banner.js — Bandeau rappel du défi actif
 * ─────────────────────────────────────────────────────────
 * Usage dans les pages de jeu :
 *   import { initChallengeBanner } from '../js/challenge-banner.js';
 *   initChallengeBanner('classic'); // passer le mode courant (lowercase)
 *
 * Le défi actif est stocké dans localStorage 'activeChallenge' :
 *   { msgId, mode, date, score, senderId, filterKey, originalFilters, target }
 * Il est effacé automatiquement si la date ne correspond plus au jour courant.
 *
 * Deux boutons, volontairement distincts :
 *   ✕ (cb-dismiss)  → masque le bandeau, le défi reste relevable
 *   Abandonner      → renonce vraiment au défi (voir abandonActiveChallenge)
 *
 * Pourquoi l'abandon existe : `activeChallenge` est une case UNIQUE, et
 * `challenge-notif.js` refuse d'en accepter un second tant qu'elle est occupée
 * (« Finish your current challenge first »). Sans sortie, un joueur qui accepte
 * un défi puis ne veut ou ne peut pas le jouer est bloqué pour toute la journée
 * — le cache client se purge à minuit (heure de Paris), mais rien avant.
 */

import { MODE_STATE_KEYS } from "./challenge-notif.js";
import { activeChallengeKey } from "./gameCore.js";

export function initChallengeBanner(currentMode) {
  // Case cloisonnée par dimension : le bandeau d'une page Expert ne doit annoncer
  // que le défi Expert, et inversement (cf. activeChallengeKey(), gameCore.js).
  const storageKey = activeChallengeKey();
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;

  let challenge;
  try {
    challenge = JSON.parse(raw);
  } catch {
    localStorage.removeItem(storageKey);
    return;
  }

  // Vérifier que c'est pour aujourd'hui (heure Paris, cohérent avec le reset quotidien)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  if (challenge.date && challenge.date !== today) {
    localStorage.removeItem(storageKey);
    return;
  }

  // Vérifier que c'est pour le bon mode
  if (challenge.mode && challenge.mode.toLowerCase() !== currentMode.toLowerCase()) return;

  _injectBanner(challenge);
}

/** Traduction avec repli, cf. CLAUDE.md §5 (t() renvoie la clé si absente). */
function tf(key, fb) {
  if (!window.i18n?.t) return fb;
  const r = window.i18n.t(key);
  return r && r !== key ? r : fb;
}

function _injectBanner(challenge) {
  if (document.getElementById("challengeBanner")) return;

  const { msgId, mode, score } = challenge;

  const banner = document.createElement("div");
  banner.id = "challengeBanner";
  banner.innerHTML = `
    <img class="cb-avatar" src="${_defaultAvatar()}" alt="" id="cbAvatar">
    <div class="cb-text">
      <div class="cb-pseudo" id="cbPseudo">⚔ ${tf("challenge.active_challenge", "Challenge")}</div>
      <div class="cb-score" id="cbScore">${tf("challenge.banner_beat", "Beat")} <strong>${score}</strong> — ${(mode || "").toUpperCase()}</div>
    </div>
    <button class="cb-abandon" id="cbAbandon">${tf("challenge.abandon", "Give up challenge")}</button>
    <button class="cb-dismiss" id="cbDismiss" title="${tf("ui.dismiss", "✕")}">✕</button>
  `;

  document.body.appendChild(banner);

  // Charger les infos de l'adversaire en arrière-plan
  if (msgId) _loadChallengerInfo(msgId);

  document.getElementById("cbDismiss")?.addEventListener("click", () => {
    banner.remove();
    // Ne pas effacer le challenge — l'utilisateur peut encore le relever
  });

  document.getElementById("cbAbandon")?.addEventListener("click", () => {
    if (!window.confirm(tf("challenge.abandon_confirm", "Give up this challenge? It will not count as a loss."))) {
      return;
    }
    abandonActiveChallenge(challenge, banner);
  });
}

/**
 * Renonce au défi en cours et rend au joueur sa liberté d'en accepter un autre.
 *
 * Le statut serveur repasse à `read` (et non `expired`) : le joueur n'a pas
 * perdu, il n'a pas joué. `expired` est réservé aux défis réellement tentés et
 * ratés — le confondre fausserait le vécu de l'expéditeur, qui verrait un défi
 * « relevé et manqué » sans qu'aucune partie n'ait eu lieu.
 *
 * ⚠️ L'appel serveur est ATTENDU, jamais en fire-and-forget : c'est exactement
 * le piège de `performRecovery()` (CLAUDE.md §7). Purger le localStorage avant
 * la confirmation du serveur laisserait le défi « accepted » côté base — donc
 * toujours bloquant — pendant que le client se croirait libéré.
 *
 * @param {object} challenge  contenu de localStorage.activeChallenge
 * @param {HTMLElement} [banner]  bandeau à retirer en cas de succès
 * @returns {Promise<boolean>} true si l'abandon a bien été enregistré
 */
export async function abandonActiveChallenge(challenge, banner) {
  const api = window._personadleApi;
  const btn = document.getElementById("cbAbandon");
  if (btn) btn.disabled = true;

  if (!api?.messages?.updateStatus || !challenge?.msgId) {
    _toast(tf("challenge.abandon_failed", "Could not give up the challenge. Try again."));
    if (btn) btn.disabled = false;
    return false;
  }

  try {
    await api.messages.updateStatus(challenge.msgId, "read");
  } catch {
    // Hors ligne ou refus serveur : on ne touche à rien côté client, sinon les
    // deux états divergent et le défi reste bloquant sans que rien ne le dise.
    _toast(tf("challenge.abandon_failed", "Could not give up the challenge. Try again."));
    if (btn) btn.disabled = false;
    return false;
  }

  // ── Le serveur a confirmé : on peut défaire l'état local ──────────────────
  // Mêmes gestes que checkChallengeCompletion() (js/challenge-result.js), dans
  // le même ordre — un abandon et une fin de partie laissent le mode dans un
  // état strictement identique.
  if (challenge.filterKey && challenge.originalFilters != null) {
    localStorage.setItem(challenge.filterKey, challenge.originalFilters);
  }

  // Défi à cible dédiée : la partie chargée n'est pas celle du jour. On efface
  // l'état du mode pour que le rechargement retombe sur la cible quotidienne.
  if (challenge.target) {
    (MODE_STATE_KEYS[(challenge.mode ?? "").toLowerCase()] ?? []).forEach((k) =>
      localStorage.removeItem(k)
    );
  }

  localStorage.removeItem(activeChallengeKey());
  banner?.remove();
  _toast(tf("challenge.abandoned", "Challenge given up. You can accept another one."));

  // Rechargement seulement si la partie affichée était celle du défi : sans lui,
  // le joueur continuerait sur la cible dédiée qu'on vient de retirer du stockage.
  if (challenge.target) setTimeout(() => window.location.reload(), 900);
  return true;
}

/** Toast si la page en fournit un, sinon rien — l'abandon ne doit pas dépendre de l'UI. */
function _toast(msg) {
  if (typeof window.showToast === "function") window.showToast(msg);
}

async function _loadChallengerInfo(msgId) {
  if (!window._personadleApi) return;
  try {
    const data = await window._personadleApi.messages.list({ limit: 50 });
    const msg = (data.messages ?? []).find((m) => m.id === msgId);
    if (!msg) return;

    const pseudoEl = document.getElementById("cbPseudo");
    const avatarEl = document.getElementById("cbAvatar");
    if (pseudoEl) pseudoEl.textContent = `⚔ ${msg.sender.pseudo}`;
    if (avatarEl && msg.sender.avatar) avatarEl.src = msg.sender.avatar;
  } catch {
    /* silencieux */
  }
}

function _defaultAvatar() {
  const p = window.location.pathname;
  const prefix = p.startsWith("/personadle/") ? "/personadle" : "";
  return `${prefix}/img/default_avatar.png`;
}
