/**
 * admin/event-codes.js — Panneau "Codes événement" (création/activation/suppression
 * de codes déblocables donnant un badge exclusif).
 */

import { api, toast, escHtml } from "./admin-api.js";

export async function renderEventCodes() {
  const el = document.getElementById("codes-panel-content");
  el.innerHTML =
    '<div style="padding:32px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  let codes = [];
  try {
    const res = await api.get("/api/admin/event_codes");
    codes = Array.isArray(res) ? res : (res.data ?? []);
  } catch (e) {
    el.innerHTML =
      '<div style="padding:32px;color:var(--red)">Erreur lors du chargement des codes.</div>';
    return;
  }

  const now = new Date().toISOString().slice(0, 10);

  const rows = codes
    .map((c) => {
      const active = c.is_active
        ? c.is_permanent || (c.start_date <= now && c.end_date >= now)
          ? '<span class="code-status code-status--active">✅ Actif</span>'
          : '<span class="code-status code-status--expired">📅 Expiré</span>'
        : '<span class="code-status code-status--inactive">⛔ Inactif</span>';

      const dates = c.is_permanent
        ? "<em>Permanent</em>"
        : `${c.start_date ?? "?"} → ${c.end_date ?? "?"}`;

      return `<tr class="code-row">
      <td><code class="code-pill">${escHtml(c.code)}</code></td>
      <td>${escHtml(c.badge_id)}</td>
      <td>${dates}</td>
      <td>${active}</td>
      <td><strong>${c.redemption_count ?? 0}</strong></td>
      <td>${escHtml(c.description || "—")}</td>
      <td class="code-actions">
        <button class="btn-sm btn-secondary" data-code="${escHtml(c.code)}" data-active="${c.is_active ? 1 : 0}" data-action="toggle">
          ${c.is_active ? "Désactiver" : "Activer"}
        </button>
        <button class="btn-sm btn-danger" data-code="${escHtml(c.code)}" data-action="delete">🗑️</button>
      </td>
    </tr>`;
    })
    .join("");

  el.innerHTML = `
    <div style="padding:1.5rem">
      <h2 style="margin:0 0 1rem;color:var(--accent)">🎟️ Codes événement</h2>

      <div class="codes-table-wrap">
        <table class="codes-table">
          <thead>
            <tr>
              <th>Code</th><th>Badge</th><th>Dates</th><th>Statut</th><th>Utilisations</th><th>Description</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Aucun code</td></tr>'}</tbody>
        </table>
      </div>

      <div class="code-create-form">
        <h3>Créer un code</h3>
        <div class="form-grid">
          <label>Code (majuscules, chiffres, _)
            <input id="new-code" type="text" placeholder="EX: PERSONA2027" maxlength="50">
          </label>
          <label>Badge ID
            <input id="new-badge-id" type="text" placeholder="slug_du_badge" maxlength="100">
          </label>
          <label>Description
            <input id="new-description" type="text" placeholder="Optionnel" maxlength="255">
          </label>
        </div>
        <div class="admin-toggle-row" style="margin:8px 0">
          <input type="checkbox" id="new-permanent">
          <span>Code permanent (pas de dates)</span>
        </div>
        <div id="date-fields" class="form-grid">
          <label>Date début
            <input id="new-start" type="date">
          </label>
          <label>Date fin
            <input id="new-end" type="date">
          </label>
        </div>
        <button class="btn-primary" id="create-code-btn" style="margin-top:10px">➕ Créer le code</button>
      </div>
    </div>
  `;

  // Toggle date fields visibility
  document.getElementById("new-permanent").addEventListener("change", (e) => {
    document.getElementById("date-fields").style.display = e.target.checked ? "none" : "";
  });

  // Toggle active / inactive
  el.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.dataset.code;
      const active = btn.dataset.active === "1";
      btn.disabled = true;
      const res = await api.patch(`/api/admin/event_codes/${encodeURIComponent(code)}`, {
        is_active: !active,
      });
      if (res.error) {
        toast("❌ " + res.error, "error");
        btn.disabled = false;
      } else {
        toast(`✅ Code ${active ? "désactivé" : "activé"}`, "success");
        renderEventCodes();
      }
    };
  });

  // Delete
  el.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.dataset.code;
      if (!confirm(`Supprimer le code "${code}" ?`)) return;
      btn.disabled = true;
      const res = await api.delete(`/api/admin/event_codes/${encodeURIComponent(code)}`);
      if (res.error) {
        toast("❌ " + res.error, "error");
        btn.disabled = false;
      } else {
        toast("🗑️ Code supprimé", "success");
        renderEventCodes();
      }
    };
  });

  // Create
  document.getElementById("create-code-btn").onclick = async () => {
    const btn = document.getElementById("create-code-btn");
    const isPerm = document.getElementById("new-permanent").checked;
    btn.disabled = true;
    btn.textContent = "…";
    const res = await api.post("/api/admin/event_codes", {
      code: document.getElementById("new-code").value.trim(),
      badge_id: document.getElementById("new-badge-id").value.trim(),
      description: document.getElementById("new-description").value.trim(),
      is_permanent: isPerm,
      is_active: true,
      start_date: isPerm ? null : document.getElementById("new-start").value,
      end_date: isPerm ? null : document.getElementById("new-end").value,
    });
    btn.disabled = false;
    btn.textContent = "➕ Créer le code";
    if (res.error) toast("❌ " + res.error, "error");
    else {
      toast("✅ Code créé", "success");
      renderEventCodes();
    }
  };
}
