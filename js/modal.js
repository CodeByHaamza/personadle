/**
 * js/modal.js — Ouverture/fermeture accessible des modales (a11y partagée).
 * Extrait de js/auth.js (loginModal/registerModal) pour être réutilisé par
 * toutes les modales de l'app (crop avatar, sélecteur de musique, carte de
 * partage, titres…) plutôt que de réimplémenter le focus trap à chaque fois.
 *
 * Comportement :
 *   - role="dialog" + aria-modal="true" posés sur l'élément.
 *   - Focus initial sur le premier élément focusable de la modale.
 *   - Trap clavier : Tab/Shift+Tab reste cantonné aux éléments visibles
 *     de la modale (pas de fuite vers le contenu derrière).
 *   - Escape ferme la modale.
 *   - Le focus revient à l'élément qui avait le focus avant l'ouverture.
 *
 * Usage :
 *   import { openModal, closeModal } from "./modal.js";
 *   openModal("myModal");                 // affiche + active le trap
 *   closeModal("myModal");                // masque + désactive le trap
 *
 *   // Si la modale a un élément additionnel à synchroniser (ex: un overlay
 *   // séparé) qu'Escape doit aussi fermer :
 *   openModal("myModal", { onClose: () => overlay.classList.add("hidden") });
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** État du trap par modale (id → { prevFocus, keyHandler }) — plusieurs modales indépendantes supportées. */
const _trapState = new Map();

/**
 * Ouvre une modale de façon accessible : role=dialog, focus initial, trap
 * clavier (Tab cantonné, Escape ferme), restauration du focus à la fermeture.
 * @param {string} id - id de l'élément modale (retire la classe "hidden")
 * @param {{ onClose?: () => void }} [opts] - callback additionnel appelé
 *   quand la modale se ferme via Escape (ex: masquer un overlay séparé)
 */
export function openModal(id, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  // Double-open sur le même id sans closeModal() entre les deux : retirer
  // l'ancien listener keydown avant d'en poser un nouveau, sinon il reste
  // accroché à document pour toujours (cf. CLAUDE.md — ne jamais empiler
  // un listener sans vérifier qu'un précédent n'existe pas déjà).
  const stale = _trapState.get(id);
  if (stale) {
    document.removeEventListener("keydown", stale.keyHandler);
    _trapState.delete(id);
  }

  el.classList.remove("hidden");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");

  const prevFocus = document.activeElement;
  const focusables = el.querySelectorAll(FOCUSABLE);
  (focusables[0] || el).focus?.();

  const keyHandler = (e) => {
    if (e.key === "Escape") {
      closeModal(id);
      opts.onClose?.();
      return;
    }
    if (e.key !== "Tab") return;
    const visible = [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!visible.length) return;
    const first = visible[0];
    const last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", keyHandler);
  _trapState.set(id, { prevFocus, keyHandler });
}

/** Ferme une modale ouverte via openModal() et restaure le focus précédent. */
export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
  const state = _trapState.get(id);
  if (state) {
    document.removeEventListener("keydown", state.keyHandler);
    state.prevFocus?.focus?.();
    _trapState.delete(id);
  }
}
