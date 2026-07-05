/**
 * js/divine-gift.js — Animation "Divine Gift" partagée
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilisée par :
 *   - admin/admin.js (quand l'admin offre des items)
 *   - index.html / profile.html (quand le destinataire reçoit les items)
 *
 * Usage :
 *   import { showDivineGiftAnimation } from '../js/divine-gift.js';
 *   showDivineGiftAnimation(items, 'The Admin has spoken…');
 *
 * items: Array<{ type: 'badge'|'wallpaper'|'title', label: string, img?: string }>
 */

function _esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _typeLabel(type) {
  return { badge: "Badge", wallpaper: "Wallpaper", title: "Titre", stats: "Stats" }[type] || type;
}

function _typeIcon(type) {
  return { badge: "🏅", wallpaper: "🖼️", title: "👑", stats: "📊" }[type] || "🎁";
}

/**
 * Résout les items depuis leurs IDs (fetche les catalogues) puis lance l'animation.
 * Utilisé par les destinataires qui ne reçoivent que { type, id } depuis cloud-sync.
 */
export async function showGiftsFromIds(rawItems, title = "🎁 Gift received!") {
  if (!rawItems?.length) return;

  const prefix = window.location.pathname.startsWith("/personadle") ? "/personadle" : "";
  const lang = window.i18n?.currentLang || "en";
  const get = (url) =>
    fetch(`${prefix}${url}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);

  const [badges, wallpapers, titles] = await Promise.all([
    get(`/api/badges?lang=${lang}`),
    get("/api/wallpapers"),
    get(`/api/titles?lang=${lang}`),
  ]);

  const bySlug = (arr) =>
    Object.fromEntries((Array.isArray(arr) ? arr : []).map((b) => [b.slug, b]));
  const byId = (arr) => Object.fromEntries((Array.isArray(arr) ? arr : []).map((w) => [w.id, w]));
  const badgeMap = bySlug(badges);
  const wallpMap = byId(wallpapers);
  const titleMap = bySlug(titles);

  const fmt = (id) =>
    String(id)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const items = rawItems.map((it) => {
    let label = fmt(it.id);
    let img = null;
    if (it.type === "badge" && badgeMap[it.id]) {
      label = badgeMap[it.id].name || label;
      if (badgeMap[it.id].image_path) img = `${prefix}/${badgeMap[it.id].image_path}`;
    } else if (it.type === "wallpaper" && wallpMap[it.id]) {
      label = wallpMap[it.id].name || label;
      if (wallpMap[it.id].image_path) img = `${prefix}/${wallpMap[it.id].image_path}`;
    } else if (it.type === "title" && titleMap[it.id]) {
      label = titleMap[it.id].name || label;
      if (titleMap[it.id].image_path) img = `${prefix}/${titleMap[it.id].image_path}`;
    }
    return { type: it.type, label, img };
  });

  showDivineGiftAnimation(items, title);
}

export function showDivineGiftAnimation(items, title = "✨ Gift received!") {
  const overlay = document.createElement("div");
  overlay.className = "divine-overlay";

  overlay.innerHTML = `
    <canvas class="divine-particles-canvas"></canvas>
    <div style="position:relative;z-index:2;text-align:center;padding:20px">
      <div class="divine-title">${_esc(title)}</div>
      <div class="divine-cards">
        ${items
          .map(
            (item, i) => `
          <div class="divine-card" style="animation-delay:${i * 100}ms">
            ${
              item.img
                ? `<img src="${_esc(item.img)}" alt="${_esc(item.label)}" onerror="this.style.display='none'">`
                : `<div class="divine-card-icon">${_typeIcon(item.type)}</div>`
            }
            <span>${_esc(item.label)}</span>
            <div class="card-type">${_typeLabel(item.type)}</div>
          </div>
        `
          )
          .join("")}
      </div>
      <div class="divine-dismiss-hint">— Click to close —</div>
    </div>
  `;

  document.body.appendChild(overlay);
  _startParticles(overlay.querySelector(".divine-particles-canvas"));
  requestAnimationFrame(() => overlay.classList.add("show"));

  const dismiss = () => {
    overlay.classList.add("exit");
    setTimeout(() => overlay.remove(), 500);
  };

  overlay.addEventListener("click", dismiss);
  setTimeout(dismiss, 5000);
}

function _startParticles(canvas) {
  if (!canvas) return;
  // Confettis décoratifs — respecte prefers-reduced-motion (une boucle
  // requestAnimationFrame n'est jamais arrêtée par la media query CSS globale,
  // contrairement aux animations CSS — voir css/global.css).
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -400,
    vy: 1.5 + Math.random() * 3,
    vx: (Math.random() - 0.5) * 1.6,
    size: 1.5 + Math.random() * 3.5,
    alpha: 0.6 + Math.random() * 0.4,
    color: Math.random() > 0.4 ? "#ffd700" : Math.random() > 0.5 ? "#fff8dc" : "#fffacd",
  }));

  let running = true;

  (function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.y += p.vy;
      p.x += p.vx;
      p.alpha -= 0.0022;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.y > canvas.height || p.alpha <= 0) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
        p.alpha = 0.6 + Math.random() * 0.4;
      }
    });
    requestAnimationFrame(draw);
  })();

  setTimeout(() => {
    running = false;
  }, 5500);
}
