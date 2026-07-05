/**
 * admin/error-logs.js — Panneau "Logs d'erreurs" (personadle_log_error(), voir
 * api/lib/error_log.php) : recherche, filtre par niveau, pagination.
 */

import { api, escHtml } from "./admin-api.js";

let _errorLogsPage = 1;
let _errorLogsLevel = "";
let _errorLogsSearch = "";
let _errorLogsSearchTimer;

export async function renderErrorLogs() {
  const el = document.getElementById("error-logs-panel-content");
  el.innerHTML =
    '<div style="padding:32px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  let res;
  try {
    const params = new URLSearchParams({ page: _errorLogsPage, limit: 30 });
    if (_errorLogsLevel) params.set("level", _errorLogsLevel);
    if (_errorLogsSearch) params.set("search", _errorLogsSearch);
    res = await api.get(`/api/admin/error_logs?${params.toString()}`);
  } catch (e) {
    el.innerHTML =
      '<div style="padding:32px;color:var(--red)">Erreur lors du chargement des logs.</div>';
    return;
  }

  const logs = res.data ?? [];

  const levelClass = (level) =>
    level === "error"
      ? "code-status--inactive" // rouge
      : level === "warning"
        ? "code-status--expired" // jaune/orange
        : "code-status--active"; // vert

  const rows = logs
    .map((l) => {
      const context = l.context
        ? `<pre style="white-space:pre-wrap;font-size:.75rem;margin:4px 0 0;opacity:.75">${escHtml(
            JSON.stringify(l.context, null, 2)
          )}</pre>`
        : "";
      return `<tr>
        <td><span class="code-status ${levelClass(l.level)}">${escHtml(l.level)}</span></td>
        <td>
          <div>${escHtml(l.message)}</div>
          ${context}
        </td>
        <td>${l.user_pseudo ? escHtml(l.user_pseudo) : "—"}</td>
        <td>${escHtml(l.created_at)}</td>
      </tr>`;
    })
    .join("");

  el.innerHTML = `
    <div style="padding:1.5rem">
      <h2 style="margin:0 0 1rem;color:var(--accent)">🪵 Logs d'erreurs</h2>

      <div class="form-grid" style="margin-bottom:1rem">
        <label>Recherche
          <input id="error-logs-search" type="text" placeholder="Filtrer par message…" value="${escHtml(_errorLogsSearch)}">
        </label>
        <label>Niveau
          <select id="error-logs-level">
            <option value="">Tous</option>
            <option value="error" ${_errorLogsLevel === "error" ? "selected" : ""}>Error</option>
            <option value="warning" ${_errorLogsLevel === "warning" ? "selected" : ""}>Warning</option>
            <option value="info" ${_errorLogsLevel === "info" ? "selected" : ""}>Info</option>
          </select>
        </label>
      </div>

      <div class="codes-table-wrap">
        <table class="codes-table">
          <thead>
            <tr><th>Niveau</th><th>Message</th><th>Utilisateur</th><th>Date</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Aucune erreur 🎉</td></tr>'}</tbody>
        </table>
      </div>

      <div id="error-logs-pagination" class="pagination"></div>
    </div>
  `;

  document.getElementById("error-logs-search").addEventListener("input", (e) => {
    clearTimeout(_errorLogsSearchTimer);
    _errorLogsSearchTimer = setTimeout(() => {
      _errorLogsSearch = e.target.value.trim();
      _errorLogsPage = 1;
      renderErrorLogs();
    }, 300);
  });

  document.getElementById("error-logs-level").addEventListener("change", (e) => {
    _errorLogsLevel = e.target.value;
    _errorLogsPage = 1;
    renderErrorLogs();
  });

  renderErrorLogsPagination(res.total ?? 0, _errorLogsPage, res.limit ?? 30);
}

function renderErrorLogsPagination(total, page, limit) {
  const el = document.getElementById("error-logs-pagination");
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <button class="btn-sm" id="error-logs-prev" ${page <= 1 ? "disabled" : ""}>← Préc.</button>
    <span>Page ${page} / ${totalPages}</span>
    <button class="btn-sm" id="error-logs-next" ${page >= totalPages ? "disabled" : ""}>Suiv. →</button>
  `;
  document.getElementById("error-logs-prev").onclick = () => {
    _errorLogsPage = Math.max(1, _errorLogsPage - 1);
    renderErrorLogs();
  };
  document.getElementById("error-logs-next").onclick = () => {
    _errorLogsPage = Math.min(totalPages, _errorLogsPage + 1);
    renderErrorLogs();
  };
}
