/**
 * Réécrit profile/avatars_data.js dans l'ordre protagoniste → cast principal →
 * personnages secondaires, en prenant scripts/avatar_census.js pour source.
 *
 * Le fichier est régénéré plutôt que retouché, puis comparé à l'ancien. Le
 * script refuse d'écrire si un portrait a DISPARU ou a changé de groupe — un
 * avatar retiré de la liste devient injouable sans que rien ne le signale. Les
 * ajouts, eux, sont le cas normal et ne sont que signalés.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { AVATAR_GROUPS } from "../profile/avatars_data.js";
import { ROSTERS } from "./avatar_census.js";

const CHEMIN = new URL("../profile/avatars_data.js", import.meta.url);

const ORDRE = { protagoniste: 0, principal: 1, secondaire: 2 };
const TITRES = {
  protagoniste: "Protagoniste(s)",
  principal: "Cast principal",
  secondaire: "Personnages secondaires",
};

const ENTETE = `// Mapping avatar → jeu. Chaque groupe est trié PROTAGONISTE, puis CAST
// PRINCIPAL, puis PERSONNAGES SECONDAIRES, et les portraits d'un même
// personnage se suivent (demande Hamza du 2026-09-22 — la galerie se parcourt à
// l'œil : on y cherche quelqu'un, pas le lot qui a livré l'image).
//
// L'ordre et le découpage viennent de \`ROSTERS\` dans scripts/avatar_census.js,
// qui sait QUI est sur chaque image — ce que les noms de fichiers ne disent pas
// de façon fiable (\`Yuki.gif\`, \`makoto_yuki.jpg\` et \`pfp_makoto.gif\` sont la
// même personne ; \`Makoto.jpg\` en est une autre). Pour déplacer un portrait,
// changer son personnage là-bas puis relancer la régénération.
//
// \`npm run avatars:census\` dit combien de portraits a chaque personnage, et
// lesquels n'en ont aucun.
export const AVATAR_GROUPS = [`;

const lignes = [ENTETE];

for (const groupe of AVATAR_GROUPS) {
  const roster = ROSTERS[groupe.game] ?? [];
  lignes.push(`  { game: "${groupe.game}", key: "${groupe.key}", avatars: [`);

  if (!roster.length) {
    // SPECIAL : détournements et crossovers, pas des portraits de personnages.
    lignes.push("    // Détournements, crossovers et images d'anniversaire — pas de roster.");
    for (const a of groupe.avatars) lignes.push(`    "${a}",`);
  } else {
    // Un roster dont une entrée porte `section` a un ordre FIGÉ : il n'est pas
    // retrié par rôle. C'est le cas de PQ, ordonné par jeu d'origine (P3 → P4 →
    // P5), verrouillé par un cas exact de tests/avatars_gallery.test.js.
    const ordreFige = roster.some((p) => p.section);
    const tries = ordreFige
      ? roster
      : [...roster].sort(
          (a, b) => ORDRE[a.role] - ORDRE[b.role] || roster.indexOf(a) - roster.indexOf(b)
        );
    let roleCourant = null;
    for (const perso of tries) {
      if (ordreFige) {
        if (perso.section) {
          lignes.push(`    // ── ${perso.section} ${"─".repeat(Math.max(2, 66 - perso.section.length))}`);
        }
      } else if (perso.role !== roleCourant) {
        roleCourant = perso.role;
        const titre = TITRES[roleCourant];
        lignes.push(`    // ── ${titre} ${"─".repeat(Math.max(2, 66 - titre.length))}`);
      }
      lignes.push(`    // ${perso.nom}`);
      for (const f of perso.fichiers) lignes.push(`    "${f}",`);
    }
  }
  lignes.push("  ] },");
}
lignes.push("];");

const nouveau = lignes.join("\n") + "\n";

// ── Garde-fou : aucune perte, groupe par groupe ────────────────────────────
const ancien = Object.fromEntries(AVATAR_GROUPS.map((g) => [g.game, [...g.avatars].sort()]));
const blocs = [...nouveau.matchAll(/\{ game: "([^"]+)"[\s\S]*?\n  \] \},/g)];
const apres = Object.fromEntries(
  blocs.map((m) => [m[1], [...m[0].matchAll(/^\s{4}"([^"]+)",$/gm)].map((x) => x[1]).sort()])
);

const surDisque = new Set(readdirSync(new URL("../img/avatar/", import.meta.url)));

// Trois mouvements possibles, et un seul est une erreur.
//
//  - AJOUT : un fichier entre dans un groupe. Cas normal d'un import, signalé.
//  - DÉPLACEMENT : un fichier quitte un groupe et réapparaît dans un autre.
//    Légitime — on corrige régulièrement un classement (un médaillon Persona Q
//    rangé par erreur dans Persona 3, par exemple). Signalé, pas bloqué.
//  - PERTE : un fichier quitte la liste ET reste sur le disque. Là c'est un
//    oubli : le portrait devient injouable sans que rien ne le signale. Bloqué.
//
// Un fichier qui quitte la liste ET a disparu du disque est un renommage ou une
// suppression volontaire ; le test de galerie vérifiera de son côté qu'aucun
// orphelin ne traîne.
const listeApres = new Set(Object.values(apres).flat());
let perteDetectee = false;
const ajouts = [];
const deplacements = [];
for (const jeu of Object.keys(ancien)) {
  const a = ancien[jeu];
  const b = apres[jeu] ?? [];
  const sortis = a.filter((x) => !b.includes(x));
  const nouveaux = b.filter((x) => !a.includes(x));

  const deplaces = sortis.filter((f) => listeApres.has(f));
  const perdus = sortis.filter((f) => !listeApres.has(f) && surDisque.has(f));

  if (perdus.length) {
    perteDetectee = true;
    console.error(
      `ERREUR ${jeu} : ${perdus.length} portrait(s) retiré(s) de la liste mais toujours sur le disque :`,
      perdus
    );
  }
  if (deplaces.length) deplacements.push(`${jeu} -${deplaces.length}`);
  if (nouveaux.length) ajouts.push(`${jeu} +${nouveaux.length}`);
}
if (perteDetectee) process.exit(1);

// Ce que le roster revendique doit exister sur le disque, sinon la galerie
// affiche un cadre vide — le test de galerie l'attraperait, autant le dire ici.
const fantomes = [...listeApres].filter((f) => !surDisque.has(f));
if (fantomes.length) {
  console.error("ERREUR : recensés mais absents de img/avatar/ :", fantomes);
  process.exit(1);
}

writeFileSync(CHEMIN, nouveau, "utf8");
if (ajouts.length) console.log("ajouts       :", ajouts.join(", "));
if (deplacements.length) console.log("deplacements :", deplacements.join(", "));
const total = Object.values(apres).reduce((n, l) => n + l.length, 0);
console.log(`avatars_data.js regenere : ${total} portraits, protagoniste -> principal -> secondaire`);
