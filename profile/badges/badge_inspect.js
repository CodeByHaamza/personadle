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
 * Ouvre la fiche d'un badge par-dessus la grille.
 *
 * @param {object} badge
 * @param {object} textes     { name, condition, description }
 * @param {boolean} debloque
 */
export function ouvrirFiche(badge, textes, debloque) {
  fermerFiche();
  const f = construireFiche(badge, textes, debloque);

  const panneau = document.createElement("div");
  panneau.id = ID_PANNEAU;
  panneau.className = "badge-inspect";
  panneau.setAttribute("role", "dialog");
  panneau.setAttribute("aria-modal", "true");
  panneau.setAttribute("aria-label", f.titre);
  panneau.innerHTML = `
    <div class="badge-inspect__card">
      <button type="button" class="badge-inspect__close"
              aria-label="${esc(t("ui.close", "Close"))}">✕</button>
      <img class="badge-inspect__img${f.etat === "locked" ? " is-locked" : ""}"
           src="${esc(badge?.img ?? "")}" alt="${esc(f.titre)}">
      <p class="badge-inspect__name">${esc(f.titre)}</p>
      <p class="badge-inspect__state">
        ${f.etat === "unlocked" ? "🔓" : "🔒"}
        ${esc(
          f.etat === "unlocked"
            ? t("profile.badge_unlocked", "Unlocked")
            : t("profile.badge_locked", "Locked")
        )}
      </p>
      <p class="badge-inspect__condition">${esc(f.condition)}</p>
      ${f.description ? `<p class="badge-inspect__desc">${esc(f.description)}</p>` : ""}
    </div>`;

  // Clic sur le fond = fermer, mais pas un clic DANS la carte.
  panneau.addEventListener("click", (e) => {
    if (e.target === panneau || e.target.closest(".badge-inspect__close")) fermerFiche();
  });
  document.addEventListener("keydown", _surEchap, true);

  document.body.appendChild(panneau);
  panneau.querySelector(".badge-inspect__close")?.focus();
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
