/**
 * js/tv-friend-anim.js — Animation TV Persona 4 pour les demandes d'amis
 * ─────────────────────────────────────────────────────────────────────
 * Usage :
 *   import { queueTvAnimations } from './tv-friend-anim.js';
 *   queueTvAnimations([{ pseudo, friendship_id, avatar_data }]);
 *
 * Choisir cette animation via settings.anim_friend_request_style = 'persona4_tv'.
 */

const _queue = [];
let _busy = false;
let _noiseRaf = null;

function _imgBase() {
  const p = window.location.pathname;
  const prefix = p.startsWith("/personadle/") ? "/personadle" : "";
  return `${prefix}/img/`;
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
  return data.replace(/^\.\.\//, base).replace(/^\.\//, base);
}

/**
 * Enfile une ou plusieurs demandes pour affichage.
 * @param {Array<{pseudo: string, friendship_id: number, avatar_data: string|null}>} requests
 */
export function queueTvAnimations(requests) {
  if (!requests.length) return;
  for (const r of requests) _queue.push(r);
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

function _render({ pseudo, friendship_id, avatar_data }) {
  document.getElementById("tv-anim-overlay")?.remove();
  _stopNoise();

  const t = (key, fallback) => {
    const v = window.i18n?.t?.(key);
    return v && v !== key ? v : fallback;
  };

  const avatarSrc = _avatarSrc(avatar_data);

  // Speaker dots (7×2 grid)
  const dots = Array(14).fill('<div class="tv-speaker-dot"></div>').join("");

  const overlay = document.createElement("div");
  overlay.id = "tv-anim-overlay";
  overlay.innerHTML = `
    <div class="tv-backdrop"></div>
    <div class="tv-stage">

      <!-- TV + burst dans le même conteneur relatif -->
      <div class="tv-wrap">

        <!-- Antennes -->
        <div class="tv-antennas">
          <div class="tv-antenna tv-antenna--l"></div>
          <div class="tv-antenna tv-antenna--r"></div>
        </div>

        <!-- Corps de la TV -->
        <div class="tv-body">
          <!-- Écran -->
          <div class="tv-screen-bezel">
            <div class="tv-screen">
              <img class="tv-avatar-bg"
                   src="${avatarSrc}" alt="" aria-hidden="true"
                   onerror="this.style.display='none'">
              <canvas class="tv-noise" id="tv-noise-canvas"></canvas>
              <img class="tv-avatar"
                   src="${avatarSrc}"
                   alt="${_esc(pseudo)}"
                   onerror="this.src='${_imgBase()}default_avatar.png'">
            </div>
          </div>
          <!-- Panneau bas -->
          <div class="tv-bottom-panel">
            <div class="tv-knobs">
              <div class="tv-knob"></div>
              <div class="tv-knob"></div>
            </div>
            <div class="tv-center">
              <div class="tv-brand">PERSONA</div>
              <div class="tv-speaker-grille">${dots}</div>
              <div class="tv-led"></div>
            </div>
          </div>
        </div><!-- /.tv-body -->

        <!-- Pieds -->
        <div class="tv-feet">
          <div class="tv-foot"></div>
          <div class="tv-foot"></div>
        </div>

        <!-- Burst avatar — EN DEHORS de .tv-body pour ne jamais être clipé.
             Position absolute relative à .tv-wrap (position: relative).
             Reste visible jusqu'au clic grâce à animation-fill-mode: forwards. -->
        <div class="tv-burst-wrap">
          <img class="tv-burst-avatar"
               id="tv-burst-avatar"
               src="${avatarSrc}"
               alt="${_esc(pseudo)}"
               onerror="this.src='${_imgBase()}default_avatar.png'">
        </div>

      </div><!-- /.tv-wrap -->

      <!-- Texte + boutons — toujours dans le flux, en dessous du burst -->
      <div class="tv-text" id="tv-text">
        <span class="tv-pseudo">${_esc(pseudo)}</span>
        <span class="tv-msg">${t("friends.tv_wants_confidant", "wants to be your Confidant.")}</span>
        <div class="tv-actions">
          <button class="tv-btn tv-btn-accept"  data-fid="${friendship_id}">
            ${t("friends.cc_yes", "Accept")}
          </button>
          <button class="tv-btn tv-btn-dismiss" data-fid="${friendship_id}">
            ${t("friends.cc_no", "Not now")}
          </button>
        </div>
      </div>
    </div>
    <div class="tv-particles" id="tv-particles"></div>
  `;

  document.body.appendChild(overlay);

  // Canvas noise
  const canvas = overlay.querySelector("#tv-noise-canvas");
  _startNoise(canvas);

  requestAnimationFrame(() => overlay.classList.add("tv--visible"));

  // Burst après 2.5s
  setTimeout(() => _triggerBurst(overlay), 2500);

  overlay.querySelector(".tv-btn-accept").addEventListener("click", async (e) => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, "accept").catch(() => {});
    _close(overlay);
  });

  overlay.querySelector(".tv-btn-dismiss").addEventListener("click", async (e) => {
    const fid = parseInt(e.currentTarget.dataset.fid, 10);
    await window._personadleApi?.friends.respond(fid, "decline").catch(() => {});
    _close(overlay);
  });

  overlay.querySelector(".tv-backdrop").addEventListener("click", () => {
    _queue.length = 0;
    _busy = false;
    _close(overlay);
  });
}

// ── Canvas noise ─────────────────────────────────────────────

function _startNoise(canvas) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  // Résolution basse intentionnelle (effet pixel)
  canvas.width = 64;
  canvas.height = 48;

  function _frame() {
    const img = ctx.createImageData(canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() > 0.5 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 220;
    }
    ctx.putImageData(img, 0, 0);
    _noiseRaf = requestAnimationFrame(_frame);
  }
  _noiseRaf = requestAnimationFrame(_frame);
}

function _stopNoise() {
  if (_noiseRaf !== null) {
    cancelAnimationFrame(_noiseRaf);
    _noiseRaf = null;
  }
}

// ── Burst ────────────────────────────────────────────────────

function _triggerBurst(overlay) {
  _stopNoise();

  const screen = overlay.querySelector(".tv-screen");
  const screenAvat = overlay.querySelector(".tv-avatar");
  const burstAvat = overlay.querySelector("#tv-burst-avatar");
  const noise = overlay.querySelector(".tv-noise");
  const textEl = overlay.querySelector("#tv-text");
  const particles = overlay.querySelector("#tv-particles");

  // Fade out noise
  if (noise) noise.style.opacity = "0";

  // Flash screen
  if (screen) screen.classList.add("tv--flash-screen");

  // Fade screen avatar to black when burst triggers
  if (screenAvat) screenAvat.classList.add("tv--screen-fade");

  // Particle origin = center of the burst wrap
  const burstWrap = overlay.querySelector(".tv-burst-wrap");
  const rect = burstWrap
    ? burstWrap.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  // Burst avatar out of TV
  if (burstAvat) {
    burstAvat.classList.add("tv--burst");
    // After burst lands (~700ms), add idle glow pulse — signals "waiting for your choice"
    setTimeout(() => burstAvat.classList.add("tv--waiting"), 700);
  }

  // Particles around burst origin
  _spawnParticles(particles, originX, originY);

  // Show text below burst
  setTimeout(() => {
    if (textEl) textEl.classList.add("tv--text-visible");
  }, 380);
}

// ── Particles ────────────────────────────────────────────────

const _SHAPES = ["⭐", "✿", "●", "★", "✦", "◆"];
const _COLORS = [
  "#ff0055",
  "#ffcc00",
  "#00ccff",
  "#ff6600",
  "#cc00ff",
  "#00ff88",
  "#ffee00",
  "#ff3399",
];

function _spawnParticles(container, originX, originY) {
  if (!container) return;

  const count = 28;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "tv-particle";
    el.textContent = _SHAPES[i % _SHAPES.length];

    const angle = (i / count) * 360 + Math.random() * (360 / count);
    const dist = 80 + Math.random() * 160;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * dist;
    const dy = Math.sin(rad) * dist;
    const rot = (Math.random() - 0.5) * 720;
    const size = 10 + Math.random() * 18;
    const delay = Math.random() * 0.15;
    const color = _COLORS[Math.floor(Math.random() * _COLORS.length)];

    el.style.cssText = `
      left: ${originX}px;
      top:  ${originY}px;
      --dx: ${dx}px;
      --dy: ${dy}px;
      --rot: ${rot}deg;
      font-size: ${size}px;
      color: ${color};
      animation-delay: ${delay}s;
    `;

    container.appendChild(el);
  }

  // Nettoyage après la fin de l'animation
  setTimeout(() => (container.innerHTML = ""), 900);
}

// ── Close ────────────────────────────────────────────────────

function _close(overlay) {
  _stopNoise();
  if (!overlay) overlay = document.getElementById("tv-anim-overlay");
  if (!overlay) {
    _showNext();
    return;
  }
  overlay.classList.add("tv--exit");
  setTimeout(() => {
    overlay.remove();
    _showNext();
  }, 420);
}
