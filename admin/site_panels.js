/**
 * admin/site_panels.js — trois panneaux globaux (migration 042) :
 *   📣 Annonces   — bandeau sur toutes les pages (FR + EN, fenêtre de dates)
 *   🔧 Maintenance — fermer le site aux joueurs (l'admin reste dedans), message, retour prévu
 *   🛡️ Anti-triche — les écarts de cible du jour loggés, groupés par joueur
 */

import { api, toast, escHtml, renderLoading, renderError } from "./admin-api.js";

function fmt(sql) {
  if (!sql) return "—";
  const d = new Date(String(sql).replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? String(sql) : d.toLocaleString("fr-FR");
}
/** SQL UTC → valeur d'un <input type="datetime-local"> en heure Paris. */
function toLocalInput(sql) {
  if (!sql) return "";
  const d = new Date(String(sql).replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

// ── 📣 Annonces ──────────────────────────────────────────────────────────────

const LEVEL = { info: "📣 Info", warning: "⚠️ Avertissement", maintenance: "🔧 Maintenance" };

export async function renderAnnouncements() {
  const el = document.getElementById("announcements-panel-content");
  renderLoading(el);
  let res;
  try {
    res = await api.get("/api/admin/announcements");
  } catch {
    renderError(el, "Erreur lors du chargement des annonces.");
    return;
  }
  const list = res.announcements ?? [];

  el.innerHTML = `
    <div class="act-panel">
      <h2 style="margin:0 0 6px;color:var(--red)">📣 Annonces</h2>
      <p class="act-muted">Bandeau en haut de toutes les pages, fermable par le joueur (mémorisé). Le message EN sert à toutes les langues sauf le français ; vide = le FR partout. Les dates sont en heure de Paris.</p>

      <div class="form-grid" style="margin-top:12px">
        <label>Niveau
          <select id="ann-level">
            <option value="info">📣 Info</option>
            <option value="warning">⚠️ Avertissement</option>
            <option value="maintenance">🔧 Maintenance à venir</option>
          </select>
        </label>
        <label>Début (optionnel)<input id="ann-starts" type="datetime-local"></label>
        <label>Fin (optionnel)<input id="ann-ends" type="datetime-local"></label>
        <label style="grid-column:1/-1">Message FR<input id="ann-fr" type="text" maxlength="500" placeholder="ex : Maintenance ce soir de 22h à 23h — le classement sera figé."></label>
        <label style="grid-column:1/-1">Message EN (optionnel)<input id="ann-en" type="text" maxlength="500" placeholder="ex : Maintenance tonight 22:00–23:00 — the leaderboard will be frozen."></label>
      </div>
      <button class="btn-secondary" id="ann-create" style="margin-top:10px">📣 Publier</button>

      <h3 class="act-h3">Annonces (${list.length})</h3>
      ${
        list.length
          ? `<table class="act-table"><thead><tr><th>État</th><th>Niveau</th><th>Message</th><th>Fenêtre</th><th>Par</th><th></th></tr></thead><tbody>${list
              .map(
                (a) => `<tr class="${a.is_active ? "" : "ann-off"}">
            <td>${a.is_active ? "🟢 active" : "⚫ inactive"}</td>
            <td>${LEVEL[a.level] ?? escHtml(a.level)}</td>
            <td><div>${escHtml(a.message_fr)}</div>${a.message_en ? `<div class="act-muted">${escHtml(a.message_en)}</div>` : ""}</td>
            <td class="act-muted">${a.starts_at || a.ends_at ? `${escHtml(fmt(a.starts_at))} → ${escHtml(fmt(a.ends_at))}` : "—"}</td>
            <td class="act-muted">${escHtml(a.created_by_pseudo ?? "—")}</td>
            <td style="white-space:nowrap">
              <button class="btn-sm ann-toggle" data-id="${a.id}" data-active="${a.is_active ? 1 : 0}">${a.is_active ? "Désactiver" : "Activer"}</button>
              <button class="btn-sm ann-delete" data-id="${a.id}">✕</button>
            </td>
          </tr>`
              )
              .join("")}</tbody></table>`
          : `<p class="act-muted">Aucune annonce.</p>`
      }
    </div>`;

  document.getElementById("ann-create").addEventListener("click", async () => {
    const payload = {
      level: document.getElementById("ann-level").value,
      message_fr: document.getElementById("ann-fr").value.trim(),
      message_en: document.getElementById("ann-en").value.trim(),
      starts_at: document.getElementById("ann-starts").value,
      ends_at: document.getElementById("ann-ends").value,
    };
    if (!payload.message_fr) return toast("Le message FR est obligatoire", "error");
    const r = await api.post("/api/admin/announcements", payload);
    if (r.error) return toast("❌ " + r.error, "error");
    toast("📣 Annonce publiée", "success");
    renderAnnouncements();
  });
  el.querySelectorAll(".ann-toggle").forEach((b) =>
    b.addEventListener("click", async () => {
      const r = await api.patch(`/api/admin/announcements/${b.dataset.id}`, {
        is_active: b.dataset.active !== "1",
      });
      if (r.error) return toast("❌ " + r.error, "error");
      renderAnnouncements();
    })
  );
  el.querySelectorAll(".ann-delete").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Supprimer cette annonce ?")) return;
      const r = await api.delete(`/api/admin/announcements/${b.dataset.id}`);
      if (r.error) return toast("❌ " + r.error, "error");
      renderAnnouncements();
    })
  );
}

// ── 🔧 Maintenance ───────────────────────────────────────────────────────────

export async function renderMaintenance() {
  const el = document.getElementById("maintenance-panel-content");
  renderLoading(el);
  let res;
  try {
    res = await api.get("/api/admin/settings");
  } catch {
    renderError(el, "Erreur lors du chargement des réglages.");
    return;
  }
  const m = res.maintenance ?? {};

  el.innerHTML = `
    <div class="act-panel">
      <h2 style="margin:0 0 6px;color:var(--red)">🔧 Maintenance</h2>
      <p class="act-muted">Quand c'est activé : les joueurs voient un écran « maintenance en cours » et l'API leur répond 503 (rien n'est enregistré). Toi, connecté en admin, tu continues à naviguer et à tester — un bandeau te rappelle de la lever. Elle ne se lève <strong>pas</strong> toute seule à l'heure de retour prévue : c'est toi qui décides.</p>

      <div class="maint-state ${m.enabled ? "maint-state--on" : "maint-state--off"}">
        <span>${m.enabled ? "🔴 MAINTENANCE ACTIVE — le site est fermé aux joueurs" : "🟢 Site ouvert"}</span>
        <button class="${m.enabled ? "btn-secondary" : "btn-danger"}" id="maint-toggle">${m.enabled ? "✅ Rouvrir le site" : "🔧 Fermer le site (maintenance)"}</button>
      </div>

      <div class="form-grid" style="margin-top:14px">
        <label style="grid-column:1/-1">Message FR<input id="maint-fr" type="text" maxlength="500" value="${escHtml(m.message_fr ?? "")}" placeholder="ex : Migration de la base de données — on revient vite."></label>
        <label style="grid-column:1/-1">Message EN (optionnel)<input id="maint-en" type="text" maxlength="500" value="${escHtml(m.message_en ?? "")}" placeholder="ex : Database migration — back soon."></label>
        <label>Retour prévu (informatif, heure Paris)<input id="maint-until" type="datetime-local" value="${toLocalInput(m.until)}"></label>
      </div>
      <button class="btn-secondary" id="maint-save" style="margin-top:10px">💾 Enregistrer le message</button>
      <p class="mod-hint">Conseil : publie d'abord une <strong>annonce</strong> « maintenance à venir » quelques heures avant, puis ferme le site ici. Pense au <code>CACHE_VERSION</code> du service worker si tu déploies du code pendant la fermeture.</p>
    </div>`;

  const save = async (extra = {}) => {
    const r = await api.patch("/api/admin/settings", {
      maintenance: {
        message_fr: document.getElementById("maint-fr").value.trim(),
        message_en: document.getElementById("maint-en").value.trim(),
        until: document.getElementById("maint-until").value,
        ...extra,
      },
    });
    if (r.error) return (toast("❌ " + r.error, "error"), null);
    return r.maintenance;
  };
  document.getElementById("maint-save").addEventListener("click", async () => {
    if (await save()) toast("💾 Message enregistré", "success");
  });
  document.getElementById("maint-toggle").addEventListener("click", async () => {
    const enable = !m.enabled;
    if (
      enable &&
      !confirm(
        "Fermer le site aux joueurs maintenant ? Ils verront l'écran de maintenance immédiatement."
      )
    )
      return;
    const r = await save({ enabled: enable });
    if (r) {
      toast(
        enable ? "🔧 Site fermé — maintenance active" : "✅ Site rouvert",
        enable ? "error" : "success"
      );
      renderMaintenance();
    }
  });
}

// ── 🛡️ Anti-triche ───────────────────────────────────────────────────────────

let _acDays = 30;

export async function renderAnticheat(openUser) {
  const el = document.getElementById("anticheat-panel-content");
  renderLoading(el);
  let res;
  try {
    res = await api.get(`/api/admin/anticheat?days=${_acDays}`);
  } catch {
    renderError(el, "Erreur lors du chargement.");
    return;
  }
  const users = res.users ?? [];

  el.innerHTML = `
    <div class="act-panel">
      <div class="act-head">
        <h2 style="margin:0;color:var(--red)">🛡️ Anti-triche</h2>
        <div class="act-range">${[7, 30, 90].map((n) => `<button class="btn-sm ac-range${n === _acDays ? " active act-range-btn" : ""}" data-days="${n}">${n} j</button>`).join("")}</div>
      </div>
      <p class="act-muted">Écarts entre la cible du jour attendue par le serveur et celle envoyée par le client (<code>api/sessions.php</code>, détection seulement — la partie est quand même enregistrée). ${res.total} écart(s) sur ${res.days} j. Un écart isolé peut être un client périmé ou un fuseau horaire ; une série sur le même joueur, non.</p>
      ${
        users.length
          ? `<table class="act-table"><thead><tr><th>Joueur</th><th>Écarts</th><th>Dernier</th><th>Exemples (mode · attendu → reçu)</th><th></th></tr></thead><tbody>${users
              .map(
                (u) => `<tr>
            <td>${u.pseudo ? escHtml(u.pseudo) : `<span class="act-muted">#${u.user_id || "?"}</span>`}${u.is_banned ? ' <span class="ac-banned">banni</span>' : ""}</td>
            <td><strong>${u.count}</strong></td>
            <td class="act-muted">${escHtml(fmt(u.last_at))}</td>
            <td class="act-muted">${u.samples.map((s) => `${escHtml(s.mode ?? "?")} · ${escHtml(s.expected ?? "?")} → <strong>${escHtml(s.received ?? "?")}</strong>`).join("<br>")}</td>
            <td style="white-space:nowrap">${u.user_id ? `<button class="btn-sm ac-open" data-id="${u.user_id}">Voir le joueur →</button>` : ""}</td>
          </tr>`
              )
              .join("")}</tbody></table>`
          : `<p class="act-muted">Aucun écart sur la période. 🎉</p>`
      }
    </div>`;

  el.querySelectorAll(".ac-range").forEach((b) =>
    b.addEventListener("click", () => {
      _acDays = Number(b.dataset.days);
      renderAnticheat(openUser);
    })
  );
  el.querySelectorAll(".ac-open").forEach((b) =>
    b.addEventListener("click", () => openUser(Number(b.dataset.id), "moderation"))
  );
}
