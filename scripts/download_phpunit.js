/**
 * download_phpunit.js
 * Télécharge phpunit.phar s'il est absent — remplace `test -f || wget` dans le
 * Makefile (Unix-only, casse sous Windows natif sans Git Bash/WSL). Node est
 * déjà une dépendance obligatoire du projet, donc ce script tourne partout.
 *
 * Usage: node scripts/download_phpunit.js <fichier_cible> <url>
 *        (voir la cible $(PHPUNIT_PHAR) du Makefile)
 */

import fs from "fs";
import https from "https";

const [, , targetPath, url] = process.argv;

if (!targetPath || !url) {
  console.error("Usage: node scripts/download_phpunit.js <fichier_cible> <url>");
  process.exit(1);
}

if (fs.existsSync(targetPath)) {
  process.exit(0);
}

console.log("↓ Téléchargement de PHPUnit…");

function download(sourceUrl, destPath) {
  return new Promise((resolve, reject) => {
    https
      .get(sourceUrl, (res) => {
        // Suit les redirections (phar.phpunit.de redirige vers GitHub releases).
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          download(res.headers.location, destPath).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} en téléchargeant ${sourceUrl}`));
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

try {
  await download(url, targetPath);
} catch (e) {
  fs.rmSync(targetPath, { force: true }); // pas de fichier partiel/corrompu en cas d'échec
  console.error(`❌ Échec du téléchargement de PHPUnit : ${e.message}`);
  process.exit(1);
}
