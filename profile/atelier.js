/**
 * profile/atelier.js — l'Atelier du profil : onglets de personnalisation et
 * indicateur d'enregistrement automatique.
 *
 * Remplace (2.2, décision Hamza du 2026-09-16) les boutons « Change Picture »,
 * « Titles », « Save » et la carte « Customization » dépliable : une carte
 * d'identité qui se met à jour en direct, un panneau à cinq onglets (Avatar,
 * Bordure, Thème, Titre, Badges), et plus de bouton à ne pas oublier — chaque
 * choix part au serveur tout de suite, l'état se lit sur la carte.
 *
 * Ce module ne connaît ni le profil ni l'API : profile-page.js lui passe la
 * fonction de synchronisation, il ne fait que l'orchestrer (regroupement,
 * état affiché, relance). Testable sans le reste de la page.
 */

const TAB_STORAGE_KEY = "atelierTab";
const PANES = ["avatar", "border", "theme", "title", "badges"];

/** t(key) renvoie la clé si absente — cf. CLAUDE.md §5. */
function t(key, fallback) {
  const r = window.i18n?.t?.(key);
  return r != null && r !== key ? r : fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONGLETS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ouvre un onglet de l'atelier (et mémorise le choix pour la prochaine visite).
 * @param {string} name  avatar | border | theme | title | badges
 * @param {{ scroll?: boolean }} [opts]  scroll : amener l'atelier à l'écran
 *        (clic depuis la carte d'identité, sur mobile l'atelier est plus bas)
 */
export function openAtelierTab(name, { scroll = false } = {}) {
  if (!PANES.includes(name)) name = PANES[0];
  const tabs = document.querySelectorAll(".atelier-tab");
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    const active = tab.dataset.pane === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(".atelier-pane").forEach((pane) => {
    pane.classList.toggle("hidden", pane.dataset.pane !== name);
  });
  try {
    localStorage.setItem(TAB_STORAGE_KEY, name);
  } catch {
    /* stockage indisponible : l'onglet ne sera pas mémorisé, c'est tout */
  }
  if (scroll) {
    document.getElementById("atelier")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
}

/** Onglet mémorisé, ou le premier. */
export function savedAtelierTab() {
  try {
    const v = localStorage.getItem(TAB_STORAGE_KEY);
    return PANES.includes(v) ? v : PANES[0];
  } catch {
    return PANES[0];
  }
}

/**
 * Câble les onglets (clic + flèches gauche/droite, comme un vrai tablist) et
 * rouvre le dernier onglet utilisé.
 */
export function initAtelier() {
  const list = document.getElementById("atelierTabs");
  if (!list) return;
  list.addEventListener("click", (e) => {
    const tab = e.target.closest(".atelier-tab");
    if (tab) openAtelierTab(tab.dataset.pane);
  });
  list.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = [...list.querySelectorAll(".atelier-tab")];
    const i = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    if (next) {
      openAtelierTab(next.dataset.pane);
      next.focus();
    }
    e.preventDefault();
  });
  openAtelierTab(savedAtelierTab());
}

// ─────────────────────────────────────────────────────────────────────────────
// ENREGISTREMENT AUTOMATIQUE
// ─────────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 700;
const SAVED_MS = 1800;

let _sync = null; // () => Promise<void> — fourni par la page
let _timer = null;
let _savedTimer = null;
let _running = false;
let _again = false;

/** État affiché : idle | saving | saved | error. */
function _setStatus(state) {
  const el = document.getElementById("saveStatus");
  const txt = document.getElementById("saveStatusText");
  if (!el) return;
  el.dataset.state = state;
  el.classList.toggle("save-status--error", state === "error");
  if (!txt) return;
  txt.textContent =
    state === "saving"
      ? t("profile.saving", "Saving…")
      : state === "saved"
        ? t("profile.saved", "Saved")
        : state === "error"
          ? t("profile.save_failed", "Not saved — tap to retry")
          : t("profile.all_saved", "Everything is saved");
}

/**
 * Branche l'indicateur sur la fonction de synchronisation de la page.
 * @param {() => Promise<void>} sync  envoie le profil complet au serveur
 */
export function initSaveStatus(sync) {
  _sync = sync;
  _setStatus("idle");
  document.getElementById("saveStatus")?.addEventListener("click", () => {
    if (document.getElementById("saveStatus")?.dataset.state === "error") flushAutosave();
  });
}

/**
 * À appeler après CHAQUE changement du joueur (c'est le `markDirty` historique) :
 * l'indicateur passe en « Enregistrement… » et la synchronisation part après un
 * court regroupement — dix clics de pastille = un seul envoi.
 */
export function scheduleAutosave() {
  clearTimeout(_timer);
  clearTimeout(_savedTimer);
  _setStatus("saving");
  _timer = setTimeout(flushAutosave, DEBOUNCE_MS);
}

/** Envoie tout de suite (fin du regroupement, ou relance après une erreur). */
export async function flushAutosave() {
  clearTimeout(_timer);
  if (_running) {
    // Un changement pendant l'envoi : on renverra à la fin, pas en parallèle.
    _again = true;
    return;
  }
  _running = true;
  _setStatus("saving");
  let ok = true;
  try {
    await _sync?.();
  } catch {
    ok = false;
  }
  _running = false;
  if (_again) {
    _again = false;
    return flushAutosave();
  }
  if (!ok) {
    _setStatus("error");
    return;
  }
  _setStatus("saved");
  _savedTimer = setTimeout(() => _setStatus("idle"), SAVED_MS);
}

/** Usage tests : remet le module à zéro. */
export function _resetAutosave() {
  clearTimeout(_timer);
  clearTimeout(_savedTimer);
  _timer = null;
  _savedTimer = null;
  _running = false;
  _again = false;
  _sync = null;
}
