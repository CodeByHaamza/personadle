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
 *
 * ── L'aperçu pendant le glissement ─────────────────────────────────────────
 * La première version se contentait de pâlir le badge saisi et d'écarter celui
 * survolé. Retour Hamza : « c'est pas intuitif, ça fait trop vide » — on ne
 * voyait pas où le badge allait atterrir, seulement un trou.
 *
 * Les badges se réorganisent donc EN DIRECT : dès que le pointeur passe sur un
 * voisin, le badge saisi prend sa place dans le DOM et les autres se décalent.
 * Il reste affiché, en transparence, exactement là où il tombera si on relâche.
 * La rangée montre à chaque instant l'ordre qu'elle aura — plus de trou, plus
 * d'effet à deviner.
 *
 * Conséquence assumée : pendant le glissement, l'ordre du DOM ne correspond plus
 * à `profile.selectedBadges`. C'est le DOM qui fait foi au relâchement, et un
 * glissement annulé se répare par un simple rendu.
 *
 * ── Le clic, enfin ──────────────────────────────────────────────────────────
 * Cliquer un badge épinglé ne faisait RIEN : pour relire la condition d'un de ses
 * propres badges, il fallait rouvrir l'atelier. Le seuil de glissement sait déjà
 * distinguer les deux gestes, donc c'est ici — et nulle part ailleurs — qu'un clic
 * peut être reconnu comme tel. D'où le rappel `onClic`.
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

/** Les cases actuellement dans la rangée, dans l'ordre du DOM. */
function casesVivantes(rangee) {
  return [...rangee.querySelectorAll(".pin-slot--filled")];
}

/**
 * Les emplacements de la rangée, relevés une fois pour tout le geste.
 *
 * On ne relit PAS les positions à chaque mouvement, et c'est volontaire. Deux
 * raisons, toutes deux constatées :
 *  - les cases décalées par l'animation portent un `transform`, que
 *    `getBoundingClientRect()` inclut : pendant la transition, une case répond
 *    encore depuis son ancienne place, le badge saisi « retombe » dessus et la
 *    rangée oscille d'un coup de souris à l'autre ;
 *  - le nombre de cases et leur taille ne changent pas pendant un glissement :
 *    ce sont les OCCUPANTS qui changent de place, pas les emplacements.
 *
 * On raisonne donc en emplacements fixes, et on demande au DOM qui occupe le
 * n-ième au moment où on en a besoin.
 */
function emplacements(rangee) {
  return casesVivantes(rangee).map((c) => c.getBoundingClientRect());
}

/** Le rang de l'emplacement sous un point de l'écran, ou -1. */
function emplacementSous(rects, x, y) {
  return rects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}

/**
 * Anime les cases qui viennent de changer de place.
 *
 * Réorganiser le DOM est INSTANTANÉ : sans ça, les badges se téléportent et on ne
 * voit pas lequel a cédé sa place. On mesure donc avant, puis on remet chaque case
 * à son ancienne position par un `transform` qu'on relâche à la frame suivante —
 * le navigateur interpole le retour à zéro (technique FLIP).
 *
 * Aucun effet hors navigateur réel (rects à zéro en jsdom) : c'est du confort
 * visuel, jamais une condition du réordonnancement.
 *
 * @param {Map<Element, DOMRect>} avant positions relevées AVANT le déplacement
 */
function animerDecalages(avant) {
  for (const [c, r0] of avant) {
    const r1 = c.getBoundingClientRect();
    const dx = r0.left - r1.left;
    const dy = r0.top - r1.top;
    if (!dx && !dy) continue;
    c.style.transition = "none";
    c.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      c.style.transition = "transform 0.16s ease";
      c.style.transform = "";
    });
  }
}

/**
 * Rend la rangée de badges épinglés réordonnable, et cliquable.
 *
 * Idempotent : appelée après chaque rendu de la rangée (le DOM est reconstruit à
 * chaque fois), elle ne pose qu'un seul jeu d'écouteurs par élément.
 *
 * @param {HTMLElement|null} rangee    conteneur des cases (#previewBadges)
 * @param {Object} profile             profil, dont `selectedBadges`
 * @param {Function} onOrdreChange     appelée avec le nouvel ordre, pour sauvegarder
 * @param {Function} [onClic]          appelée avec l'id du badge quand on le CLIQUE
 *                                     (par opposition à le glisser) — c'est ici,
 *                                     et seulement ici, qu'on sait faire la
 *                                     différence entre les deux gestes.
 */
export function initBadgeReorder(rangee, profile, onOrdreChange, onClic) {
  if (!rangee || typeof onOrdreChange !== "function") return;

  const cases = casesVivantes(rangee);
  if (!cases.length) return;

  rangee.setAttribute("role", "list");

  // Un seul badge épinglé : rien à réordonner. Il reste CLIQUABLE — voir sa
  // fiche n'a rien à voir avec le fait d'avoir des voisins.
  const reordonnable = cases.length > 1;

  cases.forEach((element) => {
    // Ceinture et bretelles : le CSS neutralise déjà le glisser natif de l'image,
    // l'attribut le dit au navigateur avant même que la feuille soit appliquée.
    element.querySelectorAll("img").forEach((i) => i.setAttribute("draggable", "false"));
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "listitem");
    if (reordonnable) {
      element.classList.add("pin-slot--movable");
      element.setAttribute("aria-roledescription", "badge réordonnable");
    }

    /** Position actuelle de cette case dans la rangée. */
    const indexActuel = () => casesVivantes(rangee).indexOf(element);

    // ── Clavier ──────────────────────────────────────────────────────────
    element.addEventListener("keydown", (e) => {
      // Entrée / Espace ouvrent la fiche, comme un clic.
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClic?.(element.dataset.badgeId);
        return;
      }
      if (!reordonnable) return;
      const gauche = e.key === "ArrowLeft";
      const droite = e.key === "ArrowRight";
      if (!gauche && !droite) return;
      e.preventDefault();
      const i = indexActuel();
      const ordre = deplacerBadge(profile.selectedBadges || [], i, i + (droite ? 1 : -1));
      if (ordre.join() !== (profile.selectedBadges || []).join()) onOrdreChange(ordre);
    });

    // ── Pointeur (souris, doigt, stylet) ─────────────────────────────────
    element.addEventListener("pointerdown", (e) => {
      // Le ✕ garde la priorité : dépingler ne doit pas devenir un glissement.
      if (e.target.closest(".pin-unpin")) return;
      if (e.button !== undefined && e.button !== 0) return;

      const departX = e.clientX;
      const departY = e.clientY;
      const depart = indexActuel();
      let glisse = false;
      let rects = null;

      const bouge = (ev) => {
        if (ev.pointerId !== e.pointerId) return; // un seul doigt à la fois
        if (!reordonnable) return;
        if (!glisse) {
          if (Math.hypot(ev.clientX - departX, ev.clientY - departY) < SEUIL_GLISSEMENT) return;
          glisse = true;
          rects = emplacements(rangee);
          element.classList.add("pin-slot--dragging");
          rangee.classList.add("pinned-slots--dragging");
        }

        const rang = emplacementSous(rects, ev.clientX, ev.clientY);
        if (rang < 0) return;
        const liste = casesVivantes(rangee);
        const sous = liste[rang];
        if (!sous || sous === element) return;

        // APERÇU EN DIRECT : le badge saisi prend la place du voisin survolé, et
        // les autres se décalent. La rangée montre donc, à tout instant, l'ordre
        // qu'elle aura si on relâche maintenant — au lieu d'un trou à interpréter.
        const positions = new Map(
          liste.filter((c) => c !== element).map((c) => [c, c.getBoundingClientRect()])
        );
        const apresSous = liste.indexOf(element) < rang;
        sous.parentNode.insertBefore(element, apresSous ? sous.nextSibling : sous);
        animerDecalages(positions);
      };

      const fin = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener("pointermove", bouge);
        window.removeEventListener("pointerup", fin);
        window.removeEventListener("pointercancel", fin);
        element.classList.remove("pin-slot--dragging");
        rangee.classList.remove("pinned-slots--dragging");
        // L'animation laisse des styles inline derrière elle ; la rangée est
        // rerendue juste après, mais pas si le badge est revenu à sa place.
        casesVivantes(rangee).forEach((c) => {
          c.style.transition = "";
          c.style.transform = "";
        });

        // Pas de glissement : c'était un CLIC. On ouvre la fiche du badge —
        // jusqu'ici, cliquer un badge épinglé ne faisait rien du tout.
        if (!glisse) {
          onClic?.(element.dataset.badgeId);
          return;
        }

        const ordre = deplacerBadge(profile.selectedBadges || [], depart, indexActuel());
        if (ordre.join() !== (profile.selectedBadges || []).join()) {
          onOrdreChange(ordre);
        } else {
          // Revenu à sa place : le DOM a bougé pour rien, on le remet d'aplomb.
          onOrdreChange([...(profile.selectedBadges || [])]);
        }
      };

      // Les écouteurs vont sur la FENÊTRE, pas sur la case. Réorganiser la rangée
      // déplace le badge saisi dans le DOM, ce qui relâche implicitement la capture
      // du pointeur : le `pointerup` arrive alors sur le badge survolé, et un
      // écouteur posé sur la case saisie ne le voit jamais — glissement perdu, rien
      // de sauvegardé, aucune erreur. Constaté avant que ce commentaire existe.
      window.addEventListener("pointermove", bouge);
      window.addEventListener("pointerup", fin);
      window.addEventListener("pointercancel", fin);
    });
  });
}
