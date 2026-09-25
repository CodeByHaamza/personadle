# -*- coding: utf-8 -*-
"""Résout les conflits du changelog dev, où chaque lot insère sa section datée.

── Le problème ───────────────────────────────────────────────────────────────
`DEV_CHANGELOG.md` se lit du plus récent au plus ancien, et chaque branche ajoute
sa section juste sous l'en-tête. Deux branches fusionnées l'une après l'autre
écrivent donc AU MÊME POINT, et git ne peut pas trancher : il rend un conflit
dont les deux côtés sont des sections complètes qu'il faut toutes les deux
garder.

── Pourquoi un script plutôt qu'une résolution à la main ─────────────────────
Parce que la résolution à la main a déjà laissé passer un marqueur : le premier
essai ne traitait que la PREMIÈRE zone de conflit du fichier, et la seconde est
partie telle quelle dans un commit de fusion. Ici on boucle jusqu'à épuisement,
on vérifie que chaque côté est bien une section datée, et on refuse d'écrire
quoi que ce soit si une seule de ces conditions n'est pas remplie.

Usage : python scripts/resolve_changelog_conflict.py <chemin du changelog>
"""
import io
import re
import sys

MOTIF = re.compile(r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [^\n]*\n", re.S)
SECTION = re.compile(r"^## 20\d\d-\d\d-\d\d — ", re.M)


def resoudre(chemin: str) -> int:
    texte = io.open(chemin, encoding="utf-8").read()
    avant = len(SECTION.findall(texte))
    zones = 0

    while True:
        m = MOTIF.search(texte)
        if not m:
            break
        notre, leur = m.group(1), m.group(2)
        for bloc, cote in ((notre, "HEAD"), (leur, "develop")):
            if not bloc.lstrip().startswith("## 20"):
                raise SystemExit(
                    f"{chemin} : zone {zones + 1}, cote {cote} n'est pas une section datee "
                    f"— resolution manuelle necessaire"
                )
        # develop d'abord : c'est la section deja fusionnee, donc la plus recente.
        texte = texte[: m.start()] + leur + "\n\n---\n\n" + notre + "\n" + texte[m.end():]
        zones += 1

    if zones == 0:
        raise SystemExit(f"{chemin} : aucun conflit a resoudre")

    restants = texte.count("<<<<<<<") + texte.count("=======") + texte.count(">>>>>>>")
    if restants:
        raise SystemExit(f"{chemin} : {restants} marqueur(s) restant(s) apres resolution")

    apres = len(SECTION.findall(texte))
    if apres < avant:
        raise SystemExit(f"{chemin} : {avant - apres} section(s) perdue(s)")

    io.open(chemin, "w", encoding="utf-8", newline="\n").write(texte)
    return zones, apres


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: resolve_changelog_conflict.py <chemin>")
    z, n = resoudre(sys.argv[1])
    print(f"{sys.argv[1]} : {z} zone(s) resolue(s), {n} sections datees")
