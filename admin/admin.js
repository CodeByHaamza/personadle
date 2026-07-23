/**
 * admin/admin.js — PersonaDLE Admin Panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout : left panel = user list (always visible), right panel = user detail.
 * Features : profile edit, avatar reset, badges/wallpapers/titles/stats/friends/
 *            social links management, pending gifts queue, divine gift animation.
 *
 * Access : admin only (window._currentUser.is_admin === true)
 *
 * Panneaux indépendants (pas de couplage avec l'état user-detail ci-dessous) extraits
 * dans leur propre module : ./event-codes.js, ./error-logs.js, ./audit-log.js,
 * ./deletion-requests.js, ./rate-limits.js. Catalogues (badges/wallpapers/titres)
 * dans ./catalogs.js. Client REST + toast + utilitaires dans ./admin-api.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initAuth } from "../js/auth.js";
import { showDivineGiftAnimation } from "../js/divine-gift.js";
import { MODES as CANONICAL_MODES } from "../js/gameCore.js";
import { api, toast, escHtml, pathPrefix } from "./admin-api.js";
import {
  badgesCatalog,
  wallpapersCatalog,
  titlesCatalog,
  loadBadgesCatalog,
  loadWallpapersCatalog,
  loadTitlesCatalog,
} from "./catalogs.js";
import { renderEventCodes } from "./event-codes.js";
import { renderErrorLogs } from "./error-logs.js";
import { renderAuditLog } from "./audit-log.js";
import { renderDeletionRequests } from "./deletion-requests.js";
import { renderRateLimits } from "./rate-limits.js";

// ── State ──────────────────────────────────────────────────────────────────
let _users = [];
let _selectedUser = null;
let _userDetail = null;
let _currentPage = 1;
let _searchQuery = "";
let _activeTab = "profile";
let pendingGifts = [];

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  await initAuth();

  if (!window._currentUser?.is_admin) {
    window.location.href = pathPrefix + "/";
    return;
  }

  document.getElementById("admin-loading").classList.add("hidden");
  document.getElementById("admin-app").classList.remove("hidden");
  document.getElementById("admin-username").textContent = window._currentUser.pseudo;

  await Promise.all([loadBadgesCatalog(), loadWallpapersCatalog(), loadTitlesCatalog()]);

  setupEvents();
  await loadUsers();
}

// ── Mobile aside ───────────────────────────────────────────────────────────
function openAside() {
  document.getElementById("admin-aside").classList.add("open");
  document.getElementById("aside-overlay").classList.add("show");
  document.getElementById("aside-toggle").classList.add("open");
}
function closeAside() {
  document.getElementById("admin-aside").classList.remove("open");
  document.getElementById("aside-overlay").classList.remove("show");
  document.getElementById("aside-toggle").classList.remove("open");
}

// ── Events ─────────────────────────────────────────────────────────────────
function setupEvents() {
  // Home button
  document.getElementById("btn-home").href = pathPrefix + "/";

  // Logout
  document.getElementById("admin-logout").onclick = async () => {
    await fetch(pathPrefix + "/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = pathPrefix + "/";
  };

  // Mobile aside toggle
  document.getElementById("aside-toggle").onclick = () =>
    document.getElementById("admin-aside").classList.contains("open") ? closeAside() : openAside();
  document.getElementById("aside-overlay").onclick = closeAside;

  // Back button (mobile)
  document.getElementById("detail-back").onclick = () => {
    showPanel("empty-state");
    openAside();
  };

  // Search
  let searchTimer;
  document.getElementById("user-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      _searchQuery = e.target.value.trim();
      _currentPage = 1;
      loadUsers();
    }, 300);
  });

  document.querySelectorAll(".detail-tab").forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  document.getElementById("pending-fab").onclick = applyPendingGifts;

  // Event Codes panel
  document.getElementById("btn-codes").onclick = () => {
    showPanel("codes-panel");
    renderEventCodes();
  };

  // Error Logs panel
  document.getElementById("btn-error-logs").onclick = () => {
    showPanel("error-logs-panel");
    renderErrorLogs();
  };

  // Admin Audit Log panel
  document.getElementById("btn-audit-log").onclick = () => {
    showPanel("audit-log-panel");
    renderAuditLog();
  };

  // RGPD Deletion Requests panel
  document.getElementById("btn-deletion-requests").onclick = () => {
    showPanel("deletion-requests-panel");
    renderDeletionRequests();
  };

  // Rate Limits panel
  document.getElementById("btn-rate-limits").onclick = () => {
    showPanel("rate-limits-panel");
    renderRateLimits();
  };
}

// ── Panel visibility (mutually exclusive right-hand panels) ────────────────
const ADMIN_PANEL_IDS = [
  "empty-state",
  "user-detail",
  "codes-panel",
  "error-logs-panel",
  "audit-log-panel",
  "deletion-requests-panel",
  "rate-limits-panel",
];

function showPanel(panelId) {
  ADMIN_PANEL_IDS.forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== panelId);
  });
}

// ── Users List ─────────────────────────────────────────────────────────────
async function loadUsers() {
  const data = await api.get(
    `/api/admin/users?q=${encodeURIComponent(_searchQuery)}&page=${_currentPage}&limit=25`
  );
  _users = data.users || [];

  const countEl = document.getElementById("admin-user-count");
  if (countEl) countEl.textContent = data.total ?? _users.length;

  renderUsersList(_users);
  renderPagination(data.total || 0, data.page || 1, data.limit || 25);
}

function renderUsersList(users) {
  const list = document.getElementById("users-list");

  if (!users.length) {
    list.innerHTML =
      '<div style="padding:20px 16px;font-size:13px;color:var(--text-muted);text-align:center">No users found.</div>';
    return;
  }

  list.innerHTML = users
    .map((u) => {
      const borderColor = escHtml(u.avatar_border_color || "#888");
      const avatarHtml = u.avatar_data
        ? `<img class="user-row-avatar" src="${escHtml(u.avatar_data)}" alt="" style="border-color:${borderColor}">`
        : `<div class="user-row-avatar-ph">👤</div>`;
      const dateStr = new Date(u.created_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });

      return `
      <div class="user-row ${_selectedUser === u.id ? "active" : ""}" data-id="${u.id}">
        ${avatarHtml}
        <div class="user-row-info">
          <div class="user-row-top">
            <span class="user-row-pseudo">${escHtml(u.pseudo)}</span>
            ${u.is_admin ? '<span class="user-row-admin-dot" title="Admin"></span>' : ""}
          </div>
          <div class="user-row-email">${escHtml(u.email)}</div>
        </div>
        <span class="user-row-date">${dateStr}</span>
      </div>
    `;
    })
    .join("");

  list.querySelectorAll(".user-row").forEach((row) => {
    row.onclick = () => openUserDetail(+row.dataset.id);
  });
}

function renderPagination(total, page, limit) {
  const pages = Math.ceil(total / limit);
  const el = document.getElementById("users-pagination");
  if (pages <= 1) {
    el.innerHTML = "";
    return;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  let html = "";

  if (start > 1) html += `<button class="page-btn" data-page="1">1</button>`;
  if (start > 2) html += `<span class="page-btn pagination-sep">…</span>`;
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === page ? "active" : ""}" data-page="${p}">${p}</button>`;
  }
  if (end < pages - 1) html += `<span class="page-btn pagination-sep">…</span>`;
  if (end < pages) html += `<button class="page-btn" data-page="${pages}">${pages}</button>`;

  el.innerHTML = html;
  el.querySelectorAll(".page-btn[data-page]").forEach((btn) => {
    btn.onclick = () => {
      _currentPage = +btn.dataset.page;
      loadUsers();
    };
  });
}

// ── User Detail ────────────────────────────────────────────────────────────
async function openUserDetail(userId) {
  // Highlight selected row
  document
    .querySelectorAll(".user-row")
    .forEach((r) => r.classList.toggle("active", +r.dataset.id === userId));

  // On mobile, close the aside drawer and show the detail panel
  if (window.innerWidth <= 768) closeAside();

  showPanel("user-detail");

  document.getElementById("user-detail-content").innerHTML =
    '<div style="padding:48px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  const data = await api.get(`/api/admin/users/${userId}`);
  _selectedUser = userId;
  _userDetail = data;

  renderDetailHeader(data);
  renderDetailQuickStats(data);
  switchTab("profile");
}

function renderDetailHeader(data) {
  const u = data.user;
  const p = data.profile;

  // Admin badge
  document.getElementById("detail-admin-badge").classList.toggle("hidden", !u.is_admin);

  document.getElementById("detail-pseudo").textContent = u.pseudo;
  document.getElementById("detail-email").textContent = u.email;

  const lastSeen = u.last_login_at
    ? `Last seen ${new Date(u.last_login_at).toLocaleDateString()}`
    : "Never logged in";
  document.getElementById("detail-info").textContent =
    `ID: ${u.id} · Code: ${u.friend_code || "—"} · ${(u.lang || "en").toUpperCase()} · Joined ${new Date(u.created_at).toLocaleDateString()} · ${lastSeen}`;

  // Avatar
  const avatarEl = document.getElementById("detail-avatar");
  const borderColor = escHtml(p?.avatar_border_color || "#ffffff");
  avatarEl.innerHTML = p?.avatar_data
    ? `<img src="${escHtml(p.avatar_data)}" alt="Avatar" style="border:3px solid ${borderColor}">`
    : '<div class="avatar-ph">👤</div>';
}

function renderDetailQuickStats(data) {
  const totalWins = (data.stats || []).reduce((s, r) => s + (r.wins || 0), 0);
  const totalGames = (data.stats || []).reduce((s, r) => s + (r.games || 0), 0);
  const badges = (data.badges || []).length;
  const friends = (data.friends || []).filter((f) => f.status === "accepted").length;
  const social = (data.social_links || []).length;

  document.getElementById("detail-quick-stats").innerHTML = `
    <div class="stat-tile"><div class="stat-tile-value">${totalWins}</div><div class="stat-tile-label">Wins</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${totalGames}</div><div class="stat-tile-label">Games</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${badges}</div><div class="stat-tile-label">Badges</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${friends}</div><div class="stat-tile-label">Friends</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${social}</div><div class="stat-tile-label">S.Links</div></div>
  `;
}

function switchTab(tab) {
  _activeTab = tab;
  document
    .querySelectorAll(".detail-tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

  const d = _userDetail;
  if (!d) return;

  switch (tab) {
    case "profile":
      renderTabProfile(d);
      break;
    case "badges":
      renderTabBadges(d);
      break;
    case "wallpapers":
      renderTabWallpapers(d);
      break;
    case "titles":
      renderTabTitles(d);
      break;
    case "stats":
      renderTabStats(d);
      break;
    case "friends":
      renderTabFriends(d);
      break;
    case "social":
      renderTabSocial(d);
      break;
  }
}

// ── Tab: Profile ───────────────────────────────────────────────────────────
function renderTabProfile(d) {
  const u = d.user;
  const p = d.profile;

  document.getElementById("user-detail-content").innerHTML = `
    <div class="tab-section">
      <h3>Informations du compte</h3>
      <div class="form-grid">
        <label>Pseudo
          <input id="edit-pseudo" type="text" value="${escHtml(u.pseudo)}">
        </label>
        <label>Email
          <input id="edit-email" type="email" value="${escHtml(u.email)}">
        </label>
        <label>Langue
          <select id="edit-lang">
            ${["en", "fr", "es", "de", "it", "pt"].map((l) => `<option ${u.lang === l ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </label>
        <label>Couleur bordure avatar
          <input id="edit-border" type="color" value="${escHtml(p?.avatar_border_color || "#ffffff")}">
        </label>
      </div>
      <div class="admin-toggle-row">
        <input id="edit-admin" type="checkbox" ${u.is_admin ? "checked" : ""}>
        <span>Compte administrateur</span>
        ${u.is_admin ? '<span style="font-size:11px;color:var(--red)">⚡ Décocher pour révoquer les droits admin</span>' : ""}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn-primary" id="save-profile-btn">💾 Sauvegarder</button>
        <button class="btn-secondary" id="reset-avatar-btn">🔄 Reset avatar</button>
      </div>
    </div>

    <div class="tab-section moderation-section">
      <h3>🛡️ Modération</h3>
      <div class="moderation-grid">
        <div class="mod-item">
          <div class="mod-item-label">
            <span>🔒 Verrouiller le pseudo</span>
            <small>L'utilisateur ne pourra plus changer son pseudo</small>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="mod-pseudo-locked" ${u.pseudo_locked ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="mod-item mod-item--ban">
          <div class="mod-item-label">
            <span>🚫 Bannir le compte</span>
            <small>Empêche toute connexion. La session active reste ouverte jusqu'au prochain chargement.</small>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="mod-is-banned" ${u.is_banned ? "checked" : ""}>
            <span class="toggle-slider toggle-slider--red"></span>
          </label>
        </div>
      </div>
      <button class="btn-secondary" id="save-mod-btn" style="margin-top:10px">💾 Appliquer modération</button>
    </div>

    <div class="danger-zone">
      <div class="danger-zone-title">⚠️ Zone dangereuse</div>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
        Suppression définitive et irréversible de toutes les données.
      </p>
      <button class="btn-danger" id="delete-user-btn">🗑️ Supprimer le compte</button>
    </div>
  `;

  // ── Save profile ──────────────────────────────────────────────────────────
  document.getElementById("save-profile-btn").onclick = async () => {
    const btn = document.getElementById("save-profile-btn");
    btn.disabled = true;
    btn.textContent = "…";

    const res = await api.patch(`/api/admin/users/${_selectedUser}`, {
      pseudo: document.getElementById("edit-pseudo").value.trim(),
      email: document.getElementById("edit-email").value.trim(),
      lang: document.getElementById("edit-lang").value,
      avatar_border_color: document.getElementById("edit-border").value,
      is_admin: document.getElementById("edit-admin").checked,
    });

    btn.disabled = false;
    btn.textContent = "💾 Sauvegarder";

    if (res.error) {
      toast("❌ " + res.error, "error");
    } else {
      toast("✅ Profil sauvegardé", "success");
      _userDetail.user = { ..._userDetail.user, ...res.user };
      _userDetail.profile = {
        ..._userDetail.profile,
        avatar_border_color: document.getElementById("edit-border").value,
      };
      renderDetailHeader(_userDetail);

      // Sync user row in list
      const row = document.querySelector(`.user-row[data-id="${_selectedUser}"]`);
      if (row) {
        const pseudoEl = row.querySelector(".user-row-pseudo");
        if (pseudoEl) pseudoEl.textContent = _userDetail.user.pseudo;
        const dotEl = row.querySelector(".user-row-admin-dot");
        if (_userDetail.user.is_admin && !dotEl) {
          row
            .querySelector(".user-row-top")
            ?.insertAdjacentHTML("beforeend", '<span class="user-row-admin-dot"></span>');
        } else if (!_userDetail.user.is_admin && dotEl) {
          dotEl.remove();
        }
      }
    }
  };

  // ── Reset avatar ──────────────────────────────────────────────────────────
  document.getElementById("reset-avatar-btn").onclick = async () => {
    if (!confirm(`Réinitialiser l'avatar de ${u.pseudo} ?`)) return;
    const res = await api.patch(`/api/admin/users/${_selectedUser}`, { reset_avatar: true });
    if (res.error) {
      toast("❌ " + res.error, "error");
    } else {
      toast("✅ Avatar réinitialisé", "success");
      _userDetail.profile.avatar_data = null;
      renderDetailHeader(_userDetail);
      const row = document.querySelector(`.user-row[data-id="${_selectedUser}"]`);
      if (row) {
        const imgEl = row.querySelector(".user-row-avatar");
        if (imgEl) imgEl.outerHTML = '<div class="user-row-avatar-ph">👤</div>';
      }
    }
  };

  // ── Moderation ────────────────────────────────────────────────────────────
  document.getElementById("save-mod-btn").onclick = async () => {
    const btn = document.getElementById("save-mod-btn");
    const isBanned = document.getElementById("mod-is-banned").checked;
    const pseudoLock = document.getElementById("mod-pseudo-locked").checked;
    btn.disabled = true;
    btn.textContent = "…";
    const res = await api.patch(`/api/admin/users/${_selectedUser}`, {
      is_banned: isBanned,
      pseudo_locked: pseudoLock,
    });
    btn.disabled = false;
    btn.textContent = "💾 Appliquer modération";
    if (res.error) {
      toast("❌ " + res.error, "error");
    } else {
      _userDetail.user = { ..._userDetail.user, ...res.user };
      toast(
        isBanned
          ? "🚫 Compte banni"
          : pseudoLock
            ? "🔒 Pseudo verrouillé"
            : "✅ Modération mise à jour",
        isBanned ? "error" : "success"
      );
    }
  };

  // ── Delete account ────────────────────────────────────────────────────────
  document.getElementById("delete-user-btn").onclick = async () => {
    if (
      !confirm(
        `Supprimer DÉFINITIVEMENT le compte de "${u.pseudo}" ?\n\nToutes ses données seront perdues. Cette action est irréversible.`
      )
    )
      return;
    await api.delete(`/api/admin/users/${_selectedUser}`);
    showPanel("empty-state");
    _selectedUser = null;
    _userDetail = null;
    pendingGifts = [];
    updateFab();
    loadUsers();
  };
}

// ── Tab: Badges ────────────────────────────────────────────────────────────
function renderTabBadges(d) {
  const unlockedSlugs = new Set(d.badges || []);

  // Group catalog by category
  const categories = {};
  badgesCatalog.forEach((badge) => {
    const cat = badge.category || "Other";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(badge);
  });

  let sectionsHtml = "";
  Object.keys(categories)
    .sort()
    .forEach((cat) => {
      const badges = categories[cat];
      const catUnlock = badges.filter((b) => unlockedSlugs.has(b.slug)).length;

      sectionsHtml += `<div class="badges-category">
      <div class="badges-category-header">${escHtml(cat)} — ${catUnlock}/${badges.length}</div>
      <div class="badges-grid">
        ${badges
          .map((badge) => {
            const isUnlocked = unlockedSlugs.has(badge.slug);
            const pendingAdd = pendingGifts.some(
              (g) => g.type === "badge" && g.id === badge.slug && g.action === "add"
            );
            const pendingRemove = pendingGifts.some(
              (g) => g.type === "badge" && g.id === badge.slug && g.action === "remove"
            );

            let cls = "badge-item";
            if (isUnlocked && !pendingRemove) cls += " unlocked";
            if (pendingAdd) cls += " pending-add";
            if (pendingRemove) cls += " pending-remove";

            return `
            <div class="${cls}" data-slug="${escHtml(badge.slug)}"
                 title="${escHtml(badge.name_en)}\nRarity: ${badge.rarity}">
              <img src="${pathPrefix}/${escHtml(badge.image_path || "")}" alt="${escHtml(badge.name_en)}" loading="lazy" onerror="this.style.opacity=0.2">
              <span class="badge-label">${escHtml(badge.name_en)}</span>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>`;
    });

  document.getElementById("user-detail-content").innerHTML = `
    <div class="tab-section">
      <h3>Badges — ${unlockedSlugs.size} / ${badgesCatalog.length} débloqués</h3>
      <div class="tab-note">
        🔴 Débloqué · 🟡 En attente d'ajout · Grisé = en attente de retrait<br>
        Cliquer pour basculer l'état. Appliquer via le bouton ⚡ en bas à droite.
      </div>
      ${sectionsHtml || '<p style="color:var(--text-muted)">Catalogue vide.</p>'}
    </div>
  `;

  document.querySelectorAll(".badge-item").forEach((item) => {
    item.onclick = () => toggleBadgePending(item.dataset.slug, unlockedSlugs, d);
  });
}

function toggleBadgePending(slug, unlockedSlugs, d) {
  const badge = badgesCatalog.find((b) => b.slug === slug);
  if (!badge) return;

  const existingAdd = pendingGifts.findIndex(
    (g) => g.type === "badge" && g.id === slug && g.action === "add"
  );
  const existingRem = pendingGifts.findIndex(
    (g) => g.type === "badge" && g.id === slug && g.action === "remove"
  );

  if (!unlockedSlugs.has(slug)) {
    existingAdd >= 0
      ? pendingGifts.splice(existingAdd, 1)
      : pendingGifts.push({
          type: "badge",
          action: "add",
          id: slug,
          label: badge.name_en,
          img: pathPrefix + "/" + badge.image_path,
        });
  } else {
    existingRem >= 0
      ? pendingGifts.splice(existingRem, 1)
      : pendingGifts.push({
          type: "badge",
          action: "remove",
          id: slug,
          label: badge.name_en,
          img: pathPrefix + "/" + badge.image_path,
        });
  }

  updateFab();
  renderTabBadges(d);
}

// ── Tab: Wallpapers ────────────────────────────────────────────────────────
function renderTabWallpapers(d) {
  const unlockedIds = new Set((d.wallpapers || []).map((id) => String(id)));

  document.getElementById("user-detail-content").innerHTML = `
    <div class="tab-section">
      <h3>Wallpapers — ${unlockedIds.size} / ${wallpapersCatalog.length} débloqués</h3>
      <div class="tab-note">
        🔴 Débloqué · 🟡 En attente d'ajout · Grisé = en attente de retrait<br>
        Cliquer pour basculer l'état. Appliquer via le bouton ⚡ en bas à droite.
      </div>
      <div class="wallpapers-grid" id="wallpapers-grid">
        ${!wallpapersCatalog.length ? '<p style="color:var(--text-muted)">Catalogue vide — rechargement en cours…</p>' : ""}
      </div>
    </div>
  `;

  if (!wallpapersCatalog.length) return;

  const grid = document.getElementById("wallpapers-grid");
  grid.innerHTML = wallpapersCatalog
    .map((w) => {
      const wid = String(w.id);
      const isUnlocked = unlockedIds.has(wid);
      const pendingAdd = pendingGifts.some(
        (g) => g.type === "wallpaper" && String(g.id) === wid && g.action === "add"
      );
      const pendingRemove = pendingGifts.some(
        (g) => g.type === "wallpaper" && String(g.id) === wid && g.action === "remove"
      );

      let cls = "wallpaper-item";
      if (isUnlocked && !pendingRemove) cls += " unlocked";
      if (pendingAdd) cls += " pending-add";
      if (pendingRemove) cls += " pending-remove";

      return `
      <div class="${cls}" data-id="${w.id}" title="${escHtml(w.name)}">
        <img src="${pathPrefix}/${escHtml(w.image_path || "")}" alt="${escHtml(w.name)}" loading="lazy">
        <span>${escHtml(w.name)}</span>
      </div>
    `;
    })
    .join("");

  grid.querySelectorAll(".wallpaper-item").forEach((item) => {
    item.onclick = () => toggleWallpaperPending(item.dataset.id, unlockedIds, d);
  });
}

function toggleWallpaperPending(wid, unlockedIds, d) {
  const wall = wallpapersCatalog.find((w) => String(w.id) === String(wid));
  if (!wall) return;

  const isUnlocked = unlockedIds.has(String(wid));
  const existingAdd = pendingGifts.findIndex(
    (g) => g.type === "wallpaper" && String(g.id) === String(wid) && g.action === "add"
  );
  const existingRem = pendingGifts.findIndex(
    (g) => g.type === "wallpaper" && String(g.id) === String(wid) && g.action === "remove"
  );

  if (!isUnlocked) {
    existingAdd >= 0
      ? pendingGifts.splice(existingAdd, 1)
      : pendingGifts.push({
          type: "wallpaper",
          action: "add",
          id: wid,
          label: wall.name,
          img: pathPrefix + "/" + wall.image_path,
        });
  } else {
    existingRem >= 0
      ? pendingGifts.splice(existingRem, 1)
      : pendingGifts.push({
          type: "wallpaper",
          action: "remove",
          id: wid,
          label: wall.name,
          img: pathPrefix + "/" + wall.image_path,
        });
  }

  updateFab();
  renderTabWallpapers(d);
}

// ── Tab: Titles ────────────────────────────────────────────────────────────
function renderTabTitles(d) {
  const unlockedIds = new Set((d.titles || []).map((t) => t.id));
  const equipped = d.profile?.equipped_title_id;

  document.getElementById("user-detail-content").innerHTML = `
    <div class="tab-section">
      <h3>Titres — ${unlockedIds.size} / ${titlesCatalog.length} débloqués</h3>
      <div class="tab-note">
        🔴 Débloqué · 🟡 En attente d'ajout · Grisé = en attente de retrait<br>
        Cliquer pour basculer l'état. Appliquer via le bouton ⚡ en bas à droite.
      </div>
      <div class="titles-grid">
        ${titlesCatalog
          .map((t) => {
            const isUnlocked = unlockedIds.has(t.id);
            const pendingAdd = pendingGifts.some(
              (g) => g.type === "title" && g.id === t.id && g.action === "add"
            );
            const pendingRem = pendingGifts.some(
              (g) => g.type === "title" && g.id === t.id && g.action === "remove"
            );
            const isEquipped = equipped == t.id;

            let cls = "title-card";
            if (isUnlocked && !pendingRem) cls += " unlocked";
            if (pendingAdd) cls += " pending-add";
            if (pendingRem) cls += " pending-remove";

            return `
            <div class="${cls}" data-id="${t.id}">
              ${
                t.image_path
                  ? `<img class="title-card-img" src="${pathPrefix}/${escHtml(t.image_path)}" alt="" loading="lazy" onerror="this.style.display='none'">`
                  : `<div class="title-card-img-ph rarity-${t.rarity}">👑</div>`
              }
              <div class="title-card-rarity rarity-${t.rarity}">${t.rarity.toUpperCase()}</div>
              <div class="title-card-name">${escHtml(t.name_en)}</div>
              ${isEquipped ? '<div class="title-card-equipped">⚡ équipé</div>' : ""}
              ${pendingAdd ? '<div class="title-card-status pending">+ ajout</div>' : ""}
              ${pendingRem ? '<div class="title-card-status remove">− retrait</div>' : ""}
            </div>
          `;
          })
          .join("")}
      </div>

      <div class="titles-equip-section">
        <span style="font-size:12px;color:var(--text-muted)">Équiper :</span>
        <select id="equip-title-select" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);padding:5px 10px;border-radius:6px;font-size:12px;outline:none;flex:1;max-width:260px">
          <option value="">— aucun —</option>
          ${(d.titles || []).map((t) => `<option value="${t.id}" ${equipped == t.id ? "selected" : ""}>${escHtml(t.name_en)} [${t.rarity}]</option>`).join("")}
        </select>
        <button class="btn-primary btn-small" id="equip-title-btn">Équiper</button>
      </div>
    </div>
  `;

  document.getElementById("equip-title-btn").onclick = async () => {
    const val = document.getElementById("equip-title-select").value;
    const res = await api.patch(`/api/admin/users/${_selectedUser}/titles/equip`, {
      title_id: val ? +val : null,
    });
    if (res.error) {
      toast("❌ " + res.error, "error");
    } else {
      toast("✅ Titre équipé", "success");
      _userDetail.profile = { ..._userDetail.profile, equipped_title_id: val ? +val : null };
    }
  };

  document.querySelectorAll(".title-card").forEach((item) => {
    item.onclick = () => toggleTitlePending(+item.dataset.id, unlockedIds, d);
  });
}

function toggleTitlePending(tid, unlockedIds, d) {
  const title = titlesCatalog.find((t) => t.id === tid);
  if (!title) return;

  const existingAdd = pendingGifts.findIndex(
    (g) => g.type === "title" && g.id === tid && g.action === "add"
  );
  const existingRem = pendingGifts.findIndex(
    (g) => g.type === "title" && g.id === tid && g.action === "remove"
  );

  if (!unlockedIds.has(tid)) {
    existingAdd >= 0
      ? pendingGifts.splice(existingAdd, 1)
      : pendingGifts.push({ type: "title", action: "add", id: tid, label: title.name_en });
  } else {
    existingRem >= 0
      ? pendingGifts.splice(existingRem, 1)
      : pendingGifts.push({ type: "title", action: "remove", id: tid, label: title.name_en });
  }

  updateFab();
  renderTabTitles(d);
}

// ── Tab: Stats ─────────────────────────────────────────────────────────────
function renderTabStats(d) {
  // Liste des clés dérivée de la source canonique (gameCore.js) — seuls les libellés
  // avec emoji ci-dessous restent propres à cet onglet admin.
  const modes = CANONICAL_MODES.map((m) => m.key);
  const labels = {
    classic: "🃏 Classic",
    emoji: "😀 Emoji",
    silhouette: "👤 Silhouette",
    alloutattack: "💥 All-Out",
    personae: "🎭 Personae",
    music: "🎵 Music",
  };
  const statsMap = {};
  (d.stats || []).forEach((s) => {
    statsMap[s.mode] = s;
  });

  document.getElementById("user-detail-content").innerHTML = `
    <div class="tab-section">
      <h3>Statistiques par mode</h3>
      <div class="tab-note">Modifier les valeurs puis cliquer Save sur chaque ligne.</div>
      <div style="overflow-x:auto">
        <table class="stats-table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Wins</th>
              <th>Give-ups</th>
              <th>Games</th>
              <th>Streak</th>
              <th>Streak Max</th>
              <th>Perfect</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${modes
              .map((mode) => {
                const s = statsMap[mode] || {
                  wins: 0,
                  giveups: 0,
                  games: 0,
                  streak: 0,
                  streak_record: 0,
                  perfect_wins: 0,
                };
                return `<tr data-mode="${mode}">
                <td><strong style="font-family:Oswald,sans-serif;font-size:13px">${labels[mode]}</strong></td>
                <td><input type="number" min="0" class="stat-input" data-field="wins"          value="${s.wins}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="giveups"       value="${s.giveups}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="games"         value="${s.games}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="streak"        value="${s.streak}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="streak_record" value="${s.streak_record}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="perfect_wins"  value="${s.perfect_wins}"></td>
                <td><button class="btn-secondary btn-small save-stats-btn">Save</button></td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll(".save-stats-btn").forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest("tr");
      const mode = row.dataset.mode;
      const payload = {};
      row.querySelectorAll(".stat-input").forEach((inp) => {
        payload[inp.dataset.field] = +inp.value;
      });

      btn.textContent = "…";
      btn.disabled = true;
      const res = await api.patch(`/api/admin/users/${_selectedUser}/stats`, { mode, ...payload });
      btn.disabled = false;
      btn.textContent = "Save";

      if (res.error) {
        toast("❌ Stats — " + res.error, "error");
      } else {
        toast("✅ Stats " + labels[mode] + " sauvegardées", "success");
        const idx = (_userDetail.stats || []).findIndex((s) => s.mode === mode);
        if (idx >= 0) _userDetail.stats[idx] = { ..._userDetail.stats[idx], mode, ...payload };
        else _userDetail.stats = [...(_userDetail.stats || []), { mode, ...payload }];
        renderDetailQuickStats(_userDetail);
      }
    };
  });
}

// ── Tab: Friends ───────────────────────────────────────────────────────────
function renderTabFriends(d) {
  const friends = d.friends || [];
  const accepted = friends.filter((f) => f.status === "accepted");
  const pending = friends.filter((f) => f.status === "pending");

  const friendRowHtml = (f) => `
    <div class="friend-row" data-fid="${f.friendship_id}">
      ${
        f.avatar_data
          ? `<img src="${escHtml(f.avatar_data)}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0">`
          : '<div style="width:38px;height:38px;border-radius:50%;background:var(--bg);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px">👤</div>'
      }
      <div style="flex:1;min-width:0">
        <strong style="font-size:13px">${escHtml(f.pseudo)}</strong>
        <div style="font-size:11px;color:var(--text-muted)">
          ${f.status === "pending" ? "⏳ En attente" : "✅ Ami"} · ID ${f.user_id} · ${new Date(f.created_at).toLocaleDateString()}
        </div>
      </div>
      <button class="btn-danger btn-small remove-friend-btn" data-fid="${f.friendship_id}">🗑️</button>
    </div>
  `;

  document.getElementById("user-detail-content").innerHTML = `
    <div class="tab-section">
      <h3>Amis — ${accepted.length} amis · ${pending.length} en attente</h3>
      ${
        !friends.length
          ? '<p style="color:var(--text-muted)">Aucune relation d\'amitié.</p>'
          : accepted.map(friendRowHtml).join("") +
            (pending.length
              ? `<div style="margin:14px 0 8px;font-size:11px;color:var(--text-muted);font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:1px">En attente</div>` +
                pending.map(friendRowHtml).join("")
              : "")
      }
    </div>
  `;

  document.querySelectorAll(".remove-friend-btn").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Supprimer cette relation d'amitié ?")) return;
      const fid = btn.dataset.fid;
      const res = await api.delete(`/api/admin/users/${_selectedUser}/friends/${fid}`);
      if (!res.error) {
        btn.closest(".friend-row").remove();
        _userDetail.friends = _userDetail.friends.filter(
          (f) => String(f.friendship_id) !== String(fid)
        );
        renderDetailQuickStats(_userDetail);
      }
    };
  });
}

// ── Tab: Social Links ──────────────────────────────────────────────────────
function renderTabSocial(d) {
  const links = d.social_links || [];
  const rankNames = [
    "",
    "Stranger",
    "Acquaintance",
    "Companion",
    "Ally",
    "Confidant",
    "Trusted Ally",
    "True Ally",
    "Bond",
    "Unbreakable Bond",
    "True Confidant",
  ];
  const rankColor = (r) => (r >= 10 ? "legendary" : r >= 7 ? "epic" : r >= 4 ? "rare" : "common");

  document.getElementById("user-detail-content").innerHTML = `
    <div class="tab-section">
      <h3>Social Links — ${links.length} relation${links.length !== 1 ? "s" : ""}</h3>
      ${
        !links.length
          ? '<p style="color:var(--text-muted)">Aucun Social Link pour cet utilisateur.</p>'
          : `<div style="overflow-x:auto">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Ami</th>
                  <th>Rang</th>
                  <th>XP</th>
                  <th>Interactions</th>
                  <th>Dernier contact</th>
                  <th>Nouveau rang</th>
                  <th>Nouvel XP</th>
                  <th style="min-width:160px"></th>
                </tr>
              </thead>
              <tbody>
                ${links
                  .map(
                    (sl) => `
                  <tr data-slid="${sl.id}">
                    <td>
                      <strong style="font-size:13px">${escHtml(sl.pseudo)}</strong><br>
                      <span style="font-size:10px;color:var(--text-muted)">#${sl.other_user_id}</span>
                    </td>
                    <td>
                      <span class="rarity-${rankColor(sl.rank)}">${sl.rank}</span><br>
                      <span style="font-size:10px;color:var(--text-muted)">${rankNames[sl.rank] || ""}</span>
                    </td>
                    <td>${sl.xp.toLocaleString()}</td>
                    <td style="text-align:center">${sl.interaction_count}</td>
                    <td style="font-size:11px;color:var(--text-muted)">
                      ${sl.last_interaction_at ? new Date(sl.last_interaction_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td>
                      <select class="sl-rank-input" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:4px 8px;border-radius:4px;font-size:12px;outline:none">
                        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => `<option value="${r}" ${r === sl.rank ? "selected" : ""}>${r} – ${rankNames[r]}</option>`).join("")}
                      </select>
                    </td>
                    <td>
                      <input type="number" class="sl-xp-input" min="0" value="${sl.xp}"
                             style="width:80px;background:transparent;border:1px solid var(--border);color:var(--text);padding:4px 7px;border-radius:4px;font-size:12px;outline:none">
                    </td>
                    <td>
                      <div style="display:flex;gap:4px;flex-wrap:wrap">
                        <button class="btn-secondary btn-small save-sl-btn">Save</button>
                        <button class="btn-secondary btn-small delete-sl-btn" style="color:#ef4444" title="Supprimer ce Social Link">✕</button>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
      }
    </div>
  `;

  // ── Save (rank + xp) ──────────────────────────────────────────────────────
  document.querySelectorAll(".save-sl-btn").forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest("tr");
      const slId = row.dataset.slid;
      const rank = +row.querySelector(".sl-rank-input").value;
      const xp = +row.querySelector(".sl-xp-input").value;
      btn.textContent = "…";
      btn.disabled = true;
      const res = await api.patch(`/api/admin/social-links/${slId}`, { rank, xp });
      btn.disabled = false;
      btn.textContent = "Save";
      if (res.error) {
        toast("❌ Social Link — " + res.error, "error");
      } else {
        toast("✅ Social Link mis à jour", "success");
        const sl = _userDetail.social_links.find((s) => String(s.id) === String(slId));
        if (sl) {
          sl.rank = rank;
          sl.xp = xp;
        }
      }
    };
  });

  // ── Delete social link ────────────────────────────────────────────────────
  document.querySelectorAll(".delete-sl-btn").forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest("tr");
      const slId = row.dataset.slid;
      const pseudo = row.querySelector("strong")?.textContent || "?";
      if (
        !confirm(
          `Supprimer définitivement le Social Link avec ${pseudo} ?\nCette action est irréversible (interactions, badge, notifs supprimés).`
        )
      )
        return;
      btn.textContent = "…";
      btn.disabled = true;
      const res = await api.delete(`/api/admin/social-links/${slId}`);
      if (res.error) {
        toast("❌ " + res.error, "error");
        btn.disabled = false;
        btn.textContent = "✕";
      } else {
        toast("✅ Social Link supprimé", "success");
        _userDetail.social_links = _userDetail.social_links.filter(
          (s) => String(s.id) !== String(slId)
        );
        renderTabSocial(_userDetail);
      }
    };
  });
}

// ── Pending Gifts Queue ────────────────────────────────────────────────────
function updateFab() {
  const fab = document.getElementById("pending-fab");
  const countEl = document.getElementById("pending-count");
  const count = pendingGifts.length;
  if (countEl) countEl.textContent = count;
  fab.classList.toggle("hidden", count === 0);
}

async function applyPendingGifts() {
  if (!pendingGifts.length || !_selectedUser) return;

  const fab = document.getElementById("pending-fab");
  fab.disabled = true;
  fab.textContent = "⚡ Application…";

  const results = await Promise.allSettled(
    pendingGifts.map((gift) => {
      if (gift.type === "badge")
        return gift.action === "add"
          ? api.post(`/api/admin/users/${_selectedUser}/badges`, { slug: gift.id })
          : api.delete(`/api/admin/users/${_selectedUser}/badges/${gift.id}`);
      if (gift.type === "wallpaper")
        return gift.action === "add"
          ? api.post(`/api/admin/users/${_selectedUser}/wallpapers`, { wallpaper_id: gift.id })
          : api.delete(`/api/admin/users/${_selectedUser}/wallpapers/${gift.id}`);
      if (gift.type === "title")
        return gift.action === "add"
          ? api.post(`/api/admin/users/${_selectedUser}/titles`, { title_id: gift.id })
          : api.delete(`/api/admin/users/${_selectedUser}/titles/${gift.id}`);
      return Promise.resolve({ ok: true });
    })
  );

  // Refresh user detail from server
  _userDetail = await api.get(`/api/admin/users/${_selectedUser}`);
  renderDetailHeader(_userDetail);
  renderDetailQuickStats(_userDetail);

  // Show animation for any successful adds (partial success is fine)
  const successfulAdds = pendingGifts.filter(
    (g, i) => g.action === "add" && results[i]?.status === "fulfilled" && !results[i].value?.error
  );
  if (successfulAdds.length > 0) showDivineGiftAnimation(successfulAdds, "The Admin has spoken…");

  pendingGifts = [];
  fab.disabled = false;
  fab.innerHTML = '⚡ Appliquer les dons (<span id="pending-count">0</span>)';
  updateFab();

  switchTab(_activeTab);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
init();
