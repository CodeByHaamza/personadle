/**
 * js/silhouette_mask.js — Noircissement d'une image DANS SES PIXELS.
 * ────────────────────────────────────────────────────────────────────────────
 * Anti-triche (2.1). Jusqu'ici la silhouette était l'image d'origine, noircie
 * par un `filter: brightness(0)` CSS. Un filtre CSS est purement décoratif :
 * il n'existe qu'au moment de peindre. « Clic droit → Copier l'image », puis
 * coller n'importe où, rendait donc le personnage à deviner — sans le moindre
 * outil, ni la moindre compétence technique.
 *
 * Ici, la couleur est écrasée dans le bitmap lui-même, hors écran, et c'est ce
 * résultat qui est donné à `<img src>`. L'original n'entre jamais dans le DOM :
 * copier ou enregistrer l'image ne rend plus qu'une forme noire.
 *
 * ⚠️ Ce que ça NE fait PAS — angles morts assumés, documentés pour qu'on ne les
 *    croie pas fermés :
 *      - l'URL du fichier d'origine reste visible dans l'onglet Réseau ;
 *      - la cible du jour reste en clair dans `localStorage`.
 *    Les fermer demanderait de rendre la silhouette côté serveur. La véritable
 *    défense de l'intégrité du classement est serveur (`api/lib/daily_target.php`,
 *    CLAUDE.md §3) ; ce module protège l'expérience du joueur honnête, pas le
 *    classement.
 *
 * Le rendu est identique au pixel près à `brightness(0)` : celui-ci met RVB à 0
 * et laisse le canal alpha intact, ce que reproduit exactement un remplissage
 * noir en `source-in`. Aucun changement visuel, seulement un changement de
 * l'endroit où le noircissement a lieu.
 */

/**
 * Rend une version noircie de `image` sous forme de data URL.
 *
 * @param   {HTMLImageElement} image - Image DÉJÀ chargée (onload passé) et de
 *                                     même origine que la page.
 * @returns {string|null} data URL PNG, ou `null` si le noircissement est
 *                        impossible — l'appelant doit alors retomber sur
 *                        l'image d'origine + le filtre CSS.
 */
export function blackenToDataURL(image) {
  const width = image?.naturalWidth || 0;
  const height = image?.naturalHeight || 0;
  // Une image de taille nulle produirait un canvas invalide (toDataURL lève).
  if (!width || !height) return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    // jsdom (et un navigateur avec le canvas désactivé) renvoie null ici.
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0, width, height);

    // `source-in` ne peint que là où le pixel de destination est opaque : la
    // couleur devient noire, l'alpha d'origine est conservé. C'est la définition
    // même de brightness(0), sans lire un seul pixel — donc sans getImageData(),
    // qui lèverait sur un canvas teinté et coûterait bien plus cher.
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // PNG et non WebP : `toDataURL('image/webp')` est ignoré silencieusement par
    // les navigateurs qui ne l'encodent pas — ils renvoient un PNG SANS le dire,
    // et on ne peut pas s'en apercevoir. Autant le demander directement. Une
    // forme noire sur fond transparent compresse de toute façon très bien.
    const url = canvas.toDataURL("image/png");

    // Un canvas teinté (image cross-origin) fait lever toDataURL, mais certains
    // moteurs renvoient plutôt la data URL vide d'un canvas 1×1 — on refuse.
    return typeof url === "string" && url.startsWith("data:image/") ? url : null;
  } catch {
    // Canvas teinté, mémoire insuffisante, canvas indisponible… Dans tous les
    // cas on préfère une partie jouable (avec le filtre CSS d'avant) à une boîte
    // vide : c'est une protection de confort, jamais un prérequis du jeu.
    return null;
  }
}
