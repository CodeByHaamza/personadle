/**
 * admin/admin.js — PersonaDLE Admin Panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Panneau d'administration frontend.
 * Fonctionnalités :
 *   - Liste des utilisateurs avec recherche et pagination
 *   - Vue détaillée par user : profil, badges, wallpapers, titres, stats, amis, social links
 *   - Système de "dons en attente" (pendingGifts) pour grouper les modifications
 *   - Animation divine lors de l'application des dons
 *
 * Accès : réservé aux admins (window._currentUser.is_admin === true)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initAuth } from '../js/auth.js';

// ── State ──────────────────────────────────────────────────────────────────
let _users        = [];
let _selectedUser = null;
let _userDetail   = null;   // données complètes du user sélectionné
let _currentPage  = 1;
let _searchQuery  = '';
let _activeTab    = 'profile';
let pendingGifts  = [];     // file d'attente des dons à appliquer

// Catalogues chargés une seule fois au démarrage
let _badgesCatalog     = [];
let _wallpapersCatalog = [];
let _titlesCatalog     = [];

// ── API Helper ─────────────────────────────────────────────────────────────
const api = {
  get:    (url)       => fetch(url, { credentials: 'include' })
                           .then(r => r.json()),
  post:   (url, body) => fetch(url, { method: 'POST',   credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                           .then(r => r.json()),
  patch:  (url, body) => fetch(url, { method: 'PATCH',  credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                           .then(r => r.json()),
  delete: (url)       => fetch(url, { method: 'DELETE', credentials: 'include' })
                           .then(r => r.json()),
};

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  await initAuth();

  if (!window._currentUser?.is_admin) {
    // Non admin ou non connecté → redirect accueil
    window.location.href = '/';
    return;
  }

  document.getElementById('admin-loading').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  document.getElementById('admin-username').textContent = window._currentUser.pseudo;

  // Charger les catalogues en parallèle avant d'afficher quoi que ce soit
  await Promise.all([
    loadBadgesCatalog(),
    loadWallpapersCatalog(),
    loadTitlesCatalog(),
  ]);

  setupEvents();
  await loadUsers();
}

// ── Event setup ────────────────────────────────────────────────────────────
function setupEvents() {
  // Logout
  document.getElementById('admin-logout').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };

  // Recherche avec debounce 300ms
  let searchTimer;
  document.getElementById('user-search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      _searchQuery = e.target.value.trim();
      _currentPage = 1;
      loadUsers();
    }, 300);
  });

  // Retour à la liste
  document.getElementById('back-to-list').onclick = () => showUsersList();

  // Tabs
  document.querySelectorAll('.detail-tab').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  // FAB appliquer les dons
  document.getElementById('pending-fab').onclick = applyPendingGifts;
}

// ── Users List ─────────────────────────────────────────────────────────────
async function loadUsers() {
  const data = await api.get(`/api/admin/users?q=${encodeURIComponent(_searchQuery)}&page=${_currentPage}&limit=20`);
  _users = data.users || [];
  renderUsersGrid(_users);
  renderPagination(data.total || 0, data.page || 1, data.limit || 20);
}

function renderUsersGrid(users) {
  const grid = document.getElementById('users-grid');
  if (!users.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:20px 0">No users found.</p>';
    return;
  }

  grid.innerHTML = users.map(u => `
    <div class="user-card" data-id="${u.id}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        ${u.avatar_data
          ? `<img src="${u.avatar_data}" class="user-card-avatar" style="border:2px solid ${escHtml(u.avatar_border_color || '#ffffff')}">`
          : `<div class="user-card-avatar" style="background:var(--bg);border:2px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">👤</div>`}
        <div>
          <strong style="font-size:15px">${escHtml(u.pseudo)}</strong>
          ${u.is_admin ? '<span style="color:var(--red);font-size:11px;margin-left:6px;font-family:Oswald,sans-serif">ADMIN</span>' : ''}
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(u.email)}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted)">
        Code: ${escHtml(u.friend_code || '—')} · ${(u.lang || 'en').toUpperCase()} · ${new Date(u.created_at).toLocaleDateString()}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.user-card').forEach(card => {
    card.onclick = () => openUserDetail(+card.dataset.id);
  });
}

function renderPagination(total, page, limit) {
  const pages = Math.ceil(total / limit);
  const el    = document.getElementById('users-pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }

  el.innerHTML = Array.from({ length: pages }, (_, i) => i + 1).map(p =>
    `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
  ).join('');

  el.querySelectorAll('.page-btn').forEach(btn => {
    btn.onclick = () => { _currentPage = +btn.dataset.page; loadUsers(); };
  });
}

// ── User Detail ────────────────────────────────────────────────────────────
async function openUserDetail(userId) {
  document.getElementById('section-users').classList.add('hidden');
  document.getElementById('user-detail').classList.remove('hidden');

  // Afficher un spinner dans le contenu en attendant
  document.getElementById('user-detail-content').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  const data    = await api.get(`/api/admin/users/${userId}`);
  _selectedUser = userId;
  _userDetail   = data;

  // ── Header ──
  const u = data.user;
  const p = data.profile;

  document.getElementById('detail-pseudo').textContent = u.pseudo + (u.is_admin ? ' ⚡' : '');
  document.getElementById('detail-email').textContent  = u.email;
  document.getElementById('detail-info').textContent   = `ID: ${u.id} · ${u.friend_code || '—'} · Joined ${new Date(u.created_at).toLocaleDateString()}`;

  const avatarEl = document.getElementById('detail-avatar');
  avatarEl.innerHTML = p?.avatar_data
    ? `<img src="${p.avatar_data}" style="width:64px;height:64px;border-radius:50%;border:3px solid ${escHtml(p.avatar_border_color || '#ffffff')}">`
    : '<div style="width:64px;height:64px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:28px">👤</div>';

  switchTab('profile');
}

function showUsersList() {
  _selectedUser = null;
  _userDetail   = null;
  pendingGifts  = [];
  updateFab();
  document.getElementById('user-detail').classList.add('hidden');
  document.getElementById('section-users').classList.remove('hidden');
}

function switchTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('.detail-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  const d = _userDetail;
  if (!d) return;

  switch (tab) {
    case 'profile':    renderTabProfile(d);    break;
    case 'badges':     renderTabBadges(d);     break;
    case 'wallpapers': renderTabWallpapers(d); break;
    case 'titles':     renderTabTitles(d);     break;
    case 'stats':      renderTabStats(d);      break;
    case 'friends':    renderTabFriends(d);    break;
    case 'social':     renderTabSocial(d);     break;
  }
}

// ── Tab: Profile ───────────────────────────────────────────────────────────
function renderTabProfile(d) {
  const u = d.user;
  const p = d.profile;

  document.getElementById('user-detail-content').innerHTML = `
    <div class="tab-section">
      <h3>Informations</h3>
      <div class="form-grid">
        <label>Pseudo
          <input id="edit-pseudo" type="text" value="${escHtml(u.pseudo)}">
        </label>
        <label>Email
          <input id="edit-email" type="email" value="${escHtml(u.email)}">
        </label>
        <label>Langue
          <select id="edit-lang">
            ${['en','fr','es','de','it'].map(l => `<option ${u.lang === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
        <label>Couleur bordure avatar
          <input id="edit-border" type="color" value="${escHtml(p?.avatar_border_color || '#ffffff')}">
        </label>
      </div>
      <label style="display:flex;align-items:center;gap:10px;margin:16px 0;cursor:pointer">
        <input id="edit-admin" type="checkbox" ${u.is_admin ? 'checked' : ''}>
        <span>Administrateur</span>
      </label>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn-primary" id="save-profile-btn">Sauvegarder</button>
        <button class="btn-danger"  id="delete-user-btn">Supprimer le compte</button>
      </div>
      <div id="profile-save-msg" style="margin-top:10px;font-size:13px"></div>
    </div>
  `;

  document.getElementById('save-profile-btn').onclick = async () => {
    const msg = document.getElementById('profile-save-msg');
    msg.textContent = 'Sauvegarde…';
    msg.style.color = 'var(--text-muted)';

    const res = await api.patch(`/api/admin/users/${_selectedUser}`, {
      pseudo:              document.getElementById('edit-pseudo').value.trim(),
      email:               document.getElementById('edit-email').value.trim(),
      lang:                document.getElementById('edit-lang').value,
      avatar_border_color: document.getElementById('edit-border').value,
      is_admin:            document.getElementById('edit-admin').checked,
    });

    if (res.error) {
      msg.textContent = '❌ ' + res.error;
      msg.style.color = 'var(--red)';
    } else {
      msg.textContent = '✅ Sauvegardé';
      msg.style.color = '#4ade80';
      // Mettre à jour l'état local
      _userDetail.user = { ..._userDetail.user, ...res.user };
      document.getElementById('detail-pseudo').textContent = _userDetail.user.pseudo + (_userDetail.user.is_admin ? ' ⚡' : '');
    }
  };

  document.getElementById('delete-user-btn').onclick = async () => {
    if (!confirm(`Supprimer DÉFINITIVEMENT le compte de ${u.pseudo} ?\n\nCette action est irréversible.`)) return;
    await api.delete(`/api/admin/users/${_selectedUser}`);
    showUsersList();
    loadUsers();
  };
}

// ── Tab: Badges ────────────────────────────────────────────────────────────
function renderTabBadges(d) {
  const unlockedSlugs = new Set(d.badges || []);

  document.getElementById('user-detail-content').innerHTML = `
    <div class="tab-section">
      <h3>Badges (${unlockedSlugs.size} / ${_badgesCatalog.length} débloqués)</h3>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
        Cliquer sur un badge pour l'ajouter/retirer de la file d'attente.
        Appliquer via le bouton ⚡ en bas à droite.
      </p>
      <div class="badges-grid" id="badges-grid"></div>
    </div>
  `;

  const grid = document.getElementById('badges-grid');
  grid.innerHTML = _badgesCatalog.map(badge => {
    const isUnlocked    = unlockedSlugs.has(badge.slug);
    const pendingAdd    = pendingGifts.some(g => g.type === 'badge' && g.id === badge.slug && g.action === 'add');
    const pendingRemove = pendingGifts.some(g => g.type === 'badge' && g.id === badge.slug && g.action === 'remove');

    let cls = 'badge-item';
    if (isUnlocked && !pendingRemove) cls += ' unlocked';
    if (pendingAdd)    cls += ' pending-add';
    if (pendingRemove) cls += ' pending-remove';

    return `
      <div class="${cls}" data-slug="${escHtml(badge.slug)}"
           title="${escHtml(badge.name_en)}\n${escHtml(badge.category || '')} · ${badge.rarity}">
        <img src="/${escHtml(badge.image_path || '')}" alt="${escHtml(badge.name_en)}" loading="lazy" onerror="this.style.opacity=0.3">
        <span class="badge-label">${escHtml(badge.name_en)}</span>
        <span class="rarity-${badge.rarity}" style="font-size:9px">${badge.rarity}</span>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.badge-item').forEach(item => {
    item.onclick = () => toggleBadgePending(item.dataset.slug, unlockedSlugs, d);
  });
}

function toggleBadgePending(slug, unlockedSlugs, d) {
  const badge = _badgesCatalog.find(b => b.slug === slug);
  if (!badge) return;

  const existingAdd    = pendingGifts.findIndex(g => g.type === 'badge' && g.id === slug && g.action === 'add');
  const existingRemove = pendingGifts.findIndex(g => g.type === 'badge' && g.id === slug && g.action === 'remove');
  const isUnlocked     = unlockedSlugs.has(slug);

  if (!isUnlocked) {
    // Pas débloqué → mise en file d'ajout (ou annulation)
    if (existingAdd >= 0) {
      pendingGifts.splice(existingAdd, 1);
    } else {
      pendingGifts.push({ type: 'badge', action: 'add', id: slug, label: badge.name_en, img: '/' + badge.image_path });
    }
  } else {
    // Déjà débloqué → mise en file de retrait (ou annulation)
    if (existingRemove >= 0) {
      pendingGifts.splice(existingRemove, 1);
    } else {
      pendingGifts.push({ type: 'badge', action: 'remove', id: slug, label: badge.name_en, img: '/' + badge.image_path });
    }
  }

  updateFab();
  renderTabBadges(d);
}

// ── Tab: Wallpapers ────────────────────────────────────────────────────────
function renderTabWallpapers(d) {
  const unlockedIds = new Set((d.wallpapers || []).map(id => String(id)));

  document.getElementById('user-detail-content').innerHTML = `
    <div class="tab-section">
      <h3>Wallpapers</h3>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
        Les wallpapers par défaut ne sont pas affichés. Cliquer pour ajouter/retirer.
      </p>
      <div class="wallpapers-grid" id="wallpapers-grid"></div>
    </div>
  `;

  const grid     = document.getElementById('wallpapers-grid');
  const unlockable = _wallpapersCatalog.filter(w => !w.is_default);

  if (!unlockable.length) {
    grid.innerHTML = '<p style="color:var(--text-muted)">Aucun wallpaper débloquable.</p>';
    return;
  }

  grid.innerHTML = unlockable.map(w => {
    const wid           = String(w.id);
    const isUnlocked    = unlockedIds.has(wid);
    const pendingAdd    = pendingGifts.some(g => g.type === 'wallpaper' && String(g.id) === wid && g.action === 'add');
    const pendingRemove = pendingGifts.some(g => g.type === 'wallpaper' && String(g.id) === wid && g.action === 'remove');

    let cls = 'wallpaper-item';
    if (isUnlocked && !pendingRemove) cls += ' unlocked';
    if (pendingAdd)    cls += ' pending-add';
    if (pendingRemove) cls += ' pending-remove';

    return `
      <div class="${cls}" data-id="${w.id}" title="${escHtml(w.name)}">
        <img src="/${escHtml(w.image_path || '')}" alt="${escHtml(w.name)}" loading="lazy" onerror="this.src=''">
        <span>${escHtml(w.name)}</span>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.wallpaper-item').forEach(item => {
    item.onclick = () => toggleWallpaperPending(item.dataset.id, unlockedIds, d);
  });
}

function toggleWallpaperPending(wid, unlockedIds, d) {
  const wall = _wallpapersCatalog.find(w => String(w.id) === String(wid));
  if (!wall) return;

  const isUnlocked  = unlockedIds.has(String(wid));
  const existingAdd = pendingGifts.findIndex(g => g.type === 'wallpaper' && String(g.id) === String(wid) && g.action === 'add');
  const existingRem = pendingGifts.findIndex(g => g.type === 'wallpaper' && String(g.id) === String(wid) && g.action === 'remove');

  if (!isUnlocked) {
    existingAdd >= 0
      ? pendingGifts.splice(existingAdd, 1)
      : pendingGifts.push({ type: 'wallpaper', action: 'add', id: wid, label: wall.name, img: '/' + wall.image_path });
  } else {
    existingRem >= 0
      ? pendingGifts.splice(existingRem, 1)
      : pendingGifts.push({ type: 'wallpaper', action: 'remove', id: wid, label: wall.name, img: '/' + wall.image_path });
  }

  updateFab();
  renderTabWallpapers(d);
}

// ── Tab: Titles ────────────────────────────────────────────────────────────
function renderTabTitles(d) {
  const unlockedIds = new Set((d.titles || []).map(t => t.id));
  const equipped    = d.profile?.equipped_title_id;

  document.getElementById('user-detail-content').innerHTML = `
    <div class="tab-section">
      <h3>Titres</h3>
      <div style="margin-bottom:20px;padding:14px;background:var(--bg3);border-radius:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label style="font-size:13px;color:var(--text-muted)">Titre équipé :</label>
        <select id="equip-title-select" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);padding:6px 12px;border-radius:6px;font-size:13px;outline:none">
          <option value="">— aucun —</option>
          ${(d.titles || []).map(t => `<option value="${t.id}" ${equipped == t.id ? 'selected' : ''}>${escHtml(t.name_en)}</option>`).join('')}
        </select>
        <button class="btn-secondary" id="equip-title-btn">Équiper</button>
        <span id="equip-title-msg" style="font-size:12px"></span>
      </div>
      <div class="titles-list" id="titles-list"></div>
    </div>
  `;

  document.getElementById('equip-title-btn').onclick = async () => {
    const val = document.getElementById('equip-title-select').value;
    const msg = document.getElementById('equip-title-msg');
    const res = await api.patch(`/api/admin/users/${_selectedUser}/titles/equip`, { title_id: val ? +val : null });
    if (res.error) {
      msg.textContent = '❌ ' + res.error;
      msg.style.color = 'var(--red)';
    } else {
      msg.textContent = '✅ Équipé';
      msg.style.color = '#4ade80';
      _userDetail.profile = { ..._userDetail.profile, equipped_title_id: val ? +val : null };
      setTimeout(() => { msg.textContent = ''; }, 2500);
    }
  };

  const list = document.getElementById('titles-list');
  list.innerHTML = _titlesCatalog.map(t => {
    const isUnlocked = unlockedIds.has(t.id);
    const pendingAdd = pendingGifts.some(g => g.type === 'title' && g.id === t.id && g.action === 'add');
    const pendingRem = pendingGifts.some(g => g.type === 'title' && g.id === t.id && g.action === 'remove');

    const isEquipped = equipped == t.id;
    let cls = 'title-item';
    if (isUnlocked && !pendingRem) cls += ' unlocked';
    if (pendingAdd) cls += ' pending-add';
    if (pendingRem) cls += ' pending-remove';

    return `
      <div class="${cls}" data-id="${t.id}"
           style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;margin-bottom:6px;background:var(--bg3);cursor:pointer">
        <div>
          <span class="rarity-${t.rarity}">[${t.rarity.toUpperCase()}]</span>
          <strong style="margin-left:8px">${escHtml(t.name_en)}</strong>
          ${t.slug ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px">${escHtml(t.slug)}</span>` : ''}
          ${isEquipped ? '<span style="font-size:11px;color:var(--gold);margin-left:8px">⚡ équipé</span>' : ''}
        </div>
        <span style="font-size:20px">
          ${pendingRem ? '🗑️' : pendingAdd ? '⏳' : isUnlocked ? '✅' : '➕'}
        </span>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.title-item').forEach(item => {
    item.onclick = () => toggleTitlePending(+item.dataset.id, unlockedIds, d);
  });
}

function toggleTitlePending(tid, unlockedIds, d) {
  const title = _titlesCatalog.find(t => t.id === tid);
  if (!title) return;

  const isUnlocked  = unlockedIds.has(tid);
  const existingAdd = pendingGifts.findIndex(g => g.type === 'title' && g.id === tid && g.action === 'add');
  const existingRem = pendingGifts.findIndex(g => g.type === 'title' && g.id === tid && g.action === 'remove');

  if (!isUnlocked) {
    existingAdd >= 0
      ? pendingGifts.splice(existingAdd, 1)
      : pendingGifts.push({ type: 'title', action: 'add', id: tid, label: title.name_en });
  } else {
    existingRem >= 0
      ? pendingGifts.splice(existingRem, 1)
      : pendingGifts.push({ type: 'title', action: 'remove', id: tid, label: title.name_en });
  }

  updateFab();
  renderTabTitles(d);
}

// ── Tab: Stats ─────────────────────────────────────────────────────────────
function renderTabStats(d) {
  const modes    = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
  const statsMap = {};
  (d.stats || []).forEach(s => { statsMap[s.mode] = s; });

  document.getElementById('user-detail-content').innerHTML = `
    <div class="tab-section">
      <h3>Statistiques par mode</h3>
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${modes.map(mode => {
              const s = statsMap[mode] || { wins: 0, giveups: 0, games: 0, streak: 0, streak_record: 0, perfect_wins: 0, total_time_ms: 0 };
              return `<tr data-mode="${mode}">
                <td><strong style="font-family:Oswald,sans-serif;text-transform:capitalize">${mode}</strong></td>
                <td><input type="number" min="0" class="stat-input" data-field="wins"          value="${s.wins}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="giveups"       value="${s.giveups}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="games"         value="${s.games}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="streak"        value="${s.streak}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="streak_record" value="${s.streak_record}"></td>
                <td><input type="number" min="0" class="stat-input" data-field="perfect_wins"  value="${s.perfect_wins}"></td>
                <td><button class="btn-secondary save-stats-btn">Save</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('.save-stats-btn').forEach(btn => {
    btn.onclick = async () => {
      const row  = btn.closest('tr');
      const mode = row.dataset.mode;
      const payload = {};
      row.querySelectorAll('.stat-input').forEach(inp => { payload[inp.dataset.field] = +inp.value; });

      btn.textContent = '…';
      btn.disabled    = true;

      const res = await api.patch(`/api/admin/users/${_selectedUser}/stats`, { mode, ...payload });

      btn.disabled    = false;
      btn.textContent = res.error ? '❌' : '✅';
      setTimeout(() => { btn.textContent = 'Save'; }, 2000);

      // Mettre à jour userDetail en mémoire
      if (!res.error) {
        const idx = (_userDetail.stats || []).findIndex(s => s.mode === mode);
        if (idx >= 0) _userDetail.stats[idx] = { ..._userDetail.stats[idx], mode, ...payload };
        else          _userDetail.stats = [...(_userDetail.stats || []), { mode, ...payload }];
      }
    };
  });
}

// ── Tab: Friends ───────────────────────────────────────────────────────────
function renderTabFriends(d) {
  const friends = d.friends || [];

  document.getElementById('user-detail-content').innerHTML = `
    <div class="tab-section">
      <h3>Amis (${friends.length})</h3>
      <div id="friends-list">
        ${friends.length === 0
          ? '<p style="color:var(--text-muted)">Aucun ami.</p>'
          : friends.map(f => `
              <div class="friend-row" data-fid="${f.friendship_id}"
                   style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;background:var(--bg3);margin-bottom:8px">
                ${f.avatar_data
                  ? `<img src="${f.avatar_data}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0">`
                  : '<div style="width:36px;height:36px;border-radius:50%;background:var(--bg);flex-shrink:0;display:flex;align-items:center;justify-content:center">👤</div>'}
                <div style="flex:1;min-width:0">
                  <strong>${escHtml(f.pseudo)}</strong>
                  <div style="font-size:11px;color:var(--text-muted)">${escHtml(f.status)} · ID utilisateur: ${f.user_id}</div>
                </div>
                <button class="btn-danger btn-small remove-friend-btn" data-fid="${f.friendship_id}" title="Supprimer cette amitié">🗑️</button>
              </div>
            `).join('')}
      </div>
    </div>
  `;

  document.querySelectorAll('.remove-friend-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Supprimer cette amitié ?')) return;
      const res = await api.delete(`/api/admin/users/${_selectedUser}/friends/${btn.dataset.fid}`);
      if (!res.error) {
        btn.closest('.friend-row').remove();
        _userDetail.friends = _userDetail.friends.filter(f => String(f.friendship_id) !== String(btn.dataset.fid));
      }
    };
  });
}

// ── Tab: Social Links ──────────────────────────────────────────────────────
function renderTabSocial(d) {
  const links = d.social_links || [];

  document.getElementById('user-detail-content').innerHTML = `
    <div class="tab-section">
      <h3>Social Links (${links.length})</h3>
      ${links.length === 0
        ? '<p style="color:var(--text-muted)">Aucun Social Link.</p>'
        : `<div style="overflow-x:auto">
            <table class="stats-table" style="width:100%">
              <thead>
                <tr>
                  <th>Ami</th>
                  <th>Rang actuel</th>
                  <th>XP actuel</th>
                  <th>Nouveau rang</th>
                  <th>Nouvel XP</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${links.map(sl => `
                  <tr data-slid="${sl.id}">
                    <td><strong>${escHtml(sl.pseudo)}</strong></td>
                    <td>${sl.rank}</td>
                    <td>${sl.xp}</td>
                    <td>
                      <select class="sl-rank-input"
                              style="background:var(--bg3);color:var(--text);border:1px solid var(--border);padding:5px 8px;border-radius:4px;font-size:13px">
                        ${[1,2,3,4,5,6,7,8,9,10].map(r => `<option value="${r}" ${r === sl.rank ? 'selected' : ''}>${r}</option>`).join('')}
                      </select>
                    </td>
                    <td>
                      <input type="number" class="sl-xp-input" min="0" value="${sl.xp}"
                             style="width:80px;background:transparent;border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:13px;outline:none">
                    </td>
                    <td><button class="btn-secondary save-sl-btn">Save</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`}
    </div>
  `;

  document.querySelectorAll('.save-sl-btn').forEach(btn => {
    btn.onclick = async () => {
      const row  = btn.closest('tr');
      const slId = row.dataset.slid;
      const rank = +row.querySelector('.sl-rank-input').value;
      const xp   = +row.querySelector('.sl-xp-input').value;

      btn.textContent = '…';
      btn.disabled    = true;

      const res = await api.patch(`/api/admin/social-links/${slId}`, { rank, xp });

      btn.disabled    = false;
      btn.textContent = res.error ? '❌' : '✅';
      setTimeout(() => { btn.textContent = 'Save'; }, 2000);
    };
  });
}

// ── Pending Gifts Queue ────────────────────────────────────────────────────
function updateFab() {
  const fab   = document.getElementById('pending-fab');
  const count = pendingGifts.length;
  document.getElementById('pending-count').textContent = count;
  fab.classList.toggle('hidden', count === 0);
}

async function applyPendingGifts() {
  if (!pendingGifts.length || !_selectedUser) return;

  const fab = document.getElementById('pending-fab');
  fab.disabled    = true;
  fab.textContent = 'Application…';

  const toAdd = pendingGifts.filter(g => g.action === 'add');

  // Exécuter tous les appels API en parallèle
  const results = await Promise.allSettled(pendingGifts.map(gift => {
    if (gift.type === 'badge') {
      return gift.action === 'add'
        ? api.post(`/api/admin/users/${_selectedUser}/badges`, { slug: gift.id })
        : api.delete(`/api/admin/users/${_selectedUser}/badges/${gift.id}`);
    }
    if (gift.type === 'wallpaper') {
      return gift.action === 'add'
        ? api.post(`/api/admin/users/${_selectedUser}/wallpapers`, { wallpaper_id: gift.id })
        : api.delete(`/api/admin/users/${_selectedUser}/wallpapers/${gift.id}`);
    }
    if (gift.type === 'title') {
      return gift.action === 'add'
        ? api.post(`/api/admin/users/${_selectedUser}/titles`, { title_id: gift.id })
        : api.delete(`/api/admin/users/${_selectedUser}/titles/${gift.id}`);
    }
    return Promise.resolve({ ok: true });
  }));

  const hasError = results.some(r => r.status === 'rejected' || r.value?.error);

  // Rafraîchir les données du user depuis l'API
  _userDetail = await api.get(`/api/admin/users/${_selectedUser}`);

  // Animation divine si au moins un ajout réussi
  if (!hasError && toAdd.length > 0) {
    showDivineGiftAnimation(toAdd);
  }

  pendingGifts = [];
  updateFab();

  fab.disabled  = false;
  // Remettre le contenu HTML original du FAB
  fab.innerHTML = '⚡ Appliquer les dons (<span id="pending-count">0</span>)';

  // Re-render le tab actif pour refléter le nouvel état
  switchTab(_activeTab);
}

// ── Divine Gift Animation ──────────────────────────────────────────────────
function showDivineGiftAnimation(items) {
  const overlay = document.createElement('div');
  overlay.className = 'divine-overlay';

  overlay.innerHTML = `
    <canvas class="divine-particles-canvas"></canvas>
    <div class="divine-content" style="position:relative;z-index:2;text-align:center;padding:20px">
      <div class="divine-title">The Admin has spoken…</div>
      <div class="divine-cards">
        ${items.map((item, i) => `
          <div class="divine-card" style="animation-delay:${i * 120}ms">
            ${item.img
              ? `<img src="${item.img}" alt="${escHtml(item.label)}" onerror="this.style.display='none'">`
              : `<div class="divine-card-icon">👑</div>`}
            <span>${escHtml(item.label)}</span>
            <div class="card-type">${getTypeLabel(item.type)}</div>
          </div>
        `).join('')}
      </div>
      <div class="divine-dismiss-hint">— Cliquer pour fermer —</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Canvas particles
  startParticles(overlay.querySelector('.divine-particles-canvas'));

  // Fade in
  requestAnimationFrame(() => overlay.classList.add('show'));

  const dismiss = () => {
    overlay.classList.add('exit');
    setTimeout(() => overlay.remove(), 500);
  };

  overlay.addEventListener('click', dismiss);
  // Auto-dismiss après 4 secondes
  setTimeout(dismiss, 4000);
}

// ── Canvas particles (dorées) ──────────────────────────────────────────────
function startParticles(canvas) {
  if (!canvas) return;

  const ctx        = canvas.getContext('2d');
  canvas.width     = window.innerWidth;
  canvas.height    = window.innerHeight;

  const particles = Array.from({ length: 70 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * -300,
    vy:    1.5 + Math.random() * 3,
    vx:    (Math.random() - 0.5) * 1.8,
    size:  1.5 + Math.random() * 3.5,
    alpha: 0.6 + Math.random() * 0.4,
    color: Math.random() > 0.4 ? '#ffd700' : (Math.random() > 0.5 ? '#fff8dc' : '#fffacd'),
  }));

  let running = true;

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.y     += p.vy;
      p.x     += p.vx;
      p.alpha -= 0.0025;

      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Respawn si hors écran ou transparent
      if (p.y > canvas.height || p.alpha <= 0) {
        p.y     = -10;
        p.x     = Math.random() * canvas.width;
        p.alpha = 0.6 + Math.random() * 0.4;
      }
    });

    requestAnimationFrame(draw);
  }

  draw();
  // Arrêter le canvas après la durée de l'overlay
  setTimeout(() => { running = false; }, 5000);
}

// ── Catalog Loaders ────────────────────────────────────────────────────────
async function loadBadgesCatalog() {
  try {
    const data     = await api.get('/api/badges');
    _badgesCatalog = data.badges || [];
  } catch (e) {
    console.error('[Admin] Failed to load badges catalog', e);
  }
}

async function loadWallpapersCatalog() {
  try {
    const data         = await api.get('/api/wallpapers');
    _wallpapersCatalog = data.wallpapers || [];
  } catch (e) {
    console.error('[Admin] Failed to load wallpapers catalog', e);
  }
}

async function loadTitlesCatalog() {
  try {
    const data     = await api.get('/api/titles');
    _titlesCatalog = data.titles || [];
  } catch (e) {
    console.error('[Admin] Failed to load titles catalog', e);
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTypeLabel(type) {
  return { badge: 'Badge', wallpaper: 'Wallpaper', title: 'Titre', stats: 'Stats' }[type] || type;
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
init();
