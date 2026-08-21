/**
 * js/challenge-result.js — Challenge result full-screen animation
 * ─────────────────────────────────────────────────────────────────
 * Exports:
 *   checkChallengeCompletion(mode, myAttempts, isWin)
 *     → Reads activeChallenge from localStorage; if applicable shows the
 *       animation, patches the message status, and redirects to home.
 *   showSenderChallengeResult(msg)
 *     → Shows the result animation to the challenge sender (used by notifications.js).
 */

import { MODE_STATE_KEYS } from "./challenge-notif.js";
import { isExpertPage } from "./gameCore.js";

/** Heart emoji/size per Social Link rank (1-10). Win only. */
const SL_HEART = {
  1: { emoji: "🤍", size: "1.5rem", glow: false },
  2: { emoji: "❤️", size: "1.8rem", glow: false },
  3: { emoji: "❤️", size: "2rem", glow: false },
  4: { emoji: "🧡", size: "2.2rem", glow: false },
  5: { emoji: "💛", size: "2.4rem", glow: false },
  6: { emoji: "💚", size: "2.6rem", glow: false },
  7: { emoji: "💙", size: "2.8rem", glow: false },
  8: { emoji: "💜", size: "3rem", glow: false },
  9: { emoji: "💗", size: "3.2rem", glow: false },
  10: { emoji: "💛", size: "3.6rem", glow: true },
};

function t(key, fallback = "") {
  const r = window.i18n?.t?.(key);
  return r != null && r !== key ? r : fallback;
}

function esc(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function _imgBase() {
  return window.location.pathname.startsWith("/personadle/") ? "/personadle/img/" : "/img/";
}

function avatarSrc(data) {
  if (!data) return `${_imgBase()}default_avatar.png`;
  if (data.startsWith("data:")) return data;
  return data.replace(/^(\.\.?\/)?img\//, _imgBase());
}

/** Converts a #RRGGBB hex color to rgba(r, g, b, alpha). */
function hexToRgba(hex, alpha) {
  const h = (hex ?? "#888888").replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16) || 136;
  const g = parseInt(h.slice(2, 4), 16) || 136;
  const b = parseInt(h.slice(4, 6), 16) || 136;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Renders the full-screen challenge result overlay and shows the animation.
 *
 * @param {object}  opts
 * @param {boolean} opts.success
 * @param {number}  opts.myAttempts
 * @param {number}  opts.friendScore      Score to beat
 * @param {string}  opts.myPseudo
 * @param {string}  opts.myAvatar
 * @param {string}  opts.myBorderColor    Hex color from profile
 * @param {string}  opts.senderPseudo
 * @param {string}  opts.senderAvatar
 * @param {string}  opts.senderBorderColor Hex color from profile
 * @param {number}  opts.slRank           Social Link rank 1-10
 * @param {number}  opts.xpGained
 */
function showChallengeResult({
  success,
  myAttempts,
  friendScore,
  myPseudo,
  myAvatar,
  myBorderColor = "#e63946",
  senderPseudo,
  senderAvatar,
  senderBorderColor = "#e63946",
  slRank = 1,
  xpGained = 0,
  isSender = false,
}) {
  const heart = SL_HEART[Math.min(10, Math.max(1, slRank))];
  const fail = !success;

  // Wallpaper "Kanji's Dungeons" : un défi ENVOYÉ par l'utilisateur a été relevé
  // par un ami (l'utilisateur est ici le sender → la condition est remplie).
  if (isSender) {
    try {
      const _prof = JSON.parse(localStorage.getItem("personaUserProfile") || "null");
      if (_prof && _prof.challengeAcceptedByFriend !== true) {
        _prof.challengeAcceptedByFriend = true;
        localStorage.setItem("personaUserProfile", JSON.stringify(_prof));
      }
    } catch (_) {
      /* profil absent ou JSON invalide → ignorer */
    }
  }

  // Avatar border + shadow styles using real profile colors
  const myStyle = `border-color:${myBorderColor};box-shadow:0 0 14px ${hexToRgba(myBorderColor, 0.5)}`;
  const senderStyle = `border-color:${senderBorderColor};box-shadow:0 0 14px ${hexToRgba(senderBorderColor, 0.5)}`;

  // Heart: on win use SL rank heart; on fail always use a red heart that will fall
  const heartEl = fail
    ? `<span class="cr-heart cr-heart--fall" style="font-size:2.6rem">❤️</span>`
    : `<span class="cr-heart${heart.glow ? " cr-heart--glow" : ""}" style="font-size:${heart.size}">${heart.emoji}</span>`;

  const titleWin = isSender
    ? t("challenge_result.sender_title_win", "BRAVO !")
    : t("challenge_result.title_win", "BRAVO !");
  const titleFail = isSender
    ? t("challenge_result.sender_title_fail", "DOMMAGE...")
    : t("challenge_result.title_fail", "DOMMAGE...");
  const labelMy = t("challenge_result.my_score", "Your attempts");
  const labelBeat = t("challenge_result.to_beat", "Score to beat");
  const labelSL = t("challenge_result.social_link", "Social Link");
  const labelClose = t("challenge_result.close", "Back to Home");
  const labelXp = t("challenge_result.xp_gained", "+{{xp}} XP Social Link").replace(
    "{{xp}}",
    xpGained
  );
  const titleModal = isSender
    ? fail
      ? t("challenge_result.sender_modal_fail", "Not Beaten...")
      : t("challenge_result.sender_modal_win", "Challenge Completed!")
    : fail
      ? t("challenge_result.modal_fail", "Challenge Failed")
      : t("challenge_result.modal_win", "Challenge Beaten!");

  const overlay = document.createElement("div");
  overlay.id = "cr-overlay";
  overlay.innerHTML = `
    <div class="cr-bravo${fail ? " cr-bravo--fail" : ""}">
      ${fail ? titleFail : titleWin}
    </div>

    <div class="cr-scene">
      <div class="cr-avatar-wrap cr-avatar-wrap--left">
        <img class="cr-avatar"
             style="${esc(myStyle)}"
             src="${esc(avatarSrc(myAvatar))}"
             alt="${esc(myPseudo)}"
             onerror="this.src=(window.location.pathname.startsWith('/personadle/')?'/personadle/img/':'/img/')+'default_avatar.png'">
        <span class="cr-pseudo">${esc(myPseudo)}</span>
      </div>

      <div class="cr-wire-wrap">
        <svg class="cr-wire-svg" viewBox="0 0 200 60" preserveAspectRatio="none">
          <path class="cr-wire-path${fail ? " cr-wire-path--fail" : ""}"
                d="M0,30 C50,10 150,50 200,30"/>
        </svg>
        ${heartEl}
      </div>

      <div class="cr-avatar-wrap cr-avatar-wrap--right">
        <img class="cr-avatar"
             style="${esc(senderStyle)}"
             src="${esc(avatarSrc(senderAvatar))}"
             alt="${esc(senderPseudo)}"
             onerror="this.src=(window.location.pathname.startsWith('/personadle/')?'/personadle/img/':'/img/')+'default_avatar.png'">
        <span class="cr-pseudo">${esc(senderPseudo)}</span>
      </div>
    </div>

    <div class="cr-modal${fail ? " cr-modal--fail" : ""}">
      <div class="cr-modal-title${fail ? " cr-modal-title--fail" : ""}">
        ${esc(titleModal)}
      </div>
      <div class="cr-modal-row">
        <span>${esc(labelMy)}</span>
        <span class="${fail ? "cr-val--bad" : "cr-val--good"}">${myAttempts}</span>
      </div>
      <div class="cr-modal-row">
        <span>${esc(labelBeat)}</span>
        <span>${friendScore}</span>
      </div>
      <div class="cr-modal-row">
        <span>${esc(labelSL)}</span>
        <span>Rank ${slRank} ${fail ? "🖤" : heart.emoji}</span>
      </div>
      ${xpGained > 0 ? `<div class="cr-modal-xp">${esc(labelXp)}</div>` : ""}
      <button class="cr-close-btn${fail ? " cr-close-btn--fail" : ""}" id="crCloseBtn">
        ${esc(labelClose)}
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("cr--visible"));

  const goHome = () => {
    overlay.remove();
    const depth = window.location.pathname.split("/").filter(Boolean).length;
    window.location.href = depth <= 1 ? "index.html" : "../index.html";
  };

  document.getElementById("crCloseBtn")?.addEventListener("click", goHome);
  setTimeout(goHome, 11_000);
}

/**
 * Checks if there is an active challenge for the given mode.
 * If yes, determines success/failure, patches the message status,
 * fetches Social Link data, and shows the result animation.
 *
 * @param {string}  mode        - 'classic'|'emoji'|'silhouette'|'alloutattack'|'personae'|'music'
 * @param {number}  myAttempts  - Number of attempts used
 * @param {boolean} isWin       - Whether the player found the answer
 */
export async function checkChallengeCompletion(mode, myAttempts, isWin) {
  // Une partie Expert ne résout jamais un défi : `activeChallenge` n'est pas scopé
  // par mode Expert (cf. getActiveChallengeTarget(), js/gameCore.js), donc valider
  // ici consommerait le défi normal avec le score d'une autre mécanique.
  if (isExpertPage()) return;

  const raw = localStorage.getItem("activeChallenge");
  if (!raw) return;

  let challenge;
  try {
    challenge = JSON.parse(raw);
  } catch {
    return;
  }

  if ((challenge.mode ?? "").toLowerCase() !== mode.toLowerCase()) return;

  localStorage.removeItem("activeChallenge");

  // Restore original filters (backed up when B accepted the challenge)
  if (
    challenge.filterKey &&
    challenge.originalFilters !== null &&
    challenge.originalFilters !== undefined
  ) {
    localStorage.setItem(challenge.filterKey, challenge.originalFilters);
  }

  // Défi à cible DÉDIÉE (2026-07-17) : la partie jouée n'était pas celle du
  // jour — on efface l'état du mode pour que le prochain chargement retombe
  // sur la cible quotidienne (seedée, donc parfaitement restaurable). L'écran
  // de résultat affiché reste intact (pas de re-render ici).
  if (challenge.target) {
    (MODE_STATE_KEYS[(challenge.mode ?? "").toLowerCase()] ?? []).forEach((k) =>
      localStorage.removeItem(k)
    );
  }

  const success = isWin && myAttempts <= challenge.score;
  const api = window._personadleApi;

  const newStatus = success ? "beaten" : "expired";
  api?.messages.updateStatus(challenge.msgId, newStatus).catch(() => {});

  let senderPseudo = "???";
  let senderAvatar = null;
  let senderBorderColor = "#e63946";
  let slRank = 1;
  const xpGained = success ? 35 : 0;

  // Fetch sender profile + SL rank + current user profile (for real avatar)
  const me = window._currentUser;
  let myPseudo = me?.pseudo ?? "Me";
  let myAvatar = me?.avatar_data ?? null;
  let myBorderColor = me?.avatar_border_color ?? "#e63946";

  const fetches = [];
  if (api && challenge.senderId) {
    fetches.push(api.user.get(challenge.senderId));
    fetches.push(
      api.socialLink
        .getByFriend(challenge.senderId)
        .then(({ link_id }) => api.socialLink.get(link_id))
        .catch(() => null)
    );
  } else {
    fetches.push(Promise.resolve(null));
    fetches.push(Promise.resolve(null));
  }
  // Fetch own profile if avatar is missing from session
  if (api && me?.id && !myAvatar) {
    fetches.push(api.user.get(me.id).catch(() => null));
  } else {
    fetches.push(Promise.resolve(null));
  }

  const [senderRes, slRes, meRes] = await Promise.allSettled(fetches);

  if (senderRes.status === "fulfilled" && senderRes.value) {
    senderPseudo = senderRes.value.pseudo ?? senderPseudo;
    senderAvatar = senderRes.value.avatar_data ?? null;
    senderBorderColor = senderRes.value.avatar_border_color ?? senderBorderColor;
  }
  if (slRes.status === "fulfilled" && slRes.value) {
    slRank = slRes.value.rank ?? 1;
  }
  if (meRes.status === "fulfilled" && meRes.value) {
    myAvatar = meRes.value.avatar_data ?? myAvatar;
    myBorderColor = meRes.value.avatar_border_color ?? myBorderColor;
  }

  showChallengeResult({
    success,
    myAttempts,
    friendScore: challenge.score,
    myPseudo,
    myAvatar,
    myBorderColor,
    senderPseudo,
    senderAvatar,
    senderBorderColor,
    slRank,
    xpGained,
  });
}

/**
 * Shows the challenge result animation from the SENDER's perspective.
 * Called by notifications.js when a sent challenge is resolved.
 *
 * @param {object} msg  — message object from the API (includes sender/receiver info)
 */
export async function showSenderChallengeResult(msg) {
  const api = window._personadleApi;
  const me = window._currentUser;

  // success for sender = their challenge was beaten by friend (celebration)
  const success = msg.status === "beaten";

  let myPseudo = me?.pseudo ?? "Me";
  let myAvatar = me?.avatar_data ?? null;
  let myBorderColor = me?.avatar_border_color ?? "#e63946";
  let slRank = 1;

  // receiver is the challenger (the person we challenged)
  const receiverPseudo = msg.receiver?.pseudo ?? "???";
  const receiverAvatar = msg.receiver?.avatar ?? null;
  let receiverBorderColor = "#e63946";

  if (api) {
    const [meProfileRes, receiverRes, slRes] = await Promise.allSettled([
      me?.id && !myAvatar ? api.user.get(me.id) : Promise.resolve(null),
      msg.receiver_id ? api.user.get(msg.receiver_id) : Promise.resolve(null),
      msg.receiver_id
        ? api.socialLink
            .getByFriend(msg.receiver_id)
            .then(({ link_id }) => api.socialLink.get(link_id))
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    if (meProfileRes.status === "fulfilled" && meProfileRes.value) {
      myAvatar = meProfileRes.value.avatar_data ?? myAvatar;
      myBorderColor = meProfileRes.value.avatar_border_color ?? myBorderColor;
    }
    if (receiverRes.status === "fulfilled" && receiverRes.value) {
      receiverBorderColor = receiverRes.value.avatar_border_color ?? receiverBorderColor;
    }
    if (slRes.status === "fulfilled" && slRes.value) {
      slRank = slRes.value.rank ?? 1;
    }
  }

  showChallengeResult({
    success,
    myAttempts: msg.challenge_score ?? 0, // sender's original score
    friendScore: msg.challenge_score ?? 0,
    myPseudo,
    myAvatar,
    myBorderColor,
    senderPseudo: receiverPseudo,
    senderAvatar: receiverAvatar,
    senderBorderColor: receiverBorderColor,
    slRank,
    xpGained: 0,
    isSender: true,
  });
}
