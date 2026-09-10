/**
 * admin/streak.js — Onglet « Streak » de la fiche utilisateur.
 *
 * La streak globale est la donnée la plus douloureuse à perdre pour un joueur,
 * et la plus fragile : elle dépend d'une frontière de journée (heure de Paris),
 * d'une sync client→serveur, et d'une récupération Jack Frost limitée à une
 * fois tous les 60 jours. Trois gestes distincts ici :
 *
 *   - Restaurer (Jack Frost illimité) : remonte la streak sans le cooldown ni le
 *     plafond « jours joués ». Ces gardes protègent d'un joueur qui s'auto-attribue
 *     une streak, pas d'un admin qui répare. Ne consomme PAS la récupération du
 *     joueur, et ne fait jamais régresser une streak de mode.
 *   - Rendre Jack Frost disponible : efface le cooldown pour que le joueur puisse
 *     s'en servir lui-même, depuis le jeu.
 *   - Écrire les valeurs : le seul chemin qui autorise une BAISSE (corriger une
 *     streak gonflée à tort) — « Restaurer » ne peut, par construction, que monter.
 */

import { api, toast, escHtml } from "./admin-api.js";

const MODE_LABELS = {
  classic: "🃏 Classique",
  emoji: "😀 Émoji",
  silhouette: "👤 Silhouette",
  alloutattack: "💥 All-Out Attack",
  personae: "🎭 Personae",
  music: "🎵 Musique",
};

export async function renderTabStreak(d) {
  const box = document.getElementById("user-detail-content");
  box.innerHTML =
    '<div style="padding:32px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  const s = await api.get(`/api/admin/users/${d.user.id}/streak`);
  if (!s || s.error) {
    box.innerHTML = `<div style="padding:32px;color:var(--red)">${escHtml(s?.error || "Impossible de lire la streak.")}</div>`;
    return;
  }

  const cooldown =
    s.cooldown_days_left > 0
      ? `<span style="color:var(--red)">🔒 indisponible — encore ${s.cooldown_days_left} jour(s)</span>`
      : '<span style="color:var(--green,#4caf50)">✅ disponible</span>';

  const modeRows = (s.modes || []).length
    ? s.modes
        .map(
          (m) => `<tr>
            <td><strong>${MODE_LABELS[m.mode] ?? escHtml(m.mode)}</strong></td>
            <td>${m.streak}</td>
            <td>${m.streak_record}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:16px">Aucune partie enregistrée.</td></tr>`;

  box.innerHTML = `
    <div class="tab-section">
      <h3>Streak globale</h3>
      <div class="tab-note">
        <code>global_streak_date</code> est la frontière de journée (heure de Paris) qui dit si la
        streak est encore vivante : la laisser incohérente avec la valeur écrite ferait repartir le
        compteur à la prochaine sync du joueur. Vide = aucune journée validée.
      </div>
      <div class="detail-quick-stats" style="margin-bottom:16px">
        <div class="stat-tile"><div class="stat-tile-value">${s.global_streak}</div><div class="stat-tile-label">En cours</div></div>
        <div class="stat-tile"><div class="stat-tile-value">${s.global_streak_record}</div><div class="stat-tile-label">Record</div></div>
        <div class="stat-tile"><div class="stat-tile-value">${s.days_played}</div><div class="stat-tile-label">Jours joués</div></div>
      </div>

      <table class="stats-table">
        <tbody>
          <tr>
            <td>Streak en cours</td>
            <td><input type="number" min="0" max="9999" class="stat-input" id="streak-current" value="${s.global_streak}"></td>
          </tr>
          <tr>
            <td>Record</td>
            <td><input type="number" min="0" max="9999" class="stat-input" id="streak-record" value="${s.global_streak_record}"></td>
          </tr>
          <tr>
            <td>Dernier jour validé</td>
            <td><input type="date" class="stat-input" id="streak-date" value="${escHtml(s.global_streak_date ?? "")}"></td>
          </tr>
          <tr>
            <td colspan="2" style="text-align:right">
              <button class="btn-secondary btn-small" id="streak-save">Écrire ces valeurs</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="tab-section">
      <h3>Récupération (Jack Frost)</h3>
      <div class="tab-note">
        État côté joueur : ${cooldown}${
          s.streak_recovered_at
            ? ` — dernière récupération le ${escHtml(String(s.streak_recovered_at).slice(0, 10))}`
            : " — jamais utilisée"
        }<br>
        « Restaurer » ignore le cooldown ET le plafond des ${s.days_played} jours joués, ne consomme
        pas la récupération du joueur, et ne fait jamais BAISSER une streak de mode déjà supérieure.
      </div>
      <table class="stats-table">
        <tbody>
          <tr>
            <td>Restaurer la streak à</td>
            <td><input type="number" min="1" max="9999" class="stat-input" id="streak-recover" value="${Math.max(1, s.global_streak_record)}"></td>
            <td style="text-align:right"><button class="btn-small" id="streak-recover-btn">Restaurer</button></td>
          </tr>
          <tr>
            <td colspan="2">Rendre Jack Frost de nouveau disponible au joueur</td>
            <td style="text-align:right">
              <button class="btn-small" id="streak-cooldown-btn" ${s.cooldown_days_left > 0 ? "" : "disabled"}>
                Effacer le cooldown
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="tab-section">
      <h3>Streaks par mode</h3>
      <div class="tab-note">
        Lecture seule ici — l'onglet 📊 Stats les modifie une par une. « Restaurer » ci-dessus les
        remonte toutes d'un coup.
      </div>
      <table class="stats-table">
        <thead><tr><th>Mode</th><th>En cours</th><th>Record</th></tr></thead>
        <tbody>${modeRows}</tbody>
      </table>
    </div>`;

  document.getElementById("streak-save").onclick = () => _save(d);
  document.getElementById("streak-recover-btn").onclick = () => _recover(d);
  const cdBtn = document.getElementById("streak-cooldown-btn");
  if (cdBtn) cdBtn.onclick = () => _resetCooldown(d);
}

async function _save(d) {
  const btn = document.getElementById("streak-save");
  btn.disabled = true;
  const res = await api.patch(`/api/admin/users/${d.user.id}/streak`, {
    action: "set",
    global_streak: +document.getElementById("streak-current").value,
    global_streak_record: +document.getElementById("streak-record").value,
    // Champ date vide → null explicite : "" ne serait pas une date valide en base.
    global_streak_date: document.getElementById("streak-date").value || null,
  });
  btn.disabled = false;

  if (res?.error) {
    toast("❌ " + res.error, "error");
    return;
  }
  toast("✅ Streak enregistrée.", "success");
  renderTabStreak(d);
}

async function _recover(d) {
  const streak = +document.getElementById("streak-recover").value;
  if (!confirm(`Restaurer la streak de ce joueur à ${streak} ? (sans consommer son Jack Frost)`)) {
    return;
  }

  const res = await api.patch(`/api/admin/users/${d.user.id}/streak`, {
    action: "recover",
    streak,
  });
  if (res?.error) {
    toast("❌ " + res.error, "error");
    return;
  }
  // `modes_updated` peut valoir 0 : tous les modes avaient déjà une streak
  // supérieure. Ce n'est pas un échec, mais l'admin doit le savoir plutôt que
  // de croire qu'il a remonté quelque chose.
  toast(
    res.modes_updated > 0
      ? `✅ Streak restaurée à ${streak} (${res.modes_updated} mode(s) remontés).`
      : `✅ Streak globale à ${streak}. Aucun mode remonté : tous étaient déjà au-dessus.`,
    "success"
  );
  renderTabStreak(d);
}

async function _resetCooldown(d) {
  if (!confirm("Rendre la récupération Jack Frost immédiatement disponible à ce joueur ?")) return;

  const res = await api.patch(`/api/admin/users/${d.user.id}/streak`, { action: "reset_cooldown" });
  if (res?.error) {
    toast("❌ " + res.error, "error");
    return;
  }
  toast("✅ Cooldown effacé — le joueur peut réutiliser Jack Frost.", "success");
  renderTabStreak(d);
}
