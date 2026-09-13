/**
 * admin/activity.js — Panneau « 📈 Activité » : joueurs actifs, parties et
 * comptes par jour, ventilation par mode, heures de jeu. Données de
 * api/admin/activity.php (comptes seulement — les invités ne postent rien).
 * Barres en CSS pur, pas de librairie de graphiques.
 */

import { api, escHtml, renderLoading, renderError } from "./admin-api.js";

const MODE_LABEL = {
  classic: "🔤 Classique",
  emoji: "😄 Emoji",
  silhouette: "👤 Silhouette",
  alloutattack: "⚔️ All-Out",
  personae: "✨ Personae",
  music: "🎵 Music",
};

let _days = 30;

export async function renderActivity() {
  const el = document.getElementById("activity-panel-content");
  renderLoading(el);

  let res;
  try {
    res = await api.get(`/api/admin/activity?days=${_days}`);
  } catch {
    renderError(el, "Erreur lors du chargement de l'activité.");
    return;
  }
  const d = res.data ?? res;
  const totals = d.totals ?? {};
  const daily = d.daily ?? [];
  const modes = d.modes ?? [];
  const hours = d.hours ?? [];

  const kpi = (label, value, hint = "") =>
    `<div class="act-kpi"><span class="act-kpi__value">${escHtml(String(value))}</span><span class="act-kpi__label">${escHtml(label)}</span>${hint ? `<span class="act-kpi__hint">${escHtml(hint)}</span>` : ""}</div>`;

  const maxGames = Math.max(1, ...daily.map((x) => x.games));
  const maxPlayers = Math.max(1, ...daily.map((x) => x.active_players));
  const dayBars = daily
    .map((x) => {
      const short = x.date.slice(5).replace("-", "/");
      return `<div class="act-day" title="${escHtml(x.date)} — ${x.active_players} joueur(s), ${x.games} partie(s), ${x.wins} gagnée(s), ${x.new_accounts} compte(s)">
        <div class="act-day__bars">
          <span class="act-bar act-bar--games" style="height:${Math.round((x.games / maxGames) * 100)}%"></span>
          <span class="act-bar act-bar--players" style="height:${Math.round((x.active_players / maxPlayers) * 100)}%"></span>
        </div>
        <span class="act-day__label">${escHtml(short)}</span>
      </div>`;
    })
    .join("");

  const modeMaxGames = Math.max(1, ...modes.map((m) => m.games));
  const modeRows = modes
    .map(
      (m) => `<tr>
        <td>${MODE_LABEL[m.mode] ?? escHtml(m.mode)}</td>
        <td><div class="act-hbar"><span style="width:${Math.round((m.games / modeMaxGames) * 100)}%"></span></div>${m.games}</td>
        <td>${m.win_rate == null ? "—" : `${m.win_rate} %`}</td>
        <td>${m.avg_attempts == null ? "—" : m.avg_attempts}</td>
        <td>${m.expert_games}${m.expert_share != null ? ` <span class="act-muted">(${m.expert_share} %)</span>` : ""}</td>
      </tr>`
    )
    .join("");

  const maxHour = Math.max(1, ...hours.map((h) => h.games));
  const hourBars = hours
    .map(
      (h) => `<div class="act-hour" title="${h.hour}h — ${h.games} partie(s)">
        <span class="act-bar act-bar--games" style="height:${Math.round((h.games / maxHour) * 100)}%"></span>
        <span class="act-hour__label">${h.hour % 3 === 0 ? h.hour : ""}</span>
      </div>`
    )
    .join("");

  el.innerHTML = `
    <div class="act-panel">
    <div class="act-head">
      <h2 style="margin:0;color:var(--red)">📈 Activité</h2>
      <div class="act-range">
        ${[7, 30, 90].map((n) => `<button class="btn-sm act-range-btn${n === _days ? " active" : ""}" data-days="${n}">${n} j</button>`).join("")}
      </div>
    </div>
    <p class="act-muted">Comptes uniquement (les invités ne posent pas de session). Journée et heures en heure de Paris.</p>

    <div class="act-kpis">
      ${kpi("Joueurs inscrits", totals.players ?? 0)}
      ${kpi("Actifs 7 j", totals.active_7d ?? 0, "ont joué au moins une partie")}
      ${kpi(`Actifs ${d.days} j`, totals.active_30d ?? 0)}
      ${kpi(`Parties ${d.days} j`, totals.games_30d ?? 0)}
      ${kpi(`Nouveaux comptes ${d.days} j`, totals.new_accounts_30d ?? 0)}
      ${kpi(`Écarts anti-triche ${d.days} j`, totals.anti_cheat_30d ?? 0, "cibles du jour non conformes (détection, pas rejet)")}
    </div>

    <h3 class="act-h3">Par jour <span class="act-legend"><i class="act-bar--games"></i> parties <i class="act-bar--players"></i> joueurs actifs</span></h3>
    <div class="act-days">${dayBars}</div>

    <h3 class="act-h3">Par mode (${d.days} j)</h3>
    <table class="act-table">
      <thead><tr><th>Mode</th><th>Parties</th><th>Victoires</th><th>Essais moy. (victoires)</th><th>Expert</th></tr></thead>
      <tbody>${modeRows}</tbody>
    </table>

    <h3 class="act-h3">Heure de jeu (${d.days} j)</h3>
    <div class="act-hours">${hourBars}</div>
    </div>
  `;

  el.querySelectorAll(".act-range-btn").forEach((b) =>
    b.addEventListener("click", () => {
      _days = Number(b.dataset.days);
      renderActivity();
    })
  );
}
