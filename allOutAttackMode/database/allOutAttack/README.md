# Animations d'All-Out Attack — hors git

Ce dossier reçoit les `.webp` animés du mode All-Out Attack (74 fichiers, ≈ 1,8 Go).
**Ils ne sont plus suivis par git** depuis la 2.2 : ils vivent sur Cloudflare R2
(`CDN_BASE_URL` dans `../../modeAllOutAttack.js`, dossier `allOutAttack/` du bucket).

- **Prod** : servis depuis R2, toujours.
- **Local** (`localhost`, `192.168.x.x`…) : servis d'ici si le fichier existe, sinon le
  mode se replie sur R2 tout seul — un clone frais joue sans rien télécharger.
- **Jouer hors ligne / éviter le CDN en dev** : `npm run aoa:fetch` télécharge ce qui manque.
- **Avant une release** : `npm run aoa:check` vérifie que chaque animation demandée par le
  jeu est bien sur R2 (exit 1 sinon) et signale les fichiers locaux orphelins.

## Ajouter un All-Out Attack

1. Convertir la vidéo : `ffmpeg -i in.mov -vf "scale=1280:-2:flags=lanczos,fps=24"
-c:v libwebp_anim -lossless 0 -quality 80 -compression_level 6 -loop 0 -an <Nom>.webp`
2. Déposer `<Nom>.webp` **ici** (pour tester en local) **et** l'uploader sur R2 dans
   `allOutAttack/` — sans l'upload, la prod affiche le placeholder.
3. Portraits (suivis par git, `../img/`) : `<Nom>.webp` (carré) et `<Nom>_Battle.webp`.
4. Datasets : `../aoaCharacters.js`, `../personas_allOut.js`, `../portraitsMap.js`
   (la clé de l'animation est `portraitsMap[nom]`, sinon le premier mot du nom).
5. `npm run pools:build`, puis `npm run aoa:check`.
