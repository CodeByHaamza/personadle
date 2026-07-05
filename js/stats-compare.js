/**
 * js/stats-compare.js — Stats comparison overlay between two players
 *
 * Public API:
 *   openCompareOverlay(friendId)  — opens the overlay for a given friend
 */

import { COMPARE_PHRASES } from "../database/compare-phrases.js";
import { MODES as CANONICAL_MODES } from "./gameCore.js";

// Liste des clés dérivée de la source canonique (gameCore.js) pour ne pas dupliquer
// la liste des modes — seuls les libellés courts ci-dessous restent propres à cet
// écran (contrainte d'espace dans le radar chart, ex. "All-Out" au lieu de
// "AllOutAttack"/"All-Out Attack" utilisés ailleurs).
const MODES = CANONICAL_MODES.map((m) => m.key);
const MODE_LABELS = {
  classic: "Classic",
  emoji: "Emoji",
  silhouette: "Silhouette",
  alloutattack: "All-Out",
  personae: "Personae",
  music: "Music",
};

const COLOR_ME = "#e63946";
const COLOR_FRIEND = "#4488ff";

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export async function openCompareOverlay(friendId) {
  const api = window._personadleApi;
  const t = (k, fb) => {
    const r = window.i18n?.t?.(k);
    return r != null && r !== k ? r : (fb ?? k);
  };

  document.getElementById("sc-overlay")?.remove();

  const overlay = _buildOverlaySkeleton(t);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add("sc--visible"));

  let data;
  try {
    data = await api.user.compare(friendId);
  } catch (err) {
    _showError(overlay, err, t);
    return;
  }

  if (data.on_cooldown) {
    _showCooldown(overlay, data.cooldown_until, t);
    return;
  }

  _populate(overlay, data, t);
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM CONSTRUCTION
// ─────────────────────────────────────────────────────────────────────────────

function _buildOverlaySkeleton(t) {
  const overlay = document.createElement("div");
  overlay.id = "sc-overlay";
  overlay.innerHTML = `
    <button class="sc-close" id="sc-close-btn" aria-label="${t("compare.close", "Close")}">✕</button>

    <div class="sc-players">
      <div class="sc-player" id="sc-player-me">
        <img class="sc-player__avatar" id="sc-me-avatar" src="../img/default_avatar.png" alt="me">
        <div class="sc-player__pseudo" id="sc-me-pseudo">…</div>
        <div class="sc-player__tag">${t("ui.you", "You")}</div>
      </div>
      <div class="sc-vs" id="sc-vs">VS</div>
      <div class="sc-player sc-player--right" id="sc-player-friend">
        <img class="sc-player__avatar" id="sc-friend-avatar" src="../img/default_avatar.png" alt="friend">
        <div class="sc-player__pseudo" id="sc-friend-pseudo">…</div>
        <div class="sc-player__tag" id="sc-friend-tag">…</div>
      </div>
    </div>

    <div class="sc-radar-wrap" id="sc-radar-wrap">
      <canvas id="sc-radar-canvas" width="280" height="280"></canvas>
      <div class="sc-radar-legend">
        <div class="sc-radar-legend__item">
          <div class="sc-radar-legend__dot sc-radar-legend__dot--me"></div>
          <span id="sc-legend-me">Me</span>
        </div>
        <div class="sc-radar-legend__item">
          <div class="sc-radar-legend__dot sc-radar-legend__dot--friend"></div>
          <span id="sc-legend-friend">Friend</span>
        </div>
      </div>
    </div>

    <div class="sc-stats" id="sc-stats"></div>

    <div class="sc-conclusion" id="sc-conclusion">
      <p class="sc-conclusion__text" id="sc-conclusion-text"></p>
    </div>

    <div class="sc-xp-toast" id="sc-xp-toast"></div>
    <div class="sc-cooldown" id="sc-cooldown"></div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) _closeOverlay();
  });
  overlay.querySelector("#sc-close-btn").addEventListener("click", _closeOverlay);

  return overlay;
}

function _closeOverlay() {
  const overlay = document.getElementById("sc-overlay");
  if (!overlay) return;
  overlay.classList.remove("sc--visible");
  setTimeout(() => overlay.remove(), 450);
}

// ─────────────────────────────────────────────────────────────────────────────
// POPULATE
// ─────────────────────────────────────────────────────────────────────────────

function _populate(overlay, data, t) {
  const { me, friend, xp_gained, cooldown_until } = data;

  const meAv = overlay.querySelector("#sc-me-avatar");
  meAv.src = me.avatar_data || "../img/default_avatar.png";
  meAv.onerror = () => {
    meAv.src = "../img/default_avatar.png";
  };
  overlay.querySelector("#sc-me-pseudo").textContent = me.pseudo;
  const frAv = overlay.querySelector("#sc-friend-avatar");
  frAv.src = friend.avatar_data || "../img/default_avatar.png";
  frAv.onerror = () => {
    frAv.src = "../img/default_avatar.png";
  };
  overlay.querySelector("#sc-friend-pseudo").textContent = friend.pseudo;
  overlay.querySelector("#sc-friend-tag").textContent = friend.pseudo;
  overlay.querySelector("#sc-legend-me").textContent = me.pseudo;
  overlay.querySelector("#sc-legend-friend").textContent = friend.pseudo;

  setTimeout(() => {
    overlay.querySelector("#sc-player-me").classList.add("sc-player--visible");
    overlay.querySelector("#sc-player-friend").classList.add("sc-player--visible");
  }, 150);
  setTimeout(() => overlay.querySelector("#sc-vs").classList.add("sc-vs--visible"), 350);
  setTimeout(() => {
    _drawRadar(overlay.querySelector("#sc-radar-canvas"), me.by_mode, friend.by_mode);
    overlay.querySelector("#sc-radar-wrap").classList.add("sc-radar-wrap--visible");
  }, 600);
  setTimeout(() => {
    _populateStats(overlay, me, friend, t);
    overlay.querySelector("#sc-stats").classList.add("sc-stats--visible");
  }, 850);
  setTimeout(() => {
    const phrase = _pickConclusion(me, friend);
    overlay.querySelector("#sc-conclusion-text").innerHTML = phrase;
    overlay.querySelector("#sc-conclusion").classList.add("sc-conclusion--visible");
  }, 1100);
  setTimeout(() => {
    const xpEl = overlay.querySelector("#sc-xp-toast");
    if (xp_gained > 0) {
      xpEl.textContent = t("compare.xp_gained", "+{{xp}} XP Social Link").replace(
        "{{xp}}",
        xp_gained
      );
      xpEl.classList.add("sc-xp-toast--visible");
    }
    if (cooldown_until) {
      const cdEl = overlay.querySelector("#sc-cooldown");
      const diff = _formatCooldown(cooldown_until);
      cdEl.textContent = t("compare.cooldown", "You can compare again in {{time}}").replace(
        "{{time}}",
        diff
      );
      cdEl.classList.add("sc-cooldown--visible");
    }
    overlay.querySelector(".sc-close").classList.add("sc-close--visible");

    // Rank-up animation fires after the overlay has fully settled
    if (data.ranked_up) {
      setTimeout(
        () =>
          window._showSocialLinkRankUp?.(data.new_rank, null, {
            friendAvatar: data.friend?.avatar_data,
            friendPseudo: data.friend?.pseudo,
          }),
        700
      );
    }
  }, 1300);
}

function _populateStats(overlay, me, friend, t) {
  const statsEl = overlay.querySelector("#sc-stats");
  const rows = [
    { key: "compare.wins", me: me.total_wins, fr: friend.total_wins },
    { key: "compare.winrate", me: _globalWr(me), fr: _globalWr(friend), fmt: (v) => v + "%" },
    { key: "compare.streak", me: me.best_streak, fr: friend.best_streak },
    { key: "compare.perfect", me: me.total_perfect, fr: friend.total_perfect },
    { key: "compare.games", me: me.total_games, fr: friend.total_games },
  ];

  statsEl.innerHTML = rows
    .map((r) => {
      const meV = r.fmt ? r.fmt(r.me) : r.me;
      const frV = r.fmt ? r.fmt(r.fr) : r.fr;
      const meCls = r.me > r.fr ? "win" : r.me < r.fr ? "lose" : "tie";
      const frCls = r.fr > r.me ? "win" : r.fr < r.me ? "lose" : "tie";
      return `
      <div class="sc-stat-val sc-stat-val--${meCls}">${meV}</div>
      <div class="sc-stat-label">${t(r.key, r.key.split(".")[1])}</div>
      <div class="sc-stat-val sc-stat-val--${frCls}">${frV}</div>
    `;
    })
    .join("");
}

function _globalWr(player) {
  return player.total_games > 0 ? Math.round((player.total_wins / player.total_games) * 100) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// RADAR CHART (Canvas)
// ─────────────────────────────────────────────────────────────────────────────

function _drawRadar(canvas, meByMode, friendByMode) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const N = MODES.length;

  const getWr = (byMode, mode) => {
    const m = byMode.find((x) => x.mode === mode);
    return m && m.games > 0 ? m.wins / m.games : 0;
  };

  const meVals = MODES.map((m) => getWr(meByMode, m));
  const friendVals = MODES.map((m) => getWr(friendByMode, m));
  const angles = MODES.map((_, i) => (Math.PI * 2 * i) / N - Math.PI / 2);

  function toXY(val, idx) {
    return {
      x: cx + r * val * Math.cos(angles[idx]),
      y: cy + r * val * Math.sin(angles[idx]),
    };
  }

  ctx.clearRect(0, 0, size, size);

  for (let lvl = 1; lvl <= 5; lvl++) {
    const fr = lvl / 5;
    ctx.beginPath();
    angles.forEach((a, i) => {
      const x = cx + r * fr * Math.cos(a);
      const y = cy + r * fr * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  angles.forEach((a) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  ctx.font = `${size * 0.05}px Arial, sans-serif`;
  ctx.fillStyle = "#aaa";
  ctx.textAlign = "center";
  MODES.forEach((mode, i) => {
    const x = cx + (r + 20) * Math.cos(angles[i]);
    const y = cy + (r + 20) * Math.sin(angles[i]) + 4;
    ctx.fillText(MODE_LABELS[mode], x, y);
  });

  ctx.beginPath();
  friendVals.forEach((v, i) => {
    const { x, y } = toXY(v, i);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(68,136,255,0.18)";
  ctx.strokeStyle = COLOR_FRIEND;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  meVals.forEach((v, i) => {
    const { x, y } = toXY(v, i);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(230,57,70,0.2)";
  ctx.strokeStyle = COLOR_ME;
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();

  [
    { vals: friendVals, color: COLOR_FRIEND },
    { vals: meVals, color: COLOR_ME },
  ].forEach(({ vals, color }) => {
    vals.forEach((v, i) => {
      const { x, y } = toXY(v, i);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCLUSION PHRASES
// ─────────────────────────────────────────────────────────────────────────────

function _pickConclusion(me, friend) {
  const lang = document.documentElement.lang || "en";
  const p = COMPARE_PHRASES[lang] ?? COMPARE_PHRASES.en;
  const rand = (arr) =>
    Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : "";
  const myWr = _globalWr(me);
  const frWr = _globalWr(friend);
  const winner = myWr >= frWr ? me.pseudo : friend.pseudo;
  const loser = myWr >= frWr ? friend.pseudo : me.pseudo;

  if (Math.random() < 0.12 && p.rare?.length) {
    return _interpolate(rand(p.rare), me.pseudo, friend.pseudo, winner, loser);
  }

  const gap = myWr - frWr;
  let phrase;

  if (Math.abs(gap) <= 5) {
    phrase = rand(p.equal);
  } else if (gap > 5) {
    phrase = rand(p.overall_win);
  } else {
    let worstMode = null,
      biggestGap = 0;
    MODES.forEach((mode) => {
      const myM = me.by_mode.find((x) => x.mode === mode);
      const frM = friend.by_mode.find((x) => x.mode === mode);
      const myWrM = myM && myM.games > 0 ? myM.wins / myM.games : 0;
      const frWrM = frM && frM.games > 0 ? frM.wins / frM.games : 0;
      const d = frWrM - myWrM;
      if (d > biggestGap) {
        biggestGap = d;
        worstMode = mode;
      }
    });
    if (worstMode && biggestGap > 0.15 && p.mode_lose?.[worstMode]?.length) {
      phrase = rand(p.mode_lose[worstMode]);
    } else {
      phrase = rand(p.overall_lose);
    }
  }

  if (me.best_streak - friend.best_streak > 5 && Math.random() < 0.4) {
    phrase = rand(p.streak_win);
  } else if (friend.best_streak - me.best_streak > 5 && Math.random() < 0.4) {
    phrase = rand(p.streak_lose);
  }

  return _interpolate(phrase, me.pseudo, friend.pseudo, me.pseudo, friend.pseudo);
}

function _interpolate(str, me, friend, winner, loser) {
  if (!str) return "";
  return str
    .replace(/{{friend}}/g, `<em>${friend}</em>`)
    .replace(/{{me}}/g, `<em>${me}</em>`)
    .replace(/{{winner}}/g, `<em>${winner}</em>`)
    .replace(/{{loser}}/g, `<em>${loser}</em>`);
}

// ─────────────────────────────────────────────────────────────────────────────
// COOLDOWN + ERRORS
// ─────────────────────────────────────────────────────────────────────────────

function _showCooldown(overlay, cooldownUntil, t) {
  const diff = _formatCooldown(cooldownUntil);
  overlay.querySelector(".sc-players").innerHTML = `
    <div style="color:#aaa;text-align:center;padding:40px 20px;">
      <div style="font-size:2rem;margin-bottom:12px">⏳</div>
      <p style="font-size:0.95rem;line-height:1.5">
        ${t("compare.cooldown", "You can compare again in {{time}}").replace("{{time}}", `<strong style="color:#e63946">${diff}</strong>`)}
      </p>
    </div>
  `;
  overlay.querySelector("#sc-vs")?.remove();
  overlay.querySelector(".sc-close").classList.add("sc-close--visible");
}

function _showError(overlay, err, t) {
  const msg =
    err?.status === 403
      ? t("friends.not_friends", "You are not friends with this player.")
      : t("ui.error", "An error occurred.");
  overlay.querySelector(".sc-players").innerHTML = `
    <div style="color:#f87171;text-align:center;padding:40px 20px;">${msg}</div>
  `;
  overlay.querySelector("#sc-vs")?.remove();
  overlay.querySelector(".sc-close").classList.add("sc-close--visible");
}

function _formatCooldown(iso) {
  const remaining = new Date(iso).getTime() - Date.now();
  if (remaining <= 0) return "0h";
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
