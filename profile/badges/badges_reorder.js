/**
 * profile/badges/badges_reorder.js — réordonner ses badges épinglés.
 *
 * `profile.selectedBadges` est un tableau ORDONNÉ depuis toujours, et
 * `renderBadgesPreview()` le rend dans cet ordre. Jusqu'ici le joueur n'avait
 * aucun moyen de le changer : l'ordre était celui dans lequel il avait épinglé,
 * et le corriger demandait de tout dépingler pour recommencer.
 *
 * ── Pourquoi des Pointer Events et pas le glisser-déposer HTML5 ─────────────
 * L'API `dragstart`/`dragover`/`drop` ne se déclenche PAS au doigt : sur mobile,
 * elle ne fait rien du tout. Or le jeu est très joué sur mobile — le dépôt a une
 * suite E2E entière à 390 px. Les Pointer Events, eux, couvrent souris, doigt et
 * stylet avec le même code.
 *
 * ── Ce qui évite de casser le clic ─────────────────────────────────────────
 * Un badge épinglé porte déjà un bouton ✕. Un glissement ne démarre donc qu'après
 * un SEUIL de quelques pixels : en deçà, c'est un clic, et le ✕ garde son
 * comportement. Sans ce seuil, dépingler deviendrait un jeu d'adresse.
 *
 * ── Et sans pointeur ────────────────────────────────────────────────────────
 * Les flèches gauche/droite déplacent le badge qui a le focus. Un réordonnancement
 * uniquement au glisser serait inaccessible au clavier, et la rangée est déjà
 * atteignable en tabulation.
 */

/** Distance (px) au-delà de laquelle un appui devient un glissement. */
const SEUIL_GLISSEMENT = 6;

/**
 * Déplace un élément d'un tableau, en renvoyant un NOUVEAU tableau.
 * Exporté pour être testable sans DOM : c'est toute la logique métier du lot.
 *
 * @param {string[]} liste
 * @param {number} depuis index de départ
 * @param {number} vers   index d'arrivée
 * @returns {string[]} l'ordre résultant (la liste d'origine si le coup est nul)
 */
export function deplacerBadge(liste, depuis, vers) {
  if (!Array.isArray(liste)) return [];
  const n = liste.length;
  if (!Number.isInteger(depuis) || !Number.isInteger(vers)) return [...liste];
  if (depuis < 0 || depuis >= n || vers < 0 || vers >= n || depuis === vers) return [...liste];
  const copie = [...liste];
  const [pris] = copie.splice(depuis, 1);
  copie.splice(vers, 0, pris);
  return copie;
}

/** Index de la case sous un point de l'écran, ou -1. */
function caseSous(cases, x, y) {
  for (let i = 0; i < cases.length; i++) {
    const r = cases[i].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
  }
  return -1;
}

/**
 * Rend la rangée de badges épinglés réordonnable.
 *
 * Idempotent : appelée après chaque rendu de la rangée (le DOM est reconstruit
 * à chaque fois), elle ne pose qu'un seul jeu d'écouteurs par élément.
 *
 * @param {HTMLElement|null} rangee    conteneur des cases (#previewBadges)
 * @param {Object} profile             profil, dont `selectedBadges`
 * @param {Function} onOrdreChange     appelée avec le nouvel ordre, pour sauvegarder
 */
export function initBadgeReorder(rangee, profile, onOrdreChange) {
  if (!rangee || typeof onOrdreChange !== "function") return;

  const cases = [...rangee.querySelectorAll(".pin-slot--filled")];
  // Un seul badge épinglé : il n'y a rien à réordonner, et rendre la case
  // « glissable » laisserait croire le contraire.
  if (cases.length < 2) return;

  cases.forEach((element, index) => {
    element.classList.add("pin-slot--movable");
    // Ceinture et bretelles : le CSS neutralise déjà le glisser natif de l'image,
    // l'attribut le dit au navigateur avant même que la feuille soit appliquée.
    element.querySelectorAll("img").forEach((i) => i.setAttribute("draggable", "false"));
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "listitem");
    element.setAttribute("aria-roledescription", "badge réordonnable");

    // ── Clavier ──────────────────────────────────────────────────────────
    element.addEventListener("keydown", (e) => {
      const gauche = e.key === "ArrowLeft";
      const droite = e.key === "ArrowRight";
      if (!gauche && !droite) return;
      e.preventDefault();
      const ordre = deplacerBadge(
        profile.selectedBadges || [],
        index,
        index + (droite ? 1 : -1)
      );
      if (ordre.join() !== (profile.selectedBadges || []).join()) {
        onOrdreChange(ordre);
      }
    });

    // ── Pointeur (souris, doigt, stylet) ─────────────────────────────────
    element.addEventListener("pointerdown", (e) => {
      // Le ✕ garde la priorité : dépingler ne doit pas devenir un glissement.
      if (e.target.closest(".pin-unpin")) return;
      if (e.button !== undefined && e.button !== 0) return;

      const departX = e.clientX;
      const departY = e.clientY;
      let glisse = false;
      let cible = index;

      const bouge = (ev) => {
        if (!glisse) {
          const d = Math.hypot(ev.clientX - departX, ev.clientY - departY);
          if (d < SEUIL_GLISSEMENT) return;
          glisse = true;
          element.classList.add("pin-slot--dragging");
          // Capture le pointeur : le glissement survit à une sortie de la case,
          // ce qui est le cas normal dès qu'on dépasse le badge voisin.
          try {
            element.setPointerCapture(ev.pointerId);
          } catch {
            /* navigateur sans capture : le glissement marche quand même */
          }
        }
        const sous = caseSous(cases, ev.clientX, ev.clientY);
        if (sous !== -1) cible = sous;
        // Aperçu : la case survolée s'écarte, pour montrer où le badge tombera.
        cases.forEach((c, i) => c.classList.toggle("pin-slot--target", glisse && i === cible && i !== index));
      };

      const fin = (ev) => {
        element.removeEventListener("pointermove", bouge);
        element.removeEventListener("pointerup", fin);
        element.removeEventListener("pointercancel", fin);
        element.classList.remove("pin-slot--dragging");
        cases.forEach((c) => c.classList.remove("pin-slot--target"));
        try {
          element.releasePointerCapture(ev.pointerId);
        } catch {
          /* rien à libérer */
        }
        if (!glisse) return; // c'était un clic
        const ordre = deplacerBadge(profile.selectedBadges || [], index, cible);
        if (ordre.join() !== (profile.selectedBadges || []).join()) {
          onOrdreChange(ordre);
        }
      };

      element.addEventListener("pointermove", bouge);
      element.addEventListener("pointerup", fin);
      element.addEventListener("pointercancel", fin);
    });
  });

  rangee.setAttribute("role", "list");
}
