/**
 * admin/moderation.js — Onglet « 🛡️ Modération » d'un joueur (migration 042) :
 *   - ban avec raison (visible par le joueur), durée et note interne, ou levée ;
 *   - messages de l'équipe (avertissement / info) vus une fois par le joueur ;
 *   - carnet de notes interne, jamais exposé ;
 *   - reset ciblé de l'état local des modes ;
 *   - lien vers le profil public tel que les autres le voient.
 * Le reste du profil (pseudo, avatar…) reste dans admin.js, onglet Profil.
 */

import { api, toast, escHtml } from "./admin-api.js";

const BAN_DURATIONS = [
  [24, "24 heures"],
  [72, "3 jours"],
  [168, "7 jours"],
  [720, "30 jours"],
  [0, "Définitif"],
];

function fmt(sql) {
  if (!sql) return "—";
  const d = new Date(String(sql).replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? String(sql) : d.toLocaleString("fr-FR");
}

/**
 * @param {HTMLElement} el   conteneur de l'onglet
 * @param {object} d         détail utilisateur (GET /api/admin/users/:id)
 * @param {number} userId
 * @param {(patch: object) => void} onUserPatched  met à jour le cache local du détail
 */
export function renderModerationTab(el, d, userId, onUserPatched) {
  const u = d.user;
  const banned = !!u.is_banned;
  const publicHref = `../profile/profile.html?view=${encodeURIComponent(u.friend_code)}`;

  el.innerHTML = `
    <div class="tab-section">
      <h3>🚫 Ban</h3>
      ${
        banned
          ? `<div class="mod-ban-state mod-ban-state--on">
              <strong>Compte banni</strong> depuis le ${escHtml(fmt(u.banned_at))} ·
              ${u.banned_until ? `jusqu'au <strong>${escHtml(fmt(u.banned_until))}</strong> (levé automatiquement à l'échéance)` : "<strong>définitif</strong>"}
              ${u.ban_reason ? `<div class="mod-ban-reason">Raison vue par le joueur : « ${escHtml(u.ban_reason)} »</div>` : ""}
              ${u.ban_note ? `<div class="mod-ban-note">Note interne : ${escHtml(u.ban_note)}</div>` : ""}
              <button class="btn-secondary" id="mod-unban-btn" style="margin-top:10px">✅ Lever le ban</button>
            </div>`
          : `<div class="form-grid">
              <label>Raison (vue par le joueur à la connexion)
                <input id="mod-ban-reason" type="text" maxlength="300" placeholder="ex : Triche au classement">
              </label>
              <label>Durée
                <select id="mod-ban-hours">
                  ${BAN_DURATIONS.map(([h, l]) => `<option value="${h}"${h === 168 ? " selected" : ""}>${l}</option>`).join("")}
                </select>
              </label>
              <label style="grid-column:1/-1">Note interne (jamais visible par le joueur)
                <input id="mod-ban-note" type="text" maxlength="2000" placeholder="ex : 3 écarts anti-triche le 13/09, déjà averti">
              </label>
            </div>
            <button class="btn-danger" id="mod-ban-btn" style="margin-top:10px">🚫 Bannir</button>
            <p class="mod-hint">Le joueur verra la raison et la date de fin à sa prochaine tentative de connexion. Un ban à durée est levé tout seul à l'échéance.</p>`
      }
    </div>

    <div class="tab-section">
      <h3>💬 Message de l'équipe</h3>
      <p class="mod-hint">Vu <strong>une fois</strong> par le joueur, en bandeau, à son prochain chargement de page — puis accusé. Un avertissement avant un ban, ou une info neutre.</p>
      <div class="form-grid">
        <label>Type
          <select id="mod-notice-type">
            <option value="warning">⚠️ Avertissement</option>
            <option value="info">💬 Information</option>
          </select>
        </label>
        <label style="grid-column:1/-1">Message
          <input id="mod-notice-message" type="text" maxlength="1000" placeholder="ex : Dernier avertissement : les pseudos insultants sont interdits.">
        </label>
      </div>
      <button class="btn-secondary" id="mod-notice-btn" style="margin-top:10px">📨 Envoyer</button>
      <div class="mod-list" id="mod-notices-list">${renderNotices(d.notices ?? [])}</div>
    </div>

    <div class="tab-section">
      <h3>📝 Notes internes</h3>
      <p class="mod-hint">Ton carnet sur ce joueur — horodaté, jamais visible par lui.</p>
      <div class="form-grid">
        <label style="grid-column:1/-1">Nouvelle note
          <input id="mod-note-text" type="text" maxlength="2000" placeholder="ex : A signalé un bug le 12/09, sympa.">
        </label>
      </div>
      <button class="btn-secondary" id="mod-note-btn" style="margin-top:10px">➕ Ajouter</button>
      <div class="mod-list" id="mod-notes-list">${renderNotes(d.notes ?? [])}</div>
    </div>

    <div class="tab-section">
      <h3>🧰 Outils</h3>
      <div class="mod-tools">
        <div class="mod-item">
          <div class="mod-item-label">
            <span>👁 Voir le profil public</span>
            <small>Tel que les autres joueurs le voient</small>
          </div>
          <a class="btn-secondary" href="${escHtml(publicHref)}" target="_blank" rel="noopener">Ouvrir ↗</a>
        </div>
        <div class="mod-item">
          <div class="mod-item-label">
            <span>♻️ Réinitialiser l'état local des modes</span>
            <small>Au prochain chargement, son navigateur vide la partie en cours de chaque mode (parties corrompues). Ses stats, badges et streak ne bougent pas.${u.reset_local_state_at ? ` Dernier reset demandé : ${escHtml(fmt(u.reset_local_state_at))}.` : ""}</small>
          </div>
          <button class="btn-secondary" id="mod-reset-local-btn">♻️ Demander</button>
        </div>
      </div>
    </div>
  `;

  // ── Ban / lever ──
  document.getElementById("mod-ban-btn")?.addEventListener("click", async () => {
    const reason = document.getElementById("mod-ban-reason").value.trim();
    const hours = Number(document.getElementById("mod-ban-hours").value);
    const note = document.getElementById("mod-ban-note").value.trim();
    if (
      !reason &&
      !confirm("Aucune raison saisie : le joueur verra juste « compte banni ». Continuer ?")
    )
      return;
    const res = await api.patch(`/api/admin/users/${userId}`, {
      is_banned: true,
      ban_reason: reason,
      ban_note: note,
      ban_hours: hours,
    });
    if (res.error) return toast("❌ " + res.error, "error");
    onUserPatched(res.user);
    toast(
      hours
        ? `🚫 Banni ${BAN_DURATIONS.find(([h]) => h === hours)?.[1] ?? ""}`
        : "🚫 Banni définitivement",
      "error"
    );
    renderModerationTab(el, { ...d, user: { ...u, ...res.user } }, userId, onUserPatched);
  });
  document.getElementById("mod-unban-btn")?.addEventListener("click", async () => {
    const res = await api.patch(`/api/admin/users/${userId}`, { is_banned: false });
    if (res.error) return toast("❌ " + res.error, "error");
    onUserPatched(res.user);
    toast("✅ Ban levé", "success");
    renderModerationTab(el, { ...d, user: { ...u, ...res.user } }, userId, onUserPatched);
  });

  // ── Message de l'équipe ──
  document.getElementById("mod-notice-btn").addEventListener("click", async () => {
    const type = document.getElementById("mod-notice-type").value;
    const message = document.getElementById("mod-notice-message").value.trim();
    if (!message) return toast("Message vide", "error");
    const res = await api.post(`/api/admin/users/${userId}/notices`, { type, message });
    if (res.error) return toast("❌ " + res.error, "error");
    toast("📨 Message envoyé — il le verra à son prochain chargement", "success");
    document.getElementById("mod-notice-message").value = "";
    const list = await api.get(`/api/admin/users/${userId}/notices`);
    d.notices = list.notices ?? [];
    document.getElementById("mod-notices-list").innerHTML = renderNotices(d.notices);
  });

  // ── Notes ──
  const refreshNotes = async () => {
    const list = await api.get(`/api/admin/users/${userId}/notes`);
    d.notes = list.notes ?? [];
    document.getElementById("mod-notes-list").innerHTML = renderNotes(d.notes);
    bindNoteDeletes();
  };
  const bindNoteDeletes = () => {
    el.querySelectorAll(".mod-note-del").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Supprimer cette note ?")) return;
        const res = await api.delete(`/api/admin/users/${userId}/notes/${b.dataset.id}`);
        if (res.error) return toast("❌ " + res.error, "error");
        refreshNotes();
      })
    );
  };
  document.getElementById("mod-note-btn").addEventListener("click", async () => {
    const note = document.getElementById("mod-note-text").value.trim();
    if (!note) return toast("Note vide", "error");
    const res = await api.post(`/api/admin/users/${userId}/notes`, { note });
    if (res.error) return toast("❌ " + res.error, "error");
    document.getElementById("mod-note-text").value = "";
    refreshNotes();
  });
  bindNoteDeletes();

  // ── Reset ciblé ──
  document.getElementById("mod-reset-local-btn").addEventListener("click", async () => {
    if (
      !confirm(
        "Demander à son navigateur de vider l'état local des modes (partie en cours de chaque mode) ? Ses stats ne bougent pas."
      )
    )
      return;
    const res = await api.patch(`/api/admin/users/${userId}`, { reset_local_state: true });
    if (res.error) return toast("❌ " + res.error, "error");
    onUserPatched(res.user);
    toast("♻️ Reset demandé — appliqué à son prochain chargement", "success");
    renderModerationTab(el, { ...d, user: { ...u, ...res.user } }, userId, onUserPatched);
  });
}

function renderNotices(list) {
  if (!list.length) return `<p class="mod-empty">Aucun message envoyé.</p>`;
  return list
    .map(
      (n) => `<div class="mod-row">
        <span class="mod-row__icon">${n.type === "info" ? "💬" : "⚠️"}</span>
        <div class="mod-row__body">
          <div>${escHtml(n.message)}</div>
          <small>${escHtml(fmt(n.created_at))} · par ${escHtml(n.admin_pseudo ?? "—")} · ${n.read_at ? `lu le ${escHtml(fmt(n.read_at))}` : "<strong>pas encore vu</strong>"}</small>
        </div>
      </div>`
    )
    .join("");
}

function renderNotes(list) {
  if (!list.length) return `<p class="mod-empty">Aucune note.</p>`;
  return list
    .map(
      (n) => `<div class="mod-row">
        <span class="mod-row__icon">📝</span>
        <div class="mod-row__body">
          <div>${escHtml(n.note)}</div>
          <small>${escHtml(fmt(n.created_at))} · ${escHtml(n.admin_pseudo ?? "—")}</small>
        </div>
        <button class="btn-sm mod-note-del" data-id="${n.id}" title="Supprimer">✕</button>
      </div>`
    )
    .join("");
}
