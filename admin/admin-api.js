/**
 * admin/admin-api.js — Helpers partagés par tous les panneaux du panel admin :
 * client REST (fetch + CSRF), toast, échappement HTML, libellés de type.
 */

import { getCsrfToken } from "../js/api.js";

// Gère /personadle/ en dev local vs / en prod.
export const pathPrefix = window.location.pathname.startsWith("/personadle") ? "/personadle" : "";

export const api = {
  get: (url) => fetch(pathPrefix + url, { credentials: "include" }).then((r) => r.json()),
  post: (url, body) =>
    fetch(pathPrefix + url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  patch: (url, body) =>
    fetch(pathPrefix + url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  delete: (url) =>
    fetch(pathPrefix + url, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-Token": getCsrfToken() },
    }).then((r) => r.json()),
};

export function toast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

export function escHtml(str) {
  // `??` (pas `||`) : un champ numérique valant légitimement 0 (compteur, id...)
  // ne doit pas s'afficher vide — seul null/undefined doit devenir "".
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getTypeLabel(type) {
  return { badge: "Badge", wallpaper: "Wallpaper", title: "Titre", stats: "Stats" }[type] || type;
}

/** Bandeau "Chargement…" injecté pendant le fetch initial d'un panneau. */
export function renderLoading(el) {
  el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Chargement…</div>';
}

/** Bandeau d'erreur injecté si le fetch initial d'un panneau échoue. */
export function renderError(el, message) {
  el.innerHTML = `<div style="padding:32px;color:var(--red)">${message}</div>`;
}

/**
 * Pagination "← Préc. / Page X sur Y / Suiv. →" partagée par les panneaux paginés
 * (audit-log, error-logs, deletion-requests, rate-limits).
 *
 * @param {string}   containerId - ID de l'élément conteneur, format `${prefix}-pagination`
 * @param {number}   total       - Nombre total d'éléments
 * @param {number}   page        - Page courante (1-indexée)
 * @param {number}   limit       - Éléments par page
 * @param {(page: number) => void} onChange - Appelé avec la nouvelle page au clic Préc./Suiv.
 */
export function renderPagination(containerId, { total, page, limit, onChange }) {
  const el = document.getElementById(containerId);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  const prefix = containerId.replace(/-pagination$/, "");
  el.innerHTML = `
    <button class="btn-sm" id="${prefix}-prev" ${page <= 1 ? "disabled" : ""}>← Préc.</button>
    <span>Page ${page} / ${totalPages}</span>
    <button class="btn-sm" id="${prefix}-next" ${page >= totalPages ? "disabled" : ""}>Suiv. →</button>
  `;
  document.getElementById(`${prefix}-prev`).onclick = () => onChange(Math.max(1, page - 1));
  document.getElementById(`${prefix}-next`).onclick = () => onChange(Math.min(totalPages, page + 1));
}
