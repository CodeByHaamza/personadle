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

import { getCsrfToken } from "./api.js";

const RECOVERY_KEY = "streakRecovery";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000; // 60 jours en ms

/**
 * Traduction avec fallback robuste (cf. CLAUDE.md §5) : t(key) renvoie la clé
 * brute si absente, donc on retombe sur `fallback` dans ce cas.
 */
function _t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

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

/** Retourne la valeur de previousStreak stockée en localStorage (0 si absente). */
export function getPreviousStreak() {
  return _getRecovery().previousStreak || 0;
}

/**
 * Aligne le cooldown local sur la date du serveur (`users.streak_recovered_at`).
 *
 * Appelé par `pullProfileFromCloud()`. Le backend est la source de vérité — y
 * compris pour effacer : `null` signifie « jamais récupéré », et doit donc
 * remettre `lastUsed` à zéro plutôt que d'être ignoré.
 *
 * @param {string|null|undefined} serverDate  `streak_recovered_at` (SQL/ISO) ou null
 */
export function syncRecoveryCooldown(serverDate) {
  if (serverDate === undefined) return; // champ absent (backend antérieur) → on ne touche à rien
  const r = _getRecovery();
  // MySQL renvoie "YYYY-MM-DD HH:MM:SS" en UTC : sans le "T" ni le "Z", Safari
  // refuse de le parser et les autres navigateurs l'interprètent en heure locale.
  const normalized =
    typeof serverDate === "string" && !serverDate.includes("T")
      ? serverDate.replace(" ", "T") + "Z"
      : serverDate;
  r.lastUsed = normalized || null;
  _saveRecovery(r);
}

/**
 * Retourne true si la récupération est disponible (cooldown de 60 jours respecté).
 *
 * ⚠️ `lastUsed` doit venir du SERVEUR (`syncRecoveryCooldown`), pas d'une trace
 * purement locale. Le cooldown est appliqué par le backend
 * (`api/lib/streak_recovery.php`) ; tant que le client ne connaissait que son
 * propre localStorage, l'absence de trace passait pour « disponible » — d'où un
 * Jack Frost proposé sur un autre appareil, après un cache vidé ou en navigation
 * privée, puis refusé par le serveur au clic.
 *
 * Le repli reste volontaire : hors ligne, ou avant la première synchronisation,
 * mieux vaut proposer une récupération que le serveur pourra refuser que la
 * cacher à quelqu'un qui y a droit.
 */
export function canRecover() {
  const r = _getRecovery();
  if (!r.previousStreak || r.previousStreak <= 1) return false;
  if (!r.lastUsed) return true;
  const used = new Date(r.lastUsed).getTime();
  if (Number.isNaN(used)) return true; // date illisible : ne pas bloquer sur une donnée corrompue
  return Date.now() - used >= TWO_MONTHS_MS;
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
  try {
    if (sessionStorage.getItem("_srDismissed")) return;
  } catch (_) {}

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
      <h2 class="sr-title">${_t("streak_recovery.title", "Streak Lost! 🥶")}</h2>
      <p class="sr-subtitle">${_t("streak_recovery.subtitle", `You had a ${previousStreak}-day streak 🔥`, { count: previousStreak })}</p>
      <p class="sr-desc">${_t("streak_recovery.description", "Jack Frost can restore it — once every 2 months.")}</p>
      <div class="sr-buttons">
        <button class="sr-btn-recover" id="sr-btn-recover">${_t("streak_recovery.restore_button", "🔥 Restore my streak!")}</button>
        <button class="sr-btn-cancel"  id="sr-btn-cancel">${_t("streak_recovery.cancel_button", "Not now")}</button>
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

  // Fermer en cliquant sur le fond — même garde anti-clic-accidentel que la modale
  // login/register (js/auth.js) : si le geste (mousedown) a commencé dans le contenu
  // du popup (ex : sélection de texte sur la description), on n'interprète pas un
  // relâchement qui déborde sur le fond comme un clic de fermeture intentionnel.
  const backdrop = overlay.querySelector("#sr-backdrop");
  let _dragStartedInside = false;
  overlay.addEventListener("mousedown", (e) => {
    _dragStartedInside = e.target !== backdrop;
  });
  backdrop.addEventListener("click", () => {
    if (!_dragStartedInside) _close(overlay);
    _dragStartedInside = false;
  });

  // Accessibilité : role=dialog, focus sur le bouton principal, Escape pour fermer.
  const menu = overlay.querySelector("#sr-menu");
  menu?.setAttribute("role", "dialog");
  menu?.setAttribute("aria-modal", "true");
  overlay.querySelector("#sr-btn-recover")?.focus();
  const onKey = (e) => {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onKey);
      _close(overlay);
    }
  };
  document.addEventListener("keydown", onKey);
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

/**
 * Applique la récupération localement : restaure la streak, marque le profil
 * pour le badge reborn_phoenix, consomme le crédit et notifie l'app.
 * N'est appelée QUE lorsque la récupération est confirmée fiable (cf. performRecovery).
 */
function _applyRecoveryLocally(previousStreak) {
  try {
    const profile = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
    if (profile.stats) {
      profile.stats.streak = previousStreak;
      profile.stats.streakRecord = Math.max(profile.stats.streakRecord || 0, previousStreak);
    }
    profile.streakRestorationUsed = true;
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));
  } catch (_) {}

  // Consommer le crédit (date + reset previousStreak) ET marquer comme confirmé
  const r = _getRecovery();
  r.lastUsed = new Date().toISOString().split("T")[0];
  r.previousStreak = 0;
  r.shown = true;
  _saveRecovery(r);

  window.dispatchEvent(new CustomEvent("personadle:streak-recovered"));
}

/**
 * Effectue la récupération de streak de façon FIABLE.
 *
 * - Utilisateur connecté → le backend fait autorité : on n'écrit le localStorage
 *   et on ne consomme le crédit QUE si le backend confirme (200). En cas de
 *   refus (429 cooldown, 400 validation) ou d'erreur réseau, rien n'est consommé
 *   et l'utilisateur peut réessayer — fini le "revert silencieux".
 * - Joueur invité (pas de compte) → application locale directe, aucun cloud à
 *   écraser donc aucun risque de revert.
 *
 * @param {number} previousStreak
 * @returns {Promise<{ok: boolean, status?: number, error?: string, streak?: number}>}
 */
export async function performRecovery(previousStreak) {
  const loggedIn = !!window._currentUser?.id;

  if (loggedIn) {
    const prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
    let res;
    try {
      res = await fetch(`${prefix}/api/user/recover-streak`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ previous_streak: previousStreak }),
      });
    } catch (_) {
      return { ok: false, error: "network" };
    }
    if (!res.ok) {
      let error = "error";
      try {
        error = (await res.json())?.error || error;
      } catch (_) {}
      return { ok: false, status: res.status, error };
    }
  }

  _applyRecoveryLocally(previousStreak);
  return { ok: true, streak: previousStreak };
}

async function _recover(previousStreak, overlay) {
  const menu = document.getElementById("sr-menu");
  const recoverBtn = overlay?.querySelector("#sr-btn-recover");
  if (recoverBtn) recoverBtn.disabled = true;

  const result = await performRecovery(previousStreak);

  if (!result.ok) {
    // Échec confirmé : on informe l'utilisateur sans consommer le crédit.
    const subtitle = overlay?.querySelector(".sr-subtitle");
    const msg =
      result.status === 429
        ? _t("streak_recovery.error_cooldown", "Recovery is on cooldown — try again later.")
        : result.error === "network"
          ? _t("streak_recovery.error_offline", "You appear to be offline. Please try again.")
          : _t(
              "streak_recovery.error_generic",
              "Recovery unavailable right now. Please try again."
            );
    if (subtitle) subtitle.textContent = msg;
    if (recoverBtn) recoverBtn.disabled = false;
    return;
  }

  // Succès : feu d'artifice puis fermeture.
  if (menu) menu.classList.add("sr--embrase");
  setTimeout(() => _close(overlay), 1800);
}

function _close(overlay) {
  if (!overlay) overlay = document.getElementById("streak-recovery-overlay");
  if (!overlay) return;
  // Mémoriser le dismiss en sessionStorage pour ne pas réafficher dans la même session
  try {
    sessionStorage.setItem("_srDismissed", "1");
  } catch (_) {}
  overlay.classList.add("sr--exit");
  setTimeout(() => overlay.remove(), 420);
}
