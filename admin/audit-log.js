/**
 * admin/audit-log.js — Panneau "Journal d'audit admin" (actions admin tracées :
 * ban, édition profil, suppression de compte…).
 */

import { api, escHtml } from "./admin-api.js";

let _auditLogPage = 1;
let _auditLogAction = "";
let _auditLogSearch = "";
let _auditLogSearchTimer;

export async function renderAuditLog() {
  const el = document.getElementById("audit-log-panel-content");
  el.innerHTML =
    '<div style="padding:32px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  let res;
  try {
    const params = new URLSearchParams({ page: _auditLogPage, limit: 30 });
    if (_auditLogAction) params.set("action", _auditLogAction);
    if (_auditLogSearch) params.set("search", _auditLogSearch);
    res = await api.get(`/api/admin/audit_log?${params.toString()}`);
  } catch (e) {
    el.innerHTML =
      '<div style="padding:32px;color:var(--red)">Erreur lors du chargement du journal d\'audit.</div>';
    return;
  }

  const entries = res.data ?? [];

  const rows = entries
    .map((a) => {
      const details = a.details
        ? `<pre style="white-space:pre-wrap;font-size:.75rem;margin:4px 0 0;opacity:.75">${escHtml(
            JSON.stringify(a.details, null, 2)
          )}</pre>`
        : "";
      return `<tr>
        <td>${a.admin_pseudo ? escHtml(a.admin_pseudo) : "—"}</td>
        <td><span class="code-status code-status--active">${escHtml(a.action)}</span></td>
        <td>${escHtml(a.target_type)} #${escHtml(a.target_id)}</td>
        <td>${details || "—"}</td>
        <td>${escHtml(a.created_at)}</td>
      </tr>`;
    })
    .join("");

  el.innerHTML = `
    <div style="padding:1.5rem">
      <h2 style="margin:0 0 1rem;color:var(--accent)">📋 Journal d'audit admin</h2>

      <div class="form-grid" style="margin-bottom:1rem">
        <label>Recherche
          <input id="audit-log-search" type="text" placeholder="Admin, action, cible…" value="${escHtml(_auditLogSearch)}">
        </label>
        <label>Action
          <input id="audit-log-action" type="text" placeholder="ex: user.ban" value="${escHtml(_auditLogAction)}">
        </label>
      </div>

      <div class="codes-table-wrap">
        <table class="codes-table">
          <thead>
            <tr><th>Admin</th><th>Action</th><th>Cible</th><th>Détails</th><th>Date</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Aucune action journalisée</td></tr>'}</tbody>
        </table>
      </div>

      <div id="audit-log-pagination" class="pagination"></div>
    </div>
  `;

  document.getElementById("audit-log-search").addEventListener("input", (e) => {
    clearTimeout(_auditLogSearchTimer);
    _auditLogSearchTimer = setTimeout(() => {
      _auditLogSearch = e.target.value.trim();
      _auditLogPage = 1;
      renderAuditLog();
    }, 300);
  });

  document.getElementById("audit-log-action").addEventListener("input", (e) => {
    clearTimeout(_auditLogSearchTimer);
    _auditLogSearchTimer = setTimeout(() => {
      _auditLogAction = e.target.value.trim();
      _auditLogPage = 1;
      renderAuditLog();
    }, 300);
  });

  renderAuditLogPagination(res.total ?? 0, _auditLogPage, res.limit ?? 30);
}

function renderAuditLogPagination(total, page, limit) {
  const el = document.getElementById("audit-log-pagination");
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <button class="btn-sm" id="audit-log-prev" ${page <= 1 ? "disabled" : ""}>← Préc.</button>
    <span>Page ${page} / ${totalPages}</span>
    <button class="btn-sm" id="audit-log-next" ${page >= totalPages ? "disabled" : ""}>Suiv. →</button>
  `;
  document.getElementById("audit-log-prev").onclick = () => {
    _auditLogPage = Math.max(1, _auditLogPage - 1);
    renderAuditLog();
  };
  document.getElementById("audit-log-next").onclick = () => {
    _auditLogPage = Math.min(totalPages, _auditLogPage + 1);
    renderAuditLog();
  };
}
