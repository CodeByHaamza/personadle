/**
 * admin/rate-limits.js — Panneau "Rate Limits actifs" (compteurs rateLimit(),
 * voir api/bootstrap.php) : recherche par clé, purge manuelle.
 */

import { api, toast, escHtml, renderLoading, renderError, renderPagination } from "./admin-api.js";

let _rateLimitsPage = 1;
let _rateLimitsSearch = "";
let _rateLimitsSearchTimer;

export async function renderRateLimits() {
  const el = document.getElementById("rate-limits-panel-content");
  renderLoading(el);

  let res;
  try {
    const params = new URLSearchParams({ page: _rateLimitsPage, limit: 30 });
    if (_rateLimitsSearch) params.set("search", _rateLimitsSearch);
    res = await api.get(`/api/admin/rate_limits?${params.toString()}`);
  } catch (e) {
    renderError(el, "Erreur lors du chargement des rate limits.");
    return;
  }

  const limits = res.data ?? [];

  const rows = limits
    .map((r) => {
      const windowDate = new Date(r.window_start * 1000).toLocaleString("fr-FR");
      return `<tr>
        <td>${escHtml(r.rl_key)}</td>
        <td>${r.hits}</td>
        <td>${windowDate}</td>
        <td><button class="btn-sm rl-clear-btn" data-key="${escHtml(r.rl_key)}">Purger</button></td>
      </tr>`;
    })
    .join("");

  el.innerHTML = `
    <div style="padding:1.5rem">
      <h2 style="margin:0 0 1rem;color:var(--accent)">⏱️ Rate Limits actifs</h2>

      <div class="form-grid" style="margin-bottom:1rem">
        <label>Recherche
          <input id="rate-limits-search" type="text" placeholder="Filtrer par clé (ex: login:)…" value="${escHtml(_rateLimitsSearch)}">
        </label>
      </div>

      <div class="codes-table-wrap">
        <table class="codes-table">
          <thead>
            <tr><th>Clé</th><th>Hits</th><th>Fenêtre depuis</th><th></th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Aucun compteur actif</td></tr>'}</tbody>
        </table>
      </div>

      <div id="rate-limits-pagination" class="pagination"></div>
    </div>
  `;

  document.getElementById("rate-limits-search").addEventListener("input", (e) => {
    clearTimeout(_rateLimitsSearchTimer);
    _rateLimitsSearchTimer = setTimeout(() => {
      _rateLimitsSearch = e.target.value.trim();
      _rateLimitsPage = 1;
      renderRateLimits();
    }, 300);
  });

  el.querySelectorAll(".rl-clear-btn").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      const res = await api.delete(`/api/admin/rate_limits?key=${encodeURIComponent(btn.dataset.key)}`);
      if (res.error) {
        toast("❌ " + res.error, "error");
        btn.disabled = false;
      } else {
        toast("✅ Compteur purgé", "success");
        renderRateLimits();
      }
    };
  });

  renderPagination("rate-limits-pagination", {
    total: res.total ?? 0,
    page: _rateLimitsPage,
    limit: res.limit ?? 30,
    onChange: (page) => {
      _rateLimitsPage = page;
      renderRateLimits();
    },
  });
}
