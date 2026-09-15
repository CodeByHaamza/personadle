/**
 * js/site_notices.js — ce que TOUTE page montre au chargement, d'après /api/auth/me
 * (migration 042) :
 *
 *   - maintenance  : écran plein qui bloque le site pour les joueurs ; l'admin
 *                    connecté voit un simple bandeau (« maintenance active — pense
 *                    à la lever ») et continue de naviguer ;
 *   - announcements : bandeau(x) en haut de page, fermables (mémorisés par id) ;
 *   - notices      : messages de l'équipe à CE joueur (avertissement / info), vus
 *                    une fois puis accusés (PATCH /api/notices/:id) ;
 *   - reset local  : si l'admin a demandé un reset ciblé (reset_local_state_at
 *                    plus récent que notre accusé), on vide l'état local des modes.
 *
 * Appelé par initAuth() (js/auth.js) — donc présent sur toutes les pages sans
 * ajouter un script. Le CSS (css/site_notices.css) est injecté d'ici, pour la
 * même raison. Pas de `data-i18n` : le texte est celui de l'admin (FR/EN) ; les
 * libellés fixes passent par t() avec repli.
 */

import { siteRootPrefix, MODE_STATE_KEYS } from "./gameCore.js";

const DISMISSED_KEY = "dismissedAnnouncements";
const RESET_ACK_KEY = "localResetAckAt";

function t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
function lang() {
  return (window.i18n?.getCurrentLang?.() ?? document.documentElement.lang ?? "en").slice(0, 2);
}
/** Message dans la langue du joueur : FR pour fr, sinon EN si fourni, sinon FR. */
function pick(fr, en) {
  return lang() === "fr" ? fr || en || "" : en || fr || "";
}
/** Date SQL UTC → locale courte. */
function fmtDate(sql) {
  if (!sql) return "";
  const d = new Date(String(sql).replace(" ", "T") + (String(sql).endsWith("Z") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return String(sql);
  try {
    return new Intl.DateTimeFormat(lang(), { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/** Charge css/site_notices.css une seule fois (aucune page n'a à le lier). */
function ensureCss() {
  if (document.getElementById("siteNoticesCss")) return;
  const link = document.createElement("link");
  link.id = "siteNoticesCss";
  link.rel = "stylesheet";
  link.href = `${siteRootPrefix()}css/site_notices.css`;
  document.head.appendChild(link);
}

/** Conteneur des bandeaux (haut de page, sous les éléments fixes). */
function stack() {
  let el = document.getElementById("siteNotices");
  if (!el) {
    el = document.createElement("div");
    el.id = "siteNotices";
    el.className = "site-notices";
    el.setAttribute("aria-live", "polite");
    document.body.prepend(el);
  }
  return el;
}

// ── Maintenance ──────────────────────────────────────────────────────────────

export function showMaintenance(maintenance, { isAdmin = false } = {}) {
  if (!maintenance) return;
  ensureCss();
  const msg = pick(maintenance.message_fr, maintenance.message_en);
  const until = maintenance.until ? fmtDate(maintenance.until) : "";

  if (isAdmin) {
    const el = stack();
    el.insertAdjacentHTML(
      "afterbegin",
      `<div class="site-banner site-banner--maintenance" role="status">
        <span class="site-banner__icon">🔧</span>
        <span class="site-banner__text"><strong>${esc(t("maintenance.admin_banner", "Maintenance mode is ON — players see the maintenance screen."))}</strong>${msg ? ` ${esc(msg)}` : ""}</span>
        <a class="site-banner__link" href="${siteRootPrefix()}admin/index.html">${esc(t("maintenance.admin_link", "Open admin"))}</a>
      </div>`
    );
    return;
  }

  document.getElementById("maintenanceScreen")?.remove();
  const screen = document.createElement("div");
  screen.id = "maintenanceScreen";
  screen.className = "maintenance-screen";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.innerHTML = `
    <div class="maintenance-card">
      <div class="maintenance-card__diamonds" aria-hidden="true"></div>
      <svg class="maintenance-card__pentacle" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="3" />
        <polygon points="100,18 122,76 184,76 134,112 152,172 100,136 48,172 66,112 16,76 78,76" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" />
      </svg>
      <h1 class="maintenance-card__title">🔧 ${esc(t("maintenance.title", "Maintenance in progress"))}</h1>
      <p class="maintenance-card__text">${esc(msg || t("maintenance.default", "The Velvet Room is closed for a moment. We'll be back shortly."))}</p>
      ${until ? `<p class="maintenance-card__until">${esc(t("maintenance.until", "Expected return: {{time}}", { time: until }).replace("{{time}}", until))}</p>` : ""}
      <p class="maintenance-card__hint">${esc(t("maintenance.hint", "Your progress is safe — come back a little later."))}</p>
    </div>`;
  document.body.appendChild(screen);
  document.body.classList.add("maintenance-active");
}

// ── Annonces ─────────────────────────────────────────────────────────────────

function dismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function dismiss(id) {
  const set = dismissed();
  set.add(id);
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set].slice(-50)));
  } catch {
    /* stockage indisponible : le bandeau reviendra, ce n'est pas grave */
  }
}

export function showAnnouncements(list) {
  const items = (list ?? []).filter((a) => !dismissed().has(a.id));
  if (!items.length) return;
  ensureCss();
  const el = stack();
  const ICON = { info: "📣", warning: "⚠️", maintenance: "🔧" };
  for (const a of items) {
    const banner = document.createElement("div");
    banner.className = `site-banner site-banner--${a.level || "info"}`;
    banner.dataset.id = String(a.id);
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <span class="site-banner__icon">${ICON[a.level] ?? "📣"}</span>
      <span class="site-banner__text">${esc(pick(a.message_fr, a.message_en))}${a.ends_at ? ` <span class="site-banner__until">(${esc(t("announce.until", "until {{time}}", { time: fmtDate(a.ends_at) }).replace("{{time}}", fmtDate(a.ends_at)))})</span>` : ""}</span>
      <button type="button" class="site-banner__close" aria-label="${esc(t("ui.close", "Close"))}">✕</button>`;
    banner.querySelector(".site-banner__close").addEventListener("click", () => {
      dismiss(a.id);
      banner.remove();
    });
    el.appendChild(banner);
  }
}

// ── Messages de l'équipe (avertissement / info) ──────────────────────────────

export async function showTeamNotices() {
  const api = window._personadleApi;
  if (!api?.notices?.pending || !window._currentUser) return;
  let data;
  try {
    data = await api.notices.pending();
  } catch {
    return;
  }
  const notices = data?.notices ?? [];
  if (!notices.length) return;
  ensureCss();
  const el = stack();
  for (const n of notices) {
    const card = document.createElement("div");
    card.className = `site-banner site-banner--notice site-banner--${n.type === "info" ? "info" : "warning"}`;
    card.setAttribute("role", "alert");
    card.innerHTML = `
      <span class="site-banner__icon">${n.type === "info" ? "💬" : "⚠️"}</span>
      <span class="site-banner__text"><strong>${esc(t("notice.from_team", "Message from the team"))}</strong> — ${esc(n.message)}</span>
      <button type="button" class="site-banner__close site-banner__ack">${esc(t("notice.ack", "Understood"))}</button>`;
    card.querySelector(".site-banner__ack").addEventListener("click", async () => {
      card.remove();
      try {
        await api.notices.markRead(n.id);
      } catch {
        /* reviendra au prochain chargement, c'est voulu */
      }
    });
    el.appendChild(card);
  }
}

// ── Reset ciblé de l'état local ──────────────────────────────────────────────

/**
 * L'admin a demandé un reset (users.reset_local_state_at) plus récent que notre
 * dernier accusé : on vide l'état local des six modes (normal + Expert) et les
 * cases de défi. Le profil local (stats, badges) n'est PAS touché — c'est le
 * cloud qui en est la source. Retourne true si un reset a été appliqué.
 */
export function applyRemoteLocalReset(resetAt) {
  if (!resetAt) return false;
  const ts = new Date(String(resetAt).replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(ts)) return false;
  const ack = Number(localStorage.getItem(RESET_ACK_KEY) || 0);
  if (ts <= ack) return false;

  // Clés d'état des modes, en normal (nom nu) et en Expert (préfixe du mode +
  // "_" + nom, cf. expertContext().key) — on ne connaît pas les préfixes ici,
  // donc on retire tout ce qui se termine par "_<nom>".
  const names = new Set(Object.values(MODE_STATE_KEYS).flat());
  for (const k of Object.keys(localStorage)) {
    const base = k.includes("_") ? k.slice(k.lastIndexOf("_") + 1) : k;
    if (
      names.has(k) ||
      names.has(base) ||
      /^(gameId_|gameLogged_|guessLog_|activeChallenge)/.test(k) ||
      /lastPlayedDate_/.test(k)
    ) {
      localStorage.removeItem(k);
    }
  }
  localStorage.setItem(RESET_ACK_KEY, String(ts));
  return true;
}

// ── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * @param {object} me  réponse de /api/auth/me : { user, maintenance, announcements, reset_local_state_at }
 */
export function applySiteNotices(me) {
  if (!me) return;
  // L'admin a ses propres panneaux (Annonces, Maintenance) : rien ne se
  // superpose à sa barre d'outils.
  if (window.location.pathname.includes("/admin/")) return;
  const isAdmin = !!me.user?.is_admin;
  showMaintenance(me.maintenance, { isAdmin });
  showAnnouncements(me.announcements);
  if (me.user) {
    if (applyRemoteLocalReset(me.reset_local_state_at)) {
      // L'état de la page courante peut être périmé : on la recharge une fois.
      window.location.reload();
      return;
    }
    showTeamNotices();
  }
}
