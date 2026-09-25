/**
 * profile/badges/badge_inspect.js — regarder un badge sans l'équiper.
 *
 * ── Pourquoi ce bouton existe ───────────────────────────────────────────────
 * Dans la grille, un clic sur un badge l'ÉPINGLE ou le DÉPINGLE. Le seul moyen
 * d'en lire la condition et la description était la bulle d'info au survol — et
 * le survol n'existe pas au doigt. Sur mobile, un joueur qui voulait simplement
 * savoir à quoi correspond un badge n'avait donc qu'une option : le toucher,
 * donc modifier ses badges épinglés pour lire une phrase.
 *
 * Un œil sur chaque carte ouvre la fiche, et ne touche à rien.
 *
 * ── Ce qui est volontairement séparé ────────────────────────────────────────
 * `construireFiche()` ne fabrique que du contenu, sans DOM ni état : c'est ce
 * qui se teste. Le reste n'est que l'ouverture et la fermeture d'un panneau.
 *
 * ── Pourquoi la modale est celle de la production ───────────────────────────
 * La première version de ce lot dessinait SA propre fiche (`.badge-inspect__*`).
 * Le jeu avait donc deux fenêtres de détail de badge : celle-ci, et la
 * `.badge-zoom-modal` que la prod affiche déjà — au déblocage d'un badge, sur le
 * profil public et sur la carte de partage. Deux habillages pour la même
 * information, selon par où on est passé.
 *
 * Retour Hamza du 2026-09-25 : c'est la modale de prod qui reste. Ce fichier
 * produit donc exactement son balisage (`.badge-zoom-modal` >
 * `.badge-zoom-content`), et `showBadgeZoom()` dans `badgesManager.js` passe
 * désormais par ici — une seule implémentation, un seul rendu.
 *
 * Deux choses lui sont ajoutées, parce que l'œil rend consultable ce que la prod
 * n'ouvrait jamais : un badge NON débloqué. Le cadenas devant la condition et
 * l'image en niveaux de gris disent cet état, qui sans eux ne se verrait pas.
 */

/** Traduit une clé i18n avec un vrai repli (cf. CLAUDE.md §5). */
function t(cle, repli) {
  const v = window.i18n?.t?.(cle);
  return v != null && v !== cle ? v : repli;
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

const ID_PANNEAU = "badgeInspectPanel";

/**
 * Contenu de la fiche d'un badge, prêt à afficher.
 *
 * Pur : ni DOM, ni i18n appliqué aux textes du badge (l'appelant fournit déjà
 * `name`, `condition` et `description` dans la langue courante). C'est ici que
 * se décide QUOI montrer selon qu'un badge est débloqué ou non — et notamment
 * qu'un badge secret verrouillé ne doit rien révéler.
 *
 * @param {object} badge        entrée de badgesList
 * @param {object} textes       { name, condition, description }
 * @param {boolean} debloque
 * @returns {{titre:string, condition:string, description:string, etat:string, secret:boolean}}
 */
export function construireFiche(badge, textes, debloque) {
  const secretVerrouille = Boolean(badge?.secret) && !debloque;

  return {
    titre: secretVerrouille ? "???" : (textes?.name ?? badge?.id ?? ""),
    // Un badge secret non débloqué ne dit NI sa condition NI sa description :
    // sinon l'œil deviendrait un moyen commode de lire toutes les réponses.
    condition: secretVerrouille ? "???" : (textes?.condition ?? ""),
    description: secretVerrouille ? "" : (textes?.description ?? ""),
    etat: debloque ? "unlocked" : "locked",
    secret: secretVerrouille,
  };
}

/** Ferme la fiche si elle est ouverte. */
export function fermerFiche() {
  document.getElementById(ID_PANNEAU)?.remove();
  document.removeEventListener("keydown", _surEchap, true);
}

function _surEchap(e) {
  if (e.key === "Escape") {
    e.stopPropagation(); // ne pas fermer AUSSI la modale des badges derrière
    fermerFiche();
  }
}

/**
 * Ouvre la fiche d'un badge, dans la modale de la production.
 *
 * Le balisage est celui de `.badge-zoom-modal` tel qu'il tourne en prod, à la
 * classe `is-locked` près (cf. en-tête) : même conteneur, même croix, même
 * ordre image / titre / condition / description, même classe `.show` posée à la
 * frame suivante pour l'animation d'entrée.
 *
 * @param {object} badge
 * @param {object} textes     { name, condition, description }
 * @param {boolean} debloque
 */
export function ouvrirFiche(badge, textes, debloque) {
  fermerFiche();
  const f = construireFiche(badge, textes, debloque);
  const verrouille = f.etat === "locked";

  const modale = document.createElement("div");
  modale.id = ID_PANNEAU;
  modale.className = "badge-zoom-modal";
  // La prod n'en met pas : elle n'ouvre cette modale qu'après un clic sur la
  // notification de déblocage. Ici elle est atteignable au clavier depuis la
  // grille, donc elle s'annonce comme un dialogue.
  modale.setAttribute("role", "dialog");
  modale.setAttribute("aria-modal", "true");
  modale.setAttribute("aria-label", f.titre);
  modale.innerHTML = `
    <div class="badge-zoom-content">
      <span class="badge-zoom-close" role="button" tabindex="0"
            aria-label="${esc(t("ui.close", "Close"))}">&times;</span>
      <img class="${verrouille ? "is-locked" : ""}"
           src="${esc(badge?.img ?? "")}" alt="${esc(f.titre)}">
      <h3>${esc(f.titre)}</h3>
      <p class="badge-condition">${verrouille ? "🔒 " : ""}${esc(f.condition)}</p>
      ${f.description ? `<p class="badge-description">${esc(f.description)}</p>` : ""}
    </div>`;

  // Clic sur le fond = fermer, mais pas un clic DANS la carte.
  modale.addEventListener("click", (e) => {
    if (e.target === modale || e.target.closest(".badge-zoom-close")) fermerFiche();
  });
  modale.querySelector(".badge-zoom-close")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fermerFiche();
    }
  });
  document.addEventListener("keydown", _surEchap, true);

  document.body.appendChild(modale);
  modale.querySelector(".badge-zoom-close")?.focus();
  // `.show` déclenche l'apparition — la poser dans la même frame que l'insertion
  // ne transitionne rien, l'élément n'a pas encore d'état de départ peint.
  requestAnimationFrame(() => modale.classList.add("show"));
}

/**
 * Pose un œil sur chaque carte de la grille.
 *
 * @param {HTMLElement|null} grille
 * @param {(id:string) => {badge:object, textes:object, debloque:boolean}|null} resoudre
 */
export function initBadgeInspect(grille, resoudre) {
  if (!grille || typeof resoudre !== "function") return;

  grille.querySelectorAll(".badge-item").forEach((carte) => {
    if (carte.querySelector(".badge-inspect-btn")) return; // déjà posé

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "badge-inspect-btn";
    bouton.textContent = "👁";
    bouton.setAttribute("aria-label", t("profile.badge_inspect", "View details"));
    bouton.title = t("profile.badge_inspect", "View details");

    // `click` ET `pointerdown` arrêtés : la carte porte un `onclick` qui épingle,
    // et sans ça regarder un badge reviendrait à le modifier — soit exactement
    // le problème que ce bouton résout.
    bouton.addEventListener("pointerdown", (e) => e.stopPropagation());
    bouton.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const donnees = resoudre(carte.dataset.id);
      if (donnees?.badge) ouvrirFiche(donnees.badge, donnees.textes, donnees.debloque);
    });

    carte.appendChild(bouton);
  });
}
