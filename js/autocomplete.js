/**
 * js/autocomplete.js — Utilitaires d'autocomplétion partagés entre les modes.
 *
 * Extrait de classiqueMode/modeClassique.js, emojiMode/emojiMode.js et
 * allOutAttackMode/modeAllOutAttack.js, où ces deux fonctions étaient dupliquées
 * à l'identique (3 copies).
 *
 * Note : `initializeAutocomplete` elle-même n'a PAS été fusionnée — les 3 modes
 * ont chacun une implémentation qui a divergé (debounce, cache, reset par clonage
 * du listener…), probablement pour corriger des bugs spécifiques. Les unifier
 * sans pouvoir vérifier visuellement les 3 pages serait risqué — laissé tel quel.
 */

/**
 * Ferme toutes les listes d'autocomplétion ouvertes, sauf celle appartenant à
 * l'élément cliqué/actif.
 * @param {EventTarget|null} e            - Cible du clic (ou null pour tout fermer)
 * @param {HTMLElement}       inputElement - Le champ de saisie à préserver
 */
export function closeAutocompleteList(e, inputElement) {
  // Array.from() : getElementsByClassName() is a LIVE collection — removing an
  // item while iterating it directly shrinks it mid-loop and skips the next one.
  const items = Array.from(document.getElementsByClassName("autocomplete-items"));
  for (const item of items) {
    if (e !== item && e !== inputElement) item.remove();
  }
}

/** Ferme inconditionnellement toutes les listes d'autocomplétion ouvertes. */
export function closeAllAutocompleteLists() {
  document.querySelectorAll(".autocomplete-items").forEach((el) => el.remove());
}

/**
 * Retire un nom du pool d'autocomplétion (pour ne pas pouvoir le re-proposer
 * après qu'il a été deviné).
 * @param {string[]} array - Le tableau de noms à muter en place (splice)
 * @param {string}   name  - Le nom à retirer (comparaison insensible à la casse)
 */
export function removeFromAutocomplete(array, name) {
  const idx = array.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  if (idx !== -1) array.splice(idx, 1);
}
