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
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getTypeLabel(type) {
  return { badge: "Badge", wallpaper: "Wallpaper", title: "Titre", stats: "Stats" }[type] || type;
}
