/**
 * admin/badge_picker.js — choisir un badge dans une liste, au lieu de taper son
 * slug à la main.
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────────
 * La création d'un code événement demandait le slug du badge dans un champ
 * libre. Une faute de frappe ne se voit nulle part : le code est créé, il
 * apparaît actif dans le panneau, et il ne donnera jamais rien — le joueur qui
 * le saisit reçoit « Code mal configuré », et personne ne sait pourquoi tant
 * qu'on n'a pas relu la ligne en base.
 *
 * Le catalogue est déjà chargé par `admin/catalogs.js` pour les onglets de
 * détail utilisateur : il n'y a rien à aller chercher de plus.
 *
 * ── Ce que le sélecteur montre ──────────────────────────────────────────────
 * L'image, le nom, la catégorie et le slug — le slug parce que c'est lui qu'on
 * écrit en base et qu'un admin doit pouvoir le reconnaître, l'image parce qu'on
 * choisit un badge à l'œil.
 *
 * `admin/` est hors périmètre i18n (outil interne, français, cf. CLAUDE.md §5) :
 * les libellés sont en dur, volontairement.
 */

import { escHtml } from "./admin-api.js";

const ID_MODALE = "badgePickerModal";

/**
 * Filtre un catalogue sur une requête libre : nom, slug ou catégorie.
 *
 * Pure et exportée — c'est la seule logique du module qui puisse mal se
 * comporter, et elle se teste sans DOM.
 *
 * @param {Array<{slug:string,name_en?:string,category?:string}>} catalogue
 * @param {string} requete
 * @returns {Array} les entrées correspondantes, dans l'ordre d'origine
 */
export function filtrerBadges(catalogue, requete) {
  if (!Array.isArray(catalogue)) return [];
  const q = String(requete ?? "")
    .trim()
    .toLowerCase();
  if (!q) return [...catalogue];
  return catalogue.filter((b) => {
    const champs = [b?.slug, b?.name_en, b?.name, b?.category];
    return champs.some((c) => String(c ?? "").toLowerCase().includes(q));
  });
}

/** Ferme le sélecteur s'il est ouvert. */
export function fermerSelecteur() {
  document.getElementById(ID_MODALE)?.remove();
}

/**
 * Ouvre le sélecteur et rend le slug choisi.
 *
 * @param {Array} catalogue        badgesCatalog (admin/catalogs.js)
 * @param {string} prefixeChemin   préfixe des images, comme dans admin.js
 * @param {(slug:string) => void} onChoix
 */
export function ouvrirSelecteurBadge(catalogue, prefixeChemin, onChoix) {
  fermerSelecteur();

  const modale = document.createElement("div");
  modale.id = ID_MODALE;
  modale.className = "badge-picker";
  modale.innerHTML = `
    <div class="badge-picker__panel" role="dialog" aria-modal="true" aria-label="Choisir un badge">
      <div class="badge-picker__head">
        <strong>Choisir un badge</strong>
        <button type="button" class="badge-picker__close" aria-label="Fermer">✕</button>
      </div>
      <input class="badge-picker__search" type="search" placeholder="Filtrer par nom, slug ou catégorie…" autocomplete="off">
      <div class="badge-picker__list"></div>
      <p class="badge-picker__empty" hidden>Aucun badge ne correspond.</p>
    </div>`;

  const liste = modale.querySelector(".badge-picker__list");
  const vide = modale.querySelector(".badge-picker__empty");

  const dessiner = (entrees) => {
    vide.hidden = entrees.length > 0;
    liste.innerHTML = entrees
      .map(
        (b) => `
        <button type="button" class="badge-picker__item" data-slug="${escHtml(b.slug)}">
          <img src="${escHtml(prefixeChemin + "/" + (b.image_path ?? ""))}" alt="" loading="lazy"
               onerror="this.style.visibility='hidden'">
          <span class="badge-picker__name">${escHtml(b.name_en ?? b.slug)}</span>
          <span class="badge-picker__meta">${escHtml(b.category ?? "")} · <code>${escHtml(b.slug)}</code></span>
        </button>`
      )
      .join("");
  };

  dessiner(filtrerBadges(catalogue, ""));

  const recherche = modale.querySelector(".badge-picker__search");
  recherche.addEventListener("input", () => dessiner(filtrerBadges(catalogue, recherche.value)));

  liste.addEventListener("click", (e) => {
    const item = e.target.closest(".badge-picker__item");
    if (!item) return;
    onChoix?.(item.dataset.slug);
    fermerSelecteur();
  });

  modale.addEventListener("click", (e) => {
    if (e.target === modale || e.target.closest(".badge-picker__close")) fermerSelecteur();
  });
  modale.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fermerSelecteur();
  });

  document.body.appendChild(modale);
  recherche.focus();
}
