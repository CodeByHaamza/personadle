/**
 * admin/challenges.js — Onglet « Défis » de la fiche utilisateur.
 *
 * Un défi vit dans DEUX états : la ligne `messages` côté serveur, et une case
 * `activeChallenge` dans le localStorage du joueur. Quand les deux divergent —
 * cache vidé, autre appareil, cible devenue injouable — le défi reste `accepted`
 * en base et le joueur n'a plus aucune prise dessus depuis le jeu. Le bouton
 * « Abandonner » de la page Amis couvre le cas courant ; cet onglet couvre le
 * reste, sans passer par phpMyAdmin.
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

/** Libellé + couleur de chaque statut, du point de vue de l'admin. */
const STATUS_LABELS = {
  unread: { label: "📨 En attente", cls: "challenge-status--pending" },
  accepted: { label: "⚔ En cours", cls: "challenge-status--active" },
  beaten: { label: "🏆 Relevé", cls: "challenge-status--ok" },
  expired: { label: "✗ Manqué", cls: "challenge-status--fail" },
  read: { label: "— Clos", cls: "challenge-status--muted" },
};

export async function renderTabChallenges(d) {
  const box = document.getElementById("user-detail-content");
  box.innerHTML =
    '<div style="padding:32px;text-align:center;color:var(--text-muted)">Chargement…</div>';

  const res = await api.get(`/api/admin/users/${d.user.id}/challenges`);
  if (!res || res.error) {
    box.innerHTML = `<div style="padding:32px;color:var(--red)">${escHtml(res?.error || "Impossible de lire les défis.")}</div>`;
    return;
  }

  const challenges = res.challenges || [];
  const stuck = challenges.filter((c) => c.status === "accepted").length;

  const rows = challenges.length
    ? challenges.map((c) => _row(c, d.user.id)).join("")
    : `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Aucun défi.</td></tr>`;

  box.innerHTML = `
    <div class="tab-section">
      <h3>Défis (100 plus récents)</h3>
      <div class="tab-note">
        <strong>Relancer</strong> repasse le défi « en attente » : il est de nouveau proposé au
        destinataire, avec la même cible et le même score à battre.<br>
        <strong>Annuler</strong> le clôt sans le compter comme manqué — c'est le geste à préférer
        pour débloquer quelqu'un ; « Manqué » ferait croire à l'expéditeur qu'une partie a eu lieu.<br>
        <strong>Supprimer</strong> retire la ligne pour LES DEUX joueurs : elle est partagée, ce
        n'est pas un masquage par utilisateur.
        ${
          stuck
            ? `<br><span style="color:var(--red)">⚠ ${stuck} défi(s) « en cours » — s'ils ne bougent plus, le joueur est bloqué dessus.</span>`
            : ""
        }
      </div>
      <div style="overflow-x:auto">
        <table class="stats-table">
          <thead>
            <tr>
              <th>Sens</th><th>Mode</th><th>À battre</th><th>Cible</th>
              <th>Statut</th><th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;

  box.querySelectorAll("[data-challenge-status]").forEach((btn) => {
    btn.onclick = () => _setStatus(d, +btn.dataset.mid, btn.dataset.challengeStatus);
  });
  box.querySelectorAll("[data-challenge-delete]").forEach((btn) => {
    btn.onclick = () => _remove(d, +btn.dataset.challengeDelete);
  });
}

function _row(c, userId) {
  const st = STATUS_LABELS[c.status] ?? {
    label: escHtml(c.status),
    cls: "challenge-status--muted",
  };
  const other = c.direction === "sent" ? c.receiver_pseudo : c.sender_pseudo;
  const arrow = c.direction === "sent" ? "→" : "←";
  const expert = c.challenge_is_expert
    ? ' <span class="expert-state expert-granted">Expert</span>'
    : "";

  // La cible est la RÉPONSE du défi. Affichée ici parce qu'un admin qui répare a
  // besoin de savoir si elle existe encore dans le dataset — c'est justement la
  // cause d'un défi injouable. Le joueur, lui, ne la voit jamais.
  const target = c.challenge_target
    ? `<code>${escHtml(c.challenge_target)}</code>`
    : '<span class="tab-note" style="margin:0">cible du jour</span>';

  // Les actions proposées dépendent de l'état : reproposer un défi déjà en
  // attente n'a aucun effet, et « annuler » un défi clos non plus.
  const actions = [];
  if (c.status !== "unread") {
    actions.push(
      `<button class="btn-small" data-mid="${c.id}" data-challenge-status="unread">Relancer</button>`
    );
  }
  if (c.status === "unread" || c.status === "accepted") {
    actions.push(
      `<button class="btn-small" data-mid="${c.id}" data-challenge-status="read">Annuler</button>`
    );
  }
  actions.push(
    `<button class="btn-small btn-danger" data-challenge-delete="${c.id}">Supprimer</button>`
  );

  return `
    <tr>
      <td>${arrow} <strong>${escHtml(other)}</strong></td>
      <td>${MODE_LABELS[c.challenge_mode] ?? escHtml(c.challenge_mode ?? "?")}${expert}</td>
      <td>${c.challenge_score ?? "—"}</td>
      <td>${target}<br><span class="tab-note" style="margin:0">${escHtml(c.challenge_date ?? "")}</span></td>
      <td><span class="challenge-status ${st.cls}">${st.label}</span></td>
      <td style="text-align:right;white-space:nowrap">${actions.join(" ")}</td>
    </tr>`;
}

async function _setStatus(d, msgId, status) {
  const res = await api.patch(`/api/admin/users/${d.user.id}/challenges/${msgId}`, { status });
  if (res?.error) {
    toast("❌ " + res.error, "error");
    return;
  }
  toast(status === "unread" ? "✅ Défi relancé." : "✅ Défi annulé.", "success");
  renderTabChallenges(d);
}

async function _remove(d, msgId) {
  if (!confirm("Supprimer ce défi ? Il disparaîtra aussi chez l'autre joueur.")) return;

  const res = await api.delete(`/api/admin/users/${d.user.id}/challenges/${msgId}`);
  if (res?.error) {
    toast("❌ " + res.error, "error");
    return;
  }
  toast("✅ Défi supprimé.", "success");
  renderTabChallenges(d);
}
