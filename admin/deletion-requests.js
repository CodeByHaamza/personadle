/**
 * admin/deletion-requests.js — Panneau "Demandes de suppression RGPD" (le compte
 * est déjà anonymisé au moment de la demande ; ce panneau permet de forcer la
 * suppression cascade définitive avant l'échéance automatique à J+30).
 */

import { api, toast, escHtml } from "./admin-api.js";

let _deletionRequestsPage = 1;
let _deletionRequestsStatus = "";

export async function renderDeletionRequests() {
  const el = document.getElementById("deletion-requests-panel-content");
  el.innerHTML =
    '<div style="padding:32px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  let res;
  try {
    const params = new URLSearchParams({ page: _deletionRequestsPage, limit: 30 });
    if (_deletionRequestsStatus) params.set("status", _deletionRequestsStatus);
    res = await api.get(`/api/admin/deletion_requests?${params.toString()}`);
  } catch (e) {
    el.innerHTML =
      '<div style="padding:32px;color:var(--red)">Erreur lors du chargement des demandes RGPD.</div>';
    return;
  }

  const requests = res.data ?? [];

  const rows = requests
    .map((r) => {
      const pending = !r.processed_at;
      const statusPill = pending
        ? '<span class="code-status code-status--expired">En attente</span>'
        : '<span class="code-status code-status--active">Traité</span>';
      const actionBtn = pending
        ? `<button class="btn-sm dr-process-btn" data-id="${r.id}">Supprimer maintenant</button>`
        : "—";
      return `<tr>
        <td>${r.user_pseudo ? escHtml(r.user_pseudo) : "—"} (#${r.user_id})</td>
        <td>${escHtml(r.deletion_type)}</td>
        <td>${statusPill}</td>
        <td>${escHtml(r.requested_at)}</td>
        <td>${r.processed_at ? escHtml(r.processed_at) : "—"}</td>
        <td>${actionBtn}</td>
      </tr>`;
    })
    .join("");

  el.innerHTML = `
    <div style="padding:1.5rem">
      <h2 style="margin:0 0 1rem;color:var(--accent)">🗑️ Demandes de suppression RGPD</h2>
      <p style="color:var(--text-muted);font-size:.85rem;margin:0 0 1rem">
        Le compte est déjà anonymisé au moment de la demande — la suppression définitive
        (cascade complète) intervient automatiquement à J+30, ou manuellement ci-dessous.
      </p>

      <div class="form-grid" style="margin-bottom:1rem">
        <label>Statut
          <select id="deletion-requests-status">
            <option value="">Toutes</option>
            <option value="pending" ${_deletionRequestsStatus === "pending" ? "selected" : ""}>En attente</option>
            <option value="processed" ${_deletionRequestsStatus === "processed" ? "selected" : ""}>Traitées</option>
          </select>
        </label>
      </div>

      <div class="codes-table-wrap">
        <table class="codes-table">
          <thead>
            <tr><th>Utilisateur</th><th>Type</th><th>Statut</th><th>Demandée le</th><th>Traitée le</th><th></th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Aucune demande</td></tr>'}</tbody>
        </table>
      </div>

      <div id="deletion-requests-pagination" class="pagination"></div>
    </div>
  `;

  document.getElementById("deletion-requests-status").addEventListener("change", (e) => {
    _deletionRequestsStatus = e.target.value;
    _deletionRequestsPage = 1;
    renderDeletionRequests();
  });

  el.querySelectorAll(".dr-process-btn").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Supprimer définitivement ce compte maintenant, avant l'échéance des 30 jours ?")) return;
      btn.disabled = true;
      const res = await api.post(`/api/admin/deletion_requests/${btn.dataset.id}/process`, {});
      if (res.error) {
        toast("❌ " + res.error, "error");
        btn.disabled = false;
      } else {
        toast("✅ Compte supprimé définitivement", "success");
        renderDeletionRequests();
      }
    };
  });

  renderDeletionRequestsPagination(res.total ?? 0, _deletionRequestsPage, res.limit ?? 30);
}

function renderDeletionRequestsPagination(total, page, limit) {
  const el = document.getElementById("deletion-requests-pagination");
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <button class="btn-sm" id="deletion-requests-prev" ${page <= 1 ? "disabled" : ""}>← Préc.</button>
    <span>Page ${page} / ${totalPages}</span>
    <button class="btn-sm" id="deletion-requests-next" ${page >= totalPages ? "disabled" : ""}>Suiv. →</button>
  `;
  document.getElementById("deletion-requests-prev").onclick = () => {
    _deletionRequestsPage = Math.max(1, _deletionRequestsPage - 1);
    renderDeletionRequests();
  };
  document.getElementById("deletion-requests-next").onclick = () => {
    _deletionRequestsPage = Math.min(totalPages, _deletionRequestsPage + 1);
    renderDeletionRequests();
  };
}
