#!/usr/bin/env python3
"""
scripts/badge_thumbs.py — Miniatures des badges (2.4, retour de Hamza sur le lot 11).

Les images de badges pèsent jusqu'à 7,7 Mo pièce (111 Mo au total) pour un
affichage de 44 à 80 px. La carte « Presque là » du profil voulait la VRAIE image
du badge : on lui en donne une version réduite, même dessin, quelques Ko.

Pour chaque fichier de profile/badges/images/, écrit
profile/badges/thumbs/<nom_en_snake_case>.webp (128 px max, carré conservé).
Le nom suit badgeThumbPath() de profile/next_unlocks_ui.js — les deux doivent
rester d'accord (tests/next_unlocks_ui.test.js le vérifie sur tous les badges).

À relancer après l'ajout d'un badge :
    python scripts/badge_thumbs.py
Dépendance de dev : Pillow.
"""

import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
SRC = os.path.join(ROOT, "profile", "badges", "images")
OUT = os.path.join(ROOT, "profile", "badges", "thumbs")
SIZE = 128
QUALITY = 82


def thumb_name(filename):
    """« Badges_Burn_My_Dread_Silver.png » → « badges_burn_my_dread_silver.webp »."""
    stem = os.path.splitext(filename)[0].lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", stem)).strip("_") + ".webp"


def main():
    os.makedirs(OUT, exist_ok=True)
    total_in = total_out = 0
    names = {}
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith((".png", ".webp", ".jpg", ".jpeg", ".gif")):
            continue
        name = thumb_name(f)
        if name in names:
            sys.exit(f"collision : {f} et {names[name]} donnent {name}")
        names[name] = f
        src = os.path.join(SRC, f)
        with Image.open(src) as im:
            im.seek(0)  # image fixe : la 1re frame d'un éventuel webp animé
            im = im.convert("RGBA")
            im.thumbnail((SIZE, SIZE), Image.LANCZOS)
            dst = os.path.join(OUT, name)
            im.save(dst, "WEBP", quality=QUALITY, method=6)
        total_in += os.path.getsize(src)
        total_out += os.path.getsize(dst)
    print(f"{len(names)} miniatures : {total_in / 1e6:.1f} Mo → {total_out / 1e3:.0f} Ko")


if __name__ == "__main__":
    main()
