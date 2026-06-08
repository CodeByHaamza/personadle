/**
 * js/streak-recovery.js — Menu de récupération de streak Jack Frost
 *
 * Usage :
 *   import { checkStreakRecovery, showStreakRecoveryMenu, canRecover } from './streak-recovery.js';
 *   checkStreakRecovery();  // appeler après auth sur index.html
 *
 * Limite : 1 récupération tous les 2 mois, stockée en localStorage.
 * Déclenchement : premier chargement du jour si la streak a été brisée.
 */

const RECOVERY_KEY = "streakRecovery";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000; // 60 jours en ms

function _imgBase() {
  const p = window.location.pathname;
  return p.startsWith("/personadle/") ? "/personadle/img/" : "/img/";
}

function _getRecovery() {
  try {
    return JSON.parse(localStorage.getItem(RECOVERY_KEY) || "{}");
  } catch {
    return {};
  }
}

function _saveRecovery(r) {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(r));
}

/** Retourne true si la récupération est disponible (délai de 2 mois respecté). */
export function canRecover() {
  const r = _getRecovery();
  if (!r.previousStreak || r.previousStreak <= 1) return false;
  if (!r.lastUsed) return true;
  return Date.now() - new Date(r.lastUsed).getTime() >= TWO_MONTHS_MS;
}

/**
 * Vérifie si le menu doit s'afficher au login.
 * - `shown` est écrit UNIQUEMENT quand l'utilisateur confirme (dans _recover)
 * - `_srDismissed` en sessionStorage empêche la ré-apparition si "Not now"
 */
export function checkStreakRecovery() {
  const r = _getRecovery();
  if (!r.previousStreak || r.previousStreak <= 1) return;
  if (r.shown) return;
  if (!canRecover()) return;
  // Ne pas réafficher si déjà dismissé dans cette session de navigation
  try { if (sessionStorage.getItem("_srDismissed")) return; } catch (_) {}

  // Petit délai pour laisser la page se stabiliser
  setTimeout(() => showStreakRecoveryMenu(r.previousStreak), 800);
}

/** Ouvre le menu manuellement (bouton "Restaurer" sur la page profil). */
export function showStreakRecoveryMenu(previousStreak) {
  if (!previousStreak) {
    const r = _getRecovery();
    previousStreak = r.previousStreak;
  }
  if (!previousStreak) return;

  document.getElementById("streak-recovery-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "streak-recovery-overlay";
  overlay.innerHTML = `
    <div class="sr-backdrop" id="sr-backdrop"></div>
    <div class="sr-menu" id="sr-menu">
      <div class="sr-snowflakes" id="sr-snowflakes"></div>
      <div class="sr-jack-wrap">
        <img src="${_imgBase()}Jacck_frost_streak.png" alt="Jack Frost" class="sr-jack-img" id="sr-jack-img">
      </div>
      <h2 class="sr-title">Streak Lost! 🥶</h2>
      <p class="sr-subtitle">You had a <strong>${previousStreak}-day streak</strong> 🔥</p>
      <p class="sr-desc">Jack Frost can restore it — once every 2 months.</p>
      <div class="sr-buttons">
        <button class="sr-btn-recover" id="sr-btn-recover">🔥 Restore my streak!</button>
        <button class="sr-btn-cancel"  id="sr-btn-cancel">Not now</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  _spawnSnowflakes();
  requestAnimationFrame(() => overlay.classList.add("sr--visible"));

  overlay
    .querySelector("#sr-btn-recover")
    .addEventListener("click", () => _recover(previousStreak, overlay));
  overlay.querySelector("#sr-btn-cancel").addEventListener("click", () => _close(overlay));
  overlay.querySelector("#sr-backdrop").addEventListener("click", () => _close(overlay));
}

function _spawnSnowflakes() {
  const container = document.getElementById("sr-snowflakes");
  if (!container) return;
  const chars = ["❄", "❅", "❆"];
  for (let i = 0; i < 22; i++) {
    const el = document.createElement("span");
    el.className = "sr-snowflake";
    el.textContent = chars[i % 3];
    el.style.left = `${Math.random() * 100}%`;
    el.style.fontSize = `${9 + Math.random() * 14}px`;
    el.style.animationDuration = `${2.2 + Math.random() * 2.8}s`;
    el.style.animationDelay = `${-Math.random() * 4}s`;
    container.appendChild(el);
  }
}

function _recover(previousStreak, overlay) {
  const menu = document.getElementById("sr-menu");
  if (menu) menu.classList.add("sr--embrase");

  // Marquer `shown` maintenant que l'utilisateur a confirmé (pas avant)
  const _rConfirm = _getRecovery();
  _rConfirm.shown = true;
  _saveRecovery(_rConfirm);

  // 1. Restaurer la streak en localStorage + marquer la recovery pour le badge reborn_phoenix
  try {
    const profile = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
    if (profile.stats) {
      profile.stats.streak = previousStreak;
      profile.stats.streakRecord = Math.max(profile.stats.streakRecord || 0, previousStreak);
    }
    profile.streakRestorationUsed = true;
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("personadle:streak-recovered"));
  } catch (_) {}

  // 2. Sync vers le backend (fire-and-forget)
  _syncRecoveryToBackend(previousStreak);

  // 3. Enregistrer la récupération (date + consommer le crédit)
  const r = _getRecovery();
  r.lastUsed = new Date().toISOString().split("T")[0];
  r.previousStreak = 0;
  _saveRecovery(r);

  setTimeout(() => _close(overlay), 1800);
}

function _syncRecoveryToBackend(previousStreak) {
  const prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
  fetch(`${prefix}/api/user/recover-streak`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ previous_streak: previousStreak }),
  }).catch(() => {}); // Silencieux si offline
}

function _close(overlay) {
  if (!overlay) overlay = document.getElementById("streak-recovery-overlay");
  if (!overlay) return;
  // Mémoriser le dismiss en sessionStorage pour ne pas réafficher dans la même session
  try { sessionStorage.setItem("_srDismissed", "1"); } catch (_) {}
  overlay.classList.add("sr--exit");
  setTimeout(() => overlay.remove(), 420);
}
