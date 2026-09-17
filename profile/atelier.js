/**
 * profile/atelier.js — l'Atelier du profil : la modale de personnalisation
 * (onglets) et l'indicateur d'enregistrement automatique.
 *
 * Remplace (2.2, décision Hamza du 2026-09-16) les boutons « Change Picture »,
 * « Titles », « Save » et la carte « Customization » dépliable. Second retour
 * du même jour : tout ça n'est plus posé dans la page mais dans UNE modale —
 * la page profil redevient une vitrine (badges, stats, collection), l'édition
 * se fait dans l'atelier, ouvert par « Personnaliser », par le ✎ de l'avatar,
 * par la puce de titre ou par un emplacement de badge vide.
 *
 * Ce module ne connaît ni le profil ni l'API : profile-page.js lui passe la
 * fonction de synchronisation, il ne fait que l'orchestrer (regroupement,
 * état affiché, relance). Testable sans le reste de la page.
 */

import { openModal, closeModal } from "../js/modal.js";

const TAB_STORAGE_KEY = "atelierTab";
const MODAL_ID = "atelierModal";
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
 * Sélectionne un onglet de l'atelier (et mémorise le choix pour la prochaine
 * visite). N'ouvre PAS la modale — voir openAtelier().
 * @param {string} name  avatar | border | theme | title | badges
 */
export function openAtelierTab(name) {
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
  // Un onglet rouvert doit se lire depuis le haut (la grille de portraits et la
  // grille de titres défilent, et la modale garde sa position de défilement).
  document.querySelector(".atelier-panes")?.scrollTo?.({ top: 0 });
  try {
    localStorage.setItem(TAB_STORAGE_KEY, name);
  } catch {
    /* stockage indisponible : l'onglet ne sera pas mémorisé, c'est tout */
  }
}

/**
 * Ouvre la modale de personnalisation sur un onglet donné.
 * @param {string} [name]  onglet à ouvrir (défaut : le dernier utilisé)
 */
export function openAtelier(name) {
  openAtelierTab(name || savedAtelierTab());
  if (!document.getElementById(MODAL_ID)) return;
  openModal(MODAL_ID);
}

/** Ferme la modale et envoie tout de suite ce qui restait en attente. */
export function closeAtelier() {
  if (!document.getElementById(MODAL_ID)) return;
  closeModal(MODAL_ID);
  // Ne jamais laisser un choix dans le tampon de regroupement derrière soi :
  // le joueur vient de fermer, pour lui c'est fini. (Rien en attente : on
  // n'envoie pas un profil complet pour une simple ouverture/fermeture.)
  if (_timer) flushAutosave();
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
 * Câble la modale : bouton « Personnaliser », fermeture (✕, clic sur le fond),
 * onglets (clic + flèches gauche/droite, comme un vrai tablist).
 */
export function initAtelier() {
  const list = document.getElementById("atelierTabs");
  if (list && !list._atelierBound) {
    list._atelierBound = true;
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
  }

  document.getElementById("openAtelierBtn")?.addEventListener("click", () => openAtelier());
  document.getElementById("closeAtelierModal")?.addEventListener("click", closeAtelier);
  const modal = document.getElementById(MODAL_ID);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeAtelier();
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

/**
 * État affiché : idle | saving | saved | error. Écrit sur TOUS les indicateurs
 * (`[data-save-status]`) : celui de la carte d'identité et celui de l'en-tête de
 * la modale — modale ouverte, la carte est derrière le fond assombri.
 */
function _setStatus(state) {
  const label =
    state === "saving"
      ? t("profile.saving", "Saving…")
      : state === "saved"
        ? t("profile.saved", "Saved")
        : state === "error"
          ? t("profile.save_failed", "Not saved — tap to retry")
          : t("profile.all_saved", "Everything is saved");

  document.querySelectorAll("[data-save-status]").forEach((el) => {
    el.dataset.state = state;
    el.classList.toggle("save-status--error", state === "error");
    const txt = el.querySelector("[data-save-status-text]");
    if (txt) txt.textContent = label;
  });
}

/**
 * Branche l'indicateur sur la fonction de synchronisation de la page.
 * @param {() => Promise<void>} sync  envoie le profil complet au serveur
 */
export function initSaveStatus(sync) {
  _sync = sync;
  _setStatus("idle");
  document.querySelectorAll("[data-save-status]").forEach((el) => {
    if (el._retryBound) return;
    el._retryBound = true;
    el.addEventListener("click", () => {
      if (el.dataset.state === "error") flushAutosave();
    });
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

/** Envoie tout de suite (fin du regroupement, fermeture, ou relance après une erreur). */
export async function flushAutosave() {
  clearTimeout(_timer);
  _timer = null;
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
